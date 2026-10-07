// modules/expenses.js - Live Shared Expenses Pool
window.ExpensesModule = {
  eventId: null,

  async init(eventId, containerId = 'expenses-container') {
    this.eventId = eventId;
    const container = document.getElementById(containerId);
    if (!container) return;

    this.renderUI(container);
    await this.fetchExpenses();
    this.setupRealtime();
  },

  renderUI(container) {
    container.innerHTML = `
      <div class="expenses-panel glass-card p-3">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="neon-title m-0">💸 Shared Expenses Pool</h5>
          <span id="total-pool-badge" class="badge bg-success fs-6">0.00 TL</span>
        </div>
        <div class="row g-2 mb-3">
          <div class="col-7">
            <input type="text" id="expense-desc" class="form-control form-control-sm bg-dark text-white border-cyber" placeholder="Açıklama (Örn: Mangal eti)">
          </div>
          <div class="col-3">
            <input type="number" id="expense-amount" class="form-control form-control-sm bg-dark text-white border-cyber" placeholder="Tutar">
          </div>
          <div class="col-2">
            <button class="btn btn-sm btn-cyber w-100" id="btn-add-expense">+</button>
          </div>
        </div>
        <ul id="expense-list" class="list-group list-group-flush gap-2"></ul>
      </div>
    `;

    document.getElementById('btn-add-expense').onclick = () => this.addExpense();
  },

  async fetchExpenses() {
    const { data: expenses } = await supabase
      .from('event_expenses')
      .select('*, users(username)')
      .eq('event_id', this.eventId)
      .order('id', { ascending: false });

    this.renderExpenses(expenses || []);
  },

  renderExpenses(expenses) {
    const list = document.getElementById('expense-list');
    const badge = document.getElementById('total-pool-badge');
    if (!list) return;

    let total = 0;
    list.innerHTML = expenses.length === 0 ? `<li class="text-muted small">Kayıtlı masraf yok.</li>` : '';

    expenses.forEach(e => {
      total += parseFloat(e.amount || 0);
      list.innerHTML += `
        <li class="list-group-item bg-dark border-secondary d-flex justify-content-between align-items-center text-white rounded">
          <div>
            <strong>${e.description}</strong>
            <small class="d-block text-muted">Ödeyen: ${e.users ? e.users.username : 'Bilinmiyor'}</small>
          </div>
          <span class="badge bg-primary fs-6">${parseFloat(e.amount).toFixed(2)}</span>
        </li>
      `;
    });

    if (badge) badge.innerText = `${total.toFixed(2)} TL`;
  },

  async addExpense() {
    const desc = document.getElementById('expense-desc').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const currentUser = JSON.parse(localStorage.getItem('user_session') || '{}');

    if (!desc || isNaN(amount) || amount <= 0) return alert('Geçerli bir harcama giriniz.');

    await supabase.from('event_expenses').insert({
      event_id: this.eventId,
      paid_by: currentUser.id,
      description: desc,
      amount: amount
    });

    document.getElementById('expense-desc').value = '';
    document.getElementById('expense-amount').value = '';
  },

  setupRealtime() {
    supabase
      .channel('public:event_expenses_' + this.eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_expenses', filter: `event_id=eq.${this.eventId}` }, () => {
        this.fetchExpenses();
      })
      .subscribe();
  }
};
