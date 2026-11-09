// Configuración de la app. Ajustar antes de generar la versión de Google Play.
export const APP_CONFIG = {
  // Nombre visible. "FIFA" y "EA SPORTS FC" son marcas registradas: ver docs/guia-android.md (riesgos).
  appName: 'FIFA Tournament Manager',
  // true: logos de clubes desde FootyLogos (requiere conexión y tener derechos de uso).
  // false: iniciales con color (sin escudos de terceros). Recomendado para la versión de Play hasta confirmar derechos.
  officialLogos: true,
  ads: {
    enabled: false,                 // Fase 1 del archivo maestro: lanzar sin anuncios. Activar solo tras revisar políticas y privacidad.
    testing: true,                  // true = anuncios de prueba de Google. Poner false solo en producción con IDs reales.
    bannerAdIdAndroid: 'ca-app-pub-3940256099942544/6300978111',   // ID de PRUEBA oficial de Google (README del plugin)
    sections: ['inicio', 'historial', 'equipos']                    // nunca en sorteos, resultados, cuadro ni clasificación
  }
};
