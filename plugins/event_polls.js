// plugins/event_polls.js
import { supabase } from '../config.js';
import { getSessionUser } from '../modules/auth.js';

let activePollChannel = null;

export async function initPlugin(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (activePollChannel) {
    supabase.removeChannel(activePollChannel);
    activePollChannel = null;
  }

  container.innerHTML = '<p style="color: #00f2fe; font-size: 0.8rem;">Loading polls...</p>';

  await renderPollsUI(eventId, containerId);

  // Realtime oy güncellemelerini anında dinle
  activePollChannel = supabase
    .channel(`realtime_polls_${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_poll_votes' }, () => {
      renderPollsUI(eventId, containerId);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_polls', filter: `event_id=eq.${eventId}` }, () => {
      renderPollsUI(eventId, containerId);
    })
    .subscribe();
}

async function renderPollsUI(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = getSessionUser();
  const isAdmin = user && (user.is_admin || user.role === 'admin');

  // Anketleri ve oyları çek
  const [{ data: polls }, { data: votes }] = await Promise.all([
    supabase.from('event_polls').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabase.from('event_poll_votes').select('*')
  ]);

  const pollList = polls || [];
  const allVotes = votes || [];

  container.innerHTML = `
    <div class="glass-box" style="margin-bottom: 20px; border: 1px solid rgba(0, 242, 254, 0.25);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 style="color: #00f2fe; margin: 0; font-size: 0.95rem;">📊 Live Event Polls & Votes</h4>
        <button id="btn-toggle-new-poll" class="btn btn-pink" style="padding: 4px 12px; font-size: 0.75rem;">+ Create Poll</button>
      </div>

      <!-- Yeni Anket Formu -->
      <div id="new-poll-form" style="display: none; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; margin-bottom: 14px;">
        <input type="text" id="poll-question-input" class="input-field" placeholder="Poll Question (e.g. Which food should we order?)" style="margin-bottom: 8px;">
        <input type="text" id="poll-options-input" class="input-field" placeholder="Options separated by comma (e.g. Pizza, Burger, Sushi)" style="margin-bottom: 10px;">
        <button id="btn-submit-new-poll" class="btn" style="width: 100%; min-height: 38px; font-size: 0.82rem;">Launch Poll</button>
      </div>

      <!-- Anketler Listesi -->
      <div id="polls-display-list" style="display: grid; gap: 14px;">
        ${pollList.length === 0 ? '<span style="color: #64748b; font-size: 0.8rem;">No polls created yet. Be the first to ask!</span>' : ''}
      </div>
    </div>
  `;

  // Yeni Anket Açma Butonu Toggle
  const toggleBtn = document.getElementById('btn-toggle-new-poll');
  const formEl = document.getElementById('new-poll-form');
  toggleBtn.onclick = () => {
    formEl.style.display = formEl.style.display === 'none' ? 'block' : 'none';
  };

  // Yeni Anket Kaydetme
  document.getElementById('btn-submit-new-poll').onclick = async () => {
    const q = document.getElementById('poll-question-input').value.trim();
    const optsRaw = document.getElementById('poll-options-input').value.trim();

    if (!q || !optsRaw) return alert('Please enter question and options!');
    const opts = optsRaw.split(',').map(o => o.trim()).filter(Boolean);
    if (opts.length < 2) return alert('Please provide at least 2 options!');

    await supabase.from('event_polls').insert([{
      event_id: eventId,
      question: q,
      options: opts,
      created_by: user ? user.id : null
    }]);

    renderPollsUI(eventId, containerId);
  };

  // Anketleri Ekrana Çizme
  const displayList = document.getElementById('polls-display-list');

  pollList.forEach(p => {
    const pVotes = allVotes.filter(v => v.poll_id === p.id);
    const totalVotes = pVotes.length;
    const myVote = user ? pVotes.find(v => v.user_id === user.id) : null;
    const canDelete = isAdmin || (user && user.id === p.created_by);

    const card = document.createElement('div');
    card.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 10px;';

    let optionsHtml = '';
    (p.options || []).forEach((opt, idx) => {
      const optVotes = pVotes.filter(v => v.option_index === idx).length;
      const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
      const isSelected = myVote && myVote.option_index === idx;

      optionsHtml += `
        <div class="poll-option-row" data-poll="${p.id}" data-idx="${idx}" style="cursor: pointer; position: relative; margin-bottom: 8px; background: rgba(0,0,0,0.3); border: 1px solid ${isSelected ? '#00f2fe' : 'rgba(255,255,255,0.08)'}; border-radius: 6px; padding: 8px 12px; overflow: hidden;">
          <!-- Oy Oranı İlerleme Çubuğu -->
          <div style="position: absolute; top: 0; left: 0; bottom: 0; width: ${pct}%; background: ${isSelected ? 'rgba(0, 242, 254, 0.25)' : 'rgba(255, 0, 127, 0.15)'}; z-index: 1; transition: width 0.3s ease;"></div>
          
          <!-- Metin ve Yüzde -->
          <div style="position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
            <span style="color: ${isSelected ? '#00f2fe' : '#f8fafc'}; font-weight: ${isSelected ? '700' : '500'};">
              ${isSelected ? '✓ ' : ''}${opt}
            </span>
            <span style="color: #94a3b8; font-size: 0.75rem;">${optVotes} votes (${pct}%)</span>
          </div>
        </div>
      `;
    });

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <strong style="color: #f8fafc; font-size: 0.9rem;">${p.question}</strong>
        ${canDelete ? `<button class="btn-del-poll" style="background: none; border: none; color: #f43f5e; cursor: pointer; font-size: 0.85rem;" title="Delete Poll">🗑️</button>` : ''}
      </div>
      <div>${optionsHtml}</div>
      <div style="font-size: 0.7rem; color: #64748b; margin-top: 4px;">Total: ${totalVotes} votes</div>
    `;

    // Oy Verme Tıklama Olayı
    card.querySelectorAll('.poll-option-row').forEach(row => {
      row.onclick = async () => {
        if (!user) return alert('Please sign in to vote');
        const optIdx = parseInt(row.dataset.idx);

        // Varsa eski oyu sil, yenisini yaz (veya aynıysa kaldır)
        await supabase.from('event_poll_votes').delete().eq('poll_id', p.id).eq('user_id', user.id);

        if (!myVote || myVote.option_index !== optIdx) {
          await supabase.from('event_poll_votes').insert([{
            poll_id: p.id,
            user_id: user.id,
            option_index: optIdx
          }]);
        }

        renderPollsUI(eventId, containerId);
      };
    });

    // Anket Silme
    const delBtn = card.querySelector('.btn-del-poll');
    if (delBtn) {
      delBtn.onclick = async () => {
        if (!confirm(`Delete poll "${p.question}"?`)) return;
        await supabase.from('event_polls').delete().eq('id', p.id);
        renderPollsUI(eventId, containerId);
      };
    }

    displayList.appendChild(card);
  });
}
