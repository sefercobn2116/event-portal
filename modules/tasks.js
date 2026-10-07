// modules/tasks.js
window.Tasks = {
  eventId: null,
  channel: null,

  async init(eventId) {
    this.eventId = eventId;
    const container = document.getElementById('module-tasks') || document.getElementById('tasks-container');
    if (!container) return;

    container.innerHTML = `
      <div class="tasks-wrapper glass-panel p-3">
        <h6 class="text-cyber mb-2">🎒 Who Brings What? (Tasks)</h6>
        <div class="input-group input-group-sm mb-3">
          <input type="text" id="new-task-title" class="form-control bg-dark text-white border-secondary" placeholder="Malzeme veya görev ekle...">
          <button class="btn btn-outline-info" onclick="Tasks.addTask()">Ekle</button>
        </div>
        <div id="tasks-items-list" class="d-flex flex-column gap-2" style="max-height: 240px; overflow-y: auto;"></div>
      </div>
    `;

    await this.loadTasks();
    this.listen();
  },

  async loadTasks() {
    const list = document.getElementById('tasks-items-list');
    if (!list) return;

    const { data: tasks } = await supabase
      .from('event_tasks')
      .select('*, users(id, username)')
      .eq('event_id', this.eventId)
      .order('id', { ascending: false });

    const user = JSON.parse(sessionStorage.getItem('nexus_user') || localStorage.getItem('nexus_user') || '{}');
    list.innerHTML = (tasks || []).length === 0 ? '<small class="text-muted">Görev bulunmuyor.</small>' : '';

    (tasks || []).forEach(t => {
      const isMine = t.assigned_to === user.id;
      list.innerHTML += `
        <div class="d-flex justify-content-between align-items-center bg-dark p-2 rounded border border-secondary">
          <div>
            <input type="checkbox" class="form-check-input me-2" ${t.is_completed ? 'checked' : ''} onchange="Tasks.toggleComplete(${t.id}, this.checked)">
            <span style="${t.is_completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${t.title}</span>
            <small class="d-block text-muted">Sorumlu: ${t.users ? t.users.username : '<em>Boşta</em>'}</small>
          </div>
          <div>
            ${!t.assigned_to ? `<button class="btn btn-xs btn-outline-success py-0" onclick="Tasks.claim(${t.id})">Ben Alırım</button>` : ''}
            ${isMine ? `<button class="btn btn-xs btn-outline-danger py-0" onclick="Tasks.unclaim(${t.id})">Bırak</button>` : ''}
          </div>
        </div>
      `;
    });
  },

  async addTask() {
    const input = document.getElementById('new-task-title');
    const val = input.value.trim();
    if (!val) return;
    await supabase.from('event_tasks').insert({ event_id: this.eventId, title: val, is_completed: false });
    input.value = '';
    this.loadTasks();
  },

  async claim(taskId) {
    const user = JSON.parse(sessionStorage.getItem('nexus_user') || localStorage.getItem('nexus_user') || '{}');
    await supabase.from('event_tasks').update({ assigned_to: user.id }).eq('id', taskId);
    this.loadTasks();
  },

  async unclaim(taskId) {
    await supabase.from('event_tasks').update({ assigned_to: null }).eq('id', taskId);
    this.loadTasks();
  },

  async toggleComplete(taskId, val) {
    await supabase.from('event_tasks').update({ is_completed: val }).eq('id', taskId);
  },

  listen() {
    if (this.channel) supabase.removeChannel(this.channel);
    this.channel = supabase.channel('tasks_live_' + this.eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_tasks', filter: `event_id=eq.${this.eventId}` }, () => {
        this.loadTasks();
      })
      .subscribe();
  }
};
