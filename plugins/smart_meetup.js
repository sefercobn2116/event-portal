// plugins/smart_meetup.js
import { supabase, EMAIL_WEBHOOK_URL } from '../config.js';
import { getSessionUser } from '../modules/auth.js';

export async function initPlugin(contextId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentUser = getSessionUser();
  if (!currentUser) return;

  let selectedSlotHour = null;
  let selectedTargetUser = null;

  container.innerHTML = `
    <div style="display: grid; gap: 20px; margin-bottom: 24px;">
      
      <!-- 1. KİŞİSEL MÜSAİTLİK MATRİSİ (CYBERPUNK NEON GRID) -->
      <div class="glass-box" style="border: 1px solid rgba(0, 242, 254, 0.25); background: linear-gradient(135deg, rgba(7, 9, 19, 0.95), rgba(18, 24, 43, 0.85));">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="color: #00f2fe; margin: 0; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
              <span>📅</span> My Availability Calendar
            </h4>
            <span style="font-size: 0.76rem; color: #94a3b8;">Click slots to mark your free hours. Locked events are closed automatically.</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 0.78rem; color: #00f2fe; font-weight: 600;">Date:</label>
            <input type="date" id="my-cal-date-picker" class="input-field" style="max-width: 160px; margin-bottom: 0; padding: 6px 10px; font-size: 0.8rem;">
          </div>
        </div>

        <!-- Slot Lejantı -->
        <div style="display: flex; gap: 16px; margin-bottom: 12px; font-size: 0.72rem; color: #94a3b8;">
          <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #22c55e; display: inline-block; box-shadow: 0 0 6px #22c55e;"></span> Available (Free)</span>
          <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #f43f5e; display: inline-block; box-shadow: 0 0 6px #f43f5e;"></span> Booked / Locked</span>
          <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.15); display: inline-block;"></span> Off</span>
        </div>

        <div id="my-hours-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); gap: 8px;"></div>
      </div>

      <!-- 2. BİREBİR EŞLEŞME & AKILLI BULUŞMA MERKEZİ -->
      <div class="glass-box" style="border: 1px solid rgba(255, 0, 127, 0.3); background: linear-gradient(135deg, rgba(18, 24, 43, 0.85), rgba(7, 9, 19, 0.95));">
        <div style="margin-bottom: 14px;">
          <h4 style="color: #ff007f; margin: 0 0 4px 0; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
            <span>⚡</span> Smart 1-on-1 Hangout Matcher
          </h4>
          <span style="font-size: 0.76rem; color: #94a3b8;">Select a friend to compare calendars and discover mutual open hours.</span>
        </div>

        <!-- Filtre Seçim Barı -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #00f2fe; margin-bottom: 4px;">Choose Member:</label>
            <select id="hangout-target-user" class="input-field" style="margin-bottom: 0;">
              <option value="">Select a member...</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #00f2fe; margin-bottom: 4px;">Target Date:</label>
            <input type="date" id="hangout-date-input" class="input-field" style="margin-bottom: 0;">
          </div>
        </div>

        <button id="btn-find-mutual-slots" class="btn btn-pink" style="width: 100%; min-height: 38px; font-weight: 700; font-size: 0.85rem;">
          🔍 Scan Mutual Free Slots
        </button>

        <!-- Kesişen Saatler Listesi -->
        <div id="mutual-results-wrapper" style="display: none; margin-top: 18px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;">
          <h5 style="color: #22c55e; margin: 0 0 10px 0; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
            <span>🟢</span> Mutual Available Hours:
          </h5>
          <div id="mutual-slots-container" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
        </div>

        <!-- AŞAĞIDA AÇILAN ÖNERİ & BULUŞMA DETAY FORMU (POPUP YERİNE ŞIK KART) -->
        <div id="booking-proposal-card" style="display: none; margin-top: 16px; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.4); border-radius: 12px; padding: 16px; animation: fadeIn 0.25s ease-out;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h5 style="color: #00f2fe; margin: 0; font-size: 0.9rem;">✨ Propose Meetup Plan</h5>
            <span id="selected-hour-badge" style="background: rgba(0, 242, 254, 0.2); border: 1px solid #00f2fe; color: #00f2fe; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold;"></span>
          </div>
          <p style="color: #94a3b8; font-size: 0.76rem; margin: 0 0 10px 0;">Both of you are free at this hour. Enter activity agenda to lock calendars.</p>
          
          <input type="text" id="proposal-plan-input" class="input-field" placeholder="Activity / Spot (e.g. Coffee at Knez, Dinner, Studio Session)..." style="margin-bottom: 10px;">
          
          <div style="display: flex; gap: 8px;">
            <button id="btn-confirm-lock-meetup" class="btn" style="flex: 2; background: linear-gradient(135deg, #00f2fe, #4facfe); color: #070913; font-weight: 800; border: none; font-size: 0.82rem;">
              Confirm & Lock Both Calendars
            </button>
            <button id="btn-cancel-proposal" class="btn" style="flex: 1; border-color: rgba(255,255,255,0.2); font-size: 0.82rem;">Cancel</button>
          </div>
          <div id="proposal-action-status" style="margin-top: 8px; font-size: 0.8rem; text-align: center;"></div>
        </div>

      </div>

    </div>
  `;

  // 1. Kendi Slot Matrisini Yönet (08:00 - 23:00)
  const myDatePicker = document.getElementById('my-cal-date-picker');
  const todayStr = new Date().toISOString().split('T')[0];
  myDatePicker.value = todayStr;

  async function renderMyHoursGrid(dateStr) {
    const grid = document.getElementById('my-hours-grid');
    grid.innerHTML = '<span style="color:#94a3b8; font-size:0.75rem;">Loading slots...</span>';

    const { data: slots } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('slot_date', dateStr);

    const slotMap = new Map();
    (slots || []).forEach(s => slotMap.set(s.slot_hour, s));

    grid.innerHTML = '';
    for (let h = 8; h <= 23; h++) {
      const slot = slotMap.get(h);
      const isBooked = slot && slot.is_booked;
      const isFree = slot && !slot.is_booked;

      const hourLabel = `${h < 10 ? '0' + h : h}:00`;
      const btn = document.createElement('div');
      btn.style.cssText = `
        padding: 8px 4px; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s ease;
        display: flex; flex-direction: column; align-items: center; justify-content: center; user-select: none;
      `;

      if (isBooked) {
        btn.style.background = 'rgba(244, 63, 94, 0.15)';
        btn.style.border = '1px solid rgba(244, 63, 94, 0.5)';
        btn.style.color = '#f43f5e';
        btn.title = slot.locked_reason || 'Busy';
        btn.innerHTML = `<span style="font-weight:700; font-size:0.75rem;">${hourLabel}</span><span style="font-size:0.62rem; margin-top:2px;">🔒 Locked</span>`;
        btn.onclick = () => alert(`⚠️ Slot Locked: ${slot.locked_reason || 'Busy'}`);
      } else if (isFree) {
        btn.style.background = 'rgba(34, 197, 94, 0.2)';
        btn.style.border = '1px solid #22c55e';
        btn.style.color = '#22c55e';
        btn.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.25)';
        btn.innerHTML = `<span style="font-weight:700; font-size:0.75rem;">${hourLabel}</span><span style="font-size:0.62rem; margin-top:2px;">✓ Free</span>`;
        btn.onclick = async () => {
          await supabase.from('user_availability').delete().eq('id', slot.id);
          renderMyHoursGrid(dateStr);
        };
      } else {
        btn.style.background = 'rgba(255, 255, 255, 0.03)';
        btn.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        btn.style.color = '#64748b';
        btn.innerHTML = `<span style="font-weight:600; font-size:0.75rem;">${hourLabel}</span><span style="font-size:0.62rem; margin-top:2px;">Off</span>`;
        btn.onclick = async () => {
          await supabase.from('user_availability').insert([{
            user_id: currentUser.id,
            slot_date: dateStr,
            slot_hour: h,
            is_booked: false
          }]);
          renderMyHoursGrid(dateStr);
        };
      }
      grid.appendChild(btn);
    }
  }

  myDatePicker.onchange = () => renderMyHoursGrid(myDatePicker.value);
  renderMyHoursGrid(todayStr);

  // 2. Kullanıcı Listesini Çek
  const targetSelect = document.getElementById('hangout-target-user');
  const hDateInput = document.getElementById('hangout-date-input');
  hDateInput.value = todayStr;

  const { data: users } = await supabase.from('users').select('id, username, email').neq('id', currentUser.id);
  targetSelect.innerHTML = '<option value="">Select a member...</option>';
  (users || []).forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.username} (${u.email})`;
    targetSelect.appendChild(opt);
  });

  // 3. Karşılıklı Boş Saatleri Bul & Listele
  const resultsWrapper = document.getElementById('mutual-results-wrapper');
  const slotsContainer = document.getElementById('mutual-slots-container');
  const proposalCard = document.getElementById('booking-proposal-card');
  const hourBadge = document.getElementById('selected-hour-badge');
  const planInput = document.getElementById('proposal-plan-input');
  const statusEl = document.getElementById('proposal-action-status');

  document.getElementById('btn-find-mutual-slots').onclick = async () => {
    const targetUserId = targetSelect.value;
    const targetDate = hDateInput.value;

    if (!targetUserId || !targetDate) return alert('Please pick a member and date!');

    selectedTargetUser = (users || []).find(u => u.id == targetUserId);
    proposalCard.style.display = 'none';
    resultsWrapper.style.display = 'block';
    slotsContainer.innerHTML = '<span style="color:#94a3b8; font-size:0.8rem;">Cross-referencing schedules...</span>';

    const [{ data: mySlots }, { data: theirSlots }] = await Promise.all([
      supabase.from('user_availability').select('*').eq('user_id', currentUser.id).eq('slot_date', targetDate),
      supabase.from('user_availability').select('*').eq('user_id', targetUserId).eq('slot_date', targetDate)
    ]);

    const myFree = new Set((mySlots || []).filter(s => !s.is_booked).map(s => s.slot_hour));
    const theirFree = new Set((theirSlots || []).filter(s => !s.is_booked).map(s => s.slot_hour));

    const mutualHours = [...myFree].filter(h => theirFree.has(h)).sort((a,b) => a - b);

    slotsContainer.innerHTML = '';
    if (mutualHours.length === 0) {
      slotsContainer.innerHTML = '<span style="color:#f43f5e; font-size:0.82rem;">No mutual free slots found on this date.</span>';
      return;
    }

    mutualHours.forEach(h => {
      const hStr = `${h < 10 ? '0' + h : h}:00 - ${(h+1) < 10 ? '0' + (h+1) : (h+1)}:00`;
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.style.cssText = `
        background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; color: #22c55e;
        padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
      `;
      pill.textContent = `⏰ ${hStr}`;

      pill.onclick = () => {
        // Seçilen saati vurgula
        slotsContainer.querySelectorAll('button').forEach(b => {
          b.style.background = 'rgba(34, 197, 94, 0.15)';
          b.style.color = '#22c55e';
        });
        pill.style.background = '#22c55e';
        pill.style.color = '#070913';

        selectedSlotHour = h;
        hourBadge.textContent = hStr;
        planInput.value = '';
        statusEl.textContent = '';
        proposalCard.style.display = 'block';
        proposalCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };

      slotsContainer.appendChild(pill);
    });
  };

  document.getElementById('btn-cancel-proposal').onclick = () => {
    proposalCard.style.display = 'none';
  };

  // 4. Buluşmayı Onayla, Slotları Kapat & Mail Gönder
  document.getElementById('btn-confirm-lock-meetup').onclick = async () => {
    if (selectedSlotHour === null || !selectedTargetUser) return;

    const targetDate = hDateInput.value;
    const planText = planInput.value.trim() || 'Hangout & Catch up';
    const hStr = `${selectedSlotHour < 10 ? '0' + selectedSlotHour : selectedSlotHour}:00 - ${(selectedSlotHour+1) < 10 ? '0' + (selectedSlotHour+1) : (selectedSlotHour+1)}:00`;

    statusEl.style.color = '#00f2fe';
    statusEl.textContent = 'Locking schedules & generating calendar invites...';

    try {
      // 1. İki tarafın da takvimindeki bu saati kilitli yap
      await supabase.from('user_availability').upsert([
        {
          user_id: currentUser.id,
          slot_date: targetDate,
          slot_hour: selectedSlotHour,
          is_booked: true,
          locked_reason: `Hangout with ${selectedTargetUser.username}: ${planText}`
        },
        {
          user_id: selectedTargetUser.id,
          slot_date: targetDate,
          slot_hour: selectedSlotHour,
          is_booked: true,
          locked_reason: `Hangout with ${currentUser.username}: ${planText}`
        }
      ], { onConflict: 'user_id,slot_date,slot_hour' });

      // 2. Apps Script Webhook'una Mail & Takvim Tetiği Gönder
      if (EMAIL_WEBHOOK_URL) {
        fetch(EMAIL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'notify_meetup_confirmed',
            user1Email: currentUser.email,
            user1Name: currentUser.username,
            user2Email: selectedTargetUser.email,
            user2Name: selectedTargetUser.username,
            date: targetDate,
            slotTime: hStr,
            note: planText
          })
        }).catch(err => console.warn('Email webhook trigger error:', err));
      }

      statusEl.style.color = '#22c55e';
      statusEl.textContent = '✓ Confirmed! Both schedules are now locked and invites sent.';

      // Grid'leri yenile
      renderMyHoursGrid(myDatePicker.value);

      setTimeout(() => {
        proposalCard.style.display = 'none';
        document.getElementById('btn-find-mutual-slots').click();
      }, 2000);

    } catch (err) {
      statusEl.style.color = '#f43f5e';
      statusEl.textContent = 'Error locking slots: ' + err.message;
    }
  };
}
