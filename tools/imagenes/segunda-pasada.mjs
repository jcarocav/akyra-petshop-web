#!/usr/bin/env node
// ============================================================
// SEGUNDA PASADA — para los productos que quedaron "sin foto" (grupo C) prueba búsquedas distintas:
//   1. el código de barras restringido a las tiendas chilenas de mascotas más conocidas (site:),
//   2. la marca + las palabras clave del nombre + "Chile",
//   3. el nombre limpio (sin códigos internos entre paréntesis ni palabras genéricas) restringido a esas tiendas.
// Mantiene la misma regla estricta para foto exacta (coincidencia.mjs): ante la duda, no acepta.
// Guarda en tools/catalogo/fotos-progreso.json los intentos hechos (para el reporte de "no encontradas").
//
// Uso: node tools/imagenes/segunda-pasada.mjs [--max 200] [--paralelo 3] [--pausa 1500]
// ============================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cruzarStock } from '../../js/stock.mjs'
import { DOMINIOS_MALOS, bajar, buscarBing, imagenUsable } from './buscar-web.mjs'
import { esCodigoDeFabrica } from './buscar.mjs'
import { evaluarCoincidencia } from './coincidencia.mjs'
import { optimizar } from './procesar.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PROGRESO = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const MAX = Number(arg('--max', 200))
const PARALELO = Number(arg('--paralelo', 3))
const PAUSA = Number(arg('--pausa', 1500))
const esperar = ms => new Promise(r => setTimeout(r, ms))
const TIENDAS = ['petcity.cl', 'tusmascotas.cl', 'bodegadelamascota.cl', 'puntomascotas.cl', 'superzoo.cl', 'petco.cl', 'mascotasonline.cl', 'zooplus.cl', 'miau.cl', 'falabella.com', 'paris.cl', 'jumbo.cl', 'lider.cl', 'mercadolibre.cl', 'distribuidoralira.cl', 'petpalace.cl', 'petonline.cl']
const SITES = TIENDAS.map(t => `site:${t}`).join(' OR ')
const GENERICAS = /\b(alimento|sobre|lata|snack|caja|balde|pote|para|de|del|con|sabor|receta|y|el|la|los|las|a|granel)\b/gi

function consultas(item) {
  const limpio = item.nombreExcel.replace(/\([^)]*\)/g, ' ').replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  const clave = limpio.replace(GENERICAS, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 7).join(' ')
  const lista = []
  if (esCodigoDeFabrica(item.codigo)) lista.push({ q: `"${item.codigo}" (${SITES})`, via: 'código en tiendas chilenas' })
  lista.push({ q: `${item.marca && item.marca !== 'Genérico' ? item.marca + ' ' : ''}${clave} Chile`, via: 'marca + palabras clave' })
  lista.push({ q: `${limpio} (${SITES})`.slice(0, 250), via: 'nombre en tiendas chilenas' })
  return lista
}

async function intentar(item) {
  const vistos = new Set()
  const hechas = []
  for (const { q, via } of consultas(item)) {
    hechas.push(`${via}: ${q}`.slice(0, 160))
    const candidatos = await buscarBing(q)
    await esperar(PAUSA)
    for (const c of candidatos.slice(0, 20)) {
      if (vistos.has(c.imagen) || DOMINIOS_MALOS.test(c.imagen) || DOMINIOS_MALOS.test(c.pagina || '')) continue
      vistos.add(c.imagen)
      const porCodigo = esCodigoDeFabrica(item.codigo) && (`${c.titulo} ${c.pagina}`).includes(item.codigo)
      const r = evaluarCoincidencia(item, c.titulo)
      if (!r.acepta && !(porCodigo && !/marca/.test(r.motivo))) continue
      try {
        const buf = await bajar(c.imagen)
        if (await imagenUsable(buf)) continue
        return { ...c, via, consulta: q, buf, confirmaCodigo: porCodigo, hechas }
      } catch { /* siguiente */ }
    }
  }
  return { hechas }
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
    if (!e || e.grupo !== 'C' || e.segundaPasada) continue
    const i = porSku.get(p.tallas ? p.tallas.find(t => porSku.has(t.sku))?.sku : p.sku)
    if (!i) continue
    items.push({ sku: p.sku, nombre: p.nombre, nombreExcel: i.nombreExcel, marca: p.marca, categoria: p.categoria, codigo: i.codigo, granel: !!p.granel })
  }
  const pendientes = items.slice(0, MAX)
  console.log(`Segunda pasada para ${pendientes.length} productos (de ${items.length} sin foto)...`)
  let hechos = 0
  let ok = 0
  let sig = 0
  let bloqueos = 0
  const trabajador = async () => {
    while (sig < pendientes.length) {
      const item = pendientes[sig++]
      let r
      try { r = await intentar(item); bloqueos = 0 } catch (e) {
        console.error(`  (sin buscar ${item.sku}: ${e.message})`)
        if (++bloqueos >= 8) { guardar(); console.error('Demasiados bloqueos seguidos: pausar y retomar más tarde'); process.exit(2) }
        continue
      }
      const hoy = new Date().toISOString().slice(0, 10)
      const previo = progreso[item.sku]
      if (r.buf) {
        const archivo = `assets/productos/${item.sku}.webp`
        try {
          await optimizar(r.buf, join(RAIZ, archivo))
          progreso[item.sku] = { grupo: 'A', metodo: r.via, confirmaCodigo: r.confirmaCodigo, titulo: r.titulo, pagina: r.pagina, origen: r.imagen, archivo, descartadas: previo.descartadas, fecha: hoy, segundaPasada: true }
          ok++
        } catch (e) { progreso[item.sku] = { ...previo, segundaPasada: true, intentos: r.hechas, fecha: hoy } }
      } else {
        progreso[item.sku] = { ...previo, segundaPasada: true, intentos: r.hechas, motivo: 'sin coincidencia segura ni por código ni por nombre (Bing, tiendas chilenas y búsqueda ampliada)', fecha: hoy }
      }
      hechos++
      if (hechos % 10 === 0 || hechos === pendientes.length) { guardar(); console.log(`  ${hechos}/${pendientes.length} · nuevas exactas: ${ok}`) }
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabajador))
  guardar()
  console.log(`Listo. Nuevas exactas: ${ok} de ${pendientes.length}.`)
}

if (process.argv[1] && process.argv[1].endsWith('segunda-pasada.mjs')) main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
