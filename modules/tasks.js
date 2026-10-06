// modules/tasks.js
import { supabase } from '../config.js';
import { getSessionUser } from './auth.js';

let activeTasksChannel = null;

export async function initEventTasks(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (activeTasksChannel) {
    supabase.removeChannel(activeTasksChannel);
    activeTasksChannel = null;
  }

  container.innerHTML = '<p style="color: #00f2fe; font-size: 0.8rem;">Loading tasks...</p>';

  await renderTasksUI(eventId, containerId);

  // Realtime canlı görev güncellemesi
  activeTasksChannel = supabase
    .channel(`realtime_tasks_${eventId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'event_tasks',
      filter: `event_id=eq.${eventId}`
    }, () => {
      renderTasksUI(eventId, containerId);
    })
    .subscribe();
}

async function renderTasksUI(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = getSessionUser();
  const isAdmin = user && (user.is_admin || user.role === 'admin');

  const { data: tasks, error } = await supabase
    .from('event_tasks')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Tasks load error:', error);
  }

  const items = tasks || [];

  container.innerHTML = `
    <!-- Görev Ekleme Kutusu -->
    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <input type="text" id="task-title-input" class="input-field" placeholder="Add an item to bring or task (e.g. Bluetooth speaker, Ice)..." style="margin-bottom: 0;">
      <button id="btn-add-task" class="btn btn-pink" style="padding: 0 18px; font-size: 0.82rem; white-space: nowrap;">+ Add</button>
    </div>

    <!-- Görev Listesi -->
    <div id="tasks-items-list" style="max-height: 220px; overflow-y: auto; display: grid; gap: 6px;">
      ${items.length === 0 ? '<span style="color: #64748b; font-size: 0.75rem;">No tasks assigned yet. Add one above!</span>' : ''}
    </div>
  `;

  const listEl = document.getElementById('tasks-items-list');

  items.forEach(t => {
    const row = document.createElement('div');
    row.style.cssText = `
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid ${t.is_completed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.08)'};
      padding: 8px 12px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    `;

    const isAssigned = !!t.assigned_to_name;
    const isMe = user && t.assigned_to_name === user.username;

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <input type="checkbox" id="chk-task-${t.id}" ${t.is_completed ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
        <span style="font-size: 0.85rem; color: ${t.is_completed ? '#94a3b8' : '#f8fafc'}; text-decoration: ${t.is_completed ? 'line-through' : 'none'};">
          ${t.task_title}
        </span>
      </div>

      <div style="display: flex; align-items: center; gap: 8px;">
        <!-- Kim Üstlendi Rozeti -->
        ${isAssigned ? `
          <span style="font-size: 0.72rem; background: rgba(0, 242, 254, 0.12); border: 1px solid rgba(0, 242, 254, 0.3); color: #00f2fe; padding: 2px 8px; border-radius: 6px;">
            👤 ${t.assigned_to_name}
          </span>
          ${isMe ? `<button class="btn-unclaim-task" style="background: none; border: none; color: #f43f5e; cursor: pointer; font-size: 0.7rem;" title="Drop task">✕</button>` : ''}
        ` : `
          <button class="btn-claim-task btn" style="padding: 2px 10px; font-size: 0.72rem; min-height: 26px;">I'll bring it</button>
        `}

        ${(isAdmin || (user && user.id === t.assigned_to_id)) ? `
          <button class="btn-del-task" style="background: none; border: none; color: #f43f5e; cursor: pointer; font-size: 0.85rem; padding: 2px;" title="Delete">🗑️</button>
        ` : ''}
      </div>
    `;

    // 1. Tamamlandı (Checkbox) Olayı
    const chk = row.querySelector(`#chk-task-${t.id}`);
    chk.onchange = async () => {
      await supabase.from('event_tasks').update({ is_completed: chk.checked }).eq('id', t.id);
    };

    // 2. Görevi Üstlen (Claim) Butonu
    const claimBtn = row.querySelector('.btn-claim-task');
    if (claimBtn) {
      claimBtn.onclick = async () => {
        if (!user) return alert('Please sign in first');
        await supabase.from('event_tasks').update({
          assigned_to_name: user.username,
          assigned_to_id: user.id
        }).eq('id', t.id);
      };
    }

    // 3. Görevi Bırak (Unclaim) Butonu
    const unclaimBtn = row.querySelector('.btn-unclaim-task');
    if (unclaimBtn) {
      unclaimBtn.onclick = async () => {
        await supabase.from('event_tasks').update({
          assigned_to_name: null,
          assigned_to_id: null
        }).eq('id', t.id);
      };
    }

    // 4. Silme Butonu
    const delBtn = row.querySelector('.btn-del-task');
    if (delBtn) {
      delBtn.onclick = async () => {
        if (!confirm(`Delete task "${t.task_title}"?`)) return;
        await supabase.from('event_tasks').delete().eq('id', t.id);
      };
    }

    listEl.appendChild(row);
  });

  // Görev Ekleme Butonu
  const addBtn = document.getElementById('btn-add-task');
  const inputEl = document.getElementById('task-title-input');

  const handleAdd = async () => {
    const val = inputEl.value.trim();
    if (!val) return;
    addBtn.disabled = true;

    await supabase.from('event_tasks').insert([{
      event_id: eventId,
      task_title: val
    }]);

    inputEl.value = '';
    addBtn.disabled = false;
    renderTasksUI(eventId, containerId);
  };

  addBtn.onclick = handleAdd;
  inputEl.onkeydown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };
}
