// modules/calendar.js
import { supabase } from '../config.js';

export const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

let currentDate = new Date();
export let activeSelectedDate = null;
export let activeSelectedSlots = [];

export function getActiveDate() {
  return activeSelectedDate;
}

export function getSelectedSlots() {
  return activeSelectedSlots;
}

export function resetSelections() {
  activeSelectedSlots = [];
  const formWrap = document.getElementById('booking-form-wrap');
  const slotsWrap = document.getElementById('selected-day-slots-wrap');
  if (formWrap) formWrap.style.display = 'none';
  if (slotsWrap) slotsWrap.style.display = 'none';
}

export async function initCalendar() {
  const mSel = document.getElementById('cal-month-select');
  const ySel = document.getElementById('cal-year-select');
  if (!mSel || !ySel) return;

  mSel.innerHTML = '';
  monthNames.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = m;
    mSel.appendChild(opt);
  });

  ySel.innerHTML = '';
  const startYear = new Date().getFullYear();
  for (let y = startYear; y < startYear + 6; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    ySel.appendChild(opt);
  }

  mSel.value = currentDate.getMonth();
  ySel.value = currentDate.getFullYear();

  mSel.onchange = () => {
    currentDate.setMonth(parseInt(mSel.value));
    renderCalendarDays();
  };

  ySel.onchange = () => {
    currentDate.setFullYear(parseInt(ySel.value));
    renderCalendarDays();
  };

  document.getElementById('cal-prev-month')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    mSel.value = currentDate.getMonth();
    ySel.value = currentDate.getFullYear();
    renderCalendarDays();
  });

  document.getElementById('cal-next-month')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    mSel.value = currentDate.getMonth();
    ySel.value = currentDate.getFullYear();
    renderCalendarDays();
  });

  await renderCalendarDays();
}

export async function renderCalendarDays() {
  const grid = document.getElementById('calendar-days-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();

  let firstDayIndex = new Date(year, month, 1).getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

  const { data: slots } = await supabase
    .from('availability_slots')
    .select('slot_date')
    .gte('slot_date', startDateStr)
    .lte('slot_date', endDateStr)
    .eq('is_active', true)
    .eq('is_booked', false);

  const slotMap = {};
  (slots || []).forEach(s => {
    slotMap[s.slot_date] = (slotMap[s.slot_date] || 0) + 1;
  });

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day-cell empty';
    grid.appendChild(emptyCell);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = slotMap[dateStr] || 0;

    const cell = document.createElement('div');
    cell.className = `cal-day-cell ${count > 0 ? 'available' : ''} ${activeSelectedDate === dateStr ? 'selected' : ''}`;
    cell.innerHTML = `
      <span>${day}</span>
      ${count > 0 ? `<span class="cal-badge-hours">${count}h</span>` : ''}
    `;

    if (count > 0) {
      cell.onclick = () => {
        document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        activeSelectedDate = dateStr;
        loadDaySlots(dateStr);
      };
    }

    grid.appendChild(cell);
  }
}

async function loadDaySlots(dateStr) {
  activeSelectedSlots = [];
  const heading = document.getElementById('selected-date-heading');
  const container = document.getElementById('hourly-slots-container');
  const slotsWrap = document.getElementById('selected-day-slots-wrap');
  const formWrap = document.getElementById('booking-form-wrap');

  if (heading) heading.textContent = `Available Hours: ${dateStr}`;
  if (container) container.innerHTML = '<p style="color: #94a3b8;">Saatler yükleniyor...</p>';
  if (slotsWrap) slotsWrap.style.display = 'block';
  if (formWrap) formWrap.style.display = 'none';

  const { data: slots } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('slot_date', dateStr)
    .eq('is_active', true)
    .eq('is_booked', false);

  if (!container) return;
  container.innerHTML = '';

  (slots || []).forEach(slot => {
    const chip = document.createElement('div');
    chip.className = 'hour-chip';
    chip.textContent = slot.hour_slot;

    chip.onclick = () => {
      chip.classList.toggle('selected');
      if (chip.classList.contains('selected')) {
        if (!activeSelectedSlots.includes(slot.hour_slot)) {
          activeSelectedSlots.push(slot.hour_slot);
        }
      } else {
        activeSelectedSlots = activeSelectedSlots.filter(s => s !== slot.hour_slot);
      }

      if (formWrap) {
        formWrap.style.display = activeSelectedSlots.length > 0 ? 'block' : 'none';
      }
    };

    container.appendChild(chip);
  });
}
