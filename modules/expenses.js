// modules/expenses.js
import { supabase } from '../config.js';
import { getSessionUser } from './auth.js';

let activeExpenseChannel = null;

export async function initEventExpenses(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (activeExpenseChannel) {
    supabase.removeChannel(activeExpenseChannel);
    activeExpenseChannel = null;
  }

  container.innerHTML = '<p style="color: #00f2fe; font-size: 0.85rem;">Loading expense pool...</p>';

  await renderExpensesUI(eventId, containerId);

  // Realtime güncellemeleri dinle
  activeExpenseChannel = supabase
    .channel(`realtime_expenses_${eventId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'event_expenses',
      filter: `event_id=eq.${eventId}`
    }, () => {
      renderExpensesUI(eventId, containerId);
    })
    .subscribe();
}

async function renderExpensesUI(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = getSessionUser();
  const isAdmin = user && (user.is_admin || user.role === 'admin');

  // 1. Etkinliğe erişimi olan tüm kullanıcıları çek (Bölüşüm hesabı için)
  const [{ data: expenses }, { data: accessList }] = await Promise.all([
    supabase.from('event_expenses').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabase.from('event_access').select('user_id, users(id, username)').eq('event_id', eventId)
  ]);

  const items = expenses || [];
  
  // Katılımcı listesi (etkinliğe kayıtlı herkes + harcama yapanlar)
  const participantMap = new Map();
  (accessList || []).forEach(a => {
    if (a.users) participantMap.set(a.users.username, a.users.id);
  });
  if (user) participantMap.set(user.username, user.id);
  items.forEach(it => {
    if (it.payer_name && !participantMap.has(it.payer_name)) {
      participantMap.set(it.payer_name, it.user_id);
    }
  });

  const memberNames = Array.from(participantMap.keys());
  const memberCount = Math.max(memberNames.length, 1);

  // 2. Matematiksel Hesap
  let totalPool = 0;
  const paidBy = {};
  memberNames.forEach(m => { paidBy[m] = 0; });

  items.forEach(it => {
    const val = parseFloat(it.amount) || 0;
    totalPool += val;
    paidBy[it.payer_name] = (paidBy[it.payer_name] || 0) + val;
  });

  const sharePerPerson = totalPool / memberCount;

  // 3. Arayüzü Çiz
  container.innerHTML = `
    <!-- Özet Panosu -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px;">
      <div style="background: rgba(0,242,254,0.08); border: 1px solid rgba(0,242,254,0.3); border-radius: 8px; padding: 10px; text-align: center;">
        <span style="font-size: 0.75rem; color: #94a3b8; display: block;">Total Expenses</span>
        <strong style="color: #00f2fe; font-size: 1.15rem;">${totalPool.toFixed(2)} €</strong>
      </div>
      <div style="background: rgba(255,0,127,0.08); border: 1px solid rgba(255,0,127,0.3); border-radius: 8px; padding: 10px; text-align: center;">
        <span style="font-size: 0.75rem; color: #94a3b8; display: block;">Per Person (${memberCount} Members)</span>
        <strong style="color: #ff007f; font-size: 1.15rem;">${sharePerPerson.toFixed(2)} €</strong>
      </div>
    </div>

    <!-- Harcama Ekleme Formu -->
    <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 10px; margin-bottom: 14px;">
      <h5 style="color: #00f2fe; margin: 0 0 8px 0; font-size: 0.85rem;">+ Log New Shared Expense</h5>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <input type="text" id="exp-desc-input" class="input-field" placeholder="Description (e.g. Dinner, Taxi, Drinks)" style="flex: 2; min-width: 150px; margin-bottom: 0;">
        <input type="number" id="exp-amount-input" class="input-field" placeholder="Amount (€)" step="0.5" style="flex: 1; min-width: 90px; margin-bottom: 0;">
        <button id="btn-submit-expense" class="btn btn-pink" style="padding: 0 20px; font-size: 0.85rem; font-weight: 700;">Add</button>
      </div>
      <div id="exp-form-status" style="margin-top: 6px; font-size: 0.75rem;"></div>
    </div>

    <!-- Kim Kime Ne Kadar Borçlu / Alacaklı Tablosu -->
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 12px; border-radius: 10px; margin-bottom: 14px;">
      <h5 style="color: #94a3b8; margin: 0 0 8px 0; font-size: 0.8rem;">⚖️ Balances & Settlements</h5>
      <div style="display: grid; gap: 6px;">
        ${memberNames.map(name => {
          const paid = paidBy[name] || 0;
          const balance = paid - sharePerPerson;
          const isOwed = balance > 0;
          const isEven = Math.abs(balance) < 0.01;
          
          let badgeText = isEven 
            ? 'Settled (0.00 €)' 
            : (isOwed ? `Gets back +${balance.toFixed(2)} €` : `Owes ${Math.abs(balance).toFixed(2)} €`);
          let badgeColor = isEven ? '#94a3b8' : (isOwed ? '#22c55e' : '#f43f5e');

          return `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.04);">
              <span><strong>${name}</strong> (paid${paid.toFixed(2)} €)</span>
              <strong style="color: ${badgeColor};">${badgeText}</strong>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Harcama Geçmişi Listesi -->
    <div>
      <h5 style="color: #94a3b8; margin: 0 0 6px 0; font-size: 0.8rem;">Recent Expenses</h5>
      <div id="expense-history-list" style="max-height: 180px; overflow-y: auto; display: grid; gap: 6px;">
        ${items.length === 0 ? '<span style="color: #64748b; font-size: 0.75rem;">No expenses recorded yet. Be the first to log!</span>' : ''}
      </div>
    </div>
  `;

  // Harcama geçmişi satırlarını bas
  const historyList = document.getElementById('expense-history-list');
  items.forEach(it => {
    const row = document.createElement('div');
    row.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); padding: 8px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;';
    row.innerHTML = `
      <div>
        <strong style="color: #f8fafc;">${it.description}</strong>
        <div style="font-size: 0.7rem; color: #94a3b8;">Paid by <strong>${it.payer_name}</strong></div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: #00f2fe; font-weight: 700;">${parseFloat(it.amount).toFixed(2)} €</span>
        ${(isAdmin || (user && user.id === it.user_id)) ? `<button class="btn-del-single-exp" style="background:none; border:none; color:#f43f5e; cursor:pointer; font-size:0.85rem;" title="Delete">🗑️</button>` : ''}
      </div>
    `;

    const delBtn = row.querySelector('.btn-del-single-exp');
    if (delBtn) {
      delBtn.onclick = async () => {
        if (!confirm(`Delete "${it.description}"?`)) return;
        await supabase.from('event_expenses').delete().eq('id', it.id);
      };
    }

    historyList.appendChild(row);
  });

  // Harcama Gönderme Buton Olayı
  const submitBtn = document.getElementById('btn-submit-expense');
  const descInput = document.getElementById('exp-desc-input');
  const amountInput = document.getElementById('exp-amount-input');
  const statusEl = document.getElementById('exp-form-status');

  submitBtn.onclick = async () => {
    const desc = descInput.value.trim();
    const val = parseFloat(amountInput.value);

    if (!desc || isNaN(val) || val <= 0) {
      statusEl.style.color = '#f43f5e';
      statusEl.textContent = 'Please enter a description and valid amount.';
      return;
    }

    submitBtn.disabled = true;
    statusEl.style.color = '#00f2fe';
    statusEl.textContent = 'Saving...';

    const { error: insErr } = await supabase.from('event_expenses').insert([{
      event_id: eventId,
      user_id: user ? user.id : null,
      payer_name: user ? user.username : 'Anonymous',
      description: desc,
      amount: val
    }]);

    if (insErr) {
      statusEl.style.color = '#f43f5e';
      statusEl.textContent = insErr.message;
      submitBtn.disabled = false;
    } else {
      descInput.value = '';
      amountInput.value = '';
      statusEl.textContent = '';
      renderExpensesUI(eventId, containerId);
    }
  };
}
