#!/usr/bin/env node
// ============================================================
// BUSCAR IMÁGENES — busca una foto EXACTA de cada producto publicado.
//
// Uso:  npm run imagenes:buscar            (solo los que aún no tienen resultado)
//       npm run imagenes:buscar -- --todo  (vuelve a buscar todos)
//
// Regla: solo se acepta una foto si calza con seguridad con el producto
// (mismo código de barras, o nombre con la misma marca, línea, sabor y
// tamaño). Si hay duda, el producto queda como "no encontrado".
//
// Lee .tmp/catalogo-interno.json (lo escribe npm run catalogo) y guarda
// los resultados en tools/imagenes/fuentes.json (sin códigos de barra:
// solo SKU → URL de origen). Luego: npm run imagenes:procesar.
// ============================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluarCoincidencia } from './coincidencia.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ARCHIVO_FUENTES = join(RAIZ, 'tools', 'imagenes', 'fuentes.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const PAUSA_MS = 350

const esperar = ms => new Promise(r => setTimeout(r, ms))

// Códigos que no son de fábrica: inventados en la planilla (999999...),
// de uso interno de la tienda (20000...) o etiquetas del importador (28937...).
export function esCodigoDeFabrica(codigo) {
  if (!/^\d{8,14}$/.test(codigo || '')) return false
  return !/^(999999|2000000|2893700|2293700|2090001)/.test(codigo)
}

async function pedirJson(url, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        signal: AbortSignal.timeout(25000)
      })
      if (r.status === 429 || r.status >= 500) { await esperar(3000 * (i + 1)); continue }
      if (!r.ok) return null
      return await r.json()
    } catch {
      await esperar(2000 * (i + 1))
    }
  }
  return null
}

// ---------- Fuentes ----------

// Punto Mascotas (PrestaShop): la búsqueda indexa el EAN y la URL del
// producto termina en el código de barras → confirmación exacta.
async function puntoMascotasPorCodigo(item) {
  if (!esCodigoDeFabrica(item.codigo)) return null
  const j = await pedirJson(`https://www.puntomascotas.cl/busqueda?controller=search&s=${item.codigo}&ajax=1`)
  const lista = j?.products || []
  for (const p of lista) {
    const url = p.url || ''
    if (!url.endsWith(`-${item.codigo}.html`)) continue
    const img = p.cover?.bySize?.large_default?.url || p.cover?.large?.url
    if (!img) continue
    return { fuente: 'puntomascotas.cl', metodo: 'código de barras', pagina: url, imagen: img, titulo: p.name }
  }
  return null
}

// Punto Mascotas por nombre (para productos sin código de fábrica o no indexados).
async function puntoMascotasPorNombre(item) {
  const consulta = item.consulta
  if (!consulta) return null
  const j = await pedirJson(`https://www.puntomascotas.cl/busqueda?controller=search&s=${encodeURIComponent(consulta)}&ajax=1`)
  const lista = (j?.products || []).slice(0, 12)
  let mejor = null
  for (const p of lista) {
    const img = p.cover?.bySize?.large_default?.url || p.cover?.large?.url
    if (!img) continue
    const r = evaluarCoincidencia(item, p.name)
    if (r.acepta && (!mejor || r.puntaje > mejor.puntaje)) {
      mejor = { puntaje: r.puntaje, fuente: 'puntomascotas.cl', metodo: 'nombre (marca, línea, sabor y tamaño)', pagina: p.url, imagen: img, titulo: p.name }
    }
  }
  if (mejor) delete mejor.puntaje
  return mejor
}

const FUENTES = [puntoMascotasPorCodigo, puntoMascotasPorNombre]

// Consulta corta para buscar por nombre: marca + palabras clave (sin la palabra
// genérica del tipo de producto ni códigos internos).
function armarConsulta(item) {
  const genericas = /^(alimento|sobre|lata|snack|caja|balde|pote|compota|galletas?|para|de|con|sabor|receta|y|el|la|los|las|a|granel)$/i
  const sinCodigos = item.nombreExcel.replace(/\([^)]*\)/g, ' ').replace(/[,]/g, ' ')
  const palabras = sinCodigos.split(/\s+/).filter(w => w && !genericas.test(w))
  return palabras.slice(0, 6).join(' ').toLowerCase()
}

async function main() {
  const interno = join(RAIZ, '.tmp', 'catalogo-interno.json')
  if (!existsSync(interno)) throw new Error('Primero corre: npm run catalogo')
  const { internos } = JSON.parse(readFileSync(interno, 'utf8'))
  const fuentes = existsSync(ARCHIVO_FUENTES) ? JSON.parse(readFileSync(ARCHIVO_FUENTES, 'utf8')) : {}
  const todo = process.argv.includes('--todo')
  const soloSku = process.argv.includes('--sku') ? process.argv[process.argv.indexOf('--sku') + 1] : null

  // Granel usa la foto de su saco; no se busca aparte.
  const pendientes = internos.filter(p => p.visible && p.categoria !== 'granel')
    .filter(p => !soloSku || p.sku === soloSku)
    .filter(p => todo || soloSku || !fuentes[p.sku])
  console.log(`Buscando fotos para ${pendientes.length} productos...`)

  let encontrados = 0
  for (const [i, p] of pendientes.entries()) {
    const item = { ...p, consulta: armarConsulta(p) }
    let resultado = null
    for (const fuente of FUENTES) {
      resultado = await fuente(item)
      await esperar(PAUSA_MS)
      if (resultado) break
    }
    fuentes[p.sku] = resultado ? { ...resultado, fecha: new Date().toISOString().slice(0, 10) } : { noEncontrada: true, fecha: new Date().toISOString().slice(0, 10) }
    if (resultado) encontrados++
    if ((i + 1) % 25 === 0 || i === pendientes.length - 1) {
      writeFileSync(ARCHIVO_FUENTES, JSON.stringify(fuentes, null, 1))
      console.log(`  ${i + 1}/${pendientes.length} · encontradas en esta corrida: ${encontrados}`)
    }
  }
  writeFileSync(ARCHIVO_FUENTES, JSON.stringify(fuentes, null, 1))
  console.log(`Listo. Encontradas: ${encontrados} de ${pendientes.length}.`)
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('buscar.mjs')) {
  main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
}
