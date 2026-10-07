// modules/loader.js
import { supabase } from '../config.js';

export async function loadActivePlugins(contextId, targetContainerId) {
  const container = document.getElementById(targetContainerId);
  if (!container) {
    console.warn(`Target container #${targetContainerId} not found in DOM.`);
    return;
  }

  // Veritabanından bu kapsayıcıya ait aktif eklentileri çek
  const { data: plugins, error } = await supabase
    .from('portal_plugins')
    .select('*')
    .eq('is_enabled', true);

  if (error) {
    console.error('Failed to fetch plugins:', error);
    return;
  }

  if (!plugins || plugins.length === 0) {
    console.log('No active plugins configured.');
    return;
  }

  for (const p of plugins) {
    // Sadece bu konteyner için tanımlanmış olanları yükle
    if (p.target_container && p.target_container !== targetContainerId) {
      continue;
    }

    try {
      // Göreli yolu temizle ve modülü yükle
      const scriptPath = p.script_url.startsWith('.') ? p.script_url : `./${p.script_url}`;
      const module = await import(scriptPath);
      
      const initFn = module.initPlugin || module.default;
      if (typeof initFn === 'function') {
        let pluginBox = document.getElementById(`plugin-${p.id}-box`);
        if (!pluginBox) {
          pluginBox = document.createElement('div');
          pluginBox.id = `plugin-${p.id}-box`;
          pluginBox.style.marginBottom = '16px';
          container.appendChild(pluginBox);
        }

        await initFn(contextId, pluginBox.id);
      } else {
        console.warn(`Plugin [${p.id}] has no initPlugin export.`);
      }
    } catch (err) {
      console.error(`Error executing plugin [${p.id}]:`, err);
    }
  }
}
