// modules/gallery.js
import { EMAIL_WEBHOOK_URL } from '../config.js';

export async function renderEventGallery(containerId, driveFolderId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div>
      <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap;">
        <input type="file" id="gal-file-input" accept="image/*" style="display: none;">
        <button id="btn-trigger-gal-upload" class="btn btn-pink" style="padding: 6px 14px; font-size: 0.8rem; cursor: pointer;">
          📸 Upload Photo
        </button>
        <button id="btn-refresh-gal" class="btn" style="padding: 6px 12px; font-size: 0.8rem;">↻ Refresh</button>
        <span id="gal-status" style="font-size: 0.75rem; color: #94a3b8;"></span>
      </div>
      <div id="gal-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px;">
        <span style="color: #64748b; font-size: 0.8rem;">Loading gallery...</span>
      </div>
    </div>
  `;

  const fileInput = document.getElementById('gal-file-input');
  const triggerBtn = document.getElementById('btn-trigger-gal-upload');
  const refreshBtn = document.getElementById('btn-refresh-gal');
  const statusEl = document.getElementById('gal-status');
  const grid = document.getElementById('gal-grid');

  triggerBtn.onclick = () => fileInput.click();

  async function loadPhotos() {
    if (!driveFolderId) {
      grid.innerHTML = '<span style="color: #64748b; font-size: 0.78rem;">No Drive folder attached to this event.</span>';
      return;
    }
    grid.innerHTML = '<span style="color: #94a3b8; font-size: 0.78rem;">Fetching photos...</span>';
    try {
      const res = await fetch(EMAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'list_media', folderId: driveFolderId })
      });
      const data = await res.json();
      if (!data.files || data.files.length === 0) {
        grid.innerHTML = '<span style="color: #64748b; font-size: 0.78rem;">No photos uploaded yet. Be the first!</span>';
        return;
      }
      grid.innerHTML = '';
      data.files.forEach(f => {
        const item = document.createElement('a');
        item.href = f.viewUrl || f.url;
        item.target = '_blank';
        item.style.cssText = 'display: block; border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,242,254,0.3); position: relative; aspect-ratio: 1;';
        item.innerHTML = `<img src="${f.thumbnail || f.url}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">`;
        grid.appendChild(item);
      });
    } catch (err) {
      grid.innerHTML = '<span style="color: #f43f5e; font-size: 0.78rem;">Failed to load photos. Check Webhook deployment.</span>';
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
          statusEl.textContent = '✓ Uploaded!';
          setTimeout(() => { statusEl.textContent = ''; loadPhotos(); }, 1500);
        } else {
          throw new Error(data.message || 'Upload failed');
        }
      } catch (err) {
        statusEl.style.color = '#f43f5e';
        statusEl.textContent = 'Upload error: ' + err.message;
      }
    };
    reader.readAsDataURL(file);
  };

  refreshBtn.onclick = loadPhotos;
  loadPhotos();
}
