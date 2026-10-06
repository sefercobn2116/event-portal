// modules/loader.js - index.html'i rahat bırakan otomatik yükleyici
import { supabase } from '../config.js';

export async function loadActivePlugins(contextId, containerElementId) {
  const container = document.getElementById(containerElementId);
  if (!container) return;

  const { data: plugins } = await supabase
    .from('portal_plugins')
    .select('*')
    .eq('is_enabled', true);

  if (!plugins || plugins.length === 0) return;

  for (const p of plugins) {
    try {
      // Dinamik dosya yükleme - index'e kod yazmaya gerek kalmaz
      const module = await import(p.script_url);
      
      // Modülün başlatıcı fonksiyonunu çalıştır
      const initFn = module.initPlugin || module.default;
      if (typeof initFn === 'function') {
        const pluginBox = document.createElement('div');
        pluginBox.id = `plugin-${p.id}-wrap`;
        pluginBox.style.marginBottom = '20px';
        container.appendChild(pluginBox);

        await initFn(contextId, pluginBox.id);
      }
    } catch (err) {
      console.warn(`Plugin [${p.name}] could not load:`, err);
    }
  }
}
