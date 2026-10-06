// modules/gallery.js
import { EMAIL_WEBHOOK_URL } from '../config.js';

let currentImages = [];
let currentImageIndex = 0;
let activeFolderId = null;

export function setupLightboxDOM() {
  if (document.getElementById('global-lightbox')) return;

  const lightbox = document.createElement('div');
  lightbox.id = 'global-lightbox';
  lightbox.className = 'lightbox-overlay';
  lightbox.innerHTML = `
    <div style="position: relative; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="position: absolute; top: -45px; right: 0; display: flex; gap: 12px; align-items: center;">
        <a id="lb-download" href="#" target="_blank" download class="btn" style="padding: 6px 14px; font-size: 0.8rem; background: #00f2fe; color: #070913; text-decoration: none; font-weight: 700;">⬇ Download</a>
        <button id="lb-close" style="background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;">✕</button>
      </div>
      <button id="lb-prev" style="position: absolute; left: -50px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 1.2rem;">‹</button>
      <img id="lb-img" src="" alt="Fullscreen View" style="max-width: 85vw; max-height: 78vh; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); object-fit: contain;">
      <button id="lb-next" style="position: absolute; right: -50px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 1.2rem;">›</button>
      <div id="lb-counter" style="margin-top: 12px; color: #94a3b8; font-size: 0.85rem;"></div>
    </div>
  `;
  document.body.appendChild(lightbox);

  document.getElementById('lb-close').onclick = closeLightbox;
  lightbox.onclick = (e) => { if (e.target === lightbox) closeLightbox(); };
  document.getElementById('lb-prev').onclick = showPrevImage;
  document.getElementById('lb-next').onclick = showNextImage;

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

  const item = currentImages[currentImageIndex];
  imgEl.src = item.url;
  if (dlBtn) dlBtn.href = item.downloadUrl || item.download_url;
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
  activeFolderId = folderId;

  // Sabit Arayüz: Üst panel (Yükleme butonu) + Alt panel (Görseller alanı)
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <div style="display: flex; gap: 10px; align-items: center;">
        <label class="btn btn-pink" style="cursor: pointer; padding: 7px 16px; font-size: 0.85rem; margin: 0;">
          📤 Upload Photo to Drive
          <input type="file" id="drive-photo-input" accept="image/*" style="display: none;">
        </label>
        <span id="upload-status" style="font-size: 0.8rem; color: #00f2fe;"></span>
      </div>
      <a href="https://drive.google.com/drive/folders/${folderId}" target="_blank" class="btn" style="padding: 6px 12px; font-size: 0.75rem; text-decoration: none;">📁 Open in Drive</a>
    </div>
    <div id="drive-photos-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; min-height: 80px;">
      <p style="color: #94a3b8; font-size: 0.85rem; grid-column: 1 / -1;">Connecting to Drive folder...</p>
    </div>
  `;

  // Fotoğraf Yükleme Olayı
  const fileInput = document.getElementById('drive-photo-input');
  const uploadStatus = document.getElementById('upload-status');

  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;

    uploadStatus.style.color = '#00f2fe';
    uploadStatus.textContent = 'Uploading to Drive...';

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const payload = {
          folderId: activeFolderId,
          fileData: reader.result,
          fileName: file.name,
          mimeType: file.type
        };

        const res = await fetch(EMAIL_WEBHOOK_URL, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.status === 'success') {
          uploadStatus.style.color = '#22c55e';
          uploadStatus.textContent = '✓ Uploaded successfully!';
          setTimeout(() => uploadStatus.textContent = '', 4000);
          loadPhotosFromDrive(activeFolderId);
        } else {
          uploadStatus.style.color = '#f43f5e';
          uploadStatus.textContent = 'Upload failed: ' + (result.message || 'Error');
        }
      } catch (err) {
        uploadStatus.style.color = '#f43f5e';
        uploadStatus.textContent = 'Error: ' + err.message;
      }
    };
    reader.readAsDataURL(file);
  };

  loadPhotosFromDrive(folderId);
}

async function loadPhotosFromDrive(folderId) {
  const grid = document.getElementById('drive-photos-grid');
  if (!grid) return;

  try {
    const res = await fetch(`${EMAIL_WEBHOOK_URL}?action=get_drive_photos&folderId=${folderId}`);
    const data = await res.json();

    if (data.status !== 'success' || !data.photos || data.photos.length === 0) {
      grid.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; grid-column: 1 / -1;">No photos in this folder yet. Click "Upload Photo to Drive" above to add the first picture!</p>';
      currentImages = [];
      return;
    }

    currentImages = data.photos;
    grid.innerHTML = '';

    currentImages.forEach((imgObj, idx) => {
      const thumb = document.createElement('img');
      thumb.src = imgObj.url;
      thumb.alt = imgObj.name;
      thumb.style.cssText = 'width: 100%; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); transition: 0.2s;';
      thumb.onmouseover = () => { thumb.style.transform = 'scale(1.03)'; thumb.style.borderColor = '#00f2fe'; };
      thumb.onmouseout = () => { thumb.style.transform = 'scale(1)'; thumb.style.borderColor = 'rgba(255,255,255,0.12)'; };
      thumb.onclick = () => openLightbox(idx);
      grid.appendChild(thumb);
    });

  } catch (err) {
    grid.innerHTML = `<p style="color: #f43f5e; font-size: 0.85rem; grid-column: 1 / -1;">Failed to fetch photos: ${err.message}</p>`;
  }
}
