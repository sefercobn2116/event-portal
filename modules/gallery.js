// modules/gallery.js
import { EMAIL_WEBHOOK_URL } from '../config.js';

export async function renderEventGallery(containerId, driveFolderId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div>
      <div style="display: flex; gap: 8px; margin-bottom: 10px; align-items: center;">
        <input type="file" id="gal-file-input" accept="image/*" style="display: none;">
        <button id="btn-trigger-gal-upload" class="btn btn-pink" style="padding: 4px 12px; font-size: 0.78rem;">📸 Upload Photo</button>
        <button id="btn-refresh-gal" class="btn" style="padding: 4px 10px; font-size: 0.78rem;">↻</button>
        <span id="gal-status" style="font-size: 0.75rem; color: #94a3b8;"></span>
      </div>
      <div id="gal-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">
        <span style="color: #64748b; font-size: 0.75rem;">Loading photos...</span>
      </div>

      <!-- Sayfa İçi Tam Ekran Lightbox & İndirme -->
      <div id="gallery-lightbox" class="lightbox-overlay" style="display: none;">
        <div class="glass-box" style="max-width: 90vw; max-height: 85vh; text-align: center; position: relative; padding: 12px;">
          <button id="btn-close-lightbox" style="position: absolute; top: 8px; right: 12px; background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer;">✕</button>
          <img id="lightbox-img" src="" style="max-width: 100%; max-height: 65vh; border-radius: 6px; object-fit: contain; margin-bottom: 10px;">
          <div>
            <a id="lightbox-download-btn" href="#" download="event_photo.jpg" class="btn btn-pink" style="padding: 6px 16px; font-size: 0.8rem; text-decoration: none;">
              ⬇️ Download Photo (İndir)
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  const fileInput = document.getElementById('gal-file-input');
  const triggerBtn = document.getElementById('btn-trigger-gal-upload');
  const refreshBtn = document.getElementById('btn-refresh-gal');
  const statusEl = document.getElementById('gal-status');
  const grid = document.getElementById('gal-grid');
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxDownload = document.getElementById('lightbox-download-btn');
  const closeLightbox = document.getElementById('btn-close-lightbox');

  triggerBtn.onclick = () => fileInput.click();
  closeLightbox.onclick = () => lightbox.style.display = 'none';
  lightbox.onclick = (e) => { if (e.target === lightbox) lightbox.style.display = 'none'; };

  async function loadPhotos() {
    if (!driveFolderId) {
      grid.innerHTML = '<span style="color: #64748b; font-size: 0.75rem;">No folder attached.</span>';
      return;
    }
    grid.innerHTML = '<span style="color: #94a3b8; font-size: 0.75rem;">Loading...</span>';
    try {
      const res = await fetch(EMAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'list_media', folderId: driveFolderId })
      });
      const data = await res.json();
      if (!data.files || data.files.length === 0) {
        grid.innerHTML = '<span style="color: #64748b; font-size: 0.75rem;">No photos yet.</span>';
        return;
      }
      grid.innerHTML = '';
      data.files.forEach(f => {
        const item = document.createElement('div');
        item.style.cssText = 'border-radius: 6px; overflow: hidden; border: 1px solid rgba(0,242,254,0.3); aspect-ratio: 1; cursor: pointer; background: #000;';
        const thumbUrl = `https://drive.google.com/thumbnail?id=${f.id}&sz=w600`;
        item.innerHTML = `<img src="${thumbUrl}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">`;
        
        item.onclick = () => {
          lightboxImg.src = thumbUrl;
          lightboxDownload.href = `https://drive.google.com/uc?export=download&id=${f.id}`;
          lightbox.style.display = 'flex';
        };
        grid.appendChild(item);
      });
    } catch (err) {
      grid.innerHTML = '<span style="color: #f43f5e; font-size: 0.75rem;">Failed to load.</span>';
    }
  }

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    statusEl.style.color = '#00f2fe';
    statusEl.textContent = 'Uploading...';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await fetch(EMAIL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'upload_media',
            folderId: driveFolderId,
            fileName: file.name,
            contentType: file.type,
            base64Data: ev.target.result
          })
        });
        const data = await res.json();
        if (data.status === 'success') {
          statusEl.style.color = '#22c55e';
          statusEl.textContent = '✓ Done!';
          setTimeout(() => { statusEl.textContent = ''; loadPhotos(); }, 1500);
        } else throw new Error();
      } catch (err) {
        statusEl.style.color = '#f43f5e';
        statusEl.textContent = 'Upload failed';
      }
    };
    reader.readAsDataURL(file);
  };

  refreshBtn.onclick = loadPhotos;
  loadPhotos();
}
