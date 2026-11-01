#!/usr/bin/env node
// ============================================================
// FOTOS REFERENCIALES desde los catálogos públicos ya descargados de las tiendas (.tmp/catalogos/, ver catalogos-tiendas.mjs).
// Para accesorios y ropa sin foto: busca un producto del MISMO TIPO y especie (sin marca de otro en el título),
// con fondo blanco, y lo deja como candidata "B?" para revisarla a ojo (igual que referencial-tiendas.mjs).
//
// Uso: node tools/imagenes/referencial-catalogos.mjs [--max 400]
// ============================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { cruzarStock } from '../../js/stock.mjs'
import { fondoBlanco } from './buscar-referencial.mjs'
import { bajar } from './buscar-web.mjs'
import { normalizar } from './coincidencia.mjs'
import { optimizar } from './procesar.mjs'
import { MARCAS_OTRAS, describir } from './referencial-tiendas.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CARPETA = join(RAIZ, '.tmp', 'catalogos')
const PROGRESO = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const MAX = Number(arg('--max', 400))
const TIENDAS = ['tusmascotas.cl', 'distribuidoralira.cl', 'petpalace.cl', 'petshopmg.cl', 'mascoteriagonzalito.cl', 'petcity.cl', 'marbenpets.cl', 'topk9.cl', 'bpets.cl']
// Títulos que delatan otra marca o un producto de comida/medicina (no un accesorio genérico)
const NO_GENERICO = /\b(royal canin|kong|nerf|catit|furminator|petmate|trixie|ferplast|savic|stefanplast|nylabone|chuckit|petsafe|hartz|kodak|beaphar|seresto|bayticol|bravecto|nexgard|frontline|pro plan|stay wild|street dogs|toycat)\b/

async function main() {
  const filas = TIENDAS.filter(t => existsSync(join(CARPETA, `${t}.json`))).flatMap(t => JSON.parse(readFileSync(join(CARPETA, `${t}.json`), 'utf8')).filter(f => f.imagen).map(f => ({ ...f, tienda: t, n: normalizar(f.nombre) })))
  const progreso = JSON.parse(readFileSync(PROGRESO, 'utf8'))
  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
  const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
  const usadas = new Set(Object.values(progreso).map(e => e.origen).filter(Boolean))
  const pendientes = cruzarStock(catalogo.productos, stock).filter(p => !p.imagen && ['accesorios', 'ropa'].includes(p.categoria) && !progreso[p.sku]?.archivo && !progreso[p.sku]?.referencialCatalogos).slice(0, MAX)
  console.log(`Referenciales desde catálogos para ${pendientes.length} productos (${filas.length} productos de tiendas)...`)
  let ok = 0
  for (const p of pendientes) {
    const d = describir(p)
    const previo = progreso[p.sku] || {}
    const hoy = new Date().toISOString().slice(0, 10)
    let elegido = null
    if (d.tipo) {
      const malas = new Set(previo.descartadas || [])
      const cand = filas.filter(f => {
        const pal = f.n.split(' ')
        if (!pal.includes(d.tipo)) return false
        if (usadas.has(f.imagen) || malas.has(f.imagen)) return false
        if (d.especie === 'gato' && /\bperr/.test(f.n)) return false
        if (d.especie === 'perro' && /\bgat/.test(f.n)) return false
        if (MARCAS_OTRAS.test(f.n) || NO_GENERICO.test(f.n)) return false
        return d.extra.every(w => f.n.includes(w)) || !d.extra.length
      })
      // primero los que más palabras en común tienen con nuestro nombre
      const nuestro = new Set(normalizar(p.nombre).split(' '))
      cand.sort((a, b) => b.n.split(' ').filter(w => nuestro.has(w)).length - a.n.split(' ').filter(w => nuestro.has(w)).length)
      for (const f of cand.slice(0, 8)) {
        try {
          usadas.add(f.imagen)
          const buf = await bajar(f.imagen)
          const m = await sharp(buf).metadata()
          const prop = m.width / m.height
          if (Math.max(m.width, m.height) < 350 || prop > 1.8 || prop < 0.55 || !(await fondoBlanco(buf))) { usadas.delete(f.imagen); continue }
          await optimizar(buf, join(RAIZ, `assets/productos/${p.sku}.webp`))
          elegido = f
          break
        } catch { usadas.delete(f.imagen) }
      }
    }
    if (elegido) {
      progreso[p.sku] = { grupo: 'B?', metodo: `tipo de producto (catálogo de ${elegido.tienda})`, titulo: elegido.nombre, pagina: elegido.enlace, origen: elegido.imagen, archivo: `assets/productos/${p.sku}.webp`, descartadas: previo.descartadas, intentos: previo.intentos, fecha: hoy }
      ok++
    } else {
      progreso[p.sku] = { ...previo, grupo: 'C', referencialCatalogos: true, motivoReferencial: d.tipo ? 'sin foto de referencia adecuada en los catálogos de las 9 tiendas' : 'no se reconoce el tipo de producto en el nombre', fecha: hoy }
    }
  }
  writeFileSync(PROGRESO, JSON.stringify(progreso, null, 1))
  console.log(`Listo. Candidatas referenciales: ${ok} de ${pendientes.length}.`)
}

if (process.argv[1] && process.argv[1].endsWith('referencial-catalogos.mjs')) main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
