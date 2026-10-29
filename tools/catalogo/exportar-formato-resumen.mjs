#!/usr/bin/env node
// ============================================================
// Exporta los productos del catálogo en el formato de 12 columnas (A–L) de la hoja "Resumen"/"ALDUNATE"
// del Excel de inventario, en 2 hojas:
//   - "Con imagen": productos visibles del catálogo que tienen foto.
//   - "Sin imagen": productos visibles del catálogo a los que todavía les falta la foto.
// Los datos de cada fila (nombre, código, precio, costo, unidades) salen de la hoja "Resumen" del Excel.
// El archivo lleva costos: queda FUERA del repositorio (carpeta de arriba) y no se publica.
// Uso: node tools/catalogo/exportar-formato-resumen.mjs [--excel ruta.xlsx] [--salida ruta.xlsx]
// ============================================================
import ExcelJS from 'exceljs'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cruzarStock } from '../../js/stock.mjs'
import { CATEGORIAS } from './reglas.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => (process.argv.includes(n) ? resolve(process.argv[process.argv.indexOf(n) + 1]) : d)
const EXCEL = arg('--excel', resolve(RAIZ, '..', 'Inventario_Mascoteria_Akyra_v53.xlsx'))
const SALIDA = arg('--salida', resolve(RAIZ, '..', 'productos-con-y-sin-imagen.xlsx'))
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

// 2) Catálogo actual: visible y con / sin foto
const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
const ordenCategoria = new Map(CATEGORIAS.map((c, i) => [c.id, i]))
const con = []
const sin = []
let sinFilaEnExcel = 0
for (const p of cruzarStock(catalogo.productos, stock).filter(x => x.visible)) {
  const skus = p.tallas ? p.tallas.filter(t => t.visible).map(t => t.sku) : [p.sku]
  for (const sku of skus) {
    const fila = porSku.get(sku)
    if (!fila) { sinFilaEnExcel++; continue }
    ;(p.imagen ? con : sin).push({ fila, orden: ordenCategoria.get(p.categoria) ?? 99 })
  }
}

// 3) Excel de salida, con el mismo encabezado que la hoja ALDUNATE
function hoja(nombre, titulo, filas) {
  const ws = libro2.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 3 }] })
  ws.addRow([titulo])
  ws.addRow([`${filas.length} productos. Formato de 12 columnas del Excel de inventario (hoja Resumen). Generado el ${new Date().toLocaleDateString('es-CL')}.`])
  const cab = ws.addRow(COLUMNAS)
  cab.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00796B' } }
  cab.alignment = { vertical: 'middle', wrapText: true }
  ws.getRow(1).font = { bold: true, size: 14 }
  ANCHOS.forEach((a, i) => { ws.getColumn(i + 1).width = a })
  filas.sort((a, b) => a.orden - b.orden || String(a.fila[2]).localeCompare(String(b.fila[2]), 'es')).forEach(f => ws.addRow(f.fila))
  ws.getColumn(4).numFmt = '0'
  ws.getColumn(5).numFmt = '$#,##0'
  ws.getColumn(12).numFmt = '$#,##0'
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 12 } }
}
const libro2 = new ExcelJS.Workbook()
hoja('Con imagen', 'Productos del catálogo CON imagen', con)
hoja('Sin imagen', 'Productos del catálogo SIN imagen (falta la foto)', sin)
await libro2.xlsx.writeFile(SALIDA)
console.log(`Con imagen: ${con.length} · Sin imagen: ${sin.length} · sin fila en la hoja Resumen: ${sinFilaEnExcel}\nArchivo: ${SALIDA}`)
