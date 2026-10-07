// modules/loader.js
import { supabase } from '../config.js';

export async function loadActivePlugins(contextId, targetContainerId) {
  const container = document.getElementById(targetContainerId);
  if (!container) return;

  const { data: plugins, error } = await supabase
    .from('portal_plugins')
    .select('*')
    .eq('is_enabled', true);

  if (error || !plugins || plugins.length === 0) return;

  for (const p of plugins) {
    if (p.target_container && p.target_container !== targetContainerId) {
      continue;
    }

    try {
      // Kök dizine göre kesin mutlak yol (404 hatasını tamamen engeller)
      let resolvedUrl = p.script_url.replace(/^\.\//, '');
      const fullPath = new URL(`../${resolvedUrl}`, import.meta.url).href;

      const module = await import(fullPath);
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
      }
    } catch (err) {
      console.error(`Plugin [${p.id}] load error:`, err);
    }
  }
}
