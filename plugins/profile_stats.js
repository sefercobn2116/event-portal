// plugins/profile_stats.js
import { supabase } from '../config.js';
import { getSessionUser } from '../modules/auth.js';

export async function initPlugin(contextId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = getSessionUser();
  if (!user) return;

  container.innerHTML = `
    <div class="glass-box" style="margin-bottom: 20px; border: 1px solid rgba(0, 242, 254, 0.25); background: linear-gradient(135deg, rgba(0, 242, 254, 0.05), rgba(255, 0, 127, 0.05));">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 style="color: #00f2fe; margin: 0; font-size: 0.95rem;">📊 My Space Snapshot</h4>
        <span style="font-size: 0.75rem; color: #94a3b8;">Active Member</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #94a3b8; display: block;">Total Paid (All Events)</span>
          <strong id="plug-user-total-paid" style="color: #22c55e; font-size: 1.1rem;">Calculating...</strong>
        </div>

        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; text-align: center;">
          <span style="font-size: 0.7rem; color: #94a3b8; display: block;">Active Events Joined</span>
          <strong id="plug-user-events-count" style="color: #ff007f; font-size: 1.1rem;">Calculating...</strong>
        </div>
      </div>
    </div>
  `;

  try {
    // 1. Kullanıcının tüm etkinliklerde ödediği toplam para
    const { data: userExpenses } = await supabase
      .from('event_expenses')
      .select('amount')
      .eq('payer_name', user.username);

    const totalPaid = (userExpenses || []).reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
    const paidEl = document.getElementById('plug-user-total-paid');
    if (paidEl) paidEl.textContent = `${totalPaid.toFixed(2)} €`;

    // 2. Kullanıcının erişimi olan etkinlik sayısı
    const { data: access } = await supabase
      .from('event_access')
      .select('id')
      .eq('user_id', user.id);

    const eventsCountEl = document.getElementById('plug-user-events-count');
    if (eventsCountEl) eventsCountEl.textContent = `${(access || []).length} Events`;
  } catch (err) {
    console.warn('Profile stats calculation warning:', err);
  }
}
