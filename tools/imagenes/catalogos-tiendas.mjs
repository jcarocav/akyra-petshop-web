#!/usr/bin/env node
// ============================================================
// CATÁLOGOS DE TIENDAS CHILENAS (listados públicos de productos) para buscar fotos SIN consultar producto por producto.
//
// 1. Baja, con pausas, el listado público de productos de cada tienda (WooCommerce Store API o Shopify products.json):
//    nombre, SKU, enlace e imagen. Se guarda en .tmp/catalogos/<tienda>.json (fuera del repositorio).
// 2. Cruza ese listado con los productos que siguen sin foto, con la misma regla estricta de siempre
//    (coincidencia.mjs: marca, línea, sabor, variante y tamaño) o con el código de barras si aparece en su SKU o enlace.
//
// Uso: node tools/imagenes/catalogos-tiendas.mjs bajar [--pausa 700]    (una vez; se puede repetir para actualizar)
//      node tools/imagenes/catalogos-tiendas.mjs cruzar [--max 700]     (busca y guarda las fotos en assets/productos/)
// ============================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cruzarStock } from '../../js/stock.mjs'
import { sinHtml } from './buscar-tiendas.mjs'
import { bajar, imagenUsable } from './buscar-web.mjs'
import { esCodigoDeFabrica } from './buscar.mjs'
import { evaluarCoincidencia } from './coincidencia.mjs'
import { optimizar } from './procesar.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CARPETA = join(RAIZ, '.tmp', 'catalogos')
const PROGRESO = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const PAUSA = Number(arg('--pausa', 700))
const MAX = Number(arg('--max', 700))
const esperar = ms => new Promise(r => setTimeout(r, ms))

const TIENDAS = [
  { id: 'tusmascotas.cl', tipo: 'woo', base: 'https://www.tusmascotas.cl' },
  { id: 'distribuidoralira.cl', tipo: 'woo', base: 'https://www.distribuidoralira.cl' },
  { id: 'petpalace.cl', tipo: 'woo', base: 'https://petpalace.cl' },
  { id: 'petshopmg.cl', tipo: 'woo', base: 'https://petshopmg.cl' },
  { id: 'mascoteriagonzalito.cl', tipo: 'woo', base: 'https://www.mascoteriagonzalito.cl' },
  { id: 'petcity.cl', tipo: 'woo', base: 'https://petcity.cl' },
  { id: 'marbenpets.cl', tipo: 'woo', base: 'https://www.marbenpets.cl' },
  { id: 'topk9.cl', tipo: 'shopify', base: 'https://topk9.cl' },
  { id: 'bpets.cl', tipo: 'shopify', base: 'https://bpets.cl' }
]

async function pedirJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) })
      if (r.status === 429 || r.status >= 500) { await esperar(8000 * (i + 1)); continue }
      if (!r.ok) return null
      return await r.json()
    } catch { await esperar(3000 * (i + 1)) }
  }
  return null
}

async function bajarTienda(t) {
  const filas = []
  for (let pag = 1; pag <= 200; pag++) {
    const url = t.tipo === 'woo' ? `${t.base}/wp-json/wc/store/v1/products?per_page=100&page=${pag}` : `${t.base}/products.json?limit=250&page=${pag}`
    const j = await pedirJson(url)
    const lista = t.tipo === 'woo' ? j : j?.products
    if (!Array.isArray(lista) || !lista.length) break
    for (const p of lista) {
      if (t.tipo === 'woo') filas.push({ nombre: sinHtml(p.name), sku: p.sku || '', enlace: p.permalink, imagen: p.images?.[0]?.src || '' })
      else filas.push({ nombre: p.title, sku: (p.variants || []).map(v => v.sku || v.barcode || '').join(' '), enlace: `${t.base}/products/${p.handle}`, imagen: p.images?.[0]?.src || '' })
    }
    if (lista.length < (t.tipo === 'woo' ? 100 : 250)) break
    await esperar(PAUSA)
  }
  return filas
}

async function comandoBajar() {
  mkdirSync(CARPETA, { recursive: true })
  for (const t of TIENDAS) {
    const filas = await bajarTienda(t)
    writeFileSync(join(CARPETA, `${t.id}.json`), JSON.stringify(filas))
    console.log(`${t.id}: ${filas.length} productos`)
  }
}

async function comandoCruzar() {
  const progreso = JSON.parse(readFileSync(PROGRESO, 'utf8'))
  const guardar = () => writeFileSync(PROGRESO, JSON.stringify(progreso, null, 1))
  const catalogos = TIENDAS.filter(t => existsSync(join(CARPETA, `${t.id}.json`))).map(t => ({ id: t.id, filas: JSON.parse(readFileSync(join(CARPETA, `${t.id}.json`), 'utf8')).filter(f => f.imagen) }))
  if (!catalogos.length) throw new Error('Primero baja los catálogos: node tools/imagenes/catalogos-tiendas.mjs bajar')
  console.log('Catálogos:', catalogos.map(c => `${c.id} ${c.filas.length}`).join(' · '))
  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
  const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
  const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
  const porSku = new Map(internos.map(i => [i.sku, i]))
  const pendientes = []
  for (const p of cruzarStock(catalogo.productos, stock).filter(x => !x.imagen)) {
    if (progreso[p.sku]?.archivo) continue
    const i = porSku.get(p.tallas ? p.tallas.find(t => porSku.has(t.sku))?.sku : p.sku)
    if (i) pendientes.push({ sku: p.sku, nombreExcel: i.nombreExcel, marca: p.marca, categoria: p.categoria, codigo: i.codigo })
  }
  console.log(`Cruzando ${Math.min(MAX, pendientes.length)} productos sin foto...`)
  let ok = 0
  for (const item of pendientes.slice(0, MAX)) {
    const previo = progreso[item.sku] || {}
    const malas = new Set(previo.descartadas || [])
    const candidatos = []
    for (const c of catalogos) {
      for (const f of c.filas) {
        if (malas.has(f.imagen)) continue
        const porCodigo = esCodigoDeFabrica(item.codigo) && (`${f.sku} ${f.enlace} ${f.imagen}`).includes(item.codigo)
        const r = evaluarCoincidencia(item, f.nombre)
        if (!r.acepta && !porCodigo) continue
        candidatos.push({ ...f, tienda: c.id, confirmaCodigo: porCodigo, puntaje: (r.acepta ? r.puntaje : 0) + (porCodigo ? 2 : 0) })
      }
    }
    candidatos.sort((a, b) => b.puntaje - a.puntaje)
    let hecho = false
    for (const m of candidatos.slice(0, 4)) {
      try {
        const buf = await bajar(m.imagen)
        if (await imagenUsable(buf)) continue
        const archivo = `assets/productos/${item.sku}.webp`
        await optimizar(buf, join(RAIZ, archivo))
        progreso[item.sku] = { grupo: 'A', metodo: `catálogo de ${m.tienda}`, confirmaCodigo: m.confirmaCodigo, titulo: m.nombre, pagina: m.enlace, origen: m.imagen, archivo, descartadas: previo.descartadas, fecha: new Date().toISOString().slice(0, 10) }
        ok++
        hecho = true
        break
      } catch { /* siguiente candidato */ }
      await esperar(300)
    }
    if (!hecho) progreso[item.sku] = { ...previo, grupo: 'C', catalogosTiendas: true, fecha: new Date().toISOString().slice(0, 10) }
  }
  guardar()
  console.log(`Listo. Nuevas exactas: ${ok}.`)
}

const comando = process.argv[2]
if (process.argv[1] && process.argv[1].endsWith('catalogos-tiendas.mjs')) {
  ;(comando === 'bajar' ? comandoBajar() : comando === 'cruzar' ? comandoCruzar() : Promise.reject(new Error('Uso: bajar | cruzar')))
    .catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
}
