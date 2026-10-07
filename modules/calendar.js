// modules/calendar.js
window.Calendar = {
  currentDate: new Date(),
  selectedDate: null,
  activeSlots: new Set(),

  init() {
    this.renderMonthView();
    this.bindEvents();
    this.subscribeRealtime();
  },

  bindEvents() {
    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');
    if (prevBtn) prevBtn.onclick = () => { this.currentDate.setMonth(this.currentDate.getMonth() - 1); this.renderMonthView(); };
    if (nextBtn) nextBtn.onclick = () => { this.currentDate.setMonth(this.currentDate.getMonth() + 1); this.renderMonthView(); };
  },

  renderMonthView() {
    const grid = document.getElementById('calendar-grid') || document.getElementById('calendar-days-container');
    const title = document.getElementById('cal-current-month') || document.getElementById('calendar-title');
    if (!grid) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    if (title) {
      title.innerText = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(this.currentDate).toUpperCase();
    }

    grid.innerHTML = '';
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < firstDayIndex; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day-cell cal-empty opacity-25';
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell = document.createElement('div');
      cell.className = `cal-day-cell p-2 text-center rounded border ${dateStr === todayStr ? 'border-info' : 'border-secondary'}`;
      cell.style.cursor = 'pointer';
      cell.innerHTML = `<span>${d}</span>`;
      
      cell.onclick = () => this.openDaySlotPicker(dateStr);
      grid.appendChild(cell);
    }
  },

  async openDaySlotPicker(dateStr) {
    this.selectedDate = dateStr;
    const user = JSON.parse(sessionStorage.getItem('nexus_user') || localStorage.getItem('nexus_user') || '{}');
    if (!user.id) return alert('Lütfen önce giriş yapın.');

    let drawer = document.getElementById('cal-slot-drawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'cal-slot-drawer';
      drawer.className = 'glass-card p-3 mt-3 border border-info rounded';
      const container = document.getElementById('calendar-module') || document.querySelector('.calendar-container') || document.body;
      container.appendChild(drawer);
    }
    drawer.style.display = 'block';

    const { data: slots } = await supabase
      .from('user_availability')
      .select('slot_hour')
      .eq('user_id', user.id)
      .eq('slot_date', dateStr);

    this.activeSlots = new Set((slots || []).map(s => s.slot_hour));
    this.renderSlotPickerUI(drawer, dateStr);
  },

  renderSlotPickerUI(drawer, dateStr) {
    drawer.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <strong class="text-info">${dateStr} — Müsaitlik Saatlerin</strong>
        <button class="btn btn-sm btn-outline-secondary py-0" onclick="document.getElementById('cal-slot-drawer').style.display='none'">✕</button>
      </div>
      <p class="small text-muted mb-2">Yeşil olan saatler profilinde "Müsait" olarak listelenir:</p>
      <div id="slot-buttons" class="d-flex flex-wrap gap-2"></div>
    `;

    const btnContainer = drawer.querySelector('#slot-buttons');
    for (let h = 8; h <= 23; h++) {
      const active = this.activeSlots.has(h);
      const btn = document.createElement('button');
      btn.className = `btn btn-sm ${active ? 'btn-success' : 'btn-outline-secondary'} py-1 px-2`;
      btn.innerText = `${String(h).padStart(2, '0')}:00`;
      btn.onclick = () => this.toggleHourSlot(h);
      btnContainer.appendChild(btn);
    }
  },

  async toggleHourSlot(hour) {
    const user = JSON.parse(sessionStorage.getItem('nexus_user') || localStorage.getItem('nexus_user') || '{}');
    if (this.activeSlots.has(hour)) {
      this.activeSlots.delete(hour);
      await supabase.from('user_availability').delete()
        .eq('user_id', user.id)
        .eq('slot_date', this.selectedDate)
        .eq('slot_hour', hour);
    } else {
      this.activeSlots.add(hour);
      await supabase.from('user_availability').upsert({
        user_id: user.id,
        slot_date: this.selectedDate,
        slot_hour: hour,
        is_booked: false
      });
    }
    const drawer = document.getElementById('cal-slot-drawer');
    if (drawer) this.renderSlotPickerUI(drawer, this.selectedDate);
  },

  subscribeRealtime() {
    supabase.channel('public:cal_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_availability' }, () => {
        if (this.selectedDate) this.openDaySlotPicker(this.selectedDate);
      })
      .subscribe();
  }
};

window.addEventListener('DOMContentLoaded', () => window.Calendar.init());
