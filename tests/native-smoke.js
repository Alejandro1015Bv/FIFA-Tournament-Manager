// Pruebas de la capa Android sin dispositivo: Capacitor simulado + jsdom. node tests/native-smoke.js
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';

const dom = new JSDOM('<!doctype html><body><div id="view"></div></body>', { url: 'http://localhost/#sorteos' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location, Event: dom.window.Event });
let ok = 0; const pass = n => { ok++; console.log('  ✓ ' + n); };

const calls = []; let backHandler = null;
const mkCap = (extra = {}) => ({ isNativePlatform: () => true, Plugins: {
  App: { addListener: (n, cb) => { if (n === 'backButton') backHandler = cb; }, exitApp: () => calls.push('exitApp') },
  Filesystem: { writeFile: async o => { calls.push(['write', o.path, o.directory, o.encoding]); return { uri: 'file:///cache/' + o.path }; } },
  Share: { share: async o => { calls.push(['share', Object.keys(o).sort().join()]); } }, ...extra } });

const N = await import('../js/native.js');
const A = await import('../js/ads.js');

// --- sin Capacitor (navegador): todo se desactiva
window.Capacitor = undefined;
assert.equal(N.isNative(), false); assert.equal(N.initNative(), false);
assert.equal(await N.shareFile('a.json', '{}'), false); assert.equal(await A.initAds({ enabled: true, sections: [] }), false);
pass('en el navegador la capa nativa y los anuncios no hacen nada');

// --- botón Atrás
window.Capacitor = mkCap();
assert.equal(N.initNative(), true); assert.ok(backHandler);
const dlg = document.createElement('dialog'); let cancelled = false;
dlg.addEventListener('cancel', e => { e.preventDefault(); cancelled = true; dlg.remove(); });
document.body.append(dlg);
backHandler(); assert.ok(cancelled, 'Atrás debe cerrar el diálogo'); pass('Atrás cierra el diálogo abierto');
location.hash = '#sorteos'; backHandler(); assert.equal(location.hash, '#inicio'); assert.ok(!calls.includes('exitApp')); pass('Atrás desde otra sección vuelve a Inicio');
backHandler(); assert.ok(calls.includes('exitApp')); pass('Atrás en Inicio sale de la app');

// --- exportar / compartir
calls.length = 0;
assert.equal(await N.shareFile('copia.json', '{"a":1}', 'Copia'), true);
assert.deepEqual(calls[0], ['write', 'copia.json', 'CACHE', 'utf8']); assert.equal(calls[1][0], 'share');
assert.equal(await N.shareText('hola'), true);
window.Capacitor = mkCap({ Share: { share: async () => { throw new Error('Share canceled'); } } });
assert.equal(await N.shareText('hola'), true, 'cancelar el menú no es un error');
window.Capacitor = mkCap({ Filesystem: { writeFile: async () => { throw new Error('disco lleno'); } } });
assert.equal(await N.shareFile('x.json', '{}'), false, 'un fallo real hace caer al método del navegador');
pass('exportar usa Filesystem+Share y distingue cancelar de fallar');

// --- anuncios
const ad = []; const consent = { isConsentFormAvailable: true, status: 'REQUIRED', canRequestAds: true };
const mkAd = (info = {}) => mkCap({ AdMob: {
  requestConsentInfo: async () => ({ ...consent, ...info }), showConsentForm: async () => { ad.push('form'); return { ...consent, status: 'OBTAINED', canRequestAds: info.afterForm ?? true }; },
  initialize: async () => ad.push('init'), addListener: async (n, cb) => { ad.push('listen:' + n); },
  showBanner: async o => ad.push(['show', o.adId, o.adSize, o.position, o.isTesting]), hideBanner: async () => ad.push('hide'), resumeBanner: async () => ad.push('resume') } });
const cfg = { enabled: true, testing: true, bannerAdIdAndroid: 'ca-app-pub-3940256099942544/6300978111', sections: ['inicio', 'historial'] };

window.Capacitor = mkAd(); assert.equal(await A.initAds({ ...cfg, enabled: false }), false); assert.deepEqual(ad, []); pass('con ads.enabled=false no se toca AdMob');
assert.equal(await A.initAds(cfg), true);
assert.deepEqual(ad.slice(0, 3), ['form', 'init', 'listen:bannerAdSizeChanged'], 'primero consentimiento, luego inicializar'); pass('flujo: consentimiento → inicialización');
await A.updateAdsForSection('sorteos', cfg); assert.equal(A.adsState().visible, false); pass('no hay banner en Sorteos (sección crítica)');
await A.updateAdsForSection('inicio', cfg);
assert.deepEqual(ad.at(-1), ['show', cfg.bannerAdIdAndroid, 'ADAPTIVE_BANNER', 'BOTTOM_CENTER', true]); pass('banner adaptable abajo con anuncio de prueba en Inicio');
await A.updateAdsForSection('resultados', cfg); assert.equal(ad.at(-1), 'hide'); assert.equal(document.documentElement.style.getPropertyValue('--ad-h'), '0px');
await A.updateAdsForSection('historial', cfg); assert.equal(ad.at(-1), 'resume'); pass('se oculta al entrar en resultados y se reanuda en Historial (sin recrearlo)');

// sin consentimiento no se pide ningún anuncio (módulo nuevo para reiniciar el estado)
const A2 = await import('../js/ads.js?denied'); ad.length = 0;
window.Capacitor = mkAd({ afterForm: false }); assert.equal(await A2.initAds(cfg), false); assert.ok(!ad.includes('init')); pass('sin consentimiento no se inicializa ni se muestra nada');
console.log(`\n${ok} comprobaciones de la capa Android correctas`);
