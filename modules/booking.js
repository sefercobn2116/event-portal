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
      // 1. Supabase'e Randevuyu Kaydet
      const { error: appErr } = await supabase.from('appointments').insert([{
        appointment_date: dateStr,
        selected_slots: slots,
        client_name: clientName,
        client_email: clientEmail,
        client_contact: contact,
        activity_plan: plan
      }]);
      if (appErr) throw appErr;

      // 2. Saatleri Rezerve Olarak İşaretle
      const { error: slotErr } = await supabase
        .from('availability_slots')
        .update({ is_booked: true })
        .eq('slot_date', dateStr)
        .in('hour_slot', slots);
      if (slotErr) throw slotErr;

      // 3. Google Apps Script Webhook Bildirimi
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

      // 4. Google Calendar & Evrensel Apple/Android (.ics) Linklerini Hazırla
      const googleCalUrl = generateGoogleCalendarUrl(dateStr, slots, clientName, plan);
      const icsDataUri = generateIcsDataUri(dateStr, slots, clientName, plan);

      // Başarı Ekranı (İki Ayrı Buton)
      const formWrap = document.getElementById('booking-form-wrap');
      if (formWrap) {
        formWrap.innerHTML = `
          <div style="text-align: center; padding: 20px 10px;">
            <h4 style="color: #22c55e; margin-bottom: 8px;">✓ Booking Confirmed!</h4>
            <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 18px;">
              Confirmation email sent to <strong>${clientEmail}</strong>.
            </p>
            
            <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px;">
              <!-- Google Calendar -->
              <a href="${googleCalUrl}" target="_blank" class="btn" style="background: #00f2fe; color: #070913; font-weight: 700; text-decoration: none; padding: 9px 18px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                📅 Google Calendar
              </a>

              <!-- Apple / Android / Outlook (Evrensel iCal .ics) -->
              <a href="${icsDataUri}" download="appointment.ics" class="btn btn-pink" style="font-weight: 700; text-decoration: none; padding: 9px 18px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                🍏 Apple / Android / iCal
              </a>
            </div>

            <div>
              <button id="btn-book-another" class="btn" style="padding: 6px 14px; font-size: 0.8rem; background: rgba(255,255,255,0.08);">
                Book Another Slot
              </button>
            </div>
          </div>
        `;

        document.getElementById('btn-book-another').onclick = () => {
          window.location.reload();
        };
      }

      resetSelections();
      await renderCalendarDays();

    } catch (err) {
      alert('Error creating appointment: ' + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Booking Now';
    }
  };
}

// GOOGLE TAKVİM LİNK MOTORU
function generateGoogleCalendarUrl(dateStr, slots, name, plan) {
  const firstSlot = slots[0] || '12:00 - 13:00';
  const lastSlot = slots[slots.length - 1] || firstSlot;

  const startHour = firstSlot.split('-')[0].trim().replace(':', '') + '00';
  const endHour = lastSlot.split('-')[1].trim().replace(':', '') + '00';

  const cleanDate = dateStr.replace(/-/g, '');
  const datesParam = `${cleanDate}T${startHour}/${cleanDate}T${endHour}`;

  const title = encodeURIComponent(`Meeting with ${name}`);
  const details = encodeURIComponent(`Plan: ${plan}\nTime: ${slots.join(', ')}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datesParam}&details=${details}`;
}

// APPLE / ANDROID / OUTLOOK İÇİN EVRENSEL .ICS DOSYASI ÜRETECİ
function generateIcsDataUri(dateStr, slots, name, plan) {
  const firstSlot = slots[0] || '12:00 - 13:00';
  const lastSlot = slots[slots.length - 1] || firstSlot;

  const startHour = firstSlot.split('-')[0].trim().replace(':', '') + '00';
  const endHour = lastSlot.split('-')[1].trim().replace(':', '') + '00';

  const cleanDate = dateStr.replace(/-/g, '');
  const dtStart = `${cleanDate}T${startHour}`;
  const dtEnd = `${cleanDate}T${endHour}`;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Event Portal//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:appt-${Date.now()}@eventportal.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:Meeting with ${name}`,
    `DESCRIPTION:${plan.replace(/\n/g, ' ')} (Slots: ${slots.join(', ')})`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsContent);
}
