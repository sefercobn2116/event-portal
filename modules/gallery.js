// modules/gallery.js
import { EMAIL_WEBHOOK_URL } from '../config.js';

let currentMedia = [];
let currentMediaIndex = 0;
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
      
      <div id="lb-media-container" style="max-width: 85vw; max-height: 78vh; display: flex; justify-content: center; align-items: center;"></div>
      
      <button id="lb-next" style="position: absolute; right: -50px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 1.2rem;">›</button>
      <div id="lb-counter" style="margin-top: 12px; color: #94a3b8; font-size: 0.85rem;"></div>
    </div>
  `;
  document.body.appendChild(lightbox);

  document.getElementById('lb-close').onclick = closeLightbox;
  lightbox.onclick = (e) => { if (e.target === lightbox) closeLightbox(); };
  document.getElementById('lb-prev').onclick = showPrevMedia;
  document.getElementById('lb-next').onclick = showNextMedia;

  window.addEventListener('keydown', (e) => {
    if (lightbox.style.display !== 'flex') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrevMedia();
    if (e.key === 'ArrowRight') showNextMedia();
  });
}

export function openLightbox(index) {
  if (!currentMedia || currentMedia.length === 0) return;
  currentMediaIndex = index;
  updateLightboxView();
  const lightbox = document.getElementById('global-lightbox');
  if (lightbox) lightbox.style.display = 'flex';
}

export function closeLightbox() {
  const lightbox = document.getElementById('global-lightbox');
  if (lightbox) {
    lightbox.style.display = 'none';
    const container = document.getElementById('lb-media-container');
    if (container) container.innerHTML = '';
  }
}

function updateLightboxView() {
  const container = document.getElementById('lb-media-container');
  const counterEl = document.getElementById('lb-counter');
  const dlBtn = document.getElementById('lb-download');
  if (!container || !counterEl) return;

  const item = currentMedia[currentMediaIndex];
  container.innerHTML = '';

  if (item.type === 'video') {
    container.innerHTML = `<iframe src="${item.url}" style="width: 80vw; height: 70vh; border: none; border-radius: 12px;" allow="autoplay"></iframe>`;
  } else {
    container.innerHTML = `<img src="${item.url}" alt="${item.name}" style="max-width: 85vw; max-height: 78vh; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); object-fit: contain;">`;
  }

  if (dlBtn) dlBtn.href = item.downloadUrl;
  counterEl.textContent = `${currentMediaIndex + 1} / ${currentMedia.length} • ${item.name}`;
}

function showPrevMedia() {
  currentMediaIndex = (currentMediaIndex - 1 + currentMedia.length) % currentMedia.length;
  updateLightboxView();
}

function showNextMedia() {
  currentMediaIndex = (currentMediaIndex + 1) % currentMedia.length;
  updateLightboxView();
}

export async function renderEventGallery(containerId, driveFolderUrl) {
  const container = document.getElementById(containerId);
  if (!container) return;

  setupLightboxDOM();

  if (!driveFolderUrl) {
    container.innerHTML = '<p style="color: #64748b; font-size: 0.85rem;">No Google Drive folder assigned for this event.</p>';
    return;
  }

  let folderId = driveFolderUrl.trim();
  const match = folderId.match(/[-\w]{25,}/);
  if (match) folderId = match[0];
  activeFolderId = folderId;

  // Dışarıya link veren hiçbir buton yok. Sadece toplu dosya seçtirici buton var:
  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <label class="btn btn-pink" style="cursor: pointer; padding: 8px 20px; font-size: 0.85rem; margin: 0; display: inline-flex; align-items: center; gap: 6px;">
          📤 Select & Upload Photos/Videos
          <input type="file" id="drive-photo-input" accept="image/*,video/*" multiple style="display: none;">
        </label>
        <span id="upload-status" style="font-size: 0.85rem; font-weight: 600;"></span>
      </div>
    </div>
    <div id="drive-photos-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; min-height: 80px;">
      <p style="color: #00f2fe; font-size: 0.85rem; grid-column: 1 / -1;">Reading media files from Drive...</p>
    </div>
  `;

  // Toplu Dosya Yükleme Motoru
  const fileInput = document.getElementById('drive-photo-input');
  const uploadStatus = document.getElementById('upload-status');

  fileInput.onchange = async () => {
    const files = Array.from(fileInput.files);
    if (!files.length) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      uploadStatus.style.color = '#00f2fe';
      uploadStatus.textContent = `Uploading ${i + 1}/${files.length}: ${file.name}...`;

      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const payload = {
              folderId: activeFolderId,
              fileData: reader.result,
              fileName: file.name,
              mimeType: file.type
            };

            await fetch(EMAIL_WEBHOOK_URL, {
              method: 'POST',
              body: JSON.stringify(payload)
            });
          } catch (e) {
            console.error(e);
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    uploadStatus.style.color = '#22c55e';
    uploadStatus.textContent = `✓ Successfully uploaded ${files.length} file(s)!`;
    setTimeout(() => { uploadStatus.textContent = ''; }, 4000);
    loadMediaFromDrive(activeFolderId);
  };

  loadMediaFromDrive(folderId);
}

async function loadMediaFromDrive(folderId) {
  const grid = document.getElementById('drive-photos-grid');
  if (!grid) return;

  try {
    const res = await fetch(`${EMAIL_WEBHOOK_URL}?action=get_drive_photos&folderId=${folderId}`);
    const data = await res.json();

    if (data.status !== 'success' || !data.photos || data.photos.length === 0) {
      grid.innerHTML = '<p style="color: #94a3b8; font-size: 0.85rem; grid-column: 1 / -1;">No photos or videos in this event yet. Use the upload button above to add media!</p>';
      currentMedia = [];
      return;
    }

    currentMedia = data.photos;
    grid.innerHTML = '';

    currentMedia.forEach((item, idx) => {
      const card = document.createElement('div');
      card.style.cssText = 'position: relative; height: 110px; border-radius: 8px; overflow: hidden; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); transition: 0.2s; background: #000;';
      
      if (item.type === 'video') {
        card.innerHTML = `
          <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,242,254,0.08);">
            <span style="font-size: 1.8rem;">🎬</span>
            <span style="font-size: 0.7rem; color: #fff; max-width: 90%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</span>
          </div>
        `;
      } else {
        card.innerHTML = `<img src="${item.url}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;">`;
      }

      card.onmouseover = () => { card.style.transform = 'scale(1.03)'; card.style.borderColor = '#00f2fe'; };
      card.onmouseout = () => { card.style.transform = 'scale(1)'; card.style.borderColor = 'rgba(255,255,255,0.12)'; };
      card.onclick = () => openLightbox(idx);
      grid.appendChild(card);
    });

  } catch (err) {
    grid.innerHTML = `<p style="color: #f43f5e; font-size: 0.85rem; grid-column: 1 / -1;">Failed to load media: ${err.message}</p>`;
  }
}
