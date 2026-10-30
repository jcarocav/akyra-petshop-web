#!/usr/bin/env node
// ============================================================
// BUSCAR FOTOS EN TIENDAS CHILENAS (sus buscadores públicos, sin pasar por buscadores de imágenes).
//
// Consulta la API pública de productos (WooCommerce Store API) de varias tiendas de mascotas y acepta la foto solo
// si el nombre del producto de la tienda calza con el nuestro con la regla estricta de siempre (coincidencia.mjs:
// marca, línea, sabor, variante y tamaño) o si el código de barras aparece en su SKU, enlace o nombre de archivo.
// Ante la duda no acepta. Respeta pausas entre consultas y no usa técnicas para saltarse bloqueos.
//
// Uso: node tools/imagenes/buscar-tiendas.mjs [--max 150] [--paralelo 2] [--pausa 500] [--sku SKU] [--reintentar]
//   --reintentar: vuelve a mirar también los que ya figuran como "sin foto" (grupo C) en este método
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cruzarStock } from '../../js/stock.mjs'
import { bajar, imagenUsable } from './buscar-web.mjs'
import { esCodigoDeFabrica } from './buscar.mjs'
import { evaluarCoincidencia, normalizar } from './coincidencia.mjs'
import { optimizar } from './procesar.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PROGRESO = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const MAX = Number(arg('--max', 150))
const PARALELO = Number(arg('--paralelo', 2))
const PAUSA = Number(arg('--pausa', 500))
const SOLO = arg('--sku', null)
const REINTENTAR = process.argv.includes('--reintentar')
const esperar = ms => new Promise(r => setTimeout(r, ms))

// Tiendas con WooCommerce Store API abierta (se probó que responden JSON)
const TIENDAS = [
  { id: 'tusmascotas.cl', base: 'https://www.tusmascotas.cl' },
  { id: 'distribuidoralira.cl', base: 'https://www.distribuidoralira.cl' },
  { id: 'petpalace.cl', base: 'https://petpalace.cl' },
  { id: 'petshopmg.cl', base: 'https://petshopmg.cl' },
  { id: 'mascoteriagonzalito.cl', base: 'https://www.mascoteriagonzalito.cl' },
  { id: 'petcity.cl', base: 'https://petcity.cl' }
]
const GENERICAS = /\b(alimento|sobre|lata|snack|caja|balde|pote|para|de|del|con|sabor|receta|y|el|la|los|las|a|granel|unidades?|uds?)\b/gi

async function pedir(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) })
      if (r.status === 429 || r.status >= 500) { await esperar(4000 * (i + 1)); continue }
      if (!r.ok) return []
      const j = await r.json()
      return Array.isArray(j) ? j : []
    } catch { await esperar(1500 * (i + 1)) }
  }
  return []
}

const sinHtml = t => String(t || '').replace(/&#8211;|&ndash;/g, '-').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ').replace(/<[^>]*>/g, ' ')

function consultas(item) {
  const limpio = normalizar(item.nombreExcel.replace(/\([^)]*\)/g, ' ')).replace(GENERICAS, ' ').replace(/\s+/g, ' ').trim()
  const pal = limpio.split(' ').filter(w => w.length > 1)
  const tam = (item.nombreExcel.match(/(\d+(?:[.,]\d+)?)\s?(kg|g|gr|ml|l|lt)\b/i) || [])[0]
  const q = []
  q.push(pal.slice(0, 6).join(' '))
  if (pal.length > 3) q.push(pal.slice(0, 3).join(' ') + (tam ? ' ' + tam.replace(',', '.') : ''))
  if (pal.length > 2) q.push(pal.slice(0, 2).join(' '))
  return [...new Set(q.filter(Boolean))]
}

async function buscarEnTiendas(item) {
  const intentos = []
  for (const tienda of TIENDAS) {
    for (const q of consultas(item)) {
      const lista = await pedir(`${tienda.base}/wp-json/wc/store/v1/products?search=${encodeURIComponent(q)}&per_page=12`)
      intentos.push(`${tienda.id}: ${q} (${lista.length})`)
      await esperar(PAUSA)
      let mejor = null
      for (const p of lista) {
        const nombre = sinHtml(p.name)
        const img = p.images?.[0]?.src
        if (!img) continue
        const porCodigo = esCodigoDeFabrica(item.codigo) && (`${p.sku} ${p.permalink} ${img}`).includes(item.codigo)
        const r = evaluarCoincidencia(item, nombre)
        if (!r.acepta && !porCodigo) continue
        const puntaje = (r.acepta ? r.puntaje : 0) + (porCodigo ? 2 : 0)
        if (!mejor || puntaje > mejor.puntaje) mejor = { puntaje, titulo: nombre, pagina: p.permalink, imagen: img, confirmaCodigo: porCodigo, tienda: tienda.id }
      }
      if (mejor) {
        try {
          const buf = await bajar(mejor.imagen)
          if (await imagenUsable(buf)) continue
          return { ...mejor, buf, intentos }
        } catch { /* seguir con otra consulta o tienda */ }
      }
    }
  }
  return { intentos }
}

async function main() {
  const progreso = JSON.parse(readFileSync(PROGRESO, 'utf8'))
  const guardar = () => writeFileSync(PROGRESO, JSON.stringify(progreso, null, 1))
  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
  const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
  const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
  const porSku = new Map(internos.map(i => [i.sku, i]))
  const items = []
  for (const p of cruzarStock(catalogo.productos, stock).filter(x => !x.imagen)) {
    const e = progreso[p.sku]
    if (SOLO ? p.sku !== SOLO : (e?.tiendas && !REINTENTAR) || (e && e.grupo !== 'C')) continue
    const i = porSku.get(p.tallas ? p.tallas.find(t => porSku.has(t.sku))?.sku : p.sku)
    if (!i) continue
    items.push({ sku: p.sku, nombre: p.nombre, nombreExcel: i.nombreExcel, marca: p.marca, categoria: p.categoria, codigo: i.codigo, granel: !!p.granel })
  }
  const pendientes = items.slice(0, MAX)
  console.log(`Buscando en ${TIENDAS.length} tiendas para ${pendientes.length} productos (de ${items.length} sin foto)...`)
  let hechos = 0
  let ok = 0
  let sig = 0
  const trabajador = async () => {
    while (sig < pendientes.length) {
      const item = pendientes[sig++]
      const r = await buscarEnTiendas(item)
      const hoy = new Date().toISOString().slice(0, 10)
      const previo = progreso[item.sku] || {}
      if (r.buf) {
        const archivo = `assets/productos/${item.sku}.webp`
        try {
          await optimizar(r.buf, join(RAIZ, archivo))
          progreso[item.sku] = { grupo: 'A', metodo: `tienda ${r.tienda} (búsqueda pública)`, confirmaCodigo: r.confirmaCodigo, titulo: r.titulo, pagina: r.pagina, origen: r.imagen, archivo, descartadas: previo.descartadas, fecha: hoy }
          ok++
        } catch { progreso[item.sku] = { ...previo, grupo: 'C', tiendas: true, intentos: r.intentos, fecha: hoy } }
      } else {
        progreso[item.sku] = { ...previo, grupo: 'C', tiendas: true, intentos: [...(previo.intentos || []), ...r.intentos].slice(-24), motivo: previo.motivo || 'sin coincidencia segura por código ni por nombre', fecha: hoy }
      }
      hechos++
      if (hechos % 10 === 0 || hechos === pendientes.length) { guardar(); console.log(`  ${hechos}/${pendientes.length} · nuevas exactas: ${ok}`) }
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabajador))
  guardar()
  console.log(`Listo. Nuevas exactas: ${ok} de ${pendientes.length}.`)
}

if (process.argv[1] && process.argv[1].endsWith('buscar-tiendas.mjs')) main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
