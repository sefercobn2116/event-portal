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
      <div style="display: flex; gap: 8px; margin-bottom: 10px;">
        <input type="text" id="new-task-input" class="input-field" placeholder="Bring item / Assign task (e.g. Speakers, Ice, Drinks)..." style="margin-bottom: 0;">
        <button id="btn-add-task" class="btn btn-pink" style="padding: 0 16px; font-size: 0.8rem; white-space: nowrap;">+ Add</button>
      </div>
      <div id="tasks-list-wrap" style="display: grid; gap: 6px;"></div>
    </div>
  `;

  const listWrap = document.getElementById('tasks-list-wrap');
  const input = document.getElementById('new-task-input');
  const addBtn = document.getElementById('btn-add-task');

  async function loadTasks() {
    const { data: tasks } = await supabase
      .from('event_tasks')
      .select('*, assignee:users!assigned_to(username)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    listWrap.innerHTML = '';
    if (!tasks || tasks.length === 0) {
      listWrap.innerHTML = '<span style="color: #64748b; font-size: 0.78rem;">No tasks yet. Add what you or others should bring!</span>';
      return;
    }

    tasks.forEach(t => {
      const row = document.createElement('div');
      row.style.cssText = `
        background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 8px 12px;
        border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px;
      `;
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" class="task-chk" ${t.is_completed ? 'checked' : ''} style="cursor: pointer;">
          <span style="font-size: 0.82rem; color: ${t.is_completed ? '#64748b' : '#f8fafc'}; text-decoration: ${t.is_completed ? 'line-through' : 'none'};">
            ${t.title}
          </span>
          <span style="font-size: 0.7rem; color: #00f2fe; background: rgba(0,242,254,0.1); padding: 2px 6px; border-radius: 4px;">
            ${t.assignee?.username ? `👤 ${t.assignee.username}` : 'Unassigned'}
          </span>
        </div>
        <div style="display: flex; gap: 6px;">
          ${!t.assigned_to ? `<button class="btn btn-claim" style="padding: 2px 8px; font-size: 0.7rem;">I'll bring this</button>` : ''}
          <button class="btn-del-task" style="background: none; border: none; color: #f43f5e; cursor: pointer; font-size: 0.8rem;">×</button>
        </div>
      `;

      row.querySelector('.task-chk').onchange = async (e) => {
        await supabase.from('event_tasks').update({ is_completed: e.target.checked }).eq('id', t.id);
      };

      const claimBtn = row.querySelector('.btn-claim');
      if (claimBtn) {
        claimBtn.onclick = async () => {
          await supabase.from('event_tasks').update({ assigned_to: currentUser.id }).eq('id', t.id);
        };
      }

      row.querySelector('.btn-del-task').onclick = async () => {
        await supabase.from('event_tasks').delete().eq('id', t.id);
      };

      listWrap.appendChild(row);
    });
  }

  addBtn.onclick = async () => {
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    await supabase.from('event_tasks').insert([{ event_id: eventId, title: title }]);
  };

  loadTasks();

  // CANLI REALTIME YAYINI
  tasksChannel = supabase.channel(`tasks_${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_tasks', filter: `event_id=eq.${eventId}` }, () => {
      loadTasks();
    })
    .subscribe();
}
