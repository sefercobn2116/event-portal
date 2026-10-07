// modules/tasks.js
import { supabase } from '../config.js';
import { getSessionUser } from './auth.js';

let tasksChannel = null;

export async function initEventTasks(eventId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentUser = getSessionUser();
  if (tasksChannel) supabase.removeChannel(tasksChannel);

  container.innerHTML = `
    <div>
      <div style="display: flex; gap: 6px; margin-bottom: 8px;">
        <input type="text" id="new-task-input" class="input-field" placeholder="Add task or item..." style="margin-bottom: 0;">
        <button id="btn-add-task" class="btn btn-pink" style="padding: 0 14px; font-size: 0.78rem;">+ Add</button>
      </div>
      <div id="tasks-list-wrap" style="display: grid; gap: 6px;"></div>
    </div>
  `;

  const listWrap = document.getElementById('tasks-list-wrap');
  const input = document.getElementById('new-task-input');

  async function loadTasks() {
    const { data: tasks } = await supabase
      .from('event_tasks')
      .select('*, assignee:users!assigned_to(username)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    listWrap.innerHTML = '';
    if (!tasks || tasks.length === 0) {
      listWrap.innerHTML = '<span style="color: #64748b; font-size: 0.75rem;">No tasks yet.</span>';
      return;
    }

    tasks.forEach(t => {
      const row = document.createElement('div');
      row.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 6px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;';
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" class="task-chk" ${t.is_completed ? 'checked' : ''}>
          <span style="font-size: 0.8rem; color: ${t.is_completed ? '#64748b' : '#f8fafc'}; text-decoration: ${t.is_completed ? 'line-through' : 'none'};">${t.title}</span>
          <span style="font-size: 0.68rem; color: #00f2fe;">${t.assignee?.username ? `👤 ${t.assignee.username}` : ''}</span>
        </div>
        <div style="display: flex; gap: 4px;">
          ${!t.assigned_to ? `<button class="btn btn-claim" style="padding: 2px 6px; font-size: 0.68rem;">Claim</button>` : ''}
          <button class="btn-del" style="background: none; border: none; color: #f43f5e; cursor: pointer;">×</button>
        </div>
      `;

      row.querySelector('.task-chk').onchange = async (e) => {
        await supabase.from('event_tasks').update({ is_completed: e.target.checked }).eq('id', t.id);
      };
      const claim = row.querySelector('.btn-claim');
      if (claim) {
        claim.onclick = async () => {
          await supabase.from('event_tasks').update({ assigned_to: currentUser.id }).eq('id', t.id);
        };
      }
      row.querySelector('.btn-del').onclick = async () => {
        await supabase.from('event_tasks').delete().eq('id', t.id);
      };

      listWrap.appendChild(row);
    });
  }

  document.getElementById('btn-add-task').onclick = async () => {
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    await supabase.from('event_tasks').insert([{ event_id: eventId, title: val }]);
  };

  loadTasks();

  tasksChannel = supabase.channel(`tasks_${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_tasks', filter: `event_id=eq.${eventId}` }, () => {
      loadTasks();
    })
    .subscribe();
}
