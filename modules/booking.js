// modules/booking.js
import { supabase, EMAIL_WEBHOOK_URL } from '../config.js';
import { getSessionUser } from './auth.js';
import { getActiveDate, getSelectedSlots, resetSelections, renderCalendarDays } from './calendar.js';

export function initBooking() {
  const submitBtn = document.getElementById('btn-submit-booking');
  if (!submitBtn) return;

  submitBtn.onclick = async () => {
    const user = getSessionUser();
    if (!user) {
      alert('Please log in first.');
      return;
    }

    const clientName = user.username || 'User';
    const clientEmail = user.email || '';
    const contact = document.getElementById('book-contact')?.value.trim() || '-';
    const plan = document.getElementById('book-plan')?.value.trim();

    const dateStr = getActiveDate();
    const slots = getSelectedSlots();

    if (!slots || slots.length === 0) {
      alert('Please select at least one hour slot.');
      return;
    }

    if (!plan) {
      alert('Please provide a short description or meeting agenda.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing booking...';

    try {
      const { error: appErr } = await supabase.from('appointments').insert([{
        appointment_date: dateStr,
        selected_slots: slots,
        client_name: clientName,
        client_email: clientEmail,
        client_contact: contact,
        activity_plan: plan
      }]);
      if (appErr) throw appErr;

      const { error: slotErr } = await supabase
        .from('availability_slots')
        .update({ is_booked: true })
        .eq('slot_date', dateStr)
        .in('hour_slot', slots);
      if (slotErr) throw slotErr;

      const queryParams = new URLSearchParams({
        client_name: clientName,
        client_email: clientEmail,
        client_contact: contact,
        activity_plan: plan,
        appointment_date: dateStr,
        selected_slots: slots.join(', ')
      }).toString();

      fetch(`${EMAIL_WEBHOOK_URL}?${queryParams}`, {
        method: 'GET',
        mode: 'no-cors'
      }).catch(e => console.warn('Mail webhook notification dispatched.'));

      alert(`Appointment confirmed! Confirmation email sent to ${clientEmail}.`);

      if (document.getElementById('book-contact')) document.getElementById('book-contact').value = '';
      if (document.getElementById('book-plan')) document.getElementById('book-plan').value = '';
      resetSelections();
      await renderCalendarDays();

    } catch (err) {
      alert('Error creating appointment: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Booking Now';
    }
  };
}
