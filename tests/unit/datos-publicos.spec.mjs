// productos.json y stock.json son públicos: nunca deben contener costos ni datos internos.
import { expect, test } from '@playwright/test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ExcelJS from 'exceljs'
import { CAMPOS_PUBLICOS } from '../../tools/catalogo/reglas.mjs'

const RAIZ = resolve(import.meta.dirname, '..', '..')
const texto = readFileSync(join(RAIZ, 'productos.json'), 'utf8')
const { productos, categorias } = JSON.parse(texto)
const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))

test('productos.json solo tiene campos públicos', () => {
  expect(productos.length).toBeGreaterThan(500)
  for (const p of productos) {
    for (const k of Object.keys(p)) expect(CAMPOS_PUBLICOS.has(k), `${p.sku}: ${k}`).toBe(true)
    for (const t of p.tallas || []) for (const k of Object.keys(t)) expect(CAMPOS_PUBLICOS.has(k), `${p.sku} talla: ${k}`).toBe(true)
  }
})

test('productos.json no menciona costos, proveedores ni sucursales/bodegas', () => {
  const datos = JSON.stringify(productos)
  for (const palabra of ['costo', 'neto', 'proveedor', 'bodega', 'aldunate', 'hornillas', 'lengas']) {
    expect(datos.toLowerCase(), palabra).not.toContain(palabra)
  }
  expect(datos).not.toMatch(/\b(?:7\d{12}|\d{13})\b/) // sin códigos de barra
})

test('todo producto tiene su stock en stock.json y ningún precio es $1', () => {
  for (const p of productos) {
    const variantes = p.tallas || [p]
    for (const v of variantes) {
      expect(Object.prototype.hasOwnProperty.call(stock.unidades, v.sku), v.sku).toBe(true)
      expect(v.precio === null || v.precio > 1, v.sku).toBe(true)
    }
  }
})

test('las 8 categorías, en orden', () => {
  expect(categorias.map(c => c.nombre)).toEqual(['Perros', 'Gatos', 'Otras mascotas', 'Granel', 'Accesorios', 'Arena', 'Ropa', 'Salud/Higiene'])
})

// Solo cuando la planilla está en el computador (no en GitHub, donde no se sube):
// se arma el catálogo desde el Excel y se compara cada precio publicado con
// la columna D (precio de venta), nunca con la C (costo neto).
const carpetas = [RAIZ, resolve(RAIZ, '..')]
const excel = carpetas.flatMap(c => readdirSync(c).filter(f => /^Inventario.*\.xlsx$/i.test(f)).map(f => join(c, f)))[0]
test('los precios publicados son el precio de venta, nunca el costo', async () => {
  test.skip(!excel || !existsSync(excel), 'La planilla no está disponible (normal en GitHub Actions)')
  const { leerExcel } = await import('../../tools/generar-catalogo.mjs')
  const { maestro } = await leerExcel(excel)
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.readFile(excel)
  const costoPorCodigo = new Map()
  libro.getWorksheet('Base Rosa (1004)').eachRow((fila, n) => {
    if (n < 5) return
    const v = fila.getCell(3).value
    const cod = fila.getCell(1).value
    if (cod !== null) costoPorCodigo.set(typeof cod === 'number' ? BigInt(Math.round(cod)).toString() : String(cod).trim(), typeof v === 'object' && v ? v.result : v)
  })
  const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
  const codigoPorSku = new Map(internos.map(i => [i.sku, i.codigo]))
  let revisados = 0
  for (const p of productos) {
    const variantes = p.tallas ? p.tallas : [p]
    for (const v of variantes) {
      const cod = codigoPorSku.get(v.sku)
      if (!cod || v.precio === null) continue
      const venta = Math.round(Number(maestro.get(cod).precio))
      const costo = Number(costoPorCodigo.get(cod))
      expect(v.precio, v.sku).toBe(venta)
      if (costo > 1 && Math.round(costo) !== venta) expect(v.precio, `${v.sku} publica el costo`).not.toBe(Math.round(costo))
      revisados++
    }
  }
  expect(revisados).toBeGreaterThan(800)
})
