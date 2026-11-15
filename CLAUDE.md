# Maskotería Akyra · sitio web — reglas para Claude Code

Sitio estático (HTML/CSS/JS puro, sin framework) de la tienda de mascotas Maskotería Akyra, Punta Arenas.
3 sucursales: Casa Matriz (Av. José Martínez de Aldunate 1431), Hornillas 080 y Las Lengas
(Av. Circunvalación Ramón Cañas 340). Dueña: Rosa. WhatsApp de pedidos: +56 9 8696 9111 (`config.js`).
Publicado en GitHub Pages: https://jcarocav.github.io/akyra-petshop-web/ (repo público `jcarocav/akyra-petshop-web`).

## Forma de trabajo (pedido del dueño)
1. **Todo en español de Chile**: informes, commits, comentarios y textos del sitio.
2. **El dueño no usa la terminal**: automatiza instalaciones, git y pruebas. No pidas decisiones técnicas:
   decide con buen criterio y anótalas en el informe. Detente solo para pedir una credencial o inicio de
   sesión que no puedas hacer, y al final para que el dueño pruebe antes de publicar.
3. **Ramas**: el trabajo va en ramas; **nunca merge a `main` sin el "aprobado" del dueño**. Respaldo previo:
   rama `respaldo-2026-09-02` y tags `respaldo-antes-catalogo-real` … `respaldo-6-antes-sin-gesnex` (para volver atrás si algo sale mal).
4. **Nunca publicar datos internos**: costo neto, proveedor ni unidades por sucursal. El Excel de inventario
   **no se sube** al repositorio (`.gitignore`). `productos.json` y `stock.json` solo llevan campos públicos
   (lo verifican `tools/catalogo/escritura.mjs` y `tests/unit/datos-publicos.spec.mjs`).
5. **Imágenes**: dos tipos, declarados en `imagenTipo` de `productos.json`. **Exacta**: la foto calza EXACTAMENTE (marca, línea, sabor, formato y tamaño; idealmente
   confirmada por código de barras). **Referencial**: producto sin marca visible o genérico (platos, juguetes, camas, collares…) con una foto de un producto igual en forma y uso;
   la card dice "Imagen referencial" y la ficha "Imagen referencial. Consulta por WhatsApp para ver el producto real en tienda." (aviso gris pequeño bajo la foto, sin botones). NUNCA una referencial que muestre la etiqueta de otra marca, otro sabor o tamaño.
   Ante la duda, sin foto. Se guardan en `assets/productos/<SKU>.webp` (≤ 800 px, ~60 KB), nunca enlazadas al sitio de origen.
   Avance y fuentes de cada foto: `tools/catalogo/fotos-progreso.json` (grupo A exacta, B referencial, C sin foto + motivo).
   Buscar fotos en la web: `node tools/imagenes/buscar-web.mjs` (Bing; retoma lo ya buscado) o `bash tools/imagenes/tandas.sh`;
   aplicarlas a `productos.json` sin pisar el stock: `node tools/catalogo/aplicar-fotos.mjs`; revisión visual: `node tools/imagenes/galeria.mjs`
   y abrir `comparar/revisar-fotos.html`; Excel por grupos: `node tools/catalogo/exportar-formato-resumen.mjs`.
6. **Accesibilidad WCAG 2.2 AA** y **0 violaciones de axe-core**; contraste 4,5:1 en texto y 3:1 en controles.
7. **Seguridad**: sin secretos en el código; CSP estricta (sin `unsafe-inline`), nada de `eval` ni `innerHTML`
   con datos; todo texto del usuario se limpia antes de ir al carrito o a WhatsApp.
8. **Pruebas en verde antes de entregar**: `npm run verificar` (lint, HTML, Playwright en Chrome/Firefox/WebKit
   escritorio y celular, enlaces rotos y Lighthouse). Una prueba en rojo se arregla con código, no bajando la exigencia.

## Comandos
| Qué | Comando |
|---|---|
| Ver el sitio en local | `npm run servidor` → http://localhost:8080 (o doble clic en `VER-SITIO.bat`, carpeta de arriba) |
| Regenerar el catálogo desde un Excel nuevo | `npm run catalogo` (o `ACTUALIZAR-CATALOGO.bat`); con otra ruta: `npm run catalogo -- --excel "ruta.xlsx"` |
| Copiar partes comunes a todas las páginas + sitemap | `npm run paginas` |
| Todas las pruebas | `npm run verificar` · solo navegador: `npm test` · rápido (solo Chrome): `npm run test:rapido` |
| Fotos: buscar / procesar / Excel de imágenes | `npm run imagenes:buscar` · `npm run imagenes:sitemaps` · `npm run imagenes:procesar` · `npm run imagenes:reporte` |
| Revisar el catálogo con Rosa (PC + celular) | doble clic en `REVISAR-CATALOGO.bat` (carpeta de arriba) o `node tools/revision/servidor.mjs` |
| Aplicar fotos nuevas sin el Excel | `node tools/catalogo/aplicar-fotos.mjs` (usa `.tmp/catalogo-base.json`) |
| Stock desde la planilla (DESACTIVADO) | `npm run stock:desde-planilla` (necesita `STOCK_CSV_URL`) |
| Reporte simulado de Gesnex (pruebas) | `npm run stock:simular` |
| Preparar el Apps Script para clasp | `npm run apps-script:preparar` |

## Cómo está armado (sin Gesnex desde noviembre 2026)
- `productos.json` (SOLO los productos publicados; lo genera `tools/generar-catalogo.mjs`) + `stock.json`
  (`{ disponibilidad: { SKU: "con-stock" | "consultar" } }`, **nunca unidades**). El sitio cruza ambos al cargar
  (`js/datos.mjs` + `js/stock.mjs`).
- Catálogo base = unión de las hojas **"Resumen"** (stock, SKU) y **"Base Rosa (1004)"** (nombre, precio, fabricante,
  categoría) del Excel, por código de barras. Lo que está solo en Base Rosa entra con stock 0 y recibe un SKU nuevo
  (`CATEGORIA-MARCA-NNN`, guardado en `tools/catalogo/skus-generados.json` para que no cambie). El generador guarda
  el catálogo completo (con código de barras y fabricante) en `.tmp/catalogo-base.json` (fuera de git).
- **Qué se publica** (`tools/catalogo/publicar.mjs`, mismas reglas en el generador, `aplicar-fotos.mjs` y la herramienta
  de revisión): (1) catálogo base → (2) **ajustes del catálogo** (`tools/catalogo/ajustes-catalogo.json`) → (3) regla:
  - excluido ("Eliminar de la web") → no se publica;
  - **Mondo Mascota** (y "Mundo Mascota", "… MONDO (código)"), **Marben Pets** (Marbenpets, Marben Pet, Wonder Dog/Cat/Pet)
    y **Leon Pet** (se revisan fabricante, marca y nombre) SIN ninguna foto → no se publica; con foto exacta o
    referencial sí. Al recibir foto (revisión o fotos propias) se publica solo al regenerar, sin cambiar reglas;
  - todas las demás marcas se publican tengan o no foto (sin foto = imagen de relleno con el logo).
  El stock ya NO oculta nada. Sitemap, destacados, categorías y buscador usan solo lo publicado.
- **Disponibilidad** (único aviso): stock 0 o sin cantidad registrada → "Consultar disponibilidad" (amarillo, texto real);
  con stock → sin aviso. Nunca se muestran unidades. Las tallas aparecen todas; la talla sin stock muestra el aviso al
  elegirla. Carrito sin tope por stock (máximo por pedido: 99 unidades / 50 kg, solo contra errores de tipeo); las líneas
  "consultar" se compran igual y en WhatsApp terminan en "(consultar disponibilidad)".
- Tallas: variantes que solo difieren en la talla son una card con selector; cada talla tiene su SKU, precio y disponibilidad.
- Precio 1 o vacío = sin precio → "Consultar precio" + botón de WhatsApp. `descripcion` (opcional, desde los ajustes)
  se muestra en la ficha y en la card.
- Partes comunes de las páginas en `tools/parciales/` (se copian con `npm run paginas`). JS en `js/*.mjs` (módulos).
- Íconos locales (`assets/iconos.svg`, Lucide) y fuentes locales (`assets/fuentes/`). Sin CDNs.

## Ajustes del catálogo (`tools/catalogo/ajustes-catalogo.json`) — fuente de precios y disponibilidad corregidos
Reemplaza a Gesnex como fuente de la disponibilidad y de los precios corregidos. **Ganan siempre sobre el Excel**: un
producto excluido no vuelve al regenerar, y un texto, precio, foto o disponibilidad modificados no vuelven al original.
```json
{ "version": 1,
  "excluidos":   { "SKU": { "motivo": "ya no se vende" } },
  "modificados": { "SKU": { "nombre", "marca", "descripcion", "categoria", "subcategoria", "precio", "disponibilidad",
                            "tallas": { "M": { "precio": 9990, "disponibilidad": "con-stock" } },
                            "imagen": "assets/productos/SKU.webp", "imagenTipo": "exacta" } },
  "agregados":   [ { "sku" (opcional: se genera), "codigo", "nombre", "marca", "categoria", "subcategoria", "precio" | "tallas": [...],
                     "granel", "disponibilidad", "descripcion", "imagen", "imagenTipo" } ] }
```
Hoy está vacío (no cambia nada). Después de `npm run catalogo` o `node tools/catalogo/aplicar-fotos.mjs` se aplica solo.

## Revisión del catálogo con Rosa (`tools/revision/`) — NO cambia el sitio
- Abrir: doble clic en `REVISAR-CATALOGO.bat` (carpeta `akyra-petshop`). La primera vez instala con Python `rembg`
  (quitar fondos), `zxing-cpp` (códigos de barras) y el modelo de rembg, y crea la regla del Firewall de Windows para el
  puerto 8090 solo en redes **privadas** (Windows pide "Sí" una vez) — `tools/revision/preparar.ps1`.
- Servidor Node (`tools/revision/servidor.mjs`): escucha en la red local (Wi‑Fi o zona Wi‑Fi del celular), rechaza
  direcciones de internet y exige una **clave aleatoria nueva en cada apertura** (`?clave=…`, luego cookie); sin clave → 403.
  Muestra un QR con `http://IP-del-PC:8090/?clave=…` (botón "Conectar celular"). Avisa si la red está como "Pública".
- Datos (fuera del repo): `akyra-petshop/revision-catalogo/`: `revision.json` (cambios **por dato**:
  `cambios[SKU][campo] = { valor, fecha, dispositivo }`; guardado seguro temporal+renombrar), `historial.log` (qué, cuándo,
  PC/Celular, y cuando un dispositivo pisa el mismo dato del otro), `respaldos/` (cada 10 min, últimas 5),
  `fotos/` (procesadas `<SKU o código>.webp` ≤ 800 px y < 60 KB; `originales/`; `pendientes/` con las dos versiones).
- Sincronización en vivo por Server-Sent Events (`/api/eventos`); presencia "PC conectado / Celular conectado".
- Fotos: cola en el PC (`tools/revision/fotos.mjs` + `trabajador.py`): EXIF, brillo, rembg, fondo blanco, centrado con
  margen, 1:1; se ofrecen "Usar esta" / "Usar sin quitar fondo" / "Repetir foto". Sin Python/rembg sigue funcionando sin
  quitar fondos. Código de barras: foto → zxing-cpp → abre la card o propone "Agregar producto nuevo".
- La pantalla (`tools/revision/publico/`) usa las MISMAS reglas de publicación del sitio (importa `publicar.mjs`) y el
  mismo diseño: carga `styles.css` del sitio y cada producto es la card del catálogo web (foto, marca, nombre, precio,
  aviso, tallas, "− 1 +" y "Añadir") con el panel de revisión debajo. Sin SKU a la vista (se muestra el código de barras).
  Las clases propias de la herramienta llevan el prefijo `rev-` para no chocar con las del sitio.
- **Exportar** escribe en `revision-catalogo/`: `cambios-catalogo.xlsx` (Eliminar, Modificar, Precios, Disponibilidad,
  Fotos nuevas, Agregar), `Inventario_Mascoteria_Akyra_v54_precios.xlsx` (copia del inventario con los precios nuevos en
  la columna D de "Base Rosa (1004)" y los productos nuevos al final; se edita el XML de esa hoja: el original y las
  fórmulas no se tocan, Excel recalcula al abrir), `ajustes-catalogo.propuesto.json` y el resumen en `revision.json`.
- **Aplicar después (otra tarea)**: copiar `revision-catalogo/fotos/*.webp` de los productos con foto nueva a
  `assets/productos/<SKU>.webp` (y anotarlas como exactas en `fotos-progreso.json`), copiar
  `ajustes-catalogo.propuesto.json` sobre `tools/catalogo/ajustes-catalogo.json` (juntándolo con lo que ya tenga),
  correr `npm run catalogo` (con el Excel v54 si Rosa lo validó) y `npm run paginas`, y probar.
- Pruebas: `npx playwright test --project=revision` (catálogo de prueba `tests/fixtures/revision/`) y
  `tests/unit/revision.spec.mjs`. En CI la prueba de rembg se salta (no se instala); el código de barras sí corre.

## Actualización automática del stock (DESACTIVADA en noviembre 2026: la dueña dejó de usar Gesnex)
**Estado**: apagada, sin borrar nada. (a) Apps Script: `CONFIG.activo = false` en `apps-script/Config.js` (ya subido con
clasp): `procesarCorreos()` no hace nada aunque quede el activador horario; para quitar también el activador, abrir el
script y ejecutar `desactivar()`. (b) GitHub Action `.github/workflows/stock.yml`: sin `schedule` (solo manual).
La planilla "Akyra · Stock web" y el secreto `STOCK_CSV_URL` siguen guardados. El sitio ya no muestra "Stock actualizado".
**Para reactivar con un sistema de ventas**: (1) ajustar `apps-script/Config.js` (`busquedaGmail`, `COLUMNAS`) al reporte
nuevo y poner `activo: true`; `npm run apps-script:preparar` y `npx clasp push` en `.tmp/clasp/`; ejecutar `instalar()` desde
el editor (crea el activador); (2) descomentar el `schedule` de `stock.yml`. El Action ahora solo escribe la
**disponibilidad** (con stock / consultar, sin unidades) de los productos publicados y respeta los ajustes del catálogo
(no agrega productos ni cambia precios: eso va por `ajustes-catalogo.json`).

Cómo funcionaba (referencia):
1. Gesnex manda cada día un correo con el reporte de stock (xlsx o csv).
2. La planilla de Google **"Akyra · Stock web"** tiene un Apps Script (`apps-script/`, se sube con clasp) que cada
   hora entre 8:00 y 23:00 busca ese correo (búsqueda en `apps-script/Config.js`), lee el adjunto, suma el stock de
   todas las bodegas por SKU y actualiza la hoja **"Stock"** (por SKU y, si no, por código de barras). Lo que no
   calza va a **"Sin match"**; cada reporte queda en **"Historial"**. Si el reporte viene vacío, con columnas raras o
   calza con menos del 50 % de los productos, **no se aplica** y llega un correo de aviso. Etiqueta el correo
   como `akyra-procesado`.
3. Un **GitHub Action** (`.github/workflows/stock.yml`, cada hora) descarga el CSV público de la hoja "Stock"
   (secreto `STOCK_CSV_URL`, solo columnas públicas), lo valida con la misma regla del 50 % y, si algo cambió,
   actualiza `stock.json` (y `productos.json` si hay productos nuevos o precios distintos). El sitio nunca consulta
   Google: si algo falla, queda con el último stock bueno. 
   Planilla (privada, en el Drive del dueño): https://docs.google.com/spreadsheets/d/1NkJQGtHwQNlyKrl8mXuGseTaStE579ND8Twx0bW2IWo
   · script: https://script.google.com/d/1_xFOb9jzqqvWssGYpxHUM_m_1PlGjDpIMZvGtq6CBdMvhSfmRdTM6Oa7/edit
   · para subir cambios del script: `npm run apps-script:preparar` y
   `npx clasp push` dentro de `.tmp/clasp/` (la clave del CSV está en `.tmp/clasp/token.txt`, fuera de git).
4. **Si falla**: mirar la hoja "Historial" de la planilla y la pestaña **Actions** de GitHub ("Stock desde la planilla").
5. **Mapeo de columnas** del reporte real de Gesnex: `apps-script/Config.js` → `COLUMNAS` (todavía se probó solo con
   el reporte simulado `tests/fixtures/gesnex-simulado.*`).

## Temas de temporada (decoraciones por fecha)
- **Calendario**: `js/temas-config.mjs` (único archivo de configuración). Cada tema tiene `fechas`, `prioridad`,
  `capa` (`principal` o `detalle`), `decoracion` (`guirnalda`, `hero`, `pie`) y, si corresponde, `portada`.
  Se activa solo según la fecha de Chile (`js/temas.mjs`); si dos temas se cruzan gana la `prioridad` más alta.
  Un tema `detalle` (Día del Animal) se suma al principal sin taparlo.
- **Fechas**: fijas `{ desde: 'MM-DD', hasta: 'MM-DD' }` (si `hasta` es menor, cruza el año);
  alrededor de un día `{ alrededor: '07-26', dias: 3 }`; móviles `{ domingo: { mes: 5, numero: 2 }, diasAntes: 7 }`
  (2.º domingo de mayo y la semana anterior). Se recalculan solas cada año.
- **Cambiar fechas**: editar `fechas` del tema en `js/temas-config.mjs`. Nada más.
- **Agregar un tema**: (1) dibujarlo en `tools/temas/construir-temas.mjs` (figuras simples + `guirnalda()` y
  `composicion()`) y correr `node tools/temas/construir-temas.mjs`; (2) agregarlo a `TEMAS` en
  `js/temas-config.mjs`; (3) sumar un caso en `tests/unit/temas.spec.mjs`. Si trae portada, agregar en
  `index.html` una `hero__diapositiva` con `data-portada="<id>"` y `hidden`.
- **Ver un tema sin esperar la fecha**: `?tema=halloween` (o el id que sea) en cualquier página; `?tema=ninguno`
  muestra el sitio sin tema.
- Reglas: solo decoración (SVG locales con `aria-hidden`, sin clics: `pointer-events: none`), no cambia los colores
  de la marca, no tapa contenido ni el carrito, animación suave apagada con "reducir movimiento".

## Herramientas instaladas
- Plugins de Claude Code (en `.claude/settings.json`): **frontend-design** (construir pantallas), **impeccable**
  (revisar y pulir), **claude-code-setup**. Skills locales (fuera de git, origen en cada `ORIGEN.txt`):
  **ui-ux-pro-max** (sistema de diseño), **emil-design-eng** y **review-animations** (pulido y animación),
  **humanizer** (textos). MCP **context7** (`.mcp.json`): solo nombres de librerías y preguntas generales, nunca
  código propio.
- Pruebas y calidad: Playwright, @axe-core/playwright, Lighthouse CI, html-validate, linkinator, oxlint, sharp.
- Hooks: `.claude/hooks/proteger-archivos.mjs` (no editar a mano `productos.json`, `stock.json`, `.env*`, lock ni
  planillas) y `.claude/hooks/lint-archivo.mjs` (oxlint / html-validate al editar).
- Subagente `security-reviewer` (`.claude/agents/`): revisión de seguridad del sitio estático.

## Secciones del inicio con contenido de terceros o dinámico
- **Sucursales** (`js/sucursales.mjs`): los 3 mapas de Google se cargan cuando la sección se acerca a la pantalla
  (IntersectionObserver, `loading="lazy"`, altura reservada). Las fachadas de fondo cambian cada 3 s y la tarjeta se
  resalta (borde, resplandor y etiqueta "Foto de fondo"); pausa con botón, mouse o foco; con "reducir movimiento"
  queda la primera fija. Fotos: `assets/img/lugares/` (Casa Matriz y Las Lengas son imágenes neutras: reemplazar
  `casa-matriz.svg` / `las-lengas.svg` por la foto real, mismo nombre de `data-sucursal` en `index.html`).
- **Instagram** (`js/instagram.mjs`): feed de Elfsight (widget `4cc8cd0a-…`), script inyectado solo al acercarse la
  sección. Si no carga, queda el botón "Síguenos en Instagram". **CSP propia del inicio**
  (`tools/parciales/seguridad-inicio.html`): permite los dominios de Elfsight y `style-src 'unsafe-inline'` (lo usa el
  widget); el resto de las páginas mantiene la CSP estricta (`seguridad.html`). Si Elfsight pide otro dominio, se ve
  como error de CSP en la consola: agregarlo solo en `seguridad-inicio.html` y correr `npm run paginas`.
- **Marcas con logos** (`tools/marcas/`): `fuentes.json` lista las marcas (logo oficial + sitio de origen) y
  `node tools/marcas/construir-logos.mjs` baja y optimiza los logos a `assets/marcas/` y reescribe el carrusel en
  `index.html`. Sin logo = se muestra el nombre. Los logos de Inaba, Vet Life, N&D, Mondo Mascota, León Pet, Master Cat y Nómade los entregó el dueño (`tools/marcas/originales/`). Los logos de letras blancas llevan `"fondo": "oscuro"`.
- **Granel**: kilos con hasta 3 decimales (`carrito.interpretarKilos`), − y + de a 0,1 kg, mínimo 0,1 kg.
