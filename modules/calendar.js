// modules/calendar.js - İnteraktif & Canlı Takvim Modülü
window.CalendarModule = {
  currentDate: new Date(),
  selectedDate: null,
  userSlots: new Set(),

  async init(containerId = 'calendar-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.renderCalendarUI(container);
    await this.loadMonthData();
    this.setupRealtime();
  },

  renderCalendarUI(container) {
    container.innerHTML = `
      <div class="calendar-wrapper glass-card p-4">
        <div class="calendar-header d-flex justify-content-between align-items-center mb-3">
          <button class="btn btn-sm btn-outline-cyber" id="cal-prev">&lt;</button>
          <h4 id="cal-month-title" class="neon-title m-0"></h4>
          <button class="btn btn-sm btn-outline-cyber" id="cal-next">&gt;</button>
        </div>
        <div class="calendar-grid-weekdays d-grid" style="grid-template-columns: repeat(7, 1fr); text-align: center; font-weight: bold; opacity: 0.7;">
          <div>Pzt</div><div>Sal</div><div>Çar</div><div>Per</div><div>Cum</div><div>Cmt</div><div>Paz</div>
        </div>
        <div id="calendar-days-grid" class="calendar-grid-days d-grid mt-2" style="grid-template-columns: repeat(7, 1fr); gap: 6px;"></div>

        <!-- Saat Seçim Modal / Paneli -->
        <div id="slot-picker-drawer" class="mt-4 p-3 rounded glass-panel" style="display: none;">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 id="slot-picker-date" class="m-0 text-cyber"></h5>
            <button class="btn btn-sm btn-outline-secondary" onclick="CalendarModule.closeSlotPicker()">Kapat ✕</button>
          </div>
          <p class="small text-muted mb-3">Müsait olduğun saatleri yeşile çevirmek için dokun:</p>
          <div id="slot-hours-grid" class="d-flex flex-wrap gap-2"></div>
        </div>
      </div>
    `;

    document.getElementById('cal-prev').onclick = () => this.changeMonth(-1);
    document.getElementById('cal-next').onclick = () => this.changeMonth(1);
  },

  changeMonth(delta) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    this.loadMonthData();
  },

  async loadMonthData() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthTitle = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(this.currentDate);
    document.getElementById('cal-month-title').innerText = monthTitle.toUpperCase();

    const grid = document.getElementById('calendar-days-grid');
    grid.innerHTML = '';

    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Boşlukları doldur
    for (let i = 0; i < firstDayIndex; i++) {
      grid.innerHTML += `<div class="cal-empty-day p-2"></div>`;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;

      const dayCell = document.createElement('div');
      dayCell.className = `cal-day-cell text-center p-2 rounded cursor-pointer ${isToday ? 'border-cyber' : ''}`;
      dayCell.style.cursor = 'pointer';
      dayCell.innerHTML = `<span>${day}</span>`;

      dayCell.onclick = () => this.openSlotPicker(dateStr);
      grid.appendChild(dayCell);
    }
  },

  async openSlotPicker(dateStr) {
    this.selectedDate = dateStr;
    const currentUser = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (!currentUser.id) return alert('Lütfen giriş yapın.');

    document.getElementById('slot-picker-drawer').style.display = 'block';
    document.getElementById('slot-picker-date').innerText = `Tarih: ${dateStr}`;

    const { data: slots } = await supabase
      .from('user_availability')
      .select('slot_hour, is_booked')
      .eq('user_id', currentUser.id)
      .eq('slot_date', dateStr);

    this.userSlots = new Set((slots || []).map(s => s.slot_hour));
    this.renderHourSlots();
  },

  renderHourSlots() {
    const container = document.getElementById('slot-hours-grid');
    container.innerHTML = '';

    for (let h = 8; h <= 23; h++) {
      const isSelected = this.userSlots.has(h);
      const btn = document.createElement('button');
      btn.className = `btn btn-sm ${isSelected ? 'btn-success' : 'btn-outline-secondary'}`;
      btn.innerText = `${String(h).padStart(2, '0')}:00`;
      btn.onclick = () => this.toggleSlot(h);
      container.appendChild(btn);
    }
  },

  async toggleSlot(hour) {
    const currentUser = JSON.parse(localStorage.getItem('user_session') || '{}');
    const isSelected = this.userSlots.has(hour);

    if (isSelected) {
      this.userSlots.delete(hour);
      await supabase
        .from('user_availability')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('slot_date', this.selectedDate)
        .eq('slot_hour', hour);
    } else {
      this.userSlots.add(hour);
      await supabase
        .from('user_availability')
        .upsert({
          user_id: currentUser.id,
          slot_date: this.selectedDate,
          slot_hour: hour,
          is_booked: false
        });
    }
    this.renderHourSlots();
  },

  closeSlotPicker() {
    document.getElementById('slot-picker-drawer').style.display = 'none';
  },

  setupRealtime() {
    supabase
      .channel('public:user_availability')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_availability' }, () => {
        if (this.selectedDate) this.openSlotPicker(this.selectedDate);
      })
      .subscribe();
  }
};
