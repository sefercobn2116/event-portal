// modules/tasks.js - Live Tasks & Who Brings What
window.TasksModule = {
  eventId: null,

  async init(eventId, containerId = 'tasks-container') {
    this.eventId = eventId;
    const container = document.getElementById(containerId);
    if (!container) return;

    this.renderUI(container);
    await this.fetchTasks();
    this.setupRealtime();
  },

  renderUI(container) {
    container.innerHTML = `
      <div class="tasks-panel glass-card p-3">
        <h5 class="neon-title mb-3">🎒 Who Brings What? (Tasks)</h5>
        <div class="input-group mb-3">
          <input type="text" id="task-input" class="form-control bg-dark text-white border-cyber" placeholder="Örn: 2 Koli Su, Buz torbası...">
          <button class="btn btn-cyber" id="btn-add-task">+ Ekle</button>
        </div>
        <ul id="task-list" class="list-group list-group-flush gap-2"></ul>
      </div>
    `;

    document.getElementById('btn-add-task').onclick = () => this.addTask();
  },

  async fetchTasks() {
    const { data: tasks } = await supabase
      .from('event_tasks')
      .select('*, users(username)')
      .eq('event_id', this.eventId)
      .order('id', { ascending: false });

    this.renderTasks(tasks || []);
  },

  renderTasks(tasks) {
    const list = document.getElementById('task-list');
    if (!list) return;
    const currentUser = JSON.parse(localStorage.getItem('user_session') || '{}');

    list.innerHTML = tasks.length === 0 ? `<li class="text-muted small">Henüz görev atanmamış.</li>` : '';

    tasks.forEach(t => {
      const isAssignedToMe = t.assigned_to === currentUser.id;
      list.innerHTML += `
        <li class="list-group-item bg-dark border-secondary d-flex justify-content-between align-items-center text-white rounded">
          <div>
            <input type="checkbox" class="form-check-input me-2" ${t.is_completed ? 'checked' : ''} onchange="TasksModule.toggleComplete(${t.id}, this.checked)">
            <span style="${t.is_completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${t.title}</span>
            <small class="d-block text-muted">Üstlenen: ${t.users ? t.users.username : '<em>Boşta</em>'}</small>
          </div>
          <div>
            ${!t.assigned_to ? `<button class="btn btn-xs btn-outline-info" onclick="TasksModule.claimTask(${t.id})">Ben Getiririm</button>` : ''}
            ${isAssignedToMe ? `<button class="btn btn-xs btn-outline-danger" onclick="TasksModule.unclaimTask(${t.id})">Bırak</button>` : ''}
          </div>
        </li>
      `;
    });
  },

  async addTask() {
    const input = document.getElementById('task-input');
    const val = input.value.trim();
    if (!val) return;

    await supabase.from('event_tasks').insert({
      event_id: this.eventId,
      title: val,
      is_completed: false
    });
    input.value = '';
  },

  async claimTask(taskId) {
    const currentUser = JSON.parse(localStorage.getItem('user_session') || '{}');
    await supabase.from('event_tasks').update({ assigned_to: currentUser.id }).eq('id', taskId);
  },

  async unclaimTask(taskId) {
    await supabase.from('event_tasks').update({ assigned_to: null }).eq('id', taskId);
  },

  async toggleComplete(taskId, isCompleted) {
    await supabase.from('event_tasks').update({ is_completed: isCompleted }).eq('id', taskId);
  },

  setupRealtime() {
    supabase
      .channel('public:event_tasks_' + this.eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_tasks', filter: `event_id=eq.${this.eventId}` }, () => {
        this.fetchTasks();
      })
      .subscribe();
  }
};
