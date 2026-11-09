# FIFA Tournament Manager

Gestor de torneos de EA SPORTS FC entre amigos. HTML + CSS + JavaScript (módulos ES), sin frameworks ni dependencias en ejecución. Todo se guarda en `localStorage`.

## Ejecución

Necesita un servidor estático (módulos ES y `fetch` de los JSON no funcionan con `file://`):

- VS Code: extensión **Live Server** → *Open with Live Server*.
- O: `python3 -m http.server 8000` en esta carpeta y abre <http://localhost:8000>.

## Flujo de uso

1. **Jugadores**: añade amigos (nombres duplicados piden confirmación).
2. **Configuración** (asistente de 5 pasos): nombre y competición → participantes → formato → reglas → revisar y crear.
3. **Sorteos**: sorteo de equipos (simultáneo, individual y bloqueo 🔒 por jugador) y sorteo de enfrentamientos con vista previa; se puede repetir o descartar hasta **confirmar**.
4. **Eliminatorias / calendario**, **Resultados** (diálogo con estado pendiente/en juego/finalizado, desempate y observaciones), **Clasificación**.
5. **Historial**: archiva el torneo finalizado; palmarés y participación por jugador.
6. **Inicio**: progreso, próximos partidos, exportar/importar JSON, eliminar torneo.

## Formatos

| Formato | Notas |
|---|---|
| Eliminación directa | Cuadro con byes aleatorios si N no es potencia de 2 (los byes se muestran como «Pase automático», sin marcador). Rondas: dieciseisavos…final. |
| Todos contra todos | Método del círculo; con N impar cada jugador descansa una vez. |
| Grupos + eliminatorias | Reparto equilibrado, cruces 1A–2B / 1B–2A (cabezas de serie estándar), generación automática al terminar los grupos o cuadro **provisional** (bloquea resultados hasta regenerarlo). Avisa si los grupos son desiguales. |

Reglas: puntos configurables, desempate configurable (puntos › DG › GF › enfrentamiento directo y variantes). Si todo empata, decide un sorteo guardado al crear el calendario (🎲). Empates en eliminatorias: prórroga+penaltis, penaltis o ganador manual.

**Integridad**: cambiar el ganador de un partido con rondas posteriores jugadas, o un resultado de grupos que altere los clasificados, pide confirmación y descarta lo afectado. La importación valida estructura y coherencia (ganadores, cuadro, equipos únicos, etc.).

## Estructura

```
index.html · css/styles.css
js/app.js            router por hash y arranque
js/state.js          estado único y constantes
js/tournament-engine.js  lógica de torneos (pura, sin DOM)
js/standings.js      clasificación y desempates
js/validation.js     validación de torneo y de datos importados
js/storage.js        localStorage, exportar/importar
js/players.js · teams.js · randomizer.js (Fisher-Yates + crypto.getRandomValues)
js/bracket.js · calendar.js · ui.js · actions.js
js/views/*.js        una vista por sección
data/competitions.json · teams.json
tests/run-tests.js   54 pruebas del motor y del catálogo     → npm test
tests/ui-smoke.js · native-smoke.js · a11y-smoke.js · contrast.js   interfaz, capa Android, accesibilidad/estados y contraste → npm install && npm run test:ui
```

## Catálogo, escudos y disponibilidad en EA FC 27

Los logos y plantillas salen de [FootyLogos](https://www.footylogos.com/es) (temporadas 2026-27 / Mundial 2026, leídas el 12-oct-2026). La disponibilidad en el juego sale de la lista final de [fifauteam.com](https://fifauteam.com/fc-27-leagues-clubs-national-teams/) para **EA SPORTS FC 27** (15-oct-2026). Cada equipo tiene `games.fc27`: `yes` (con licencia), `generic` (nombre/escudo genérico en el juego) o `no` (no aparece).

| Competición | En catálogo | Disponibles en FC 27 |
|---|---|---|
| Mundial 2026 | 48 | 32 |
| Selecciones nacionales (todas las de FC 27) | 51 | 51 |
| Champions League | 36 | 34 |
| Europa League | 36 | 30 |
| Copa Libertadores | 32 | 6 |
| LaLiga · Premier · Bundesliga · Serie A · Ligue 1 · MLS | 20 · 20 · 18 · 20 · 18 · 30 | todos |

- Los torneos nuevos sortean **solo equipos disponibles en FC 27** (se puede desmarcar en el paso 1 del asistente y en la vista Equipos).
- Serie A: Inter, Milan, Atalanta y Monza aparecen en el juego con nombre y escudo genéricos (p. ej. «Lombardia FC»); la app lo avisa.
- Libertadores: solo 6 clubes (argentinos) figuran en la lista de clubes de FC 27; los demás pueden aparecer solo dentro de la competición con plantillas genéricas, así que no se consideran disponibles.
- Las 19 selecciones de FC 27 que no juegan el Mundial usan banderas de `flagcdn.com` (ids `flag-xx`).
- **Solo está verificado FC 27.** FC 24, FC 25 y FC 26 no se han revisado equipo por equipo; el campo `games` admite añadir más ediciones.
- Si un logo no carga se muestran las iniciales. Los torneos guardados antes siguen funcionando (ids antiguos por `aliases`; equipos descartados como `legacy`).

## Extras

- **Copiar resumen**: texto con clasificación/cuadro y campeón, listo para pegar en WhatsApp (Inicio y Clasificación).

## Interfaz

Sistema de diseño con tokens, tema claro/oscuro/automático, diseño responsive (móvil, tablet, escritorio), esqueletos de carga, estados vacíos/error y accesibilidad: ver **`docs/sistema-de-diseno.md`**.

## Versión Android

Preparada con Capacitor siguiendo el *Archivo Maestro*: `capacitor.config.json`, `scripts/build-www.mjs`, botón Atrás, exportar con *Compartir*, áreas seguras y banner opcional (desactivado). Guía completa, riesgos y pasos: **`docs/guia-android.md`**. Borradores: `docs/politica-de-privacidad.md` y `docs/ficha-google-play.md`. Interruptores en `js/app-config.js` (`appName`, `officialLogos`, `ads`).

## Pruebas

`npm test` cubre aleatoriedad, byes, calendarios, grupos, desempates, asignación de equipos, resultados, propagación en el cuadro, persistencia e importación inválida. La interfaz se ha probado con jsdom (renderizado de todas las secciones en todos los estados y registro de un resultado); **no se ha probado visualmente en un navegador real**, así que conviene revisar el aspecto del cuadro y el responsive.
