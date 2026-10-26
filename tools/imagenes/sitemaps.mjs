#!/usr/bin/env node
// ============================================================
// Segunda fuente de fotos: páginas de producto de grandes tiendas
// chilenas, ubicadas con sus sitemaps públicos (los que declaran en
// robots.txt). Para cada producto sin foto:
//   1. se buscan páginas cuyo nombre (en la URL) calce con marca y palabras clave;
//   2. se abre la página (máx. 1 por segundo por tienda);
//   3. se acepta SOLO si la página contiene nuestro código de barras, o si
//      el producto no tiene código de fábrica y el título calza en marca,
//      línea, sabor y tamaño (comparación estricta de coincidencia.mjs).
//   La foto es la imagen principal de la página (og:image).
//
// Uso: node tools/imagenes/sitemaps.mjs   (guarda en tools/imagenes/fuentes.json)
// ============================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { esCodigoDeFabrica } from './buscar.mjs'
import { evaluarCoincidencia, normalizar } from './coincidencia.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CACHE = join(RAIZ, 'tools', 'imagenes', 'cache')
const ARCHIVO_FUENTES = join(RAIZ, 'tools', 'imagenes', 'fuentes.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const TIENDAS = [
  // Jumbo y Santa Isabel no listan productos en su sitemap; Líder bloquea robots (no se fuerza).
  { id: 'laikamascotas.cl', indices: ['https://laikamascotas.cl/sitemap.xml', 'https://laikamascotas.cl/sitemap_v2.xml'], producto: /laikamascotas\.cl\/(?!perros$|gatos$|promociones|membership|marcas|tiendas|legal|blog)[^/]+\/?[^/]*$/ },
  { id: 'petcity.cl', indices: ['https://petcity.cl/sitemap_index.xml'], producto: /\/tienda\/|petcity\.cl\/[^/]+\/$/, soloIndices: /product-sitemap/ },
  { id: 'clubdeperrosygatos.cl', indices: ['https://www.clubdeperrosygatos.cl/sitemap_index.xml'], producto: /./, soloIndices: /product-sitemap/ },
  { id: 'tusmascotas.cl', indices: ['https://www.tusmascotas.cl/sitemap_index.xml'], producto: /./, soloIndices: /product-sitemap/ },
  { id: 'superzoo.cl', indices: ['https://www.superzoo.cl/sitemap_index.xml'], producto: /\.html$/ },
  { id: 'puntomascotas.cl', indices: ['https://www.puntomascotas.cl/1_index_sitemap.xml'], producto: /-\d{8,14}\.html$/ }
]

const MASCOTAS = /(perr|gat|cachorr|mascota|arena|felin|canin|snack|alimento|churu|whiskas|pedigree|felix|champion|purina|proplan|pro-plan|royal|fit-formula|master-dog|master-cat|dog|cat|kitten|puppy|antiparasit|shampoo|collar|arnes|correa|juguete|leonardo|bravery|amity|biofresh|nomade|vet-life|vetlife|dragpharma|top-k9|bioline|petbrilho|wanpy|cremi|naturalistic|animal-planet|dentastix|cachupin|agility|ownat|acana|applaws|bestpet|tasty|fancy-feast|cat-chow|dog-chow|alfa-dog|ancestral|bokato|super-pet|superpet|masko|gati)/

const esperar = ms => new Promise(r => setTimeout(r, ms))
const ultimoPedido = new Map()

async function pedir(url, { texto = true } = {}) {
  const host = new URL(url).host
  const espera = 1100 - (Date.now() - (ultimoPedido.get(host) || 0))
  if (espera > 0) await esperar(espera)
  ultimoPedido.set(host, Date.now())
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CL,es;q=0.9' }, signal: AbortSignal.timeout(30000), redirect: 'follow' })
      if (r.status === 429 || r.status >= 500) { await esperar(4000 * (i + 1)); continue }
      if (!r.ok) return null
      return texto ? await r.text() : r
    } catch {
      await esperar(2000 * (i + 1))
    }
  }
  return null
}

const locs = xml => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'))

async function urlsDeTienda(t) {
  const archivo = join(CACHE, `${t.id}.json`)
  if (existsSync(archivo)) return JSON.parse(readFileSync(archivo, 'utf8'))
  const pendientes = [...t.indices]
  const vistos = new Set()
  const productos = new Set()
  while (pendientes.length) {
    const u = pendientes.shift()
    if (vistos.has(u)) continue
    vistos.add(u)
    const xml = await pedir(u)
    if (!xml) continue
    const lista = locs(xml)
    if (/<sitemapindex/i.test(xml)) {
      for (const l of lista) if (!t.soloIndices || t.soloIndices.test(l)) pendientes.push(l)
    } else {
      for (const l of lista) if (t.producto.test(l) && MASCOTAS.test(l.toLowerCase())) productos.add(l)
    }
  }
  const resultado = [...productos]
  writeFileSync(archivo, JSON.stringify(resultado))
  console.log(`  ${t.id}: ${resultado.length} páginas de productos para mascotas`)
  return resultado
}

// Palabras de una URL ("alimento-gato-master-cat-carne-85-g-1448696/p")
function palabrasUrl(url) {
  const ruta = decodeURIComponent(new URL(url).pathname).replace(/\/p$/, '')
  return new Set(normalizar(ruta.replace(/[/_-]+/g, ' ')).split(' ').filter(Boolean))
}

function palabrasClave(item) {
  const vacias = new Set(['alimento', 'sobre', 'lata', 'snack', 'caja', 'de', 'con', 'y', 'para', 'sabor', 'receta', 'el', 'la', 'a', 'kg', 'g', 'gr', 'ml', 'uds', 'ud', 'x'])
  return [...new Set(normalizar(item.nombreExcel.replace(/\([^)]*\)/g, ' ')).split(' '))].filter(w => w.length > 1 && !vacias.has(w))
}

function candidatos(item, indice) {
  const clave = palabrasClave(item)
  const marca = normalizar(item.marca).split(' ').filter(w => w.length >= 3 && !['purina', 'mascota', 'pets', 'pet'].includes(w))
  const resultado = []
  for (const { url, palabras } of indice) {
    if (marca.length && !marca.some(m => palabras.has(m) || [...palabras].some(p => p.includes(m)))) continue
    const presentes = clave.filter(w => palabras.has(w) || palabras.has(w.replace(/(es|s)$/, ''))).length
    const puntaje = presentes / clave.length
    if (puntaje >= 0.6) resultado.push({ url, puntaje })
  }
  return resultado.sort((a, b) => b.puntaje - a.puntaje).slice(0, 3)
}

function metaContenido(html, propiedad) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${propiedad}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${propiedad}["']`, 'i')
  const m = html.match(re)
  return m ? (m[1] || m[2]).replace(/&amp;/g, '&') : null
}

function variantesCodigo(codigo) {
  const c = String(codigo)
  const v = new Set([c])
  if (c.length === 12) v.add('0' + c)
  if (c.length === 13 && c.startsWith('0')) v.add(c.slice(1))
  return [...v]
}

function confirmar(item, html, url) {
  const imagen = metaContenido(html, 'og:image')
  if (!imagen || /logo|placeholder|no[-_]?image/i.test(imagen)) return null
  const titulo = (metaContenido(html, 'og:title') || (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '').trim()
  const fabrica = esCodigoDeFabrica(item.codigo)
  const gtinsPagina = new Set([...html.matchAll(/"gtin(?:8|12|13|14)?"\s*:\s*"?(\d{8,14})/gi)].map(m => m[1].replace(/^0+/, '')))
  const variosGtin = [...gtinsPagina].some(g => g !== String(item.codigo).replace(/^0+/, ''))
  if (fabrica && !variosGtin && variantesCodigo(item.codigo).some(c => new RegExp(`(^|[^0-9])${c}([^0-9]|$)`).test(html))) {
    return { metodo: 'código de barras', imagen, titulo, pagina: url }
  }
  // Si la página declara otro código de barras, es otro producto
  const otros = [...html.matchAll(/"gtin(?:13|12|8)?"\s*:\s*"?(\d{8,14})/g)].map(m => m[1])
  if (fabrica && otros.length) return null
  const r = evaluarCoincidencia(item, titulo)
  if (r.acepta) return { metodo: 'nombre (marca, línea, sabor y tamaño)', imagen, titulo, pagina: url }
  return null
}

async function main() {
  mkdirSync(CACHE, { recursive: true })
  const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
  const fuentes = JSON.parse(readFileSync(ARCHIVO_FUENTES, 'utf8'))
  console.log('Leyendo sitemaps…')
  const indice = []
  for (const t of TIENDAS) {
    for (const url of await urlsDeTienda(t)) indice.push({ url, tienda: t.id, palabras: palabrasUrl(url) })
  }
  console.log(`Índice: ${indice.length} páginas`)
  const i = process.argv.indexOf('--solo')
  const solo = i >= 0 ? new Set(process.argv[i + 1].split(',')) : null
  const pendientes = internos.filter(p => p.visible && p.categoria !== 'granel' && (!fuentes[p.sku] || fuentes[p.sku].noEncontrada || fuentes[p.sku].error))
    .filter(p => !solo || solo.has(p.sku))
  console.log(`Productos sin foto: ${pendientes.length}`)
  let encontrados = 0
  for (const [i, p] of pendientes.entries()) {
    const lista = candidatos(p, indice)
    for (const c of lista) {
      const html = await pedir(c.url)
      if (!html) continue
      const ok = confirmar(p, html, c.url)
      if (ok) {
        fuentes[p.sku] = { fuente: new URL(c.url).host.replace(/^www\./, ''), ...ok, fecha: new Date().toISOString().slice(0, 10) }
        encontrados++
        break
      }
    }
    if ((i + 1) % 20 === 0 || i === pendientes.length - 1) {
      writeFileSync(ARCHIVO_FUENTES, JSON.stringify(fuentes, null, 1))
      console.log(`  ${i + 1}/${pendientes.length} · nuevas: ${encontrados}`)
    }
  }
  writeFileSync(ARCHIVO_FUENTES, JSON.stringify(fuentes, null, 1))
  console.log(`Listo. Nuevas fotos encontradas: ${encontrados}`)
}

main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
