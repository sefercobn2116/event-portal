// plugins/smart_meetup.js
import { supabase, EMAIL_WEBHOOK_URL } from '../config.js';
import { getSessionUser } from '../modules/auth.js';

let meetupChannel = null;
let availChannel = null;

export async function initPlugin(contextId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentUser = getSessionUser();
  if (!currentUser) return;

  let selectedSlotHour = null;
  let selectedTargetUser = null;

  container.innerHTML = `
    <div style="display: grid; gap: 18px; margin-bottom: 20px;">
      
      <!-- ONAYLANMIŞ BULUŞMALAR & İPTAL KARTI (MANAGE BOOKINGS) -->
      <div id="confirmed-bookings-card" class="glass-box" style="border-color: rgba(34, 197, 94, 0.35);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <h4 style="color: #22c55e; margin: 0; font-size: 0.95rem;">🗓️ Confirmed Hangouts (Manage & Cancel)</h4>
            <span style="font-size: 0.72rem; color: #94a3b8;">Canceling reopens both members' free slots and sends cancel notification.</span>
          </div>
          <button id="btn-refresh-bookings" class="btn" style="padding: 2px 8px; font-size: 0.7rem;">↻</button>
        </div>
        <div id="confirmed-bookings-list" style="display: grid; gap: 6px;"></div>
      </div>

      <!-- BEKLEYEN TALEPLER -->
      <div id="hangout-requests-card" class="glass-box" style="border-color: rgba(0, 242, 254, 0.35);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <h4 style="color: #00f2fe; margin: 0; font-size: 0.95rem;">📩 Pending Hangout Requests</h4>
            <span style="font-size: 0.72rem; color: #94a3b8;">Accepting locks calendars and emails .ics invites.</span>
          </div>
          <button id="btn-refresh-requests" class="btn" style="padding: 2px 8px; font-size: 0.7rem;">↻</button>
        </div>
        <div id="incoming-requests-list" style="display: grid; gap: 6px;"></div>
      </div>

      <!-- KİŞİSEL SAAT MATRİSİ -->
      <div class="glass-box" style="border-color: rgba(0, 242, 254, 0.25);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <h4 style="color: #00f2fe; margin: 0; font-size: 0.95rem;">📅 My Weekly Availability Matrix</h4>
          <input type="date" id="my-cal-date-picker" class="input-field" style="max-width: 150px; margin-bottom: 0; padding: 4px 8px; font-size: 0.78rem;">
        </div>
        <div id="my-hours-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 6px;"></div>
      </div>

      <!-- 1-ON-1 EŞLEŞTİRİCİ -->
      <div class="glass-box" style="border-color: rgba(255, 0, 127, 0.3);">
        <h4 style="color: #ff007f; margin: 0 0 10px 0; font-size: 0.95rem;">⚡ Smart 1-on-1 Hangout Matcher</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-bottom: 10px;">
          <select id="hangout-target-user" class="input-field" style="margin-bottom: 0;"><option value="">Pick a friend...</option></select>
          <input type="date" id="hangout-date-input" class="input-field" style="margin-bottom: 0;">
        </div>
        <button id="btn-find-mutual-slots" class="btn btn-pink" style="width: 100%; padding: 6px; font-size: 0.8rem;">🔍 Scan Mutual Free Slots</button>

        <div id="mutual-results-wrapper" style="display: none; margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
          <h5 style="color: #22c55e; margin: 0 0 8px 0; font-size: 0.8rem;">🟢 Mutual Open Hours:</h5>
          <div id="mutual-slots-container" style="display: flex; gap: 6px; flex-wrap: wrap;"></div>
        </div>

        <div id="booking-proposal-card" style="display: none; margin-top: 12px; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.4); border-radius: 8px; padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <h5 style="color: #00f2fe; margin: 0; font-size: 0.85rem;">Propose Hangout</h5>
            <span id="selected-hour-badge" style="color: #00f2fe; font-size: 0.75rem; font-weight: bold;"></span>
          </div>
          <input type="text" id="proposal-plan-input" class="input-field" placeholder="Agenda (e.g. Coffee, Dinner)..." style="margin-bottom: 8px;">
          <div style="display: flex; gap: 6px;">
            <button id="btn-send-meetup-request" class="btn" style="flex: 2; padding: 6px; font-size: 0.78rem;">Send Request</button>
            <button id="btn-cancel-proposal" class="btn" style="flex: 1; padding: 6px; font-size: 0.78rem;">Cancel</button>
          </div>
        </div>
      </div>

    </div>
  `;

  // 1. ONAYLANMIŞ BULUŞMALAR & İPTAL
  async function loadConfirmed() {
    const list = document.getElementById('confirmed-bookings-list');
    const { data: bList } = await supabase
      .from('meetup_requests')
      .select('*, requester:users!requester_id(username, email), target:users!target_user_id(username, email)')
      .or(`target_user_id.eq.${currentUser.id},requester_id.eq.${currentUser.id}`)
      .eq('status', 'accepted')
      .order('slot_date', { ascending: true });

    list.innerHTML = '';
    if (!bList || bList.length === 0) {
      list.innerHTML = '<span style="color: #64748b; font-size: 0.75rem;">No active confirmed hangouts.</span>';
      return;
    }

    bList.forEach(b => {
      const other = b.requester_id === currentUser.id ? b.target : b.requester;
      const hStr = `${b.slot_hour < 10 ? '0' + b.slot_hour : b.slot_hour}:00 - ${(b.slot_hour+1) < 10 ? '0' + (b.slot_hour+1) : (b.slot_hour+1)}:00`;
      const card = document.createElement('div');
      card.style.cssText = 'background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;';
      card.innerHTML = `
        <div>
          <strong style="color: #f8fafc; font-size: 0.85rem;">${other?.username || 'User'}</strong>
          <span style="display: block; font-size: 0.75rem; color: #94a3b8;">📅 ${b.slot_date} (⏰ ${hStr}) • ${b.note || 'Hangout'}</span>
        </div>
        <button class="btn btn-cancel-b" style="padding: 4px 8px; font-size: 0.72rem; color: #f43f5e; border-color: #f43f5e;">Cancel</button>
      `;

      card.querySelector('.btn-cancel-b').onclick = async () => {
        if (!confirm('Cancel appointment? Both calendars will reopen.')) return;
        // Slotları Boşalt
        await supabase.from('user_availability')
          .update({ is_booked: false, locked_reason: null })
          .in('user_id', [b.requester_id, b.target_user_id])
          .eq('slot_date', b.slot_date)
          .eq('slot_hour', b.slot_hour);

        await supabase.from('meetup_requests').update({ status: 'cancelled' }).eq('id', b.id);

        // İptal Maili Gönder
        fetch(EMAIL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'notify_meetup_request',
            targetEmail: other?.email,
            requesterName: currentUser.username,
            date: b.slot_date,
            slotTime: hStr,
            note: `Appointment Cancelled by ${currentUser.username}. Time slot reopened.`
          })
        }).catch(e => console.warn(e));

        loadConfirmed();
        renderMatrix(document.getElementById('my-cal-date-picker').value);
      };
      list.appendChild(card);
    });
  }
  document.getElementById('btn-refresh-bookings').onclick = loadConfirmed;
  loadConfirmed();

  // 2. BEKLEYEN TALEPLER
  async function loadPending() {
    const list = document.getElementById('incoming-requests-list');
    const { data: rList } = await supabase
      .from('meetup_requests')
      .select('*, requester:users!requester_id(username, email), target:users!target_user_id(username, email)')
      .or(`target_user_id.eq.${currentUser.id},requester_id.eq.${currentUser.id}`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    list.innerHTML = '';
    if (!rList || rList.length === 0) {
      list.innerHTML = '<span style="color: #64748b; font-size: 0.75rem;">No pending requests.</span>';
      return;
    }

    rList.forEach(r => {
      const isInc = r.target_user_id === currentUser.id;
      const other = isInc ? r.requester : r.target;
      const hStr = `${r.slot_hour < 10 ? '0' + r.slot_hour : r.slot_hour}:00 - ${(r.slot_hour+1) < 10 ? '0' + (r.slot_hour+1) : (r.slot_hour+1)}:00`;
      const card = document.createElement('div');
      card.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;';
      card.innerHTML = `
        <div>
          <span style="font-size: 0.7rem; color: ${isInc ? '#00f2fe' : '#ff007f'}; font-weight: bold;">${isInc ? '📥 Incoming' : '📤 Sent'}</span>
          <strong style="color: #f8fafc; font-size: 0.85rem; margin-left: 6px;">${other?.username || 'User'}</strong>
          <span style="display: block; font-size: 0.75rem; color: #94a3b8;">📅 ${r.slot_date} (⏰ ${hStr}) • ${r.note || 'Hangout'}</span>
        </div>
        <div style="display: flex; gap: 4px;">
          ${isInc ? `
            <button class="btn btn-acc" style="padding: 3px 8px; font-size: 0.72rem; color: #22c55e; border-color: #22c55e;">✓ Accept</button>
            <button class="btn btn-dec" style="padding: 3px 8px; font-size: 0.72rem; color: #f43f5e; border-color: #f43f5e;">✕</button>
          ` : '<span style="font-size: 0.72rem; color: #94a3b8;">Pending...</span>'}
        </div>
      `;

      if (isInc) {
        card.querySelector('.btn-acc').onclick = async () => {
          await supabase.from('user_availability').upsert([
            { user_id: r.requester_id, slot_date: r.slot_date, slot_hour: r.slot_hour, is_booked: true, locked_reason: `Hangout with ${currentUser.username}` },
            { user_id: r.target_user_id, slot_date: r.slot_date, slot_hour: r.slot_hour, is_booked: true, locked_reason: `Hangout with ${other?.username}` }
          ], { onConflict: 'user_id,slot_date,slot_hour' });

          await supabase.from('meetup_requests').update({ status: 'accepted' }).eq('id', r.id);

          // Onay ve ICS Takvim Maili
          fetch(EMAIL_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'notify_meetup_confirmed',
              user1Email: r.requester?.email,
              user1Name: r.requester?.username,
              user2Email: currentUser.email,
              user2Name: currentUser.username,
              date: r.slot_date,
              slotTime: hStr,
              note: r.note
            })
          }).catch(e => console.warn(e));

          loadPending();
          loadConfirmed();
          renderMatrix(document.getElementById('my-cal-date-picker').value);
        };

        card.querySelector('.btn-dec').onclick = async () => {
          await supabase.from('meetup_requests').update({ status: 'rejected' }).eq('id', r.id);
          loadPending();
        };
      }
      list.appendChild(card);
    });
  }
  document.getElementById('btn-refresh-requests').onclick = loadPending;
  loadPending();

  // 3. SAAT MATRİSİ
  const dateP = document.getElementById('my-cal-date-picker');
  const today = new Date().toISOString().split('T')[0];
  dateP.value = today;

  async function renderMatrix(dateStr) {
    const grid = document.getElementById('my-hours-grid');
    const { data: slots } = await supabase.from('user_availability').select('*').eq('user_id', currentUser.id).eq('slot_date', dateStr);
    const map = new Map((slots || []).map(s => [s.slot_hour, s]));

    grid.innerHTML = '';
    for (let h = 8; h <= 23; h++) {
      const s = map.get(h);
      const isBooked = s && s.is_booked;
      const isFree = s && !s.is_booked;
      const hourLabel = `${h < 10 ? '0' + h : h}:00`;
      const btn = document.createElement('div');
      btn.style.cssText = 'padding: 6px 2px; border-radius: 6px; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center;';

      if (isBooked) {
        btn.style.background = 'rgba(244, 63, 94, 0.15)';
        btn.style.border = '1px solid rgba(244, 63, 94, 0.5)';
        btn.style.color = '#f43f5e';
        btn.innerHTML = `<span style="font-weight:bold; font-size:0.75rem;">${hourLabel}</span><span style="font-size:0.6rem;">🔒 Busy</span>`;
        btn.onclick = () => alert(`Locked: ${s.locked_reason || 'Busy'}`);
      } else if (isFree) {
        btn.style.background = 'rgba(34, 197, 94, 0.2)';
        btn.style.border = '1px solid #22c55e';
        btn.style.color = '#22c55e';
        btn.innerHTML = `<span style="font-weight:bold; font-size:0.75rem;">${hourLabel}</span><span style="font-size:0.6rem;">✓ Free</span>`;
        btn.onclick = async () => {
          await supabase.from('user_availability').delete().eq('id', s.id);
          renderMatrix(dateStr);
        };
      } else {
        btn.style.background = 'rgba(255, 255, 255, 0.03)';
        btn.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        btn.style.color = '#64748b';
        btn.innerHTML = `<span style="font-size:0.75rem;">${hourLabel}</span><span style="font-size:0.6rem;">Off</span>`;
        btn.onclick = async () => {
          await supabase.from('user_availability').insert([{ user_id: currentUser.id, slot_date: dateStr, slot_hour: h, is_booked: false }]);
          renderMatrix(dateStr);
        };
      }
      grid.appendChild(btn);
    }
  }
  dateP.onchange = () => renderMatrix(dateP.value);
  renderMatrix(today);

  // 4. EŞLEŞTİRME
  const tUser = document.getElementById('hangout-target-user');
  const tDate = document.getElementById('hangout-date-input');
  tDate.value = today;

  const { data: uList } = await supabase.from('users').select('id, username, email').neq('id', currentUser.id);
  (uList || []).forEach(u => {
    tUser.innerHTML += `<option value="${u.id}">${u.username} (${u.email})</option>`;
  });

  const resWrap = document.getElementById('mutual-results-wrapper');
  const sContainer = document.getElementById('mutual-slots-container');
  const pCard = document.getElementById('booking-proposal-card');
  const hBadge = document.getElementById('selected-hour-badge');
  const pInput = document.getElementById('proposal-plan-input');

  document.getElementById('btn-find-mutual-slots').onclick = async () => {
    const targetId = tUser.value;
    const dateVal = tDate.value;
    if (!targetId || !dateVal) return alert('Select user & date');

    selectedTargetUser = (uList || []).find(u => u.id == targetId);
    pCard.style.display = 'none';
    resWrap.style.display = 'block';

    const [{ data: myS }, { data: theirS }] = await Promise.all([
      supabase.from('user_availability').select('*').eq('user_id', currentUser.id).eq('slot_date', dateVal),
      supabase.from('user_availability').select('*').eq('user_id', targetId).eq('slot_date', dateVal)
    ]);

    const myFree = new Set((myS || []).filter(s => !s.is_booked).map(s => s.slot_hour));
    const theirFree = new Set((theirS || []).filter(s => !s.is_booked).map(s => s.slot_hour));
    const mutual = [...myFree].filter(h => theirFree.has(h)).sort((a,b) => a - b);

    sContainer.innerHTML = '';
    if (mutual.length === 0) {
      sContainer.innerHTML = '<span style="color:#f43f5e; font-size:0.75rem;">No mutual free hours.</span>';
      return;
    }

    mutual.forEach(h => {
      const hStr = `${h < 10 ? '0' + h : h}:00 - ${(h+1) < 10 ? '0' + (h+1) : (h+1)}:00`;
      const pill = document.createElement('button');
      pill.className = 'btn';
      pill.style.cssText = 'padding: 4px 10px; font-size: 0.75rem; color: #22c55e; border-color: #22c55e;';
      pill.textContent = `⏰ ${hStr}`;
      pill.onclick = () => {
        selectedSlotHour = h;
        hBadge.textContent = hStr;
        pCard.style.display = 'block';
      };
      sContainer.appendChild(pill);
    });
  };

  document.getElementById('btn-cancel-proposal').onclick = () => pCard.style.display = 'none';

  document.getElementById('btn-send-meetup-request').onclick = async () => {
    if (selectedSlotHour === null || !selectedTargetUser) return;
    const dateVal = tDate.value;
    const plan = pInput.value.trim() || 'Hangout';
    const hStr = `${selectedSlotHour < 10 ? '0' + selectedSlotHour : selectedSlotHour}:00 - ${(selectedSlotHour+1) < 10 ? '0' + (selectedSlotHour+1) : (selectedSlotHour+1)}:00`;

    await supabase.from('meetup_requests').insert([{
      requester_id: currentUser.id,
      target_user_id: selectedTargetUser.id,
      slot_date: dateVal,
      slot_hour: selectedSlotHour,
      note: plan,
      status: 'pending'
    }]);

    // Davet Maili Gönder
    fetch(EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'notify_meetup_request',
        targetEmail: selectedTargetUser.email,
        requesterName: currentUser.username,
        date: dateVal,
        slotTime: hStr,
        note: plan
      })
    }).catch(e => console.warn(e));

    pCard.style.display = 'none';
    alert('✓ Request sent!');
    loadPending();
  };

  // Realtime Dinleyiciler
  if (meetupChannel) supabase.removeChannel(meetupChannel);
  meetupChannel = supabase.channel('meetups_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meetup_requests' }, () => {
      loadPending();
      loadConfirmed();
    }).subscribe();

  if (availChannel) supabase.removeChannel(availChannel);
  availChannel = supabase.channel('avail_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_availability' }, () => {
      renderMatrix(dateP.value);
    }).subscribe();
}
