#!/usr/bin/env node
// ============================================================
// FOTOS REFERENCIALES (grupo B) para accesorios y ropa que no tienen foto exacta.
//
// Para productos sin marca visible o genéricos (collares, platos, juguetes, camas, ropa…) busca en Bing una foto
// del MISMO TIPO de producto (con los datos que da el nombre: talla, capacidad, "doble", "eléctrico"…).
// Deja cada foto como grupo "B?" (candidata) para revisarla a ojo: la revisión descarta las que muestran la
// etiqueta de otra marca o no son del mismo tipo (tools/imagenes/rechazar.mjs) y --confirmar pasa el resto a "B".
//
// Uso: node tools/imagenes/buscar-referencial.mjs [--max 400]      (busca candidatas)
//      node tools/imagenes/buscar-referencial.mjs --confirmar      (B? → B)
// ============================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { cruzarStock } from '../../js/stock.mjs'
import { buscarBing } from './buscar-web.mjs'
import { normalizar } from './coincidencia.mjs'
import { optimizar } from './procesar.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PROGRESO = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const MAX = Number(arg('--max', 400))
const esperar = ms => new Promise(r => setTimeout(r, ms))
const DOMINIOS_MALOS = /(shutterstock|alamy|istockphoto|dreamstime|123rf|depositphotos|gettyimages|pinterest|facebook|fbcdn|instagram|tiktok|youtube|ytimg|wikimedia|reddit|aliexpress|alicdn|temu|ebay|animania|olx)/i

// Palabras de marca o de código que no describen el producto
const SOBRA = /\b(mondo|mascotas?|leon pet|leon|marben pets?|marben|wonder (cat|dog)|wonder|top-?k9|generico|mundo|buen amigo|brnx|pets?|para|de|del|con|y|el|la|x\d+|\d{4,})\b/g
const TIPOS = {
  'Collares, correas y arneses': 'collar correa arnes', 'Camas y descanso': 'cama', Transporte: 'transportador',
  'Peluquería y cuidado': 'cepillo peluqueria', 'Platos y fuentes': 'plato bebedero comedero', Juguetes: 'juguete', Rascadores: 'rascador',
  'Areneros e higiene': 'arenero', Bandanas: 'bandana', Chalecos: 'chaleco', 'Chaquetas y parkas': 'chaqueta', 'Bodys y otros': 'body ropa'
}

function consultaDe(p) {
  const nombre = normalizar(p.nombre.replace(/\([^)]*\)/g, ' ')).replace(SOBRA, ' ').replace(/\s+/g, ' ').trim()
  const especie = /\bgat[oa]s?\b/.test(normalizar(p.nombre)) ? 'gato' : /\bperr[oa]s?\b/.test(normalizar(p.nombre)) ? 'perro' : ''
  const base = nombre.split(' ').filter(w => w && w !== 'gato' && w !== 'perro').join(' ')
  const tipo = (TIPOS[p.subcategoria] || '').split(' ')[0]
  const q = [base || tipo, base && tipo && !base.includes(tipo) ? '' : '', especie ? `para ${especie}` : 'para mascotas'].filter(Boolean).join(' ')
  return { q: q.trim(), clave: (base.split(' ')[0] || tipo || 'x') }
}

async function bajar(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, signal: AbortSignal.timeout(10000) })
  if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) throw new Error('no es imagen')
  return Buffer.from(await r.arrayBuffer())
}

// Foto de catálogo: fondo blanco o casi blanco en los bordes (sin escenas, sin marca de agua de tienda en los bordes)
async function fondoBlanco(buf) {
  const { data, info } = await sharp(buf).flatten({ background: '#fff' }).resize(40, 40, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  let suma = 0
  let n = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (x > 2 && x < info.width - 3 && y > 2 && y < info.height - 3) continue
      const i = (y * info.width + x) * info.channels
      suma += Math.min(data[i], data[i + 1], data[i + 2])
      n++
    }
  }
  return suma / n >= 238
}

async function main() {
  const progreso = JSON.parse(readFileSync(PROGRESO, 'utf8'))
  const guardar = () => writeFileSync(PROGRESO, JSON.stringify(progreso, null, 1))
  if (process.argv.includes('--confirmar')) {
    let n = 0
    for (const e of Object.values(progreso)) if (e.grupo === 'B?') { e.grupo = 'B'; n++ }
    guardar()
    console.log(`${n} fotos referenciales confirmadas (grupo B).`)
    return
  }
  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
  const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
  const pendientes = cruzarStock(catalogo.productos, stock)
    .filter(p => p.visible && !p.imagen && ['accesorios', 'ropa'].includes(p.categoria) && (!progreso[p.sku] || progreso[p.sku].grupo === 'C'))
    .filter(p => !progreso[p.sku]?.buscadaReferencial)
    .slice(0, MAX)
  console.log(`Buscando fotos referenciales para ${pendientes.length} productos...`)
  const usadas = new Set(Object.values(progreso).map(e => e.origen).filter(Boolean))
  let hechos = 0
  let ok = 0
  let siguiente = 0
  const trabajador = async () => {
    while (siguiente < pendientes.length) {
      const p = pendientes[siguiente++]
      const { q, clave } = consultaDe(p)
      const previo = progreso[p.sku] || {}
      let elegido = null
      try {
        const candidatos = await buscarBing(q)
        await esperar(1200)
        for (const c of candidatos.slice(0, 20)) {
          if (usadas.has(c.imagen) || (previo.descartadas || []).includes(c.imagen) || DOMINIOS_MALOS.test(c.imagen) || DOMINIOS_MALOS.test(c.pagina || '')) continue
          if (!normalizar(c.titulo).includes(normalizar(clave).slice(0, 5))) continue
          try {
            usadas.add(c.imagen) // se reserva ya: otro producto en paralelo no puede tomar la misma foto
            const buf = await bajar(c.imagen)
            const m = await sharp(buf).metadata()
            const prop = m.width / m.height
            if (Math.max(m.width, m.height) < 350 || prop > 1.8 || prop < 0.55 || !(await fondoBlanco(buf))) { usadas.delete(c.imagen); continue }
            await optimizar(buf, join(RAIZ, `assets/productos/${p.sku}.webp`))
            elegido = c
            break
          } catch { usadas.delete(c.imagen) }
        }
      } catch (e) { console.error(e.message); guardar(); process.exit(2) }
      const hoy = new Date().toISOString().slice(0, 10)
      if (elegido) {
        progreso[p.sku] = { grupo: 'B?', metodo: 'tipo de producto', consulta: q, titulo: elegido.titulo, pagina: elegido.pagina, origen: elegido.imagen, archivo: `assets/productos/${p.sku}.webp`, descartadas: previo.descartadas, fecha: hoy }
        ok++
      } else {
        progreso[p.sku] = { ...previo, grupo: 'C', buscadaReferencial: true, motivo: previo.motivo || 'sin foto exacta ni referencial adecuada', fecha: hoy }
      }
      hechos++
      if (hechos % 10 === 0 || hechos === pendientes.length) { guardar(); console.log(`  ${hechos}/${pendientes.length} · candidatas: ${ok}`) }
    }
  }
  await Promise.all(Array.from({ length: 4 }, trabajador))
  guardar()
  console.log(`Listo. Candidatas referenciales: ${ok} de ${pendientes.length}.`)
}

if (process.argv[1] && process.argv[1].endsWith('buscar-referencial.mjs')) main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
