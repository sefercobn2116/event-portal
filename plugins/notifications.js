// plugins/notifications.js
import { supabase, EMAIL_WEBHOOK_URL } from '../config.js';

export async function initPlugin(eventId, containerId) {
  // 1. Ortak Harcama Bildirim Dinleyicisi
  supabase
    .channel(`notif_expenses_${eventId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'event_expenses',
      filter: `event_id=eq.${eventId}`
    }, async (payload) => {
      const newExp = payload.new;
      if (!newExp) return;

      try {
        const [{ data: accessList }, { data: evt }] = await Promise.all([
          supabase.from('event_access').select('users(email, username)').eq('event_id', eventId),
          supabase.from('events').select('title').eq('id', eventId).single()
        ]);

        (accessList || []).forEach(a => {
          if (a.users && a.users.email && a.users.username !== newExp.payer_name) {
            fetch(EMAIL_WEBHOOK_URL, {
              method: 'POST',
              body: JSON.stringify({
                action: 'notify_new_expense',
                email: a.users.email,
                payerName: newExp.payer_name,
                description: newExp.description,
                amount: parseFloat(newExp.amount).toFixed(2),
                eventTitle: evt ? evt.title : 'Private Event'
              })
            }).catch(e => console.warn('Expense notif error:', e));
          }
        });
      } catch (err) {
        console.warn('Expense notification error:', err);
      }
    })
    .subscribe();

  // 2. Yapılacaklar & Getirilecekler (Tasks) Bildirim Dinleyicisi
  supabase
    .channel(`notif_tasks_${eventId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'event_tasks',
      filter: `event_id=eq.${eventId}`
    }, async (payload) => {
      const task = payload.new;
      if (!task) return;

      const isInsert = payload.eventType === 'INSERT';
      const isClaimed = payload.eventType === 'UPDATE' && payload.old && !payload.old.assigned_to_name && task.assigned_to_name;

      if (!isInsert && !isClaimed) return;

      try {
        const [{ data: accessList }, { data: evt }] = await Promise.all([
          supabase.from('event_access').select('users(email, username)').eq('event_id', eventId),
          supabase.from('events').select('title').eq('id', eventId).single()
        ]);

        const statusType = isClaimed ? 'claimed' : 'created';
        const actor = task.assigned_to_name || 'A member';

        (accessList || []).forEach(a => {
          if (a.users && a.users.email && a.users.username !== actor) {
            fetch(EMAIL_WEBHOOK_URL, {
              method: 'POST',
              body: JSON.stringify({
                action: 'notify_task_update',
                email: a.users.email,
                taskTitle: task.task_title,
                actorName: actor,
                statusType: statusType,
                eventTitle: evt ? evt.title : 'Private Event'
              })
            }).catch(e => console.warn('Task notif error:', e));
          }
        });
      } catch (err) {
        console.warn('Task notification error:', err);
      }
    })
    .subscribe();
}
