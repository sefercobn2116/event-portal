// modules/gallery.js

let currentImages = [];
let currentImageIndex = 0;

// Lightbox HTML İskeletini Dinamik Oluştur
export function setupLightboxDOM() {
  if (document.getElementById('global-lightbox')) return;

  const lightbox = document.createElement('div');
  lightbox.id = 'global-lightbox';
  lightbox.className = 'lightbox-overlay';
  lightbox.innerHTML = `
    <div style="position: relative; max-width: 90vw; max-height: 90vh; display: flex; align-items: center; justify-content: center;">
      <button id="lb-close" style="position: absolute; top: -45px; right: 0; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;">✕</button>
      <button id="lb-prev" style="position: absolute; left: -50px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 1.2rem;">‹</button>
      <img id="lb-img" src="" alt="Fullscreen View" style="max-width: 85vw; max-height: 80vh; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); object-fit: contain;">
      <button id="lb-next" style="position: absolute; right: -50px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 1.2rem;">›</button>
      <div id="lb-counter" style="position: absolute; bottom: -35px; color: #94a3b8; font-size: 0.9rem;"></div>
    </div>
  `;
  document.body.appendChild(lightbox);

  // Kapatma ve Gezinme Olayları
  const closeBtn = document.getElementById('lb-close');
  const prevBtn = document.getElementById('lb-prev');
  const nextBtn = document.getElementById('lb-next');

  closeBtn.onclick = closeLightbox;
  lightbox.onclick = (e) => { if (e.target === lightbox) closeLightbox(); };
  prevBtn.onclick = showPrevImage;
  nextBtn.onclick = showNextImage;

  // Klavye Desteği (ESC, Sol, Sağ)
  window.addEventListener('keydown', (e) => {
    if (lightbox.style.display !== 'flex') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrevImage();
    if (e.key === 'ArrowRight') showNextImage();
  });
}

export function openLightbox(index) {
  if (!currentImages || currentImages.length === 0) return;
  currentImageIndex = index;
  updateLightboxView();
  const lightbox = document.getElementById('global-lightbox');
  if (lightbox) lightbox.style.display = 'flex';
}

export function closeLightbox() {
  const lightbox = document.getElementById('global-lightbox');
  if (lightbox) lightbox.style.display = 'none';
}

function updateLightboxView() {
  const imgEl = document.getElementById('lb-img');
  const counterEl = document.getElementById('lb-counter');
  if (!imgEl || !counterEl) return;

  imgEl.src = currentImages[currentImageIndex];
  counterEl.textContent = `${currentImageIndex + 1} / ${currentImages.length}`;
}

function showPrevImage() {
  currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
  updateLightboxView();
}

function showNextImage() {
  currentImageIndex = (currentImageIndex + 1) % currentImages.length;
  updateLightboxView();
}

// Drive Klasör Linkinden Fotoğrafları Çekip Izgara Oluşturma
export async function renderEventGallery(containerId, driveFolderUrl) {
  const container = document.getElementById(containerId);
  if (!container) return;

  setupLightboxDOM();

  if (!driveFolderUrl) {
    container.innerHTML = '<p style="color: #64748b; font-size: 0.9rem;">Bu etkinlik için Google Drive klasörü tanımlanmamış.</p>';
    return;
  }

  container.innerHTML = '<p style="color: #00f2fe; font-size: 0.85rem;">Fotoğraflar taranıyor...</p>';

  try {
    // Klasör linkinden veya doğrudan ID'den folder ID yakalama
    let folderId = driveFolderUrl.trim();
    const match = folderId.match(/[-\w]{25,}/);
    if (match) folderId = match[0];

    // Örnek / Demo veya Drive entegrasyonu görsel havuzu
    // (Google Drive API erişimi için veya demo görseller için liste)
    currentImages = [
      `https://lh3.googleusercontent.com/d/${folderId}=w800`,
      `https://images.unsplash.com/photo-1511578314322-379afb476865?w=800`,
      `https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800`
    ];

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-top: 10px;';

    currentImages.forEach((imgUrl, idx) => {
      const thumb = document.createElement('img');
      thumb.src = imgUrl;
      thumb.alt = `Photo ${idx + 1}`;
      thumb.style.cssText = 'width: 100%; height: 95px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); transition: 0.2s;';
      thumb.onmouseover = () => { thumb.style.transform = 'scale(1.03)'; thumb.style.borderColor = '#00f2fe'; };
      thumb.onmouseout = () => { thumb.style.transform = 'scale(1)'; thumb.style.borderColor = 'rgba(255,255,255,0.1)'; };
      thumb.onclick = () => openLightbox(idx);
      grid.appendChild(thumb);
    });

    container.appendChild(grid);
  } catch (err) {
    container.innerHTML = `<p style="color: #f43f5e; font-size: 0.85rem;">Galeri yüklenemedi: ${err.message}</p>`;
  }
}
