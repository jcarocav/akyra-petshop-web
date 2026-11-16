#!/usr/bin/env node
// ============================================================
// Excel de conteos del catálogo: qué se ve hoy, cuántas cards hay, cuáles tienen foto (exacta o referencial) y cuáles faltan.
// Solo datos públicos (sin costos ni unidades por sucursal). Cada hoja trae en B1 el total de filas.
// Uso: node tools/catalogo/exportar-conteos.mjs [--salida ruta.xlsx]
// ============================================================
import ExcelJS from 'exceljs'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cruzarStock } from '../../js/stock.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const i = process.argv.indexOf('--salida')
const SALIDA = i > 0 ? resolve(process.argv[i + 1]) : resolve(RAIZ, '..', 'conteo-productos-akyra.xlsx')
const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
const cards = cruzarStock(catalogo.productos, stock)

const tipoFoto = p => (!p.imagen ? 'Sin foto' : p.imagenTipo === 'referencial' ? 'Imagen referencial' : 'Foto exacta')
const fila = p => [p.sku, p.nombre, p.marca, p.categoria, p.precio > 1 ? p.precio : 'Consultar', p.visible ? 'Visible' : 'Oculta (stock 0)', tipoFoto(p)]
const COLS = ['SKU', 'NOMBRE', 'MARCA', 'CATEGORÍA', 'PRECIO', 'EN EL SITIO', 'FOTO']
const ANCHOS = [16, 60, 20, 16, 12, 18, 20]

const conStock = cards.filter(p => p.visible)
const conFoto = conStock.filter(p => p.imagen)
const referenciales = cards.filter(p => p.imagen && p.imagenTipo === 'referencial')
const pendientes = cards.filter(p => !p.imagen)
const skus = cards.flatMap(p => (p.tallas?.length ? p.tallas.map(t => ({ ...p, sku: t.sku, nombre: `${p.nombre} (talla ${t.talla})` })) : [p]))

const libro = new ExcelJS.Workbook()
const borde = { style: 'thin', color: { argb: 'FFCCCCCC' } }
function hoja(nombre, titulo, lista) {
  const h = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 3 }] })
  h.getCell('A1').value = titulo
  h.getCell('A1').font = { bold: true, size: 12 }
  h.getCell('B1').value = lista.length
  h.getCell('B1').font = { bold: true, size: 14, color: { argb: 'FF00796B' } }
  h.getCell('B1').alignment = { horizontal: 'left' }
  h.addRow([])
  const cab = h.addRow(COLS)
  cab.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A99D' } } })
  for (const p of lista) h.addRow(fila(p)).eachCell(c => { c.border = { bottom: borde } })
  ANCHOS.forEach((a, k) => { h.getColumn(k + 1).width = a })
  h.autoFilter = { from: 'A3', to: `G${3 + lista.length}` }
  return h
}

const r = libro.addWorksheet('Resumen')
r.addRow(['Concepto', 'Cantidad', 'Hoja']).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A99D' } } })
const filas = [
  ['Productos actuales con stock (visibles en el sitio)', conStock.length, 'Con stock'],
  ['Cards totales (visibles + ocultas por stock 0)', cards.length, 'Cards totales'],
  ['Productos actuales con foto', conFoto.length, 'Actuales con foto'],
  ['Cards con imagen referencial (visibles y ocultas)', referenciales.length, 'Referenciales'],
  ['Cards pendientes de foto (visibles y ocultas)', pendientes.length, 'Pendientes de foto'],
  ['Total de productos registrados (cada talla cuenta)', skus.length, 'Total registrados']
]
filas.forEach(f => r.addRow(f))
r.addRow([])
r.addRow(['Nota: una card agrupa las tallas de un mismo producto; por eso hay más productos registrados (SKU) que cards.'])
r.getColumn(1).width = 58; r.getColumn(2).width = 12; r.getColumn(3).width = 22

hoja('Con stock', 'Productos actuales con stock (visibles):', conStock)
hoja('Cards totales', 'Cards totales en el sitio:', cards)
hoja('Actuales con foto', 'Productos actuales (con stock) con foto:', conFoto)
hoja('Referenciales', 'Cards con imagen referencial:', referenciales)
hoja('Pendientes de foto', 'Cards pendientes de sacar foto:', pendientes)
hoja('Total registrados', 'Total de productos registrados (un SKU por fila):', skus)
await libro.xlsx.writeFile(SALIDA)
console.log(filas.map(f => `${f[0]}: ${f[1]}`).join('\n'))
console.log('Guardado en ' + SALIDA)
