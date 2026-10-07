// plugins/smart_meetup.js
import { supabase, EMAIL_WEBHOOK_URL } from '../config.js';
import { getSessionUser } from '../modules/auth.js';

export async function initPlugin(contextId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentUser = getSessionUser();
  if (!currentUser) return;

  container.innerHTML = `
    <div class="glass-box" style="margin-bottom: 20px; border: 1px solid rgba(0, 242, 254, 0.3); background: linear-gradient(135deg, rgba(7, 9, 19, 0.95), rgba(18, 24, 43, 0.9));">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h4 style="color: #00f2fe; margin: 0; font-size: 1rem;">✨ 1-on-1 Meetup Matcher</h4>
          <span style="font-size: 0.75rem; color: #94a3b8;">Find mutual free time and auto-lock calendars</span>
        </div>
        <button id="btn-toggle-my-avail" class="btn" style="padding: 4px 12px; font-size: 0.75rem;">📅 Set My Availability</button>
      </div>

      <!-- 1. KENDİ MÜSAİTLİK AYARLAMA KUTUSU -->
      <div id="my-avail-box" style="display: none; background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; margin-bottom: 14px; border-left: 3px solid #00f2fe;">
        <h5 style="color: #00f2fe; margin: 0 0 6px 0; font-size: 0.85rem;">Pick Your Free Hours</h5>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
          <input type="date" id="avail-date-input" class="input-field" style="max-width: 160px; margin-bottom: 0;">
          <select id="avail-slot-select" class="input-field" style="max-width: 150px; margin-bottom: 0;">
            <option value="12:00 - 14:00">12:00 - 14:00 (Lunch)</option>
            <option value="14:00 - 16:00">14:00 - 16:00 (Afternoon)</option>
            <option value="18:00 - 20:00">18:00 - 20:00 (Dinner)</option>
            <option value="20:00 - 22:00">20:00 - 22:00 (Drinks / Fun)</option>
            <option value="22:00 - 02:00">22:00 - 02:00 (Night Out)</option>
            <option value="All Day (24h)">All Day (24h Full Day)</option>
          </select>
          <button id="btn-add-my-slot" class="btn btn-pink" style="padding: 0 14px; font-size: 0.8rem;">+ Add Slot</button>
        </div>
        <div id="my-active-slots" style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 0.75rem;"></div>
      </div>

      <!-- 2. BİRİYLE EŞLEŞME ALANI -->
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap;">
        <label style="font-size: 0.8rem; color: #94a3b8;">Meet with:</label>
        <select id="meet-target-user" class="input-field" style="max-width: 220px; margin-bottom: 0;">
          <option value="">Select a friend...</option>
        </select>
        <button id="btn-find-mutual" class="btn" style="padding: 6px 14px; font-size: 0.8rem;">🔍 Find Mutual Free Time</button>
      </div>

      <!-- KESİŞEN ORTAK YEŞİL SAATLER -->
      <div id="mutual-results-box" style="display: none;">
        <h5 style="color: #22c55e; margin: 10px 0 6px 0; font-size: 0.85rem;">🟢 Mutual Free Slots Found:</h5>
        <div id="mutual-slots-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;"></div>
      </div>

      <!-- BEKLEYEN TALEPLERİM -->
      <div id="pending-meetups-box" style="margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; display: none;">
        <h5 style="color: #ff007f; margin: 0 0 6px 0; font-size: 0.8rem;">Incoming Hangout Requests</h5>
        <div id="pending-meetups-list"></div>
      </div>
    </div>
  `;

  // Arkadaş listesini doldur
  const { data: users } = await supabase.from('users').select('id, username').neq('id', currentUser.id);
  const select = document.getElementById('meet-target-user');
  (users || []).forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.username;
    select.appendChild(opt);
  });

  // Müsaitlik panelini aç/kapat
  const toggleBtn = document.getElementById('btn-toggle-my-avail');
  const availBox = document.getElementById('my-avail-box');
  toggleBtn.onclick = () => {
    availBox.style.display = availBox.style.display === 'none' ? 'block' : 'none';
    loadMySlots();
  };

  async function loadMySlots() {
    const list = document.getElementById('my-active-slots');
    list.innerHTML = 'Loading your slots...';
    const { data } = await supabase.from('user_availability').select('*').eq('user_id', currentUser.id).eq('is_booked', false);
    list.innerHTML = '';
    (data || []).forEach(s => {
      const chip = document.createElement('span');
      chip.style.cssText = 'background: rgba(0,242,254,0.15); border: 1px solid #00f2fe; color: #00f2fe; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;';
      chip.innerHTML = `${s.slot_date} (${s.slot_time}) <b style="cursor:pointer; color:#f43f5e;" data-id="${s.id}">×</b>`;
      chip.querySelector('b').onclick = async () => {
        await supabase.from('user_availability').delete().eq('id', s.id);
        loadMySlots();
      };
      list.appendChild(chip);
    });
  }

  // Yeni Müsaitlik Ekle
  document.getElementById('btn-add-my-slot').onclick = async () => {
    const d = document.getElementById('avail-date-input').value;
    const t = document.getElementById('avail-slot-select').value;
    if (!d) return alert('Select a date!');
    await supabase.from('user_availability').upsert([{ user_id: currentUser.id, slot_date: d, slot_time: t, is_booked: false }]);
    loadMySlots();
  };

  // Ortak Boş Saatleri Bul (Algoritma)
  document.getElementById('btn-find-mutual').onclick = async () => {
    const targetId = document.getElementById('meet-target-user').value;
    if (!targetId) return alert('Pick a friend first!');

    const resBox = document.getElementById('mutual-results-box');
    const grid = document.getElementById('mutual-slots-grid');
    resBox.style.display = 'block';
    grid.innerHTML = '<span style="color:#94a3b8; font-size:0.8rem;">Matching calendars...</span>';

    const [{ data: mySlots }, { data: targetSlots }] = await Promise.all([
      supabase.from('user_availability').select('*').eq('user_id', currentUser.id).eq('is_booked', false),
      supabase.from('user_availability').select('*').eq('user_id', targetId).eq('is_booked', false)
    ]);

    const targetSet = new Set((targetSlots || []).map(s => `${s.slot_date}_${s.slot_time}`));
    const mutual = (mySlots || []).filter(s => targetSet.has(`${s.slot_date}_${s.slot_time}`));

    grid.innerHTML = '';
    if (mutual.length === 0) {
      grid.innerHTML = '<span style="color:#f43f5e; font-size:0.8rem;">No mutual free slots found. Try adding more availability!</span>';
      return;
    }

    mutual.forEach(m => {
      const card = document.createElement('div');
      card.style.cssText = 'background: rgba(34,197,94,0.15); border: 1px solid #22c55e; border-radius: 8px; padding: 8px; text-align: center;';
      card.innerHTML = `
        <div style="font-size:0.75rem; color:#f8fafc; font-weight:bold;">${m.slot_date}</div>
        <div style="font-size:0.8rem; color:#22c55e; font-weight:800;">${m.slot_time}</div>
        <button class="btn btn-pink" style="margin-top:6px; padding:3px 8px; font-size:0.7rem;">Send Hangout Request</button>
      `;

      card.querySelector('button').onclick = async () => {
        const note = prompt('Optional plan/note (e.g. Dinner, Drinks):', 'Hangout');
        await supabase.from('meetup_requests').insert([{
          requester_id: currentUser.id,
          target_user_id: targetId,
          slot_date: m.slot_date,
          slot_time: m.slot_time,
          note: note || 'Hangout'
        }]);

        // E-posta Bildirimi Gönder
        const { data: targetU } = await supabase.from('users').select('email, username').eq('id', targetId).single();
        if (targetU && targetU.email) {
          fetch(EMAIL_WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify({
              action: 'notify_meetup_request',
              targetEmail: targetU.email,
              requesterName: currentUser.username,
              date: m.slot_date,
              slotTime: m.slot_time,
              note: note
            })
          }).catch(e => console.warn(e));
        }

        alert('✓ Meetup request sent! They will get an email notification.');
      };

      grid.appendChild(card);
    });
  };

  // Gelen İstekleri Kontrol Et
  async function checkPending() {
    const { data: reqs } = await supabase
      .from('meetup_requests')
      .select('*, requester:users!requester_id(username, email)')
      .eq('target_user_id', currentUser.id)
      .eq('status', 'pending');

    const box = document.getElementById('pending-meetups-box');
    const list = document.getElementById('pending-meetups-list');
    if (reqs && reqs.length > 0) {
      box.style.display = 'block';
      list.innerHTML = '';
      reqs.forEach(r => {
        const row = document.createElement('div');
        row.style.cssText = 'background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;';
        row.innerHTML = `
          <div>
            <strong style="color: #00f2fe; font-size: 0.8rem;">${r.requester?.username}</strong>
            <span style="color: #94a3b8; font-size: 0.75rem; display: block;">${r.slot_date} (${r.slot_time}) • ${r.note}</span>
          </div>
          <button class="btn btn-pink" style="padding: 4px 10px; font-size: 0.72rem;">Accept & Lock Calendar</button>
        `;

        row.querySelector('button').onclick = async () => {
          // İki tarafın da takvimindeki bu saati kilitli yap
          await supabase.from('user_availability').update({ is_booked: true }).match({ slot_date: r.slot_date, slot_time: r.slot_time });
          await supabase.from('meetup_requests').update({ status: 'accepted' }).eq('id', r.id);

          // Çift taraflı onay maili + ICS takvim davetiyesi
          fetch(EMAIL_WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify({
              action: 'notify_meetup_confirmed',
              user1Email: currentUser.email,
              user1Name: currentUser.username,
              user2Email: r.requester?.email,
              user2Name: r.requester?.username,
              date: r.slot_date,
              slotTime: r.slot_time,
              note: r.note
            })
          }).catch(e => console.warn(e));

          alert('✓ Accepted! Calendar locked and invite emails sent.');
          checkPending();
        };

        list.appendChild(row);
      });
    } else {
      box.style.display = 'none';
    }
  }

  checkPending();
}
