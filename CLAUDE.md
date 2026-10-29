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
   rama `respaldo-2026-09-02` y tag `respaldo-antes-catalogo-real` (para volver atrás si algo sale mal).
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
| Stock desde la planilla (lo hace el Action) | `npm run stock:desde-planilla` (necesita `STOCK_CSV_URL`) |
| Reporte simulado de Gesnex (pruebas) | `npm run stock:simular` |
| Preparar el Apps Script para clasp | `npm run apps-script:preparar` |

## Cómo está armado
- `productos.json` (catálogo, lo genera `tools/generar-catalogo.mjs`) + `stock.json` (`{ actualizado, unidades: { SKU: n | null } }`).
  El sitio cruza ambos al cargar (`js/datos.mjs` + `js/stock.mjs`).
- Catálogo = unión de las hojas **"Resumen"** (stock, SKU) y **"Base Rosa (1004)"** (nombre, precio, fabricante,
  categoría) del Excel, por código de barras. Lo que está solo en Base Rosa entra con stock 0 (oculto) y recibe un
  SKU nuevo (`CATEGORIA-MARCA-NNN`, guardado en `tools/catalogo/skus-generados.json` para que no cambie).
- Visibilidad: stock > 0 → visible (tope del "+" = stock); stock 0 → oculto en catálogo, buscador, destacados y
  sitemap (su ficha dice "Agotado por ahora" con `noindex`); sin dato (cantidad vacía en las 5 hojas de conteo)
  → visible como "Consultar disponibilidad", sin tope. Granel: en kilos con hasta 3 decimales (se escribe a mano, coma o punto; − y + de a 0,1 kg); bajo 0,1 kg = agotado.
- Tallas: variantes que solo difieren en la talla son una card con selector; cada talla tiene su SKU, precio y stock.
- Precio 1 o vacío = sin precio → "Consultar precio" + botón de WhatsApp.
- Partes comunes de las páginas en `tools/parciales/` (se copian con `npm run paginas`). JS en `js/*.mjs` (módulos).
- Íconos locales (`assets/iconos.svg`, Lucide) y fuentes locales (`assets/fuentes/`). Sin CDNs.

## Actualización diaria del stock (Gesnex → correo → Google Sheets → sitio)
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
   Google: si algo falla, queda con el último stock bueno. El catálogo muestra "Stock actualizado: dd-mm-aaaa hh:mm".
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
