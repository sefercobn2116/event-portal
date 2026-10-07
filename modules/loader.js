// modules/loader.js
import { supabase } from '../config.js';

export async function loadActivePlugins(contextId, targetContainerId) {
  const container = document.getElementById(targetContainerId);
  if (!container) {
    console.error(`[Loader] Container #${targetContainerId} not found in DOM`);
    return;
  }

  // 1. Veritabanından eklentileri çek
  const { data: plugins, error } = await supabase
    .from('portal_plugins')
    .select('*')
    .eq('is_enabled', true);

  if (error) {
    container.innerHTML = `
      <div style="background: rgba(244,63,94,0.15); border: 1px solid #f43f5e; padding: 10px; border-radius: 8px; color: #f43f5e; font-size: 0.8rem; margin-bottom: 15px;">
        ⚠️ <strong>Database Error:</strong> ${error.message} (Check RLS permissions)
      </div>
    `;
    return;
  }

  if (!plugins || plugins.length === 0) {
    container.innerHTML = `
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; color: #94a3b8; font-size: 0.75rem; margin-bottom: 15px;">
        ℹ️ No active plugins returned from database for container: <code>${targetContainerId}</code>
      </div>
    `;
    return;
  }

  container.innerHTML = ''; // Temizle ve eklentileri basmaya başla

  for (const p of plugins) {
    if (p.target_container && p.target_container !== targetContainerId) {
      continue;
    }

    try {
      // GitHub Pages kök yoluyla kesin eşleştirme
      let scriptPath = p.script_url;
      if (!scriptPath.startsWith('./') && !scriptPath.startsWith('../') && !scriptPath.startsWith('http')) {
        scriptPath = `../${scriptPath}`;
      }

      const module = await import(scriptPath);
      const initFn = module.initPlugin || module.default;

      if (typeof initFn === 'function') {
        const pluginBox = document.createElement('div');
        pluginBox.id = `plugin-${p.id}-box`;
        pluginBox.style.marginBottom = '16px';
        container.appendChild(pluginBox);

        await initFn(contextId, pluginBox.id);
      } else {
        throw new Error(`initPlugin function missing in ${p.script_url}`);
      }
    } catch (err) {
      const errBox = document.createElement('div');
      errBox.style.cssText = 'background: rgba(244,63,94,0.15); border: 1px solid #f43f5e; padding: 10px; border-radius: 8px; color: #f43f5e; font-size: 0.75rem; margin-bottom: 10px;';
      errBox.innerHTML = `⚠️ <strong>Plugin [${p.id}] Failed:</strong> ${err.message}<br><small>Path: ${p.script_url}</small>`;
      container.appendChild(errBox);
    }
  }
}
