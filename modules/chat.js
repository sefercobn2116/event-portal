// modules/chat.js
window.Chat = {
  eventId: null,
  channel: null,

  async init(eventId) {
    this.eventId = eventId;
    const chatContainer = document.getElementById('module-chat') || document.getElementById('chat-container');
    const suggContainer = document.getElementById('module-suggestions') || document.getElementById('suggestions-container');

    if (chatContainer) {
      chatContainer.innerHTML = `
        <div class="glass-panel p-3 d-flex flex-column" style="height: 320px;">
          <h6 class="text-cyber mb-2">💬 Live Room Chat</h6>
          <div id="chat-stream" class="flex-grow-1 overflow-auto d-flex flex-column gap-2 mb-2"></div>
          <div class="input-group input-group-sm">
            <input type="text" id="chat-msg-input" class="form-control bg-dark text-white border-secondary" placeholder="Mesaj yazın...">
            <button class="btn btn-outline-info" onclick="Chat.sendMessage()">Gönder</button>
          </div>
        </div>
      `;
      document.getElementById('chat-msg-input').onkeypress = (e) => { if (e.key === 'Enter') Chat.sendMessage(); };
    }

    if (suggContainer) {
      suggContainer.innerHTML = `
        <div class="glass-panel p-3 d-flex flex-column" style="height: 320px;">
          <h6 class="text-cyber mb-2">💡 Live Event Ideas & Suggestions</h6>
          <div class="input-group input-group-sm mb-2">
            <input type="text" id="sugg-new-input" class="form-control bg-dark text-white border-secondary" placeholder="Fikir öner...">
            <button class="btn btn-outline-info" onclick="Chat.addSuggestion()">Ekle</button>
          </div>
          <div id="sugg-stream" class="flex-grow-1 overflow-auto d-flex flex-column gap-2"></div>
        </div>
      `;
    }

    await this.loadMessages();
    await this.loadSuggestions();
    this.listen();
  },

  async loadMessages() {
    const box = document.getElementById('chat-stream');
    if (!box) return;

    const { data: messages } = await supabase
      .from('event_chat')
      .select('*, users(username)')
      .eq('event_id', this.eventId)
      .order('created_at', { ascending: true });

    const user = JSON.parse(sessionStorage.getItem('nexus_user') || localStorage.getItem('nexus_user') || '{}');
    box.innerHTML = '';

    (messages || []).forEach(m => {
      const isMe = m.user_id === user.id;
      box.innerHTML += `
        <div class="d-flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'}">
          <small class="text-muted" style="font-size:10px;">${m.users?.username || 'Kullanıcı'}</small>
          <div class="p-2 rounded small ${isMe ? 'bg-info text-dark' : 'bg-dark text-white border border-secondary'}" style="max-width:80%;">
            ${m.message}
          </div>
        </div>
      `;
    });
    box.scrollTop = box.scrollHeight;
  },

  async sendMessage() {
    const input = document.getElementById('chat-msg-input');
    const msg = input.value.trim();
    const user = JSON.parse(sessionStorage.getItem('nexus_user') || localStorage.getItem('nexus_user') || '{}');
    if (!msg || !user.id) return;

    await supabase.from('event_chat').insert({ event_id: this.eventId, user_id: user.id, message: msg });
    input.value = '';
    this.loadMessages();
  },

  async loadSuggestions() {
    const list = document.getElementById('sugg-stream');
    if (!list) return;

    const { data: suggestions } = await supabase
      .from('event_suggestions')
      .select('*')
      .eq('event_id', this.eventId)
      .order('votes', { ascending: false });

    list.innerHTML = (suggestions || []).length === 0 ? '<small class="text-muted">Öneri bulunmuyor.</small>' : '';

    (suggestions || []).forEach(s => {
      list.innerHTML += `
        <div class="d-flex justify-content-between align-items-center bg-dark p-2 rounded border border-secondary">
          <span class="small">${s.text}</span>
          <button class="btn btn-xs btn-outline-info py-0" onclick="Chat.upvoteSuggestion(${s.id}, ${s.votes || 0})">👍 ${s.votes || 0}</button>
        </div>
      `;
    });
  },

  async addSuggestion() {
    const input = document.getElementById('sugg-new-input');
    const text = input.value.trim();
    const user = JSON.parse(sessionStorage.getItem('nexus_user') || localStorage.getItem('nexus_user') || '{}');
    if (!text) return;

    await supabase.from('event_suggestions').insert({ event_id: this.eventId, user_id: user.id, text, votes: 0 });
    input.value = '';
    this.loadSuggestions();
  },

  async upvoteSuggestion(id, currentVotes) {
    await supabase.from('event_suggestions').update({ votes: (currentVotes || 0) + 1 }).eq('id', id);
    this.loadSuggestions();
  },

  listen() {
    if (this.channel) supabase.removeChannel(this.channel);
    this.channel = supabase.channel('chat_live_' + this.eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_chat', filter: `event_id=eq.${this.eventId}` }, () => this.loadMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_suggestions', filter: `event_id=eq.${this.eventId}` }, () => this.loadSuggestions())
      .subscribe();
  }
};
