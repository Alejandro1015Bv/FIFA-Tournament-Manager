# Sistema de diseño

Todo el aspecto sale de `css/tokens.css` (valores) y `css/styles.css` (componentes, solo con `var(--…)`). Un test (`tests/a11y-smoke.js`) falla si `styles.css` contiene colores sueltos.

## Tokens
| Grupo | Tokens |
|---|---|
| Color (oscuro / claro / auto) | `--bg --surface --surface-2 --surface-3 --border --border-strong --text --text-muted --primary(-hover/-active/-soft/-text) --info --success --warning --danger --danger-solid --focus --overlay --skeleton-a/b` |
| Tipografía | `--font-sans`, `--text-xs…3xl` (12–30 px), `--weight-*`, `--leading-*` |
| Espaciado | `--space-1…12` (escala de 4 px) |
| Bordes y radios | `--radius-sm/md/lg/full`, `--border-width`, `--focus-width` |
| Sombras | `--shadow-sm/md/lg` (una variante por tema) |
| Movimiento | `--dur-fast/med`, `--ease` (se anula con «reducir movimiento») |
| Tamaños | `--tap` 44 px (objetivo táctil), `--control-h`, `--sidebar-w`, `--bottom-nav-h`, `--content-max` |

Contraste verificado por `tests/contrast.js` (43 pares en oscuro y claro): texto ≥ 4,5:1; bordes de controles y anillo de foco ≥ 3:1.

## Temas
Automático (sigue al sistema), Claro y Oscuro. Botón en la barra superior; se guarda en `ftm:theme`. El tema se aplica antes de pintar para evitar parpadeos.

## Responsive (móvil primero)
| Ancho | Navegación | Contenido |
|---|---|---|
| < 768 px (375 px de referencia) | Barra inferior (4 secciones + «Más») | 1 columna, diálogos como hoja inferior, cuadro con scroll horizontal por rondas, botones de 44 px |
| 768–1279 px | Barra lateral fija | 2 columnas, 4 estadísticas, diálogos centrados |
| ≥ 1280 px | Barra lateral ancha | 3–4 columnas, contenido hasta 75 rem |

## Componentes y estados
Un único lenguaje: botón (`primary`, `secondary`, `ghost`, `danger`, `danger-ghost`, `small`), campo, selector, casilla/radio, tarjeta, insignia de estado, pestañas, tabla, diálogo/hoja, aviso, estado vacío.

| Estado | Tratamiento |
|---|---|
| hover | solo con puntero fino (`@media (hover: hover)`) |
| focus | anillo de 3 px visible solo con teclado (`:focus-visible`) |
| active | color más oscuro + `scale(.98)` en botones; fondo en navegación |
| disabled | 50 % de opacidad, cursor `not-allowed`, sin hover |
| busy | `aria-busy` + cursor de progreso |
| seleccionado | `aria-current`, `aria-pressed`, `:checked` con borde y fondo de marca |

## Estados de la interfaz
| Situación | Qué ocurre |
|---|---|
| Cargando catálogo | Esqueleto con la forma de cada sección (`role=status`, `aria-busy`); las insignias muestran un esqueleto hasta cargar |
| Sin jugadores / sin torneo / sin partidos | Estado vacío con título, una línea y **una acción** que lo resuelve |
| Filtro sin resultados | Estado vacío con «Limpiar» / «Mostrar todos» |
| Catálogo no disponible | Estado de error con «Reintentar» (también aviso en cualquier sección) |
| Imagen que falla | Iniciales locales → escudo genérico |
| Datos dañados / almacenamiento lleno / importación inválida | Aviso con causa; los datos dañados se respaldan |
| Acción completada | Aviso con icono y `role=status`; los errores usan `role=alert` |
| Acción destructiva o con impacto | Diálogo de confirmación con la lista de lo afectado |
| Falta un dato | Se muestra «—», «Por definir» o «Sin equipo», nunca vacío |

## Accesibilidad
Enlace «Saltar al contenido», un `h1` por sección, foco al contenido al cambiar de sección, diálogos etiquetados que devuelven el foco, imágenes con `alt` (vacío cuando el nombre está al lado), botones solo-icono con `aria-label`, tablas con `caption` y `th scope`, regiones desplazables enfocables, estados que no dependen solo del color (texto o icono), y `prefers-reduced-motion`.

## Pendiente de comprobar a mano
No he podido abrir la interfaz en un navegador real. Revisa en 375, 768 y 1280 px (DevTools) y en el teléfono: cuadro de eliminatorias, hoja «Más», diálogos, tema claro y oscuro, y lectura con TalkBack.
