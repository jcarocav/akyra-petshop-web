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
5. **Imágenes**: solo fotos que calcen EXACTAMENTE (marca, línea, sabor, formato y tamaño; idealmente
   confirmadas por código de barras). Ante la duda, "No encontrada". Se guardan en `assets/productos/<SKU>.webp`
   (≤ 800 px, ~60 KB), nunca enlazadas al sitio de origen.
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
  → visible como "Consultar disponibilidad", sin tope. Granel: en kilos, pasos de 0,5 kg; bajo 0,5 kg = agotado.
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
4. **Si falla**: mirar la hoja "Historial" de la planilla y la pestaña **Actions** de GitHub ("Stock desde la planilla").
5. **Mapeo de columnas** del reporte real de Gesnex: `apps-script/Config.js` → `COLUMNAS` (todavía se probó solo con
   el reporte simulado `tests/fixtures/gesnex-simulado.*`).

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
