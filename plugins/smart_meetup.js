// plugins/smart_meetup.js
import { supabase, EMAIL_WEBHOOK_URL } from '../config.js';
import { getSessionUser } from '../modules/auth.js';

export async function initPlugin(contextId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentUser = getSessionUser();
  if (!currentUser) return;

  container.innerHTML = `
    <!-- 1. BİREBİR BULUŞMA BUTONU & MODAL TETİKLEYİCİSİ -->
    <div class="glass-box" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border: 1px solid rgba(0, 242, 254, 0.3);">
      <div>
        <h4 style="color: #00f2fe; margin: 0 0 4px 0; font-size: 1.05rem;">⚡ 1-on-1 Hangout Matcher</h4>
        <span style="font-size: 0.8rem; color: #94a3b8;">Compare schedules & instantly book mutual free hours without overlap.</span>
      </div>
      <button id="btn-open-hangout-modal" class="btn btn-pink" style="padding: 8px 18px; font-weight: 700; font-size: 0.85rem;">
        🤝 Plan 1-on-1 Hangout
      </button>
    </div>

    <!-- 2. PROFİL İÇİ KİŞİSEL SAAT SLOT MATRİSİ -->
    <div class="glass-box" style="margin-bottom: 20px; border: 1px solid rgba(255, 0, 127, 0.25);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <h4 style="color: #ff007f; margin: 0; font-size: 0.95rem;">📅 My Weekly Availability Matrix</h4>
        <span style="font-size: 0.75rem; color: #94a3b8;">Click hours to mark yourself FREE (Green). Locked slots (Red) cannot conflict.</span>
      </div>
      
      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px;">
        <label style="font-size: 0.78rem; color: #00f2fe;">Select Date:</label>
        <input type="date" id="my-cal-date-picker" class="input-field" style="max-width: 170px; margin-bottom: 0;">
      </div>

      <div id="my-hours-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: 6px;"></div>
      <div id="my-cal-save-status" style="margin-top: 8px; font-size: 0.75rem; text-align: right; color: #22c55e;"></div>
    </div>

    <!-- 3. HANGOUT PLANLAMA POPUP MODALI -->
    <div id="hangout-modal" class="lightbox-overlay" style="display: none;">
      <div class="glass-box" style="max-width: 440px; width: 90%; position: relative;">
        <button id="btn-close-hangout-modal" style="position: absolute; top: 12px; right: 14px; background: none; border: none; color: #fff; font-size: 1.4rem; cursor: pointer;">✕</button>
        <h3 style="color: #00f2fe; margin: 0 0 6px 0;">Plan 1-on-1 Hangout</h3>
        <p style="color: #94a3b8; font-size: 0.8rem; margin: 0 0 14px 0;">Pick a friend to compare schedules and find mutual open slots.</p>

        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 0.75rem; color: #00f2fe; margin-bottom: 4px;">Choose Member:</label>
          <select id="hangout-target-user" class="input-field" style="margin-bottom: 0;">
            <option value="">Select a member...</option>
          </select>
        </div>

        <div style="margin-bottom: 14px;">
          <label style="display: block; font-size: 0.75rem; color: #00f2fe; margin-bottom: 4px;">Target Date:</label>
          <input type="date" id="hangout-date-input" class="input-field" style="margin-bottom: 0;">
        </div>

        <button id="btn-check-mutual-hours" class="btn" style="width: 100%; margin-bottom: 14px;">Find Mutual Free Hours</button>

        <div id="hangout-results-area" style="display: none;">
          <h5 style="color: #22c55e; margin: 0 0 8px 0; font-size: 0.85rem;">🟢 Available Mutual Hours:</h5>
          <div id="mutual-hours-buttons" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; max-height: 160px; overflow-y: auto;"></div>
        </div>
        
        <div id="hangout-action-status" style="margin-top: 10px; font-size: 0.8rem; text-align: center;"></div>
      </div>
    </div>
  `;

  // 1. Profil Takvimi Slot Mantığı (Saat 08:00 - 24:00)
  const datePicker = document.getElementById('my-cal-date-picker');
  const todayStr = new Date().toISOString().split('T')[0];
  datePicker.value = todayStr;

  async function renderMyHoursGrid(selectedDate) {
    const grid = document.getElementById('my-hours-grid');
    grid.innerHTML = '<span style="color:#94a3b8; font-size:0.75rem;">Loading slots...</span>';

    // Kullanıcının o gündeki mevcut kayıtlarını çek
    const { data: slots } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('slot_date', selectedDate);

    const slotMap = new Map();
    (slots || []).forEach(s => slotMap.set(s.slot_hour, s));

    grid.innerHTML = '';
    for (let h = 8; h <= 23; h++) {
      const slot = slotMap.get(h);
      const isBooked = slot && slot.is_booked;
      const isAvailable = slot && !slot.is_booked;

      const hourLabel = `${h < 10 ? '0' + h : h}:00`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = `padding: 8px 4px; font-size: 0.75rem; border-radius: 6px; cursor: pointer; text-align: center; border: 1px solid; transition: all 0.15s;`;

      if (isBooked) {
        btn.style.background = 'rgba(244, 63, 94, 0.2)';
        btn.style.borderColor = '#f43f5e';
        btn.style.color = '#f43f5e';
        btn.title = slot.locked_reason || 'Busy / Booked';
        btn.innerHTML = `${hourLabel}<br><span style="font-size:0.6rem;">🔒 Busy</span>`;
        btn.onclick = () => alert(`⚠️ This slot is locked: ${slot.locked_reason || 'Busy'}`);
      } else if (isAvailable) {
        btn.style.background = 'rgba(34, 197, 94, 0.25)';
        btn.style.borderColor = '#22c55e';
        btn.style.color = '#22c55e';
        btn.innerHTML = `${hourLabel}<br><span style="font-size:0.6rem;">✓ Free</span>`;
        btn.onclick = async () => {
          await supabase.from('user_availability').delete().eq('id', slot.id);
          renderMyHoursGrid(selectedDate);
        };
      } else {
        btn.style.background = 'rgba(255, 255, 255, 0.03)';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        btn.style.color = '#94a3b8';
        btn.innerHTML = `${hourLabel}<br><span style="font-size:0.6rem;">- Off</span>`;
        btn.onclick = async () => {
          await supabase.from('user_availability').insert([{
            user_id: currentUser.id,
            slot_date: selectedDate,
            slot_hour: h,
            is_booked: false
          }]);
          renderMyHoursGrid(selectedDate);
        };
      }
      grid.appendChild(btn);
    }
  }

  datePicker.onchange = () => renderMyHoursGrid(datePicker.value);
  renderMyHoursGrid(todayStr);

  // 2. Hangout Modal Mantığı
  const modal = document.getElementById('hangout-modal');
  const openModalBtn = document.getElementById('btn-open-hangout-modal');
  const closeModalBtn = document.getElementById('btn-close-hangout-modal');
  const targetSelect = document.getElementById('hangout-target-user');
  const hDateInput = document.getElementById('hangout-date-input');
  hDateInput.value = todayStr;

  openModalBtn.onclick = async () => {
    modal.style.display = 'flex';
    const { data: users } = await supabase.from('users').select('id, username').neq('id', currentUser.id);
    targetSelect.innerHTML = '<option value="">Select a member...</option>';
    (users || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.username;
      targetSelect.appendChild(opt);
    });
  };

  closeModalBtn.onclick = () => modal.style.display = 'none';

  // 3. Karşılıklı Boş Saatleri Hesapla & Çakışmayı Önle
  document.getElementById('btn-check-mutual-hours').onclick = async () => {
    const targetUserId = targetSelect.value;
    const dateVal = hDateInput.value;
    const resultsArea = document.getElementById('hangout-results-area');
    const buttonsWrap = document.getElementById('mutual-hours-buttons');
    const statusEl = document.getElementById('hangout-action-status');

    if (!targetUserId || !dateVal) return alert('Please choose member and date!');

    resultsArea.style.display = 'block';
    buttonsWrap.innerHTML = '<span style="color:#94a3b8; font-size:0.75rem;">Scanning calendars...</span>';
    statusEl.textContent = '';

    const [{ data: mySlots }, { data: targetSlots }] = await Promise.all([
      supabase.from('user_availability').select('*').eq('user_id', currentUser.id).eq('slot_date', dateVal),
      supabase.from('user_availability').select('*').eq('user_id', targetUserId).eq('slot_date', dateVal)
    ]);

    const myFreeSet = new Set((mySlots || []).filter(s => !s.is_booked).map(s => s.slot_hour));
    const targetFreeSet = new Set((targetSlots || []).filter(s => !s.is_booked).map(s => s.slot_hour));

    // Kesişen saatler
    const mutualHours = [...myFreeSet].filter(h => targetFreeSet.has(h)).sort((a,b) => a - b);

    buttonsWrap.innerHTML = '';
    if (mutualHours.length === 0) {
      buttonsWrap.innerHTML = '<span style="color:#f43f5e; font-size:0.8rem; grid-column: 1/-1;">No mutual free hours on this date.</span>';
      return;
    }

    mutualHours.forEach(h => {
      const hStr = `${h < 10 ? '0' + h : h}:00 - ${(h+1) < 10 ? '0' + (h+1) : (h+1)}:00`;
      const b = document.createElement('button');
      b.className = 'btn';
      b.style.cssText = 'padding: 6px; font-size: 0.75rem; border-color: #22c55e; color: #22c55e;';
      b.textContent = hStr;

      b.onclick = async () => {
        const note = prompt(`Book hangout for ${hStr}? Enter plan (e.g. Coffee, Dinner):`, 'Coffee & Catch up');
        if (!note) return;

        b.disabled = true;
        statusEl.style.color = '#00f2fe';
        statusEl.textContent = 'Locking calendars & notifying friend...';

        // 1. İki tarafın da o saatini kilitli yap (Çakışmayı önler)
        await supabase.from('user_availability').upsert([
          { user_id: currentUser.id, slot_date: dateVal, slot_hour: h, is_booked: true, locked_reason: `Hangout with friend: ${note}` },
          { user_id: targetUserId, slot_date: dateVal, slot_hour: h, is_booked: true, locked_reason: `Hangout with ${currentUser.username}: ${note}` }
        ]);

        // 2. Bildirim E-postası Uçur
        const { data: targetUser } = await supabase.from('users').select('email, username').eq('id', targetUserId).single();
        if (targetUser && targetUser.email) {
          fetch(EMAIL_WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify({
              action: 'notify_meetup_confirmed',
              user1Email: currentUser.email,
              user1Name: currentUser.username,
              user2Email: targetUser.email,
              user2Name: targetUser.username,
              date: dateVal,
              slotTime: hStr,
              note: note
            })
          }).catch(e => console.warn(e));
        }

        statusEl.style.color = '#22c55e';
        statusEl.textContent = '✓ Confirmed! Calendars locked and emails sent.';
        renderMyHoursGrid(datePicker.value);
        setTimeout(() => modal.style.display = 'none', 1800);
      };

      buttonsWrap.appendChild(b);
    });
  };
}
