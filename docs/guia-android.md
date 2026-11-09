# Guía: de web a Android (Archivo Maestro v1.0 aplicado a este proyecto)

Fecha de la revisión: 15-oct-2026. Versiones verificadas en npm ese día: Capacitor 8.5.3, `@capacitor/app` 8.1.2, `@capacitor/share` 8.0.3, `@capacitor/filesystem` 8.1.5, `@capacitor-community/admob` 8.2.1. Capacitor 8 genera `minSdk 24 / compileSdk 36 / targetSdk 36`: **comprueba el requisito vigente de Google Play el día de publicar** (https://developer.android.com/google/play/requirements/target-sdk).

## 1. Auditoría (sección 3 del archivo maestro)

| Punto | Resultado |
|---|---|
| Scripts/CDN/fuentes externos | Ninguno. Solo `css/styles.css` y `js/app.js`. |
| `innerHTML` con datos de usuario | Ninguno (todo con `textContent`/nodos). |
| Secretos en el código | Ninguno. El ID de AdMob incluido es el de **prueba** de Google. |
| Persistencia | `localStorage` + exportar/importar JSON validado (válido para prototipo según el archivo maestro, §8.4). Exportar usa el menú *Compartir* de Android. |
| Botón Atrás | Implementado: cierra diálogo → vuelve a Inicio → sale. Probado con Capacitor simulado; **falta probarlo en un teléfono real**. |
| Áreas seguras / muesca | `viewport-fit=cover` + `env(safe-area-inset-*)`. Verificar en dispositivo. |
| Offline | La app, el motor y los datos funcionan sin conexión. **Los escudos de FootyLogos y las banderas se cargan por Internet**: sin conexión se ven iniciales. No prometer «100 % offline con escudos». |
| Permisos Android | Solo `INTERNET` (escudos y anuncios). |

## 2. Riesgos que debes decidir antes de publicar

1. **Nombre**: «FIFA» y «EA SPORTS FC» son marcas registradas; usarlas en el título de Google Play puede dar rechazo por propiedad intelectual/suplantación. Recomendación: nombre neutro (p. ej. «Torneo de Amigos») y en la descripción aclarar «no afiliada ni respaldada por FIFA ni EA». Cambia `appName` en `js/app-config.js` y `capacitor.config.json`.
2. **Escudos de clubes y federaciones**: son marcas de terceros. No he podido leer los términos de FootyLogos; una app con anuncios es uso comercial. Hasta confirmar derechos (leer su página «Uso y derechos de los logos» o contactarles), pon `officialLogos: false` en `js/app-config.js`: la app muestra iniciales con color y no pide nada a FootyLogos. Las banderas de países (flagcdn) se mantienen.
3. **Cuenta de Google Play**: revisa los requisitos de pruebas cerradas que se apliquen a tu tipo de cuenta antes de planificar la fecha.
4. **Ingresos**: sin garantía; dependen de usuarios activos, país y demanda.

## 3. Pasos (sección 17 del archivo maestro)

Requisitos: Node.js, Android Studio (con SDK) y un teléfono Android.

```bash
npm install                  # instala Capacitor y plugins
npm test && npm run test:ui  # pruebas
npm run build:www            # copia la app a www/
npx cap add android          # SOLO la primera vez
npm run cap:sync             # build:www + cap sync android
npm run cap:open             # abre Android Studio
```

En `capacitor.config.json` cambia `appId` (hoy `com.ejemplo.torneoamigos`) por un identificador **tuyo y definitivo**: no se puede cambiar después de publicar. Luego en Android Studio: ejecutar en el teléfono → comprobar la lista de abajo → *Build → Generate Signed Bundle / APK*.

### Pruebas en teléfono real (obligatorias)
- [ ] Crear un torneo completo de cada formato; cerrar y reabrir; reiniciar el teléfono.
- [ ] Modo avión: abre y funciona (escudos → iniciales).
- [ ] Botón Atrás en diálogos, secciones e Inicio.
- [ ] Exportar JSON (menú Compartir) e importarlo de vuelta.
- [ ] «Copiar/compartir resumen».
- [ ] Teclado no tapa campos; muesca y barras bien.
- [ ] Actualizar la app sobre una versión anterior sin perder datos.

### Firma
Crea un *keystore*, guarda **varias copias seguras** y no lo subas a ningún repositorio (`.gitignore` ya excluye `*.keystore`, `*.jks`). Cada actualización necesita un `versionCode` mayor.

## 4. Anuncios poco intrusivos (sección 13)

Estado: **código listo y desactivado** (`ads.enabled: false`), siguiendo la «Fase 1: lanzar sin anuncios».

Diseño: un único banner adaptable abajo, solo en Inicio, Historial y Equipos; se oculta en Sorteos, Cuadro, Clasificación y Resultados y no hay intersticiales. No se pide ningún anuncio hasta completar el consentimiento (UMP). El contenido se desplaza el alto del banner para no taparlo.

Para activarlo (Fase 3):
1. `npm install @capacitor-community/admob` y `npx cap sync android`.
2. En `android/app/src/main/AndroidManifest.xml`, dentro de `<application>`:
   `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id" />`
   y en `res/values/strings.xml`: `<string name="admob_app_id">TU_ID_DE_APP</string>`.
3. En `js/app-config.js`: `ads.enabled: true`. **Mantén `testing: true`** y el ID de prueba hasta publicar; nunca pulses tus propios anuncios reales.
4. Crea la app y el bloque de anuncios en AdMob, configura el mensaje de consentimiento, y solo entonces pon tus IDs reales y `testing: false`.
5. En Play Console: política de privacidad (ver `docs/politica-de-privacidad.md`), declaración de anuncios, **Seguridad de los datos** y clasificación de contenido coherentes con lo que hace la app.

Opcional más adelante: anuncio recompensado voluntario para temas visuales (no implementado: la app no tiene temas todavía).

## 5. Lista final (sección 15)
Ver las casillas de la sección 15 del archivo maestro; en este proyecto ya están resueltos: sin CDN, sin secretos, permisos mínimos, exportar/importar validado, anuncios de prueba y fuera de controles críticos. Pendientes del propietario: `appId` y nombre definitivos, derechos de logos, icono/capturas, política de privacidad publicada, cuenta de Play, firma y pruebas en dispositivo.
