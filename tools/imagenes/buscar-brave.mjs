#!/usr/bin/env node
// ============================================================
// BUSCAR FOTOS CON BRAVE SEARCH (imágenes) para los productos que siguen sin foto (grupo C o sin intento).
// Mismo método y misma regla estricta que buscar-web.mjs (Bing): por código de barras, por nombre + marca y por
// código + nombre; solo acepta la foto si el título de la página calza (coincidencia.mjs). Con pausas largas;
// si el buscador deja de entregar resultados, el producto se salta sin anotarse y, si pasa muchas veces, se corta.
//
// Uso: node tools/imagenes/buscar-brave.mjs [--max 150] [--paralelo 2] [--pausa 3000]
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cruzarStock } from '../../js/stock.mjs'
import { buscarItem } from './buscar-web.mjs'
import { optimizar } from './procesar.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PROGRESO = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const MAX = Number(arg('--max', 150))
const PARALELO = Number(arg('--paralelo', 2))
const PAUSA = Number(arg('--pausa', 3000))
const esperar = ms => new Promise(r => setTimeout(r, ms))
const desescapar = t => t.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\n/g, ' ')

// Resultados de imágenes de Brave: están en el HTML de la página (title, página de origen e imagen original)
export async function buscarBrave(consulta) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://search.brave.com/images?q=${encodeURIComponent(consulta)}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CL,es;q=0.9' }, signal: AbortSignal.timeout(25000) })
      if (r.status === 429 || r.status >= 500) { await esperar(15000 * (i + 1)); continue }
      const t = await r.text()
      const out = []
      for (const m of t.matchAll(/title:"((?:[^"\\]|\\.)*)",url:"([^"]*)"[\s\S]{0,1800}?properties:\{url:"([^"]*)"/g)) out.push({ titulo: desescapar(m[1]), pagina: m[2], imagen: m[3] })
      if (out.length) return out
      if (i < 2) { await esperar(15000 * (i + 1)); continue }
      throw new Error('Brave no está entregando resultados (limitación temporal): pausar y retomar más tarde')
    } catch (e) {
      if (/Brave no está/.test(e.message)) throw e
      await esperar(3000 * (i + 1))
    }
  }
  return []
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
    if (e?.archivo || e?.brave) continue
    const i = porSku.get(p.tallas ? p.tallas.find(t => porSku.has(t.sku))?.sku : p.sku)
    if (!i) continue
    items.push({ sku: p.sku, nombre: p.nombre, nombreExcel: i.nombreExcel, marca: p.marca, categoria: p.categoria, codigo: i.codigo, granel: !!p.granel })
  }
  const pendientes = items.slice(0, MAX)
  console.log(`Brave Search para ${pendientes.length} productos (de ${items.length} sin foto)...`)
  let hechos = 0
  let ok = 0
  let sig = 0
  let bloqueos = 0
  const motor = async q => { const r = await buscarBrave(q); await esperar(PAUSA); return r }
  const trabajador = async () => {
    while (sig < pendientes.length) {
      const item = pendientes[sig++]
      let r
      try { r = await buscarItem(item, motor); bloqueos = 0 } catch (e) {
        console.error(`  (sin buscar ${item.sku}: ${e.message})`)
        if (++bloqueos >= 6) { guardar(); console.error('Demasiadas limitaciones seguidas: pausar y retomar más tarde'); process.exit(2) }
        continue
      }
      const hoy = new Date().toISOString().slice(0, 10)
      const previo = progreso[item.sku] || {}
      if (r) {
        const archivo = `assets/productos/${item.sku}.webp`
        try {
          await optimizar(r.buf, join(RAIZ, archivo))
          progreso[item.sku] = { grupo: 'A', metodo: `Brave Search (${r.via})`, confirmaCodigo: r.confirmaCodigo, titulo: r.titulo, pagina: r.pagina, origen: r.imagen, archivo, descartadas: previo.descartadas, fecha: hoy }
          ok++
        } catch { progreso[item.sku] = { ...previo, grupo: 'C', brave: true, fecha: hoy } }
      } else {
        progreso[item.sku] = { ...previo, grupo: 'C', brave: true, motivo: previo.motivo || 'sin coincidencia segura por código ni por nombre', fecha: hoy }
      }
      hechos++
      if (hechos % 10 === 0 || hechos === pendientes.length) { guardar(); console.log(`  ${hechos}/${pendientes.length} · nuevas exactas: ${ok}`) }
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabajador))
  guardar()
  console.log(`Listo. Nuevas exactas: ${ok} de ${pendientes.length}.`)
}

if (process.argv[1] && process.argv[1].endsWith('buscar-brave.mjs')) main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
