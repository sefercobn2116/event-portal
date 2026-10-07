// modules/chat.js
import { supabase } from '../config.js';
import { getSessionUser } from './auth.js';

let chatChannel = null;
let sugChannel = null;

export async function initEventChat(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (chatChannel) supabase.removeChannel(chatChannel);

  async function loadChat() {
    const { data: messages } = await supabase
      .from('event_chat')
      .select('*, users(username)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    container.innerHTML = '';
    (messages || []).forEach(m => {
      const div = document.createElement('div');
      div.style.cssText = 'margin-bottom: 6px; font-size: 0.8rem;';
      div.innerHTML = `<strong style="color: #00f2fe;">${m.users?.username || 'User'}:</strong> <span style="color: #f8fafc;">${m.message}</span>`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }

  loadChat();

  chatChannel = supabase.channel(`chat_${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_chat', filter: `event_id=eq.${eventId}` }, () => {
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
  await supabase.from('event_chat').insert([{ event_id: eventId, user_id: user.id, message: text }]);
}

export async function initEventSuggestions(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (sugChannel) supabase.removeChannel(sugChannel);

  async function loadSuggestions() {
    // EN ÇOK OY ALAN 1. SIRADA
    const { data: suggestions } = await supabase
      .from('event_suggestions')
      .select('*, users(username)')
      .eq('event_id', eventId)
      .order('votes', { ascending: false })
      .order('created_at', { ascending: false });

    container.innerHTML = '';
    if (!suggestions || suggestions.length === 0) {
      container.innerHTML = '<span style="color: #64748b; font-size: 0.75rem;">No suggestions yet.</span>';
      return;
    }

    suggestions.forEach(s => {
      const card = document.createElement('div');
      card.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 6px 10px; border-radius: 6px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;';
      card.innerHTML = `
        <div>
          <span style="color: #f8fafc; font-size: 0.8rem;">${s.text}</span>
          <span style="display: block; font-size: 0.68rem; color: #94a3b8;">by ${s.users?.username || 'User'}</span>
        </div>
        <button class="btn btn-vote" style="padding: 2px 8px; font-size: 0.72rem; color: #22c55e; border-color: #22c55e;">👍 ${s.votes || 0}</button>
      `;

      card.querySelector('.btn-vote').onclick = async () => {
        await supabase.from('event_suggestions').update({ votes: (s.votes || 0) + 1 }).eq('id', s.id);
      };

      container.appendChild(card);
    });
  }

  loadSuggestions();

  sugChannel = supabase.channel(`sug_${eventId}`)
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
  await supabase.from('event_suggestions').insert([{ event_id: eventId, user_id: user.id, text, votes: 0 }]);
}
