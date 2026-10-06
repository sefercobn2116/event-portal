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
      alert('Lütfen önce oturum açın.');
      return;
    }

    // Kullanıcı bilgileri artık doğrudan oturumdan (session) alınıyor
    const clientName = user.username || 'Kullanıcı';
    const clientEmail = user.email || '';
    const contact = document.getElementById('book-contact')?.value.trim() || 'Belirtilmedi';
    const plan = document.getElementById('book-plan')?.value.trim();

    const dateStr = getActiveDate();
    const slots = getSelectedSlots();

    if (!plan || slots.length === 0) {
      alert('Lütfen bir açıklama yazın ve en az bir saat seçin.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'İşleniyor...';

    try {
      // 1. Supabase'e Randevuyu Ekle
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

      // 3. Arka Planda Google Apps Script Webhook'una Bildir
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
      }).catch(e => console.warn('Mail webhook uyarısı:', e));

      alert(`Randevunuz alındı! Onay maili ${clientEmail} adresinize iletildi.`);

      // Formu temizle ve görünümü sıfırla
      if (document.getElementById('book-contact')) document.getElementById('book-contact').value = '';
      if (document.getElementById('book-plan')) document.getElementById('book-plan').value = '';
      resetSelections();
      await renderCalendarDays();

    } catch (err) {
      alert('Rezervasyon kaydedilirken hata oluştu: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Booking Now';
    }
  };
}
