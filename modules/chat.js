// modules/chat.js
import { supabase } from '../config.js';
import { getSessionUser } from './auth.js';

let activeSubscription = null;

export async function initEventChat(eventId, listContainerId) {
  const container = document.getElementById(listContainerId);
  if (!container) return;

  // Önceki aboneliği temizle
  if (activeSubscription) {
    supabase.removeChannel(activeSubscription);
    activeSubscription = null;
  }

  container.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem;">Mesajlar yükleniyor...</p>';

  // Geçmiş mesajları getir
  const { data: messages, error } = await supabase
    .from('event_messages')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    container.innerHTML = `<p style="color: #f43f5e;">Hata: ${error.message}</p>`;
    return;
  }

  container.innerHTML = '';
  (messages || []).forEach(msg => appendChatMessage(container, msg));
  container.scrollTop = container.scrollHeight;

  // Supabase Gerçek Zamanlı (Realtime) Dinleyici
  activeSubscription = supabase
    .channel(`room:${eventId}`)
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
  bubble.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: ${isMe ? 'flex-end' : 'flex-start'};
    margin-bottom: 10px;
  `;

  bubble.innerHTML = `
    <span style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">
      ${msg.sender_name || 'Anonim'} • ${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
    <div style="
      background: ${isMe ? 'linear-gradient(135deg, #00f2fe, #3b82f6)' : 'rgba(255,255,255,0.08)'};
      color: ${isMe ? '#070913' : '#fff'};
      font-weight: ${isMe ? '600' : 'normal'};
      padding: 8px 14px;
      border-radius: ${isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};
      max-width: 80%;
      word-break: break-word;
      font-size: 0.9rem;
    ">
      ${msg.content}
    </div>
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
    content: content,
    created_at: new Date().toISOString()
  }]);
}
