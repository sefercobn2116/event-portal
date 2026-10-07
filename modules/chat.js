// modules/chat.js
import { supabase } from '../config.js';
import { getSessionUser } from './auth.js';

let activeChatChannel = null;
let activeSugChannel = null;

// ================= CANLI CHAT =================
export async function initEventChat(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const targetEventId = Number(eventId);

  async function loadChat() {
    const { data: messages } = await supabase
      .from('event_chat')
      .select('*, users(username)')
      .eq('event_id', targetEventId)
      .order('created_at', { ascending: true });

    container.innerHTML = '';
    (messages || []).forEach(m => {
      const div = document.createElement('div');
      div.style.cssText = 'margin-bottom: 6px; font-size: 0.82rem; word-break: break-word;';
      div.innerHTML = `<strong style="color: #00f2fe;">${m.users?.username || 'Member'}:</strong> <span style="color: #f8fafc; margin-left: 4px;">${m.message}</span>`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }

  await loadChat();

  // Önceki açık kanalı temizle
  if (activeChatChannel) {
    supabase.removeChannel(activeChatChannel);
  }

  // Kesintisiz Realtime Kanalı
  activeChatChannel = supabase.channel(`room_chat_${targetEventId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_chat' }, (payload) => {
      if (Number(payload.new.event_id) === targetEventId) {
        loadChat();
      }
    })
    .subscribe();
}

export async function sendChatMessage(eventId, inputId) {
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  const user = getSessionUser();
  if (!text || !user) return;

  input.value = '';
  await supabase.from('event_chat').insert([{
    event_id: Number(eventId),
    user_id: user.id,
    message: text
  }]);
}

// ================= CANLI ÖNERİLER (EN ÇOK OY ALAN 1. SIRADA) =================
export async function initEventSuggestions(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const targetEventId = Number(eventId);

  async function loadSuggestions() {
    const { data: suggestions } = await supabase
      .from('event_suggestions')
      .select('*, users(username)')
      .eq('event_id', targetEventId)
      .order('votes', { ascending: false })
      .order('created_at', { ascending: false });

    container.innerHTML = '';
    if (!suggestions || suggestions.length === 0) {
      container.innerHTML = '<span style="color: #64748b; font-size: 0.78rem;">No ideas submitted yet. Pitch one above!</span>';
      return;
    }

    suggestions.forEach(s => {
      const card = document.createElement('div');
      card.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 8px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px;';
      card.innerHTML = `
        <div>
          <span style="color: #f8fafc; font-size: 0.82rem; font-weight: 500;">${s.text}</span>
          <span style="display: block; font-size: 0.7rem; color: #94a3b8;">by ${s.users?.username || 'Member'}</span>
        </div>
        <button class="btn btn-vote-sug" style="padding: 3px 10px; font-size: 0.75rem; border-color: #22c55e; color: #22c55e;">
          👍 ${s.votes || 0}
        </button>
      `;

      card.querySelector('.btn-vote-sug').onclick = async () => {
        await supabase.from('event_suggestions').update({ votes: (s.votes || 0) + 1 }).eq('id', s.id);
      };

      container.appendChild(card);
    });
  }

  await loadSuggestions();

  if (activeSugChannel) {
    supabase.removeChannel(activeSugChannel);
  }

  activeSugChannel = supabase.channel(`room_sug_${targetEventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_suggestions' }, (payload) => {
      const evId = payload.new ? payload.new.event_id : payload.old?.event_id;
      if (Number(evId) === targetEventId) {
        loadSuggestions();
      }
    })
    .subscribe();
}

export async function sendSuggestion(eventId, inputId) {
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  const user = getSessionUser();
  if (!text || !user) return;

  input.value = '';
  await supabase.from('event_suggestions').insert([{
    event_id: Number(eventId),
    user_id: user.id,
    text: text,
    votes: 0
  }]);
}
