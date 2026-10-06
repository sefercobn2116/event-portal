// modules/calendar.js
import { supabase } from '../config.js';

export const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

let currentDate = new Date();
export let selectedSlotDate = null;
export let selectedSlots = new Set();

export async function initCalendar() {
  const mSelect = document.getElementById('cal-month-select');
  const ySelect = document.getElementById('cal-year-select');

  if (mSelect && ySelect) {
    mSelect.innerHTML = '';
    monthNames.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = m;
      mSelect.appendChild(opt);
    });

    ySelect.innerHTML = '';
    for (let yr = 2026; yr <= 2032; yr++) {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = yr;
      ySelect.appendChild(opt);
    }

    mSelect.value = currentDate.getMonth();
    ySelect.value = currentDate.getFullYear();

    mSelect.onchange = () => {
      currentDate.setMonth(parseInt(mSelect.value));
      renderCalendar();
    };

    ySelect.onchange = () => {
      currentDate.setFullYear(parseInt(ySelect.value));
      renderCalendar();
    };

    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');
    if (prevBtn) prevBtn.onclick = () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      mSelect.value = currentDate.getMonth();
      ySelect.value = currentDate.getFullYear();
      renderCalendar();
    };
    if (nextBtn) nextBtn.onclick = () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      mSelect.value = currentDate.getMonth();
      ySelect.value = currentDate.getFullYear();
      renderCalendar();
    };
  }

  await renderCalendar();
}

export async function renderCalendar() {
  const grid = document.getElementById('calendar-days-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const yr = currentDate.getFullYear();
  const mo = currentDate.getMonth();
  const totalDays = new Date(yr, mo + 1, 0).getDate();
  
  let startDay = new Date(yr, mo, 1).getDay() - 1;
  if (startDay === -1) startDay = 6;

  const startIso = `${yr}-${String(mo + 1).padStart(2, '0')}-01`;
  const endIso = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

  const { data: slots } = await supabase
    .from('availability_slots')
    .select('slot_date, is_active, is_booked')
    .gte('slot_date', startIso)
    .lte('slot_date', endIso)
    .eq('is_active', true);

  const slotCountMap = {};
  (slots || []).forEach(s => {
    if (!s.is_booked) {
      slotCountMap[s.slot_date] = (slotCountMap[s.slot_date] || 0) + 1;
    }
  });

  for (let i = 0; i < startDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day-cell empty';
    grid.appendChild(emptyCell);
  }

  for (let d = 1; d <= totalDays; d++) {
    const dStr = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const availableCount = slotCountMap[dStr] || 0;

    const cell = document.createElement('div');
    cell.className = `cal-day-cell ${availableCount > 0 ? 'available' : ''} ${selectedSlotDate === dStr ? 'selected' : ''}`;
    
    cell.innerHTML = `
      <span>${d}</span>
      ${availableCount > 0 ? `<span class="cal-badge-hours">${availableCount}h</span>` : ''}
    `;

    cell.onclick = () => {
      document.querySelectorAll('#calendar-days-grid .cal-day-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      loadHourlySlotsForDay(dStr);
    };

    grid.appendChild(cell);
  }
}

async function loadHourlySlotsForDay(dateStr) {
  selectedSlotDate = dateStr;
  selectedSlots.clear();

  const wrap = document.getElementById('selected-day-slots-wrap');
  const heading = document.getElementById('selected-date-heading');
  const container = document.getElementById('hourly-slots-container');
  const formWrap = document.getElementById('booking-form-wrap');

  if (wrap) wrap.style.display = 'block';
  if (heading) heading.textContent = `Available Hours: ${dateStr}`;
  if (container) container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem;">Loading hours...</p>';
  if (formWrap) formWrap.style.display = 'none';

  const { data: slots } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('slot_date', dateStr)
    .order('hour_slot', { ascending: true });

  if (!slots || slots.length === 0) {
    container.innerHTML = '<p style="color: #64748b; font-size: 0.85rem;">No available slots set for this day.</p>';
    return;
  }

  container.innerHTML = '';
  slots.forEach(slot => {
    const btn = document.createElement('div');
    btn.className = 'slot-btn';
    btn.textContent = slot.hour_slot;

    if (slot.is_booked) {
      btn.classList.add('booked');
      btn.title = 'Already booked';
    } else {
      btn.onclick = () => {
        if (selectedSlots.has(slot.hour_slot)) {
          selectedSlots.delete(slot.hour_slot);
          btn.classList.remove('active');
        } else {
          selectedSlots.add(slot.hour_slot);
          btn.classList.add('active');
        }

        if (formWrap) {
          formWrap.style.display = selectedSlots.size > 0 ? 'block' : 'none';
        }
      };
    }

    container.appendChild(btn);
  });
}
