// modules/booking.js içine eklenecek / güncellenecek RSVP mantığı
window.RSVP = {
  eventId: null,
  channel: null,

  async init(eventId) {
    this.eventId = eventId;
    const container = document.getElementById('module-rsvp') || document.getElementById('rsvp-container');
    if (!container) return;

    container.innerHTML = `
      <div class="glass-panel p-3 mb-3">
        <h6 class="text-cyber mb-2">👥 Katılım Onay & İstek Paneli</h6>
        <div id="rsvp-requests-list" class="d-flex flex-column gap-2"></div>
      </div>
    `;

    await this.loadRequests();
    this.listen();
  },

  async loadRequests() {
    const list = document.getElementById('rsvp-requests-list');
    if (!list) return;

    const { data: requests } = await supabase
      .from('event_join_requests')
      .select('id, status, user_id, users(username, email)')
      .eq('event_id', this.eventId);

    list.innerHTML = (requests || []).length === 0 ? '<small class="text-muted">Bekleyen katılım isteği yok.</small>' : '';

    (requests || []).forEach(r => {
      const name = r.users?.username || r.users?.email || 'Kullanıcı';
      list.innerHTML += `
        <div class="d-flex justify-content-between align-items-center bg-dark p-2 rounded border border-secondary small">
          <span>${name}</span>
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${r.status === 'accepted' ? 'bg-success' : r.status === 'rejected' ? 'bg-danger' : 'bg-warning'}">${r.status}</span>
            ${r.status === 'pending' ? `
              <button class="btn btn-xs btn-success py-0 px-2" onclick="RSVP.respond(${r.id}, 'accepted',${r.user_id})">Onayla</button>
              <button class="btn btn-xs btn-danger py-0 px-2" onclick="RSVP.respond(${r.id}, 'rejected',${r.user_id})">Reddet</button>
            ` : ''}
          </div>
        </div>
      `;
    });
  },

  async respond(requestId, newStatus, userId) {
    await supabase.from('event_join_requests').update({ status: newStatus }).eq('id', requestId);
    if (newStatus === 'accepted' && userId) {
      await supabase.from('event_access').upsert({ event_id: this.eventId, user_id: userId });
    }
    this.loadRequests();
  },

  listen() {
    if (this.channel) supabase.removeChannel(this.channel);
    this.channel = supabase.channel('rsvp_live_' + this.eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_join_requests', filter: `event_id=eq.${this.eventId}` }, () => {
        this.loadRequests();
      })
      .subscribe();
  }
};
