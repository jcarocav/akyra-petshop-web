#!/usr/bin/env node
// ============================================================
// FOTOS REFERENCIALES (grupo B) de accesorios y ropa sin marca visible, desde los buscadores públicos de tiendas chilenas.
//
// Para productos genéricos (platos, collares, camas, juguetes, ropa…) toma una foto de un producto del MISMO TIPO
// (misma palabra de tipo y misma especie: no mezcla perro con gato), con fondo blanco. Queda como "B?" (candidata)
// para revisarla a ojo: la revisión descarta las que muestran la marca de otro o no son del mismo tipo
// (tools/imagenes/rechazar.mjs) y buscar-referencial.mjs --confirmar pasa el resto a "B".
//
// Uso: node tools/imagenes/referencial-tiendas.mjs [--max 300] [--paralelo 3] [--pausa 500]
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { cruzarStock } from '../../js/stock.mjs'
import { fondoBlanco } from './buscar-referencial.mjs'
import { GENERICAS, TIENDAS, pedir, sinHtml } from './buscar-tiendas.mjs'
import { bajar } from './buscar-web.mjs'
import { normalizar } from './coincidencia.mjs'
import { optimizar } from './procesar.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PROGRESO = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const MAX = Number(arg('--max', 300))
const PARALELO = Number(arg('--paralelo', 3))
const PAUSA = Number(arg('--pausa', 500))
const esperar = ms => new Promise(r => setTimeout(r, ms))

// Palabras de marca o código que no describen el producto
const SOBRA = /\b(mondo|mascotas?|leon pet|leon|marben pets?|marben|wonder (cat|dog)|wonder|top-?k9|generico|mundo|buen amigo|brnx|pets?|petegou|baby dog|happy pets?|furminator|stay wild|toycat|mr dog|mr|clean cat|easy clean|turbo clean|para|de|del|con|y|el|la|los|las|x\d+|\d{3,})\b/g
const MARCAS_OTRAS = /\b(royal canin|kong|nerf|catit|furminator|petmate|trixie|ferplast|savic|stefanplast|nylabone|chuckit|petsafe|hartz|kodak)\b/
const TIPOS = ['collar', 'correa', 'arnes', 'plato', 'bebedero', 'comedero', 'fuente', 'cama', 'colchon', 'cojin', 'manta', 'juguete', 'pelota', 'hueso', 'cuerda', 'rascador', 'arenero', 'pala', 'transportador', 'mochila', 'bandana', 'chaleco', 'chaqueta', 'parka', 'poleron', 'body', 'cepillo', 'cortaunas', 'peine', 'tijera', 'mamadera', 'tunel', 'tirador', 'placa', 'lentes', 'sweater', 'polera', 'capa', 'impermeable', 'bozal', 'pechera', 'alfombra', 'comedor', 'jaula', 'casa']

function describir(p) {
  const n = normalizar(p.nombre.replace(/\([^)]*\)/g, ' '))
  const palabras = n.split(' ')
  const tipo = TIPOS.find(t => palabras.includes(t))
  const especie = /\bgat[oa]s?\b/.test(n) ? 'gato' : /\bperr[oa]s?\b/.test(n) ? 'perro' : /\b(hamster|conejo|cobayo|ave|pajaro)\b/.test(n) ? 'otro' : (p.categoria === 'ropa' ? 'perro' : '')
  const resto = n.replace(SOBRA, ' ').replace(GENERICAS, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 2 && w !== tipo)
  return { tipo: tipo || null, especie, extra: resto.slice(0, 2) }
}

async function candidata(p, usadas) {
  const d = describir(p)
  if (!d.tipo) return { motivo: 'no se reconoce el tipo de producto en el nombre' }
  const consulta = [d.tipo, d.especie && d.especie !== 'otro' ? d.especie : '', ...d.extra].filter(Boolean).join(' ')
  for (const t of TIENDAS) {
    const lista = await pedir(`${t.base}/wp-json/wc/store/v1/products?search=${encodeURIComponent(consulta)}&per_page=12`)
    await esperar(PAUSA)
    for (const x of lista) {
      const nombre = normalizar(sinHtml(x.name))
      const img = x.images?.[0]?.src
      if (!img || usadas.has(img)) continue
      if (!nombre.split(' ').includes(d.tipo) && !nombre.includes(d.tipo)) continue
      if (d.especie === 'gato' && /\bperr/.test(nombre)) continue
      if (d.especie === 'perro' && /\bgat/.test(nombre)) continue
      if (MARCAS_OTRAS.test(nombre)) continue
      try {
        usadas.add(img) // se reserva ya: otro producto en paralelo no puede tomar la misma foto
        const buf = await bajar(img)
        const m = await sharp(buf).metadata()
        const prop = m.width / m.height
        if (Math.max(m.width, m.height) < 350 || prop > 1.8 || prop < 0.55 || !(await fondoBlanco(buf))) { usadas.delete(img); continue }
        return { buf, titulo: sinHtml(x.name), pagina: x.permalink, imagen: img, tienda: t.id, consulta }
      } catch { usadas.delete(img) }
    }
  }
  return { motivo: `sin foto de referencia adecuada (se buscó "${consulta}" en 6 tiendas)` }
}

async function main() {
  const progreso = JSON.parse(readFileSync(PROGRESO, 'utf8'))
  const guardar = () => writeFileSync(PROGRESO, JSON.stringify(progreso, null, 1))
  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
  const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
  const pendientes = cruzarStock(catalogo.productos, stock)
    .filter(p => !p.imagen && ['accesorios', 'ropa'].includes(p.categoria) && !progreso[p.sku]?.archivo && !progreso[p.sku]?.referencialTiendas)
    .slice(0, MAX)
  console.log(`Fotos referenciales (tiendas) para ${pendientes.length} productos...`)
  const usadas = new Set(Object.values(progreso).map(e => e.origen).filter(Boolean))
  let hechos = 0
  let ok = 0
  let sig = 0
  const trabajador = async () => {
    while (sig < pendientes.length) {
      const p = pendientes[sig++]
      const r = await candidata(p, usadas)
      const hoy = new Date().toISOString().slice(0, 10)
      const previo = progreso[p.sku] || {}
      if (r.buf) {
        await optimizar(r.buf, join(RAIZ, `assets/productos/${p.sku}.webp`))
        progreso[p.sku] = { grupo: 'B?', metodo: `tipo de producto (tienda ${r.tienda})`, consulta: r.consulta, titulo: r.titulo, pagina: r.pagina, origen: r.imagen, archivo: `assets/productos/${p.sku}.webp`, descartadas: previo.descartadas, intentos: previo.intentos, fecha: hoy }
        ok++
      } else {
        progreso[p.sku] = { ...previo, grupo: 'C', referencialTiendas: true, motivo: previo.motivo || r.motivo, motivoReferencial: r.motivo, fecha: hoy }
      }
      hechos++
      if (hechos % 10 === 0 || hechos === pendientes.length) { guardar(); console.log(`  ${hechos}/${pendientes.length} · candidatas: ${ok}`) }
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabajador))
  guardar()
  console.log(`Listo. Candidatas referenciales: ${ok} de ${pendientes.length}.`)
}

if (process.argv[1] && process.argv[1].endsWith('referencial-tiendas.mjs')) main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
