// Integración con Capacitor (Android). En el navegador todo esto se desactiva solo.
const cap = () => (typeof window !== 'undefined' ? window.Capacitor : undefined);
export const isNative = () => !!cap()?.isNativePlatform?.();
export const plugin = name => cap()?.Plugins?.[name];

// Botón Atrás: cierra el diálogo abierto → vuelve a Inicio → sale de la app.
export function handleBack(App = plugin('App')) {
  const dialogs = document.querySelectorAll('dialog');
  const top = dialogs[dialogs.length - 1];
  if (top) { top.dispatchEvent(new Event('cancel', { cancelable: true })); return 'dialog'; }
  if ((location.hash.slice(1) || 'inicio') !== 'inicio') { location.hash = '#inicio'; return 'home'; }
  App?.exitApp?.();
  return 'exit';
}
export function initNative() {
  if (!isNative()) return false;
  const App = plugin('App');
  if (!App?.addListener) return false;
  App.addListener('backButton', () => handleBack(App));
  return true;
}

const cancelled = e => /cancel/i.test(String(e?.message ?? e));
// Guarda un archivo temporal y abre el menú "Compartir" de Android (para exportar copias).
export async function shareFile(filename, text, title = filename) {
  const FS = plugin('Filesystem'), Share = plugin('Share');
  if (!isNative() || !FS || !Share) return false;
  try {
    const { uri } = await FS.writeFile({ path: filename, data: text, directory: 'CACHE', encoding: 'utf8' });
    await Share.share({ title, url: uri, dialogTitle: title });
    return true;
  } catch (e) { if (cancelled(e)) return true; console.error('shareFile', e); return false; }
}
export async function shareText(text, title = 'Resumen del torneo') {
  const Share = plugin('Share');
  if (!isNative() || !Share) return false;
  try { await Share.share({ text, dialogTitle: title }); return true; }
  catch (e) { if (cancelled(e)) return true; console.error('shareText', e); return false; }
}
