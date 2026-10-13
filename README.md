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
tests/run-tests.js   50 pruebas del motor y del catálogo     → npm test
tests/ui-smoke.js    prueba de interfaz (jsdom) → npm install && npm run test:ui
```

## Catálogo y escudos

Los logos y las plantillas salen de [FootyLogos](https://www.footylogos.com/es) (páginas consultadas el 12-oct-2026). 10 competiciones, 245 equipos:

| Competición | Equipos | Competición | Equipos |
|---|---|---|---|
| Mundial 2026 | 48 | Premier League 2026-27 | 20 |
| Champions League 2026-27 | 36 | Bundesliga 2026-27 | 18 |
| Europa League 2026-27 | 36 | Serie A 2026-27 | 20 |
| Copa Libertadores 2026 | 32 | Ligue 1 2026-27 | 18 |
| LaLiga 2026-27 | 20 | MLS 2026 | 30 |

- Cada equipo usa `https://assets.footylogos.com/previews/<slug>/<slug>-logo-footylogos-320.webp` (URL tomada de las páginas de FootyLogos, no inventada). Un club presente en varias competiciones es **un único equipo** (p. ej. Real Madrid en LaLiga y Champions).
- Si un logo no carga se muestran las iniciales del equipo (y, como último recurso, un escudo genérico).
- Los logos son marcas de sus titulares; se enlazan desde la CDN de FootyLogos (la app necesita conexión para verlos).
- **Torneos guardados antes del cambio**: los ids antiguos se resuelven por `aliases`, y los equipos que ya no están en ninguna competición (p. ej. Italia) se conservan como `legacy: true` solo para que sigan mostrándose.
- No se garantiza que cada equipo esté en una edición concreta de EA SPORTS FC: edita `data/competitions.json` / `data/teams.json` para ajustar.

## Pruebas

`npm test` cubre aleatoriedad, byes, calendarios, grupos, desempates, asignación de equipos, resultados, propagación en el cuadro, persistencia e importación inválida. La interfaz se ha probado con jsdom (renderizado de todas las secciones en todos los estados y registro de un resultado); **no se ha probado visualmente en un navegador real**, así que conviene revisar el aspecto del cuadro y el responsive.
