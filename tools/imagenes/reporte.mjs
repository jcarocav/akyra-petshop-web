#!/usr/bin/env node
// ============================================================
// Genera imagenes-catalogo.xlsx (en la carpeta de arriba del sitio):
//   - "No encontradas": productos visibles sin foto, ordenados por sucursal
//     y categoría, para salir a sacar fotos.
//   - "Encontradas": de dónde salió cada foto (página de origen y archivo).
// Uso: npm run imagenes:reporte   (después de npm run catalogo)
// ============================================================
import ExcelJS from 'exceljs'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIAS } from '../catalogo/reglas.mjs'
import { cruzarStock } from '../../js/stock.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SALIDA = process.argv.includes('--salida') ? resolve(process.argv[process.argv.indexOf('--salida') + 1]) : resolve(RAIZ, '..', 'imagenes-catalogo.xlsx')

const LUGARES = ['ALDUNATE', 'HORNILLAS', 'LAS LENGAS', 'BODEGA CENTRAL', 'BODEGA HORNILLAS']
const NOMBRE_LUGAR = { ALDUNATE: 'Casa Matriz (Aldunate)', HORNILLAS: 'Hornillas', 'LAS LENGAS': 'Las Lengas', 'BODEGA CENTRAL': 'Bodega Central', 'BODEGA HORNILLAS': 'Bodega Hornillas' }
const nombreCategoria = new Map(CATEGORIAS.map(c => [c.id, c.nombre]))
const ordenCategoria = new Map(CATEGORIAS.map((c, i) => [c.id, i]))

const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
const fuentes = JSON.parse(readFileSync(join(RAIZ, 'tools', 'imagenes', 'fuentes.json'), 'utf8'))
const interno = new Map(internos.map(i => [i.sku, i]))

const visibles = cruzarStock(catalogo.productos, stock).filter(p => p.visible)
const noEncontradas = []
const encontradas = []
for (const p of visibles) {
  const variantes = p.tallas ? p.tallas.filter(t => t.visible).map(t => t.sku) : [p.sku]
  const datos = variantes.map(s => interno.get(s)).filter(Boolean)
  const codigo = datos.map(d => d.codigo).join(', ')
  if (!p.imagen) {
    const lugares = [...new Set(datos.flatMap(d => d.lugares))].sort((a, b) => LUGARES.indexOf(a) - LUGARES.indexOf(b))
    const sinDato = datos.every(d => d.sinCantidadRegistrada)
    noEncontradas.push({
      orden: lugares.length ? LUGARES.indexOf(lugares[0]) : 99,
      sku: p.sku, codigo, nombre: p.nombre, marca: p.marca, categoria: nombreCategoria.get(p.categoria), ordenCat: ordenCategoria.get(p.categoria),
      lugar: lugares.length ? lugares.map(l => NOMBRE_LUGAR[l]).join(', ') : (sinDato ? 'Sin cantidad registrada (consultar en tienda)' : 'Sin ubicación registrada'),
      tallas: p.tallas ? p.tallas.filter(t => t.visible).map(t => t.talla).join(', ') : ''
    })
  } else {
    const skuFoto = p.imagen.replace(/^.*\/|\.webp$/g, '')
    const f = fuentes[skuFoto] || {}
    encontradas.push({
      sku: p.sku, codigo, nombre: p.nombre, marca: p.marca, categoria: nombreCategoria.get(p.categoria),
      pagina: f.pagina || '', archivo: p.imagen, fuente: f.fuente || '', metodo: skuFoto !== p.sku ? `foto del saco (${skuFoto})` : (f.metodo || '')
    })
  }
}
noEncontradas.sort((a, b) => a.orden - b.orden || a.ordenCat - b.ordenCat || a.nombre.localeCompare(b.nombre, 'es'))
encontradas.sort((a, b) => a.categoria.localeCompare(b.categoria, 'es') || a.nombre.localeCompare(b.nombre, 'es'))

const libro = new ExcelJS.Workbook()
libro.creator = 'Maskotería Akyra — catálogo web'
function hoja(nombre, columnas, filas) {
  const h = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] })
  h.columns = columnas
  h.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  h.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006F68' } }
  filas.forEach(f => h.addRow(f))
  h.autoFilter = { from: 'A1', to: { row: 1, column: columnas.length } }
  return h
}
hoja('No encontradas', [
  { header: 'Sucursal o bodega con stock', key: 'lugar', width: 34 },
  { header: 'Categoría', key: 'categoria', width: 16 },
  { header: 'SKU', key: 'sku', width: 16 },
  { header: 'Código de barras', key: 'codigo', width: 18 },
  { header: 'Nombre', key: 'nombre', width: 60 },
  { header: 'Marca', key: 'marca', width: 18 },
  { header: 'Tallas', key: 'tallas', width: 12 }
], noEncontradas)
const h2 = hoja('Encontradas', [
  { header: 'SKU', key: 'sku', width: 16 },
  { header: 'Código de barras', key: 'codigo', width: 18 },
  { header: 'Nombre', key: 'nombre', width: 60 },
  { header: 'Marca', key: 'marca', width: 18 },
  { header: 'Categoría', key: 'categoria', width: 16 },
  { header: 'URL de la página de origen', key: 'pagina', width: 60 },
  { header: 'Archivo local', key: 'archivo', width: 36 },
  { header: 'Tienda de origen', key: 'fuente', width: 22 },
  { header: 'Cómo se confirmó', key: 'metodo', width: 34 }
], encontradas)
h2.getColumn('pagina').eachCell((c, n) => { if (n > 1 && c.value) c.value = { text: c.value, hyperlink: c.value } })
await libro.xlsx.writeFile(SALIDA)
console.log(`${SALIDA}\n  No encontradas: ${noEncontradas.length} · Encontradas: ${encontradas.length}`)
