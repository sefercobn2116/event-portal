// modules/chat.js
import { supabase } from '../config.js';
import { getSessionUser } from './auth.js';

let chatChannel = null;
let suggestionsChannel = null;

// ================= CHAT =================
export async function initEventChat(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (chatChannel) supabase.removeChannel(chatChannel);

  async function loadChat() {
    const { data: messages } = await supabase
      .from('event_chat')
      .select('*, users(username, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    container.innerHTML = '';
    (messages || []).forEach(m => {
      const div = document.createElement('div');
      div.style.cssText = 'margin-bottom: 8px; font-size: 0.82rem;';
      div.innerHTML = `
        <strong style="color: #00f2fe;">${m.users?.username || 'User'}:</strong>
        <span style="color: #f8fafc; margin-left: 4px;">${m.message}</span>
      `;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }

  loadChat();

  chatChannel = supabase.channel(`chat_${eventId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_chat', filter: `event_id=eq.${eventId}` }, () => {
      loadChat();
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
    event_id: eventId,
    user_id: user.id,
    message: text
  }]);
}

// ================= CANLI ÖNERİLER (EN ÇOK OY ALAN EN ÜSTTE) =================
export async function initEventSuggestions(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (suggestionsChannel) supabase.removeChannel(suggestionsChannel);

  async function loadSuggestions() {
    // EN ÇOK OY ALAN 1. SIRADA (votes DESC, created_at DESC)
    const { data: suggestions } = await supabase
      .from('event_suggestions')
      .select('*, users(username)')
      .eq('event_id', eventId)
      .order('votes', { ascending: false })
      .order('created_at', { ascending: false });

    container.innerHTML = '';
    if (!suggestions || suggestions.length === 0) {
      container.innerHTML = '<span style="color: #64748b; font-size: 0.78rem;">No ideas submitted yet. Pitch one above!</span>';
      return;
    }

    suggestions.forEach(s => {
      const card = document.createElement('div');
      card.style.cssText = `
        background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); padding: 8px 12px;
        border-radius: 8px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px;
      `;
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

  loadSuggestions();

  // CANLI REALTIME DİNLEME (KİM OY VERİRSE VEYA YENİ FİKİR ATARSA ANINDA GÜNCELLENİR)
  suggestionsChannel = supabase.channel(`suggestions_${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_suggestions', filter: `event_id=eq.${eventId}` }, () => {
      loadSuggestions();
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
    event_id: eventId,
    user_id: user.id,
    text: text,
    votes: 0
  }]);
}
