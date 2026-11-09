// Banner discreto (Google AdMob vía @capacitor-community/admob). DESACTIVADO por defecto.
// Reglas: solo en secciones no críticas, tras el flujo de consentimiento, con anuncios de prueba mientras se desarrolla.
import { APP_CONFIG } from './app-config.js';
import { isNative, plugin } from './native.js';

let ready = false, created = false, visible = false;
const setAdHeight = h => document.documentElement.style.setProperty('--ad-h', `${Math.max(0, Math.round(h || 0))}px`);

export async function initAds(cfg = APP_CONFIG.ads) {
  if (!cfg?.enabled || !isNative()) return false;
  const AdMob = plugin('AdMob');
  if (!AdMob) { console.warn('Plugin AdMob no instalado'); return false; }
  try {
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
    if (!info.canRequestAds) return false;                       // sin consentimiento no se pide ningún anuncio
    await AdMob.initialize();
    AdMob.addListener?.('bannerAdSizeChanged', s => setAdHeight(s?.height));
    ready = true;
    return true;
  } catch (e) { console.error('AdMob', e); return false; }
}

export async function updateAdsForSection(sectionId, cfg = APP_CONFIG.ads) {
  if (!ready) return;
  const AdMob = plugin('AdMob');
  const want = cfg.sections.includes(sectionId);
  try {
    if (want && !visible) {
      if (!created) { await AdMob.showBanner({ adId: cfg.bannerAdIdAndroid, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: cfg.testing }); created = true; }
      else await AdMob.resumeBanner();
      visible = true;
    } else if (!want && visible) { await AdMob.hideBanner(); visible = false; setAdHeight(0); }
  } catch (e) { console.error('AdMob banner', e); }
}
export const adsState = () => ({ ready, created, visible });
