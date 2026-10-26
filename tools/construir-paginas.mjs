#!/usr/bin/env node
// ============================================================
// CONSTRUIR PÁGINAS — copia las partes comunes (cabecera, carrito,
// pie, aviso de privacidad, seguridad y scripts) dentro de cada
// página HTML, entre las marcas <!-- parcial:nombre --> y
// <!-- /parcial:nombre -->. Así todas quedan iguales y se editan en
// un solo lugar: tools/parciales/.
//
// También genera sitemap.xml (con todas las fichas de producto).
//
// Uso: npm run paginas
// Si el sitio pasa a un dominio propio: npm run paginas -- --sitio https://www.akyra.cl/
// ============================================================
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cruzarStock } from '../js/stock.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITIO_ACTUAL = 'https://jcarocav.github.io/akyra-petshop-web/'

const PAGINAS = {
  'index.html': { id: 'inicio', modulo: 'pagina-inicio', prioridad: '1.0' },
  'catalogo.html': { id: 'catalogo', modulo: 'pagina-catalogo', prioridad: '0.9' },
  'producto.html': { id: 'producto', modulo: 'pagina-producto', sinSitemap: true },
  'contactenos.html': { id: 'contacto', modulo: 'pagina-contacto', prioridad: '0.5' },
  'politica-privacidad.html': { id: 'privacidad', prioridad: '0.3' },
  'politica-despacho-retiro.html': { id: 'despacho', prioridad: '0.4' },
  'politica-cambios-devoluciones.html': { id: 'cambios', prioridad: '0.3' },
  'accesibilidad.html': { id: 'accesibilidad', prioridad: '0.3' },
  '404.html': { id: '404', sinSitemap: true }
}

function argumento(nombre) {
  const i = process.argv.indexOf(nombre)
  return i >= 0 ? process.argv[i + 1] : null
}

const sitioNuevo = argumento('--sitio')
const SITIO = (sitioNuevo || SITIO_ACTUAL).replace(/\/?$/, '/')

function parcial(nombre, pagina) {
  if (nombre === 'scripts') {
    const lineas = [
      '<script src="config.js" defer></script>',
      '<script type="module" src="js/app.mjs"></script>'
    ]
    if (pagina.modulo) lineas.push(`<script type="module" src="js/${pagina.modulo}.mjs"></script>`)
    return lineas.join('\n')
  }
  let html = readFileSync(join(RAIZ, 'tools', 'parciales', `${nombre}.html`), 'utf8').trimEnd()
  html = html.replace(/\{\{actual:([a-z0-9-]+)\}\}/g, (_, id) => (id === pagina.id ? ' aria-current="page"' : ''))
  return html
}

let cambiadas = 0
for (const [archivo, pagina] of Object.entries(PAGINAS)) {
  const ruta = join(RAIZ, archivo)
  const original = readFileSync(ruta, 'utf8')
  let html = original.replace(/<!-- parcial:([a-z-]+) -->[\s\S]*?<!-- \/parcial:\1 -->/g,
    (_, nombre) => `<!-- parcial:${nombre} -->\n${parcial(nombre, pagina)}\n<!-- /parcial:${nombre} -->`)
  if (sitioNuevo) html = html.split(SITIO_ACTUAL).join(SITIO)
  // La página 404 se muestra en cualquier ruta: sus enlaces deben partir de la raíz del sitio.
  if (archivo === '404.html') {
    const base = new URL(SITIO).pathname
    html = html.replace(/<base href="[^"]*">\n?/, '').replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n<base href="${base}">`)
  }
  if (html !== original) { writeFileSync(ruta, html); cambiadas++ }
}

// ---------- sitemap.xml ----------
// Solo productos visibles (con stock o sin dato): los agotados no van al sitemap
const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
const productos = cruzarStock(catalogo.productos, stock).filter(p => p.visible)
const hoy = new Date().toISOString().slice(0, 10)
const urls = []
for (const [archivo, pagina] of Object.entries(PAGINAS)) {
  if (pagina.sinSitemap) continue
  urls.push({ loc: SITIO + (archivo === 'index.html' ? '' : archivo), prioridad: pagina.prioridad })
}
for (const c of catalogo.categorias || []) {
  urls.push({ loc: `${SITIO}catalogo.html?categoria=${c.id}`, prioridad: '0.8' })
}
for (const p of productos) {
  urls.push({ loc: `${SITIO}producto.html?id=${encodeURIComponent(p.id)}`, prioridad: '0.6' })
}
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc.replace(/&/g, '&amp;')}</loc><lastmod>${hoy}</lastmod><priority>${u.prioridad}</priority></url>`).join('\n')}
</urlset>
`
writeFileSync(join(RAIZ, 'sitemap.xml'), xml)

// robots.txt, llms.txt y security.txt apuntan al sitio actual
for (const archivo of ['robots.txt', 'llms.txt', '.well-known/security.txt']) {
  try {
    const ruta = join(RAIZ, archivo)
    const t = readFileSync(ruta, 'utf8')
    if (sitioNuevo) writeFileSync(ruta, t.split(SITIO_ACTUAL).join(SITIO))
  } catch { /* opcional */ }
}

console.log(`Páginas actualizadas: ${cambiadas} · sitemap.xml: ${urls.length} direcciones (${productos.length} productos)`)
if (sitioNuevo) console.log(`Recuerda cambiar SITIO_ACTUAL en tools/construir-paginas.mjs a ${SITIO}`)
// Listado para revisar que no quedó ninguna página fuera
const sueltas = readdirSync(RAIZ).filter(f => f.endsWith('.html') && !PAGINAS[f])
if (sueltas.length) console.log('Ojo: páginas sin registrar en PAGINAS:', sueltas.join(', '))
