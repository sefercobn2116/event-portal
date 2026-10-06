// modules/booking.js
import { supabase, EMAIL_WEBHOOK_URL } from '../config.js';
import { getActiveDate, getSelectedSlots, resetSelections, renderCalendarDays } from './calendar.js';

export function initBooking() {
  const submitBtn = document.getElementById('btn-submit-booking');
  if (!submitBtn) return;

  submitBtn.onclick = async () => {
    const name = document.getElementById('book-name')?.value.trim();
    const email = document.getElementById('book-email')?.value.trim();
    const contact = document.getElementById('book-contact')?.value.trim();
    const plan = document.getElementById('book-plan')?.value.trim();
    
    const dateStr = getActiveDate();
    const slots = getSelectedSlots();

    if (!name || !email || !contact || !plan || slots.length === 0) {
      alert('Tüm alanları doldurmanız ve en az 1 saat seçmeniz gerekmektedir.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'İşleniyor...';

    try {
      // 1. Supabase'e Randevuyu Ekle
      const { error: appErr } = await supabase.from('appointments').insert([{
        appointment_date: dateStr,
        selected_slots: slots,
        client_name: name,
        client_email: email,
        client_contact: contact,
        activity_plan: plan
      }]);
      if (appErr) throw appErr;

      // 2. İlgili Slotları Rezerve Edildi Olarak İşaretle
      const { error: slotErr } = await supabase
        .from('availability_slots')
        .update({ is_booked: true })
        .eq('slot_date', dateStr)
        .in('hour_slot', slots);
      if (slotErr) throw slotErr;

      // 3. Arka Planda Google Apps Script Webhook'una İstek Gönder
      const queryParams = new URLSearchParams({
        client_name: name,
        client_email: email,
        client_contact: contact,
        activity_plan: plan,
        appointment_date: dateStr,
        selected_slots: slots.join(', ')
      }).toString();

      fetch(`${EMAIL_WEBHOOK_URL}?${queryParams}`, {
        method: 'GET',
        mode: 'no-cors'
      }).catch(e => console.warn('Mail webhook uyarısı:', e));

      alert('Randevunuz başarıyla oluşturuldu! Bilgilendirme e-postanız gönderildi.');

      // Formu temizle ve görünümü sıfırla
      document.getElementById('book-name').value = '';
      document.getElementById('book-email').value = '';
      document.getElementById('book-contact').value = '';
      document.getElementById('book-plan').value = '';
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
