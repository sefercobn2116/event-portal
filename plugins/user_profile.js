// plugins/user_profile.js
import { supabase } from '../config.js';
import { getSessionUser } from '../modules/auth.js';

export async function initPlugin(contextId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const user = getSessionUser();
  if (!user) return;

  let currentAvatar = user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;

  container.innerHTML = `
    <div class="glass-box" style="margin-bottom: 20px; border: 1px solid rgba(0, 242, 254, 0.25); background: linear-gradient(135deg, rgba(18, 24, 43, 0.8), rgba(7, 9, 19, 0.95));">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img id="plug-prof-current-avatar" src="${currentAvatar}" style="width: 52px; height: 52px; border-radius: 50%; border: 2px solid #00f2fe; background: #070913; object-fit: cover; box-shadow: 0 0 12px rgba(0, 242, 254, 0.35);" alt="Avatar">
          <div>
            <h4 style="color: #00f2fe; margin: 0; font-size: 1rem;">Profile & Avatar Settings</h4>
            <span style="font-size: 0.78rem; color: #94a3b8;">${user.username} • ${user.email}</span>
          </div>
        </div>
        <button id="btn-toggle-profile-edit" class="btn" style="padding: 4px 12px; font-size: 0.75rem;">Edit Profile</button>
      </div>

      <!-- Düzenleme Paneli -->
      <div id="plug-profile-edit-form" style="display: none; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px; margin-top: 10px;">
        
        <!-- 1. KENDİ FOTOĞRAFINI YÜKLEME ALANI -->
        <div style="background: rgba(0,0,0,0.3); border: 1px dashed rgba(0, 242, 254, 0.4); padding: 14px; border-radius: 10px; margin-bottom: 14px; text-align: center;">
          <label style="display: block; font-size: 0.8rem; color: #00f2fe; margin-bottom: 8px; font-weight: 700;">
            📸 Upload Your Own Picture
          </label>
          <input type="file" id="plug-avatar-file-input" accept="image/*" style="display: none;">
          <button id="btn-trigger-avatar-file" class="btn btn-pink" style="padding: 6px 16px; font-size: 0.8rem; cursor: pointer;">
            Choose from Gallery / Camera
          </button>
          <div id="plug-file-upload-status" style="font-size: 0.72rem; color: #94a3b8; margin-top: 6px;">Supports JPG, PNG, WEBP (Auto-optimized)</div>
        </div>

        <!-- 2. VEYA HAZIR BOT SEÇ -->
        <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 6px;">Or pick a preset avatar:</label>
        <div id="plug-avatar-picker-grid" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 14px;"></div>

        <!-- 3. ŞİFRE GÜNCELLEME -->
        <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px;">Update Password (Leave blank to keep unchanged):</label>
        <input type="password" id="plug-prof-new-pass" class="input-field" placeholder="New Password" style="margin-bottom: 12px;">

        <button id="btn-save-user-profile" class="btn" style="width: 100%; min-height: 40px; font-size: 0.85rem; font-weight: 700;">Save Profile & Picture</button>
        <div id="plug-profile-save-status" style="margin-top: 8px; font-size: 0.8rem; text-align: center;"></div>
      </div>
    </div>
  `;

  // Hazır bot avatarları
  const avatarStyles = ['Nova', 'Cipher', 'Vortex', 'Shadow', 'Neon', 'Specter', 'Zephyr', 'Orion'];
  const grid = document.getElementById('plug-avatar-picker-grid');

  avatarStyles.forEach(name => {
    const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = `width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 2px solid ${currentAvatar === url ? '#ff007f' : 'transparent'}; background: #070913; padding: 2px; transition: transform 0.15s ease;`;
    
    img.onclick = () => {
      currentAvatar = url;
      document.querySelectorAll('#plug-avatar-picker-grid img').forEach(i => i.style.borderColor = 'transparent');
      img.style.borderColor = '#ff007f';
      document.getElementById('plug-prof-current-avatar').src = url;
    };
    grid.appendChild(img);
  });

  const toggleBtn = document.getElementById('btn-toggle-profile-edit');
  const form = document.getElementById('plug-profile-edit-form');
  toggleBtn.onclick = () => {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  };

  // Kendi Fotoğrafını Yükleme (Dosya Seçici Tetikleyici)
  const fileInput = document.getElementById('plug-avatar-file-input');
  const triggerBtn = document.getElementById('btn-trigger-avatar-file');
  const uploadStatus = document.getElementById('plug-file-upload-status');

  triggerBtn.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadStatus.style.color = '#00f2fe';
    uploadStatus.textContent = 'Processing and cropping image...';

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Kare ve optimize boyuta küçültme (Canvas)
        const canvas = document.createElement('canvas');
        const targetSize = 256; // 256x256 mükemmel netlik ve 15-20kb hafiflik
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');

        // Merkezden kare kesim hesabı
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);

        // WebP formatında optimize et
        const optimizedDataUrl = canvas.toDataURL('image/webp', 0.85);

        currentAvatar = optimizedDataUrl;
        document.getElementById('plug-prof-current-avatar').src = optimizedDataUrl;
        document.querySelectorAll('#plug-avatar-picker-grid img').forEach(i => i.style.borderColor = 'transparent');

        uploadStatus.style.color = '#22c55e';
        uploadStatus.textContent = '✓ Image ready! Click "Save Profile & Picture" below.';
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Değişiklikleri Kaydet
  document.getElementById('btn-save-user-profile').onclick = async () => {
    const newPass = document.getElementById('plug-prof-new-pass').value.trim();
    const statusEl = document.getElementById('plug-profile-save-status');

    statusEl.style.color = '#00f2fe';
    statusEl.textContent = 'Saving profile changes...';

    const updates = { avatar_url: currentAvatar };
    if (newPass) {
      if (newPass.length < 4) {
        statusEl.style.color = '#f43f5e';
        statusEl.textContent = 'Password must be at least 4 characters.';
        return;
      }
      updates.password_hash = newPass;
    }

    const { error } = await supabase.from('users').update(updates).eq('id', user.id);

    if (error) {
      statusEl.style.color = '#f43f5e';
      statusEl.textContent = 'Update failed: ' + error.message;
    } else {
      statusEl.style.color = '#22c55e';
      statusEl.textContent = '✓ Profile & Picture updated successfully!';
      
      // LocalStorage ve sol üstteki küçük avatarı anında güncelle
      user.avatar_url = currentAvatar;
      if (newPass) user.password_hash = newPass;
      localStorage.setItem('portal_user', JSON.stringify(user));

      const navAvatar = document.getElementById('user-nav-avatar');
      if (navAvatar) navAvatar.src = currentAvatar;

      setTimeout(() => {
        form.style.display = 'none';
        statusEl.textContent = '';
      }, 1500);
    }
  };
}
