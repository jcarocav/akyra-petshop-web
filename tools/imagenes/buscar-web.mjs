#!/usr/bin/env node
// ============================================================
// BUSCAR FOTOS EN LA WEB (Bing Imágenes) para los productos visibles que aún no tienen foto.
//
// Para cada producto prueba, en este orden: (1) código de barras, (2) nombre + marca, (3) código + nombre.
// Solo acepta una foto como EXACTA (grupo A) si el título de la página de donde sale calza con el
// producto con la misma regla estricta de siempre (marca, línea, sabor, variante y tamaño: coincidencia.mjs)
// y la imagen es usable (≥ 300 px, casi cuadrada). Ante la duda, no acepta: queda para revisar (grupo C).
//
// Guarda el avance en tools/catalogo/fotos-progreso.json (si se corta, al retomar no repite lo ya buscado)
// y la foto optimizada en assets/productos/<SKU>.webp.
//
// Uso: node tools/imagenes/buscar-web.mjs [--max 80] [--sku SKU] [--pausa 1500]
// ============================================================
import sharp from 'sharp'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cruzarStock } from '../../js/stock.mjs'
import { esCodigoDeFabrica } from './buscar.mjs'
import { evaluarCoincidencia } from './coincidencia.mjs'
import { optimizar } from './procesar.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PROGRESO = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const MAX = Number(arg('--max', 80))
const PAUSA = Number(arg('--pausa', 1500))
const SOLO = arg('--sku', null)
const esperar = ms => new Promise(r => setTimeout(r, ms))

// Bancos de imágenes y redes: casi siempre con marca de agua o de otro producto
const DOMINIOS_MALOS = /(shutterstock|alamy|istockphoto|dreamstime|123rf|depositphotos|gettyimages|pinterest|facebook|fbcdn|instagram|tiktok|youtube|ytimg|wikimedia|redd\.it|reddit|animania|aliexpress|alicdn|temu|ebay|mercadolibre\.com\.ar|olx)/i

export async function buscarBing(consulta) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(consulta)}&form=HDRSC2&first=1`, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'es-CL,es;q=0.9' }, signal: AbortSignal.timeout(25000)
      })
      if (r.status === 429 || r.status >= 500) { await esperar(5000 * (i + 1)); continue }
      const t = await r.text()
      if (/captcha|unusual traffic/i.test(t.slice(0, 20000)) && !t.includes('iusc')) throw new Error('Bing pide captcha: pausar y retomar más tarde')
      return [...t.matchAll(/class="iusc"[^>]*m="([^"]+)"/g)].map(m => {
        try {
          const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
          return { imagen: j.murl, pagina: j.purl, titulo: j.t || '' }
        } catch { return null }
      }).filter(c => c && c.imagen)
    } catch (e) {
      if (/captcha/i.test(e.message)) throw e
      await esperar(2000 * (i + 1))
    }
  }
  return []
}

async function bajar(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' }, signal: AbortSignal.timeout(25000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  if (!(r.headers.get('content-type') || '').startsWith('image/')) throw new Error('no es imagen')
  return Buffer.from(await r.arrayBuffer())
}

// ¿La imagen sirve? ≥ 300 px y no es un banner (proporción cercana a cuadrada)
async function imagenUsable(buf) {
  const m = await sharp(buf).metadata()
  if (!m.width || Math.max(m.width, m.height) < 300) return 'muy chica'
  const proporcion = m.width / m.height
  if (proporcion > 2 || proporcion < 0.45) return 'proporción rara'
  return null
}

function armarItems() {
  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
  const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
  const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
  const porSku = new Map(internos.map(i => [i.sku, i]))
  const items = []
  for (const p of cruzarStock(catalogo.productos, stock).filter(x => x.visible && !x.imagen)) {
    const skuInterno = p.tallas ? p.tallas.find(t => porSku.has(t.sku))?.sku : p.sku
    const i = porSku.get(skuInterno || p.sku)
    if (!i) continue
    items.push({ sku: p.sku, nombre: p.nombre, nombreExcel: i.nombreExcel, marca: p.marca, categoria: p.categoria, codigo: i.codigo, granel: !!p.granel })
  }
  return items
}

function consultas(item) {
  const marca = item.marca && item.marca !== 'Genérico' && !item.nombreExcel.toLowerCase().includes(item.marca.toLowerCase()) ? ` ${item.marca}` : ''
  const nombre = item.nombreExcel.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  const lista = []
  if (esCodigoDeFabrica(item.codigo)) lista.push({ q: item.codigo, via: 'código de barras' })
  lista.push({ q: `${nombre}${marca}`, via: 'nombre' })
  if (esCodigoDeFabrica(item.codigo)) lista.push({ q: `${item.codigo} ${nombre}`.slice(0, 160), via: 'código + nombre' })
  return lista
}

export async function buscarItem(item) {
  const vistos = new Set()
  for (const { q, via } of consultas(item)) {
    const candidatos = await buscarBing(q)
    await esperar(PAUSA)
    for (const c of candidatos.slice(0, 20)) {
      if (vistos.has(c.imagen) || DOMINIOS_MALOS.test(c.imagen) || DOMINIOS_MALOS.test(c.pagina || '')) continue
      vistos.add(c.imagen)
      const porCodigo = esCodigoDeFabrica(item.codigo) && (`${c.titulo} ${c.pagina}`).includes(item.codigo)
      const r = evaluarCoincidencia(item, c.titulo)
      if (!r.acepta && !(porCodigo && /marca/.test(r.motivo) === false)) continue
      try {
        const buf = await bajar(c.imagen)
        const problema = await imagenUsable(buf)
        if (problema) continue
        return { ...c, via, consulta: q, buf, confirmaCodigo: porCodigo }
      } catch { /* siguiente candidato */ }
    }
  }
  return null
}

async function main() {
  const progreso = existsSync(PROGRESO) ? JSON.parse(readFileSync(PROGRESO, 'utf8')) : {}
  const guardar = () => writeFileSync(PROGRESO, JSON.stringify(progreso, null, 1))
  const pendientes = armarItems().filter(i => (SOLO ? i.sku === SOLO : !progreso[i.sku])).slice(0, MAX)
  console.log(`Buscando fotos para ${pendientes.length} productos...`)
  let a = 0
  for (const [n, item] of pendientes.entries()) {
    let r = null
    try { r = await buscarItem(item) } catch (e) { console.error(e.message); guardar(); process.exit(2) }
    const hoy = new Date().toISOString().slice(0, 10)
    if (r) {
      const archivo = `assets/productos/${item.sku}.webp`
      try {
        await optimizar(r.buf, join(RAIZ, archivo))
        progreso[item.sku] = { grupo: 'A', metodo: r.via, confirmaCodigo: r.confirmaCodigo, titulo: r.titulo, pagina: r.pagina, origen: r.imagen, archivo, fecha: hoy }
        a++
      } catch (e) {
        progreso[item.sku] = { grupo: 'C', motivo: `la mejor foto no se pudo procesar (${e.message})`, fecha: hoy }
      }
    } else {
      progreso[item.sku] = { grupo: 'C', motivo: 'sin coincidencia segura por código ni por nombre', fecha: hoy }
    }
    if ((n + 1) % 10 === 0 || n === pendientes.length - 1) { guardar(); console.log(`  ${n + 1}/${pendientes.length} · exactas: ${a}`) }
  }
  guardar()
  console.log(`Listo. Exactas encontradas: ${a} de ${pendientes.length}.`)
}

if (process.argv[1] && process.argv[1].endsWith('buscar-web.mjs')) main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
