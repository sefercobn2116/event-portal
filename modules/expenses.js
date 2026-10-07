// modules/expenses.js
window.Expenses = {
  eventId: null,
  channel: null,

  async init(eventId) {
    this.eventId = eventId;
    const container = document.getElementById('module-expenses') || document.getElementById('expenses-container');
    if (!container) return;

    container.innerHTML = `
      <div class="expenses-wrapper glass-panel p-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="text-cyber m-0">💸 Shared Expenses Pool</h6>
          <span id="expenses-total-badge" class="badge bg-success">0.00 TL</span>
        </div>
        <div class="input-group input-group-sm mb-3">
          <input type="text" id="exp-input-desc" class="form-control bg-dark text-white border-secondary" placeholder="Harcama açıklaması">
          <input type="number" id="exp-input-amount" class="form-control bg-dark text-white border-secondary" placeholder="Tutar" style="max-width: 90px;">
          <button class="btn btn-outline-info" onclick="Expenses.addExpense()">Ekle</button>
        </div>
        <div id="expenses-items-list" class="d-flex flex-column gap-2" style="max-height: 240px; overflow-y: auto;"></div>
      </div>
    `;

    await this.loadExpenses();
    this.listen();
  },

  async loadExpenses() {
    const list = document.getElementById('expenses-items-list');
    const badge = document.getElementById('expenses-total-badge');
    if (!list) return;

    const { data: expenses } = await supabase
      .from('event_expenses')
      .select('*, users(username)')
      .eq('event_id', this.eventId)
      .order('id', { ascending: false });

    let total = 0;
    list.innerHTML = (expenses || []).length === 0 ? '<small class="text-muted">Kayıtlı harcama yok.</small>' : '';

    (expenses || []).forEach(e => {
      total += parseFloat(e.amount || 0);
      list.innerHTML += `
        <div class="d-flex justify-content-between align-items-center bg-dark p-2 rounded border border-secondary">
          <div>
            <strong>${e.description}</strong>
            <small class="d-block text-muted">Ödeyen: ${e.users?.username || 'Bilinmiyor'}</small>
          </div>
          <span class="badge bg-primary fs-6">${parseFloat(e.amount).toFixed(2)}</span>
        </div>
      `;
    });

    if (badge) badge.innerText = `${total.toFixed(2)} TL`;
  },

  async addExpense() {
    const desc = document.getElementById('exp-input-desc').value.trim();
    const amount = parseFloat(document.getElementById('exp-input-amount').value);
    const user = JSON.parse(sessionStorage.getItem('nexus_user') || localStorage.getItem('nexus_user') || '{}');

    if (!desc || isNaN(amount) || amount <= 0) return alert('Lütfen geçerli harcama giriniz.');

    await supabase.from('event_expenses').insert({
      event_id: this.eventId,
      paid_by: user.id,
      description: desc,
      amount: amount
    });

    document.getElementById('exp-input-desc').value = '';
    document.getElementById('exp-input-amount').value = '';
    this.loadExpenses();
  },

  listen() {
    if (this.channel) supabase.removeChannel(this.channel);
    this.channel = supabase.channel('expenses_live_' + this.eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_expenses', filter: `event_id=eq.${this.eventId}` }, () => {
        this.loadExpenses();
      })
      .subscribe();
  }
};
