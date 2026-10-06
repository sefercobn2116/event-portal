// modules/chat.js
import { supabase } from '../config.js';
import { getSessionUser } from './auth.js';

let activeChatChannel = null;
let activeSuggestionChannel = null;

export async function initEventChat(eventId, listContainerId) {
  const container = document.getElementById(listContainerId);
  if (!container) return;

  if (activeChatChannel) {
    supabase.removeChannel(activeChatChannel);
    activeChatChannel = null;
  }

  container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem;">Loading messages...</p>';

  const { data: messages } = await supabase
    .from('event_messages')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  container.innerHTML = '';
  (messages || []).forEach(msg => appendChatMessage(container, msg));
  container.scrollTop = container.scrollHeight;

  activeChatChannel = supabase
    .channel(`chat_room_${eventId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'event_messages',
      filter: `event_id=eq.${eventId}`
    }, (payload) => {
      appendChatMessage(container, payload.new);
      container.scrollTop = container.scrollHeight;
    })
    .subscribe();
}

function appendChatMessage(container, msg) {
  const user = getSessionUser();
  const isMe = user && (user.id === msg.user_id || user.username === msg.sender_name);

  const bubble = document.createElement('div');
  bubble.style.cssText = `display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'}; margin-bottom: 8px;`;

  bubble.innerHTML = `
    <span style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">
      ${msg.sender_name || 'Anonymous'} • ${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
    <div style="
      background: ${isMe ? 'linear-gradient(135deg, #00f2fe, #3b82f6)' : 'rgba(255,255,255,0.08)'};
      color: ${isMe ? '#070913' : '#fff'};
      font-weight: ${isMe ? '600' : 'normal'};
      padding: 8px 12px;
      border-radius: ${isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};
      max-width: 80%;
      word-break: break-word;
      font-size: 0.9rem;
    ">${msg.content}</div>
  `;
  container.appendChild(bubble);
}

export async function sendChatMessage(eventId, inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const content = input.value.trim();
  const user = getSessionUser();
  if (!content || !user) return;

  input.value = '';

  await supabase.from('event_messages').insert([{
    event_id: eventId,
    user_id: user.id,
    sender_name: user.username,
    content: content
  }]);
}

export async function initEventSuggestions(eventId, listContainerId) {
  const container = document.getElementById(listContainerId);
  if (!container) return;

  if (activeSuggestionChannel) {
    supabase.removeChannel(activeSuggestionChannel);
    activeSuggestionChannel = null;
  }

  container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem;">Loading suggestions...</p>';

  const { data: suggestions } = await supabase
    .from('event_suggestions')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  container.innerHTML = '';
  (suggestions || []).forEach(sug => appendSuggestionCard(container, sug));

  activeSuggestionChannel = supabase
    .channel(`sug_room_${eventId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'event_suggestions',
      filter: `event_id=eq.${eventId}`
    }, (payload) => {
      appendSuggestionCard(container, payload.new, true);
    })
    .subscribe();
}

function appendSuggestionCard(container, sug, isNew = false) {
  const card = document.createElement('div');
  card.style.cssText = `
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(0, 242, 254, 0.2);
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 8px;
    animation: fadeIn 0.3s ease;
  `;

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
      <strong style="color: #00f2fe; font-size: 0.85rem;">💡 ${sug.sender_name}</strong>
      <span style="font-size: 0.7rem; color: #64748b;">${new Date(sug.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <p style="color: #f8fafc; font-size: 0.85rem; margin: 0;">${sug.suggestion}</p>
  `;

  if (isNew) {
    container.insertBefore(card, container.firstChild);
  } else {
    container.appendChild(card);
  }
}

export async function sendSuggestion(eventId, inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const suggestionText = input.value.trim();
  const user = getSessionUser();
  if (!suggestionText || !user) return;

  input.value = '';

  await supabase.from('event_suggestions').insert([{
    event_id: eventId,
    user_id: user.id,
    sender_name: user.username,
    suggestion: suggestionText
  }]);
}
