// modules/expenses.js
import { supabase } from '../config.js';
import { getSessionUser } from './auth.js';

let expChannel = null;

export async function initEventExpenses(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentUser = getSessionUser();
  if (expChannel) supabase.removeChannel(expChannel);

  container.innerHTML = `
    <div>
      <div style="display: grid; grid-template-columns: 2fr 1fr auto; gap: 6px; margin-bottom: 8px;">
        <input type="text" id="exp-desc-input" class="input-field" placeholder="Description..." style="margin-bottom: 0;">
        <input type="number" id="exp-amount-input" class="input-field" placeholder="Amount €" step="0.5" style="margin-bottom: 0;">
        <button id="btn-add-exp" class="btn btn-pink" style="padding: 0 14px; font-size: 0.78rem;">+ Add</button>
      </div>
      <div id="exp-total-badge" style="background: rgba(34,197,94,0.15); border: 1px solid #22c55e; color: #22c55e; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; margin-bottom: 8px;">
        Total: 0.00 €
      </div>
      <div id="exp-list-wrap" style="display: grid; gap: 6px;"></div>
    </div>
  `;

  const listWrap = document.getElementById('exp-list-wrap');
  const totalBadge = document.getElementById('exp-total-badge');
  const desc = document.getElementById('exp-desc-input');
  const amount = document.getElementById('exp-amount-input');

  async function loadExpenses() {
    const { data: expenses } = await supabase
      .from('event_expenses')
      .select('*, payer:users!paid_by(username)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    let sum = 0;
    listWrap.innerHTML = '';
    (expenses || []).forEach(e => {
      sum += Number(e.amount);
      const row = document.createElement('div');
      row.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;';
      row.innerHTML = `
        <div>
          <span style="font-size: 0.8rem; color: #f8fafc;">${e.description}</span>
          <span style="display: block; font-size: 0.68rem; color: #94a3b8;">paid by ${e.payer?.username || 'User'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <strong style="color: #22c55e; font-size: 0.82rem;">${Number(e.amount).toFixed(2)} €</strong>
          <button class="btn-del-exp" style="background: none; border: none; color: #f43f5e; cursor: pointer;">×</button>
        </div>
      `;
      row.querySelector('.btn-del-exp').onclick = async () => {
        await supabase.from('event_expenses').delete().eq('id', e.id);
      };
      listWrap.appendChild(row);
    });
    totalBadge.textContent = `Total Pool: ${sum.toFixed(2)} €`;
  }

  document.getElementById('btn-add-exp').onclick = async () => {
    const dVal = desc.value.trim();
    const aVal = parseFloat(amount.value);
    if (!dVal || isNaN(aVal)) return alert('Valid info required');
    desc.value = '';
    amount.value = '';
    await supabase.from('event_expenses').insert([{ event_id: eventId, paid_by: currentUser.id, description: dVal, amount: aVal }]);
  };

  loadExpenses();

  expChannel = supabase.channel(`exp_${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_expenses', filter: `event_id=eq.${eventId}` }, () => {
      loadExpenses();
    })
    .subscribe();
}
