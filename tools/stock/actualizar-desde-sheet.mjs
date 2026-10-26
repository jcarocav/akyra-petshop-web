#!/usr/bin/env node
// ============================================================
// ACTUALIZAR STOCK DESDE LA PLANILLA "Akyra · Stock web"
// Lo corre el GitHub Action .github/workflows/stock.yml cada hora:
//   1. Descarga el CSV público de la hoja "Stock" (solo columnas públicas).
//   2. Lo valida: columnas correctas y al menos el 50 % de los productos conocidos.
//      Si no pasa, NO cambia nada (el sitio sigue con el último stock bueno).
//   3. Escribe stock.json; si hay productos nuevos o precios distintos, productos.json.
//
// Uso: STOCK_CSV_URL="https://script.google.com/macros/s/.../exec?token=..." node tools/stock/actualizar-desde-sheet.mjs
//      node tools/stock/actualizar-desde-sheet.mjs --archivo ruta.csv   (para probar)
// ============================================================
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { categoriaDesdeExcel, deducirEdad, deducirSubcategoria, formatoMarca, formatoTitulo, precioPublico, slug } from '../catalogo/reglas.mjs'
import { escribirCatalogo, escribirStock } from '../catalogo/escritura.mjs'
import { normalizarUnidades } from '../../js/stock.mjs'
import { lectorNumero, lectorParsearCsv } from './lector.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MINIMO = 0.5
const PREFIJOS = { PER: 'perros', GAT: 'gatos', OTR: 'otras-mascotas', GRA: 'granel', ACC: 'accesorios', SAL: 'salud-higiene' }

// El CSV lo escribe nuestro Apps Script (doGet) con números de JavaScript: "2.805" son 2,805 kg,
// no 2.805 unidades. Solo si alguien escribió a mano un número con coma se usa el lector chileno.
export function numeroCsv(valor) {
  const t = String(valor ?? '').trim()
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  return lectorNumero(t)
}

function skusDe(productos) {
  return productos.flatMap(p => (p.tallas ? p.tallas.map(t => t.sku) : [p.sku]))
}

// Función pura (la usan las pruebas)
export function aplicarCsv({ csvTexto, productos, stock, ahora = new Date() }) {
  const filas = lectorParsearCsv(csvTexto)
  if (!filas.length) return { ok: false, error: 'El CSV viene vacío.' }
  const encabezados = filas[0].map(h => String(h).trim().toLowerCase())
  const col = nombre => encabezados.indexOf(nombre)
  if (col('sku') < 0 || col('unidades') < 0) return { ok: false, error: `Columnas inesperadas: ${encabezados.join(', ')}` }
  const datos = filas.slice(1).filter(f => String(f[col('sku')] || '').trim())
  if (!datos.length) return { ok: false, error: 'El CSV no trae productos.' }

  const conocidos = new Set(skusDe(productos))
  const porSku = new Map(datos.map(f => [String(f[col('sku')]).trim().toUpperCase(), f]))
  const presentes = [...conocidos].filter(s => porSku.has(s.toUpperCase())).length
  const coincidencia = conocidos.size ? presentes / conocidos.size : 1
  if (coincidencia < MINIMO) {
    return { ok: false, error: `El CSV solo trae el ${Math.round(coincidencia * 100)}% de los productos conocidos (mínimo ${MINIMO * 100}%). No se actualizó nada.` }
  }

  const valor = (f, nombre) => (col(nombre) >= 0 ? f[col(nombre)] : '')
  // ---- Stock: lo que no viene en el CSV conserva su valor anterior
  const unidades = { ...stock?.unidades }
  const errores = []
  for (const [sku, f] of porSku) {
    const crudo = String(valor(f, 'unidades') ?? '').trim()
    if (crudo === '') { unidades[sku] = null; continue }
    const n = numeroCsv(crudo)
    if (n === null) { errores.push(`${sku}: unidades "${crudo}" no es un número`); continue }
    unidades[sku] = normalizarUnidades(n)
  }

  // ---- Precios y productos nuevos
  let cambiosCatalogo = 0
  const nuevosProductos = []
  const lista = productos.map(p => ({ ...p, tallas: p.tallas ? p.tallas.map(t => ({ ...t })) : undefined }))
  for (const p of lista) {
    if (!p.tallas) delete p.tallas
    const variantes = p.tallas || [p]
    for (const v of variantes) {
      const f = porSku.get(v.sku.toUpperCase())
      if (!f) continue
      const precio = precioPublico(numeroCsv(valor(f, 'precio')))
      if (precio !== null && precio !== v.precio) { v.precio = precio; cambiosCatalogo++ }
    }
  }
  for (const [sku, f] of porSku) {
    if (conocidos.has(sku)) continue
    const nombre = String(valor(f, 'nombre') || '').trim()
    if (!nombre) { errores.push(`${sku}: producto nuevo sin nombre (se omite)`); continue }
    const categoria = categoriaDesdeExcel(valor(f, 'categoria')) || PREFIJOS[sku.split('-')[0]] || 'accesorios'
    const p = {
      id: slug(sku), sku, nombre: categoria === 'granel' ? formatoTitulo(nombre) : formatoTitulo(nombre),
      marca: formatoMarca(valor(f, 'marca')), categoria, subcategoria: deducirSubcategoria(categoria, nombre),
      precio: precioPublico(numeroCsv(valor(f, 'precio'))), nuevo: true
    }
    const edad = deducirEdad(categoria, nombre)
    if (edad) p.edad = edad
    if (categoria === 'granel') p.granel = true
    lista.push(p)
    nuevosProductos.push(sku)
    cambiosCatalogo++
  }

  // Fecha del último reporte aplicado; si todavía no llega ninguno, la fecha más nueva de las filas.
  // Así, si nada cambió, stock.json queda idéntico y el Action no hace commit.
  const fechasDe = nombre => datos.map(f => String(valor(f, nombre) || '')).filter(Boolean).sort()
  const fechas = fechasDe('reporte').length ? fechasDe('reporte') : fechasDe('actualizado')
  const actualizado = fechas.length ? new Date(fechas[fechas.length - 1]) : ahora
  return {
    ok: true, error: null, coincidencia, errores, nuevos: nuevosProductos, cambiosCatalogo,
    productos: lista, stock: { actualizado: Number.isNaN(actualizado.getTime()) ? ahora.toISOString() : actualizado.toISOString(), unidades }
  }
}

async function main() {
  const i = process.argv.indexOf('--archivo')
  let csvTexto
  if (i >= 0) csvTexto = readFileSync(process.argv[i + 1], 'utf8')
  else {
    const url = process.env.STOCK_CSV_URL
    if (!url) {
      console.log('STOCK_CSV_URL no está configurado todavía: no se hace nada.')
      return
    }
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60000) })
    if (!r.ok) throw new Error(`No se pudo descargar el CSV (HTTP ${r.status}). El sitio queda con el último stock bueno.`)
    csvTexto = await r.text()
  }
  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
  const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
  const r = aplicarCsv({ csvTexto, productos: catalogo.productos, stock })
  if (!r.ok) throw new Error(r.error)
  const antes = JSON.stringify(stock.unidades)
  if (JSON.stringify(r.stock.unidades) !== antes) escribirStock(r.stock.unidades, new Date(r.stock.actualizado))
  if (r.cambiosCatalogo) escribirCatalogo(r.productos, { fuente: `${catalogo.fuente} + planilla Akyra · Stock web` })
  console.log(`Coincidencia: ${Math.round(r.coincidencia * 100)}% · productos nuevos: ${r.nuevos.length} · cambios de catálogo: ${r.cambiosCatalogo}`)
  for (const e of r.errores) console.log('  aviso: ' + e)
}

if (process.argv[1] && process.argv[1].endsWith('actualizar-desde-sheet.mjs')) {
  main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
}
