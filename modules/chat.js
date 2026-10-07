// modules/chat.js - Live Room Chat & Suggestions
window.ChatModule = {
  eventId: null,

  async init(eventId, chatContainerId = 'chat-container', suggestionsContainerId = 'suggestions-container') {
    this.eventId = eventId;
    this.renderChatUI(document.getElementById(chatContainerId));
    this.renderSuggestionsUI(document.getElementById(suggestionsContainerId));

    await this.fetchMessages();
    await this.fetchSuggestions();
    this.setupRealtime();
  },

  renderChatUI(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="chat-box glass-card d-flex flex-column" style="height: 380px;">
        <div class="p-2 border-bottom border-secondary">
          <h6 class="m-0 text-cyber">💬 Live Room Chat</h6>
        </div>
        <div id="chat-messages" class="flex-grow-1 p-2 overflow-auto d-flex flex-column gap-2"></div>
        <div class="p-2 border-top border-secondary d-flex gap-2">
          <input type="text" id="chat-input" class="form-control form-control-sm bg-dark text-white border-cyber" placeholder="Mesaj yazın...">
          <button class="btn btn-sm btn-cyber" id="btn-send-chat">Gönder</button>
        </div>
      </div>
    `;
    document.getElementById('btn-send-chat').onclick = () => this.sendMessage();
    document.getElementById('chat-input').onkeypress = (e) => { if (e.key === 'Enter') this.sendMessage(); };
  },

  renderSuggestionsUI(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="suggestions-box glass-card p-3">
        <h6 class="text-cyber mb-2">💡 Live Event Ideas & Suggestions</h6>
        <div class="input-group input-group-sm mb-2">
          <input type="text" id="suggestion-input" class="form-control bg-dark text-white border-cyber" placeholder="Fikir öner...">
          <button class="btn btn-cyber" id="btn-add-suggestion">Ekle</button>
        </div>
        <div id="suggestions-list" class="d-flex flex-column gap-2 overflow-auto" style="max-height: 200px;"></div>
      </div>
    `;
    document.getElementById('btn-add-suggestion').onclick = () => this.addSuggestion();
  },

  async fetchMessages() {
    const { data: messages } = await supabase
      .from('event_chat')
      .select('*, users(username, avatar_url)')
      .eq('event_id', this.eventId)
      .order('created_at', { ascending: true });

    const box = document.getElementById('chat-messages');
    if (!box) return;
    box.innerHTML = '';
    const currentUser = JSON.parse(localStorage.getItem('user_session') || '{}');

    (messages || []).forEach(m => {
      const isMe = m.user_id === currentUser.id;
      box.innerHTML += `
        <div class="d-flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'}">
          <small class="text-muted">${m.users ? m.users.username : 'Bilinmeyen'}</small>
          <div class="p-2 rounded ${isMe ? 'bg-primary text-white' : 'bg-secondary text-white'}" style="max-width: 80%; word-break: break-word;">
            ${m.message}
          </div>
        </div>
      `;
    });
    box.scrollTop = box.scrollHeight;
  },

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    const currentUser = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (!msg || !currentUser.id) return;

    await supabase.from('event_chat').insert({
      event_id: this.eventId,
      user_id: currentUser.id,
      message: msg
    });
    input.value = '';
  },

  async fetchSuggestions() {
    const { data: suggestions } = await supabase
      .from('event_suggestions')
      .select('*')
      .eq('event_id', this.eventId)
      .order('votes', { ascending: false });

    const list = document.getElementById('suggestions-list');
    if (!list) return;
    list.innerHTML = (suggestions || []).length === 0 ? `<small class="text-muted">Öneri bulunmuyor.</small>` : '';

    (suggestions || []).forEach(s => {
      list.innerHTML += `
        <div class="d-flex justify-content-between align-items-center bg-dark p-2 rounded border border-secondary">
          <span class="text-white small">${s.text}</span>
          <button class="btn btn-xs btn-outline-cyber" onclick="ChatModule.upvoteSuggestion(${s.id}, ${s.votes})">
            👍 ${s.votes || 0}
          </button>
        </div>
      `;
    });
  },

  async addSuggestion() {
    const input = document.getElementById('suggestion-input');
    const text = input.value.trim();
    const currentUser = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (!text) return;

    await supabase.from('event_suggestions').insert({
      event_id: this.eventId,
      user_id: currentUser.id,
      text: text,
      votes: 0
    });
    input.value = '';
  },

  async upvoteSuggestion(id, currentVotes) {
    await supabase.from('event_suggestions').update({ votes: (currentVotes || 0) + 1 }).eq('id', id);
  },

  setupRealtime() {
    supabase
      .channel('public:chat_and_sugg_' + this.eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_chat', filter: `event_id=eq.${this.eventId}` }, () => {
        this.fetchMessages();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_suggestions', filter: `event_id=eq.${this.eventId}` }, () => {
        this.fetchSuggestions();
      })
      .subscribe();
  }
};
