#!/usr/bin/env node
// ============================================================
// Exporta TODOS los productos del catálogo (también los ocultos por stock 0) en el formato de 12 columnas (A–L) de la hoja "Resumen"/"ALDUNATE"
// del Excel de inventario, en 4 hojas: "Con imagen" (foto exacta), "Imagen referencial", "Sin imagen"
// (por sucursal/bodega y categoría) y "Detalle fuentes" (URL de origen y motivo de cada una).
// Los datos de cada fila (nombre, código, precio, costo, unidades) salen de la hoja "Resumen" del Excel.
// El archivo lleva costos: queda FUERA del repositorio (carpeta de arriba) y no se publica.
// Uso: node tools/catalogo/exportar-formato-resumen.mjs [--excel ruta.xlsx] [--salida ruta.xlsx]
// ============================================================
import ExcelJS from 'exceljs'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cruzarStock } from '../../js/stock.mjs'
import { CATEGORIAS } from './reglas.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => (process.argv.includes(n) ? resolve(process.argv[process.argv.indexOf(n) + 1]) : d)
const EXCEL = arg('--excel', resolve(RAIZ, '..', 'Inventario_Mascoteria_Akyra_v53.xlsx'))
const SALIDA = arg('--salida', resolve(RAIZ, '..', 'productos-con-y-sin-imagen.xlsx'))
const PROGRESO = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
const FUENTES = join(RAIZ, 'tools', 'imagenes', 'fuentes.json')
const COLUMNAS = ['SKU', 'VARIANTE DE', 'NOMBRE', 'CODIGO BARRAS', 'PRECIO VENTA BRUTO', 'FABRICANTE', 'CATEGORIA', 'ALERTA STOCK', 'PROVEEDOR', 'BODEGA', 'UNIDADES', 'COSTO COMPRA NETO']
const ANCHOS = [16, 14, 52, 17, 14, 18, 18, 12, 14, 18, 11, 14]

// 1) Hoja "Resumen" del Excel → fila (A–L) por SKU
const libro = new ExcelJS.Workbook()
await libro.xlsx.readFile(EXCEL)
const resumen = libro.getWorksheet('Resumen')
if (!resumen) throw new Error('El Excel no tiene la hoja "Resumen".')
const valor = c => (c && typeof c === 'object' && 'result' in c ? c.result : c?.text ?? c) ?? ''
let filaTitulos = 0
resumen.eachRow((fila, n) => { if (!filaTitulos && String(valor(fila.getCell(1).value)) === 'SKU') filaTitulos = n })
const porSku = new Map()
resumen.eachRow((fila, n) => {
  if (n <= filaTitulos) return
  const sku = String(valor(fila.getCell(1).value)).trim()
  if (sku) porSku.set(sku, COLUMNAS.map((_, i) => valor(fila.getCell(i + 1).value)))
})

// 1b) Los productos que solo están en "Base Rosa" (sin conteo, stock 0) no tienen fila en "Resumen":
//     se arma su fila con los datos de Base Rosa (código, nombre, precio, fabricante, categoría, proveedor, costo)
const base = libro.getWorksheet('Base Rosa (1004)')
const filaBase = new Map()
if (base) {
  base.eachRow((fila, n) => {
    if (n < 5) return
    const c = valor(fila.getCell(1).value)
    if (c === '' || c === null) return
    const codigo = typeof c === 'number' ? BigInt(Math.round(c)).toString() : String(c).trim()
    filaBase.set(codigo, { nombre: valor(fila.getCell(2).value), costo: valor(fila.getCell(3).value), precio: valor(fila.getCell(4).value), fab: valor(fila.getCell(6).value), cat: valor(fila.getCell(7).value), prov: valor(fila.getCell(8).value) })
  })
}

// 2) Catálogo actual (visibles y también los ocultos por stock 0): con foto exacta / referencial / sin foto
const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
const lugaresDe = new Map(internos.map(i => [i.sku, i.lugares || []]))
const codigoDe = new Map(internos.map(i => [i.sku, i.codigo]))
const progreso = existsSync(PROGRESO) ? JSON.parse(readFileSync(PROGRESO, 'utf8')) : {}
const fuentesViejas = existsSync(FUENTES) ? JSON.parse(readFileSync(FUENTES, 'utf8')) : {}
const LUGARES = ['ALDUNATE', 'HORNILLAS', 'LAS LENGAS', 'BODEGA CENTRAL', 'BODEGA HORNILLAS']
const ordenCategoria = new Map(CATEGORIAS.map((c, i) => [c.id, i]))
const hojas = { exacta: [], referencial: [], sin: [] }
const detalle = []
const noEncontradas = []
let sinFilaEnExcel = 0
for (const p of cruzarStock(catalogo.productos, stock)) {
  const skus = p.tallas ? p.tallas.map(t => t.sku) : [p.sku]
  const grupo = !p.imagen ? 'sin' : p.imagenTipo === 'referencial' ? 'referencial' : 'exacta'
  const origen = progreso[p.sku] || {}
  const vieja = fuentesViejas[p.sku] || {}
  const lugares = [...new Set(skus.flatMap(s => lugaresDe.get(s) || []))]
  const lugar = Math.min(...lugares.map(l => LUGARES.indexOf(l)).filter(i => i >= 0), 99)
  for (const sku of skus) {
    let fila = porSku.get(sku)
    if (!fila) {
      const b = filaBase.get(codigoDe.get(sku))
      if (!b) { sinFilaEnExcel++; continue }
      fila = [sku, '', b.nombre, codigoDe.get(sku), b.precio, b.fab, b.cat, '', b.prov || '---', 'BODEGA CENTRAL', 0, b.costo]
    }
    hojas[grupo].push({ fila, orden: ordenCategoria.get(p.categoria) ?? 99, lugar })
    if (grupo === 'sin') {
      const viejaBusqueda = vieja.noEncontrada ? 'Punto Mascotas y Tus Mascotas (primera ronda del catálogo, por código y por nombre)' : ''
      const bing = origen.grupo === 'C' && !origen.tiendas && origen.motivo && !origen.referencialTiendas ? 'Bing Imágenes (código de barras, nombre + marca, código + nombre)' : ''
      const tiendas = origen.tiendas || origen.referencialTiendas || (origen.intentos || []).length ? '6 tiendas chilenas (tusmascotas, distribuidoralira, petpalace, petshopmg, mascoteriagonzalito, petcity)' : ''
      const metodos = [viejaBusqueda, bing, tiendas].filter(Boolean).join(' · ') || 'sin búsqueda registrada'
      noEncontradas.push([sku, fila[2], codigoDe.get(sku) || fila[3], fila[5], fila[6], p.visible ? 'Visible en el sitio' : 'Oculto por stock 0', origen.motivoReferencial || origen.motivo || 'sin coincidencia segura', metodos, (origen.descartadas || []).length ? `${origen.descartadas.length} foto(s) descartada(s) en la revisión` : '', origen.fecha || ''])
    }
    detalle.push([sku, fila[2], { exacta: 'exacta', referencial: 'referencial', sin: 'sin imagen' }[grupo],
      grupo === 'sin' ? '' : (origen.origen || vieja.imagen || ''),
      grupo === 'sin' ? (origen.motivo || 'todavía sin buscar') : (grupo === 'referencial' ? (origen.motivo || 'foto de referencia (producto igual en forma y uso)') : (origen.metodo ? `encontrada por ${origen.metodo}` : (vieja.metodo ? `encontrada por ${vieja.metodo}` : ''))),
      grupo === 'sin' ? '' : (origen.pagina || vieja.pagina || '')])
  }
}

// 3) Excel de salida, con el mismo encabezado que la hoja ALDUNATE
function encabezado(ws, titulo, nota, columnas, anchos) {
  ws.addRow([titulo])
  ws.addRow([nota])
  const cab = ws.addRow(columnas)
  cab.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00796B' } }
  cab.alignment = { vertical: 'middle', wrapText: true }
  ws.getRow(1).font = { bold: true, size: 14 }
  anchos.forEach((a, i) => { ws.getColumn(i + 1).width = a })
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columnas.length } }
}
function hoja(nombre, titulo, filas, { porLugar = false } = {}) {
  const ws = libro2.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 3 }] })
  encabezado(ws, titulo, `${filas.length} productos. Formato de 12 columnas del Excel de inventario (hoja Resumen). Generado el ${new Date().toLocaleDateString('es-CL')}.`, COLUMNAS, ANCHOS)
  filas.sort((a, b) => (porLugar ? a.lugar - b.lugar : 0) || a.orden - b.orden || String(a.fila[2]).localeCompare(String(b.fila[2]), 'es')).forEach(f => ws.addRow(f.fila))
  ws.getColumn(4).numFmt = '0'
  ws.getColumn(5).numFmt = '$#,##0'
  ws.getColumn(12).numFmt = '$#,##0'
}
const libro2 = new ExcelJS.Workbook()
hoja('Con imagen', 'Productos del catálogo con foto EXACTA', hojas.exacta)
hoja('Imagen referencial', 'Productos con foto REFERENCIAL (conviene sacarles una foto real)', hojas.referencial)
hoja('Sin imagen', 'Productos SIN imagen (para salir a sacar fotos): ordenados por sucursal/bodega y categoría', hojas.sin, { porLugar: true })
const wd = libro2.addWorksheet('Detalle fuentes', { views: [{ state: 'frozen', ySplit: 3 }] })
encabezado(wd, 'De dónde salió cada foto', `${detalle.length} filas. Grupo: exacta / referencial / sin imagen (con el motivo).`, ['SKU', 'NOMBRE', 'GRUPO', 'URL DE ORIGEN DE LA FOTO', 'MOTIVO / MÉTODO', 'PÁGINA DE ORIGEN'], [16, 52, 14, 70, 48, 60])
detalle.sort((a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0])).forEach(f => wd.addRow(f))
const wn = libro2.addWorksheet('Reporte no encontradas', { views: [{ state: 'frozen', ySplit: 3 }] })
encabezado(wn, 'Productos cuya foto NO se encontró', `${noEncontradas.length} productos. Para cada uno se buscó por código de barras y por nombre; abajo, dónde y qué pasó. Para salir a sacar la foto, la hoja "Sin imagen" los trae ordenados por sucursal/bodega.`,
  ['SKU', 'NOMBRE', 'CODIGO BARRAS', 'FABRICANTE', 'CATEGORIA', 'ESTADO EN EL SITIO', 'MOTIVO', 'DÓNDE SE BUSCÓ', 'FOTOS DESCARTADAS', 'ÚLTIMA BÚSQUEDA'], [16, 52, 17, 18, 18, 22, 52, 70, 30, 14])
noEncontradas.sort((a, b) => a[4].localeCompare(b[4], 'es') || a[1].localeCompare(b[1], 'es')).forEach(f => wn.addRow(f))
wn.getColumn(3).numFmt = '0'
await libro2.xlsx.writeFile(SALIDA)
console.log(`Exactas: ${hojas.exacta.length} · Referenciales: ${hojas.referencial.length} · Sin imagen: ${hojas.sin.length} · sin fila en Resumen ni Base Rosa: ${sinFilaEnExcel}
Archivo: ${SALIDA}`)
