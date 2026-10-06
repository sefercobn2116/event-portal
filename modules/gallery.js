// modules/gallery.js

let currentImages = [];
let currentImageIndex = 0;

export function setupLightboxDOM() {
  if (document.getElementById('global-lightbox')) return;

  const lightbox = document.createElement('div');
  lightbox.id = 'global-lightbox';
  lightbox.className = 'lightbox-overlay';
  lightbox.innerHTML = `
    <div style="position: relative; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="position: absolute; top: -45px; right: 0; display: flex; gap: 12px; align-items: center;">
        <a id="lb-download" href="#" target="_blank" download class="btn" style="padding: 6px 14px; font-size: 0.8rem; background: #00f2fe; color: #070913; text-decoration: none;">⬇ Download</a>
        <button id="lb-close" style="background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;">✕</button>
      </div>
      <button id="lb-prev" style="position: absolute; left: -50px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 1.2rem;">‹</button>
      <img id="lb-img" src="" alt="Fullscreen View" style="max-width: 85vw; max-height: 78vh; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); object-fit: contain;">
      <button id="lb-next" style="position: absolute; right: -50px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 1.2rem;">›</button>
      <div id="lb-counter" style="margin-top: 12px; color: #94a3b8; font-size: 0.85rem;"></div>
    </div>
  `;
  document.body.appendChild(lightbox);

  const closeBtn = document.getElementById('lb-close');
  const prevBtn = document.getElementById('lb-prev');
  const nextBtn = document.getElementById('lb-next');

  closeBtn.onclick = closeLightbox;
  lightbox.onclick = (e) => { if (e.target === lightbox) closeLightbox(); };
  prevBtn.onclick = showPrevImage;
  nextBtn.onclick = showNextImage;

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
  const dlBtn = document.getElementById('lb-download');
  if (!imgEl || !counterEl) return;

  const url = currentImages[currentImageIndex];
  imgEl.src = url;
  if (dlBtn) dlBtn.href = url;
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

export async function renderEventGallery(containerId, driveFolderUrl) {
  const container = document.getElementById(containerId);
  if (!container) return;

  setupLightboxDOM();

  if (!driveFolderUrl) {
    container.innerHTML = '<p style="color: #64748b; font-size: 0.85rem;">No Google Drive folder linked for this event.</p>';
    return;
  }

  let folderId = driveFolderUrl.trim();
  const match = folderId.match(/[-\w]{25,}/);
  if (match) folderId = match[0];

  container.innerHTML = '<p style="color: #00f2fe; font-size: 0.85rem;">Fetching Drive photos...</p>';

  try {
    currentImages = [
      `https://lh3.googleusercontent.com/d/${folderId}=w1600`,
      `https://drive.google.com/uc?export=view&id=${folderId}`
    ];

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-size: 0.8rem; color: #94a3b8;">Google Drive Connected</span>
        <a href="https://drive.google.com/drive/folders/${folderId}" target="_blank" class="btn" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none;">📁 Open Drive Folder</a>
      </div>
      <div id="drive-photos-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px;"></div>
    `;

    const grid = document.getElementById('drive-photos-grid');
    currentImages.forEach((imgUrl, idx) => {
      const thumb = document.createElement('img');
      thumb.src = imgUrl;
      thumb.alt = `Drive Image ${idx + 1}`;
      thumb.style.cssText = 'width: 100%; height: 95px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); transition: 0.2s;';
      thumb.onerror = () => { thumb.style.display = 'none'; };
      thumb.onclick = () => openLightbox(idx);
      grid.appendChild(thumb);
    });

  } catch (err) {
    container.innerHTML = `<p style="color: #f43f5e; font-size: 0.85rem;">Failed to load photos: ${err.message}</p>`;
  }
}
