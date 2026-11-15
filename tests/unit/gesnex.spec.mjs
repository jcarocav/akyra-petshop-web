// Actualización de stock: lector del reporte de Gesnex (apps-script/Lector.js),
// cruce con el catálogo y el paso planilla → stock.json del GitHub Action.
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { cruzarDisponibilidad, disponibilidadDesdeUnidades, estadoDisponibilidad } from '../../js/stock.mjs'
import { aplicarCsv } from '../../tools/stock/actualizar-desde-sheet.mjs'
import { lectorAplicarReporte, lectorLeerReporte, lectorParsearCsv } from '../../tools/stock/lector.mjs'

const RAIZ = resolve(import.meta.dirname, '..', '..')
const XLSX = createRequire(import.meta.url)('xlsx')
const productos = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8')).productos
const csvSimulado = readFileSync(join(RAIZ, 'tests', 'fixtures', 'gesnex-simulado.csv'), 'utf8')
// stock.json ya no tiene unidades (desde noviembre 2026 solo "con-stock" / "consultar"): para probar el lector
// (hoy desactivado) se suman a mano las bodegas del reporte simulado.
const unidadesSimuladas = {}
for (const linea of csvSimulado.replace(/^﻿/, '').split(/\r?\n/).slice(1)) {
  const [sku, , , , cantidad] = linea.split(';')
  if (!sku) continue
  unidadesSimuladas[sku] = Math.round(((unidadesSimuladas[sku] || 0) + Number(String(cantidad).replace(',', '.'))) * 1000) / 1000
}
const stock = { unidades: unidadesSimuladas }
const stockPublico = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))

const skus = productos.flatMap(p => (p.tallas ? p.tallas.map(t => ({ sku: t.sku, precio: t.precio, nombre: p.nombre })) : [{ sku: p.sku, precio: p.precio, nombre: p.nombre }]))
const catalogoPlanilla = () => skus.map(s => ({ sku: s.sku, codigo: '', nombre: s.nombre, precio: s.precio, unidades: stock.unidades[s.sku] }))

test.describe('lector del reporte de Gesnex (archivo simulado)', () => {
  test('lee el CSV con ; y coma decimal, y suma todas las bodegas por SKU', () => {
    const r = lectorLeerReporte(lectorParsearCsv(csvSimulado))
    expect(r.ok).toBe(true)
    expect(r.filasLeidas).toBeGreaterThan(1500)
    let comparados = 0
    for (const p of r.productos) {
      const esperado = stock.unidades[p.sku]
      if (esperado === null || esperado === undefined) continue
      expect(p.unidades, p.sku).toBeCloseTo(esperado, 3)
      comparados++
    }
    expect(comparados).toBeGreaterThan(900)
  })

  test('lee el XLSX aunque tenga filas de título antes de los encabezados', () => {
    const libro = XLSX.readFile(join(RAIZ, 'tests', 'fixtures', 'gesnex-simulado.xlsx'))
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1, raw: true, defval: '' })
    const r = lectorLeerReporte(filas)
    expect(r.ok).toBe(true)
    const desdeCsv = lectorLeerReporte(lectorParsearCsv(csvSimulado))
    expect(r.productos.length).toBe(desdeCsv.productos.length)
  })

  test('aplica el reporte a la planilla y calza por SKU o por código de barras', () => {
    const catalogo = [
      { sku: 'GAT-TEST-001', codigo: '7800000000011', nombre: 'Uno', precio: 1000, unidades: 0 },
      { sku: 'GAT-TEST-002', codigo: '7800000000028', nombre: 'Dos', precio: 2000, unidades: 5 }
    ]
    const tabla = [['SKU', 'Código de barras', 'Descripción', 'Bodega', 'Stock', 'Precio'],
      ['GAT-TEST-001', '7800000000011', 'Uno', 'ALDUNATE', '2', '1.100'],
      ['GAT-TEST-001', '7800000000011', 'Uno', 'HORNILLAS', '1', '1.100'],
      ['', '7800000000028', 'Dos', 'LAS LENGAS', '0', ''],
      ['XXX-NUEV-001', '7800000000099', 'Producto nuevo', 'ALDUNATE', '4', '3990'],
      ['', '7800000000105', '', 'ALDUNATE', '1', '']]
    const r = lectorAplicarReporte(catalogo, lectorLeerReporte(tabla), { fecha: '2026-10-26T10:00:00-03:00' })
    expect(r.ok).toBe(true)
    expect(r.filas[0]).toMatchObject({ sku: 'GAT-TEST-001', unidades: 3, precio: 1100 })
    expect(r.filas[1]).toMatchObject({ sku: 'GAT-TEST-002', unidades: 0, precio: 2000 })
    expect(r.nuevos).toHaveLength(1)
    expect(r.nuevos[0]).toMatchObject({ sku: 'XXX-NUEV-001', nombre: 'Producto nuevo', unidades: 4, nuevo: 'sí' })
    expect(r.sinMatch.map(s => s.sku || s.codigo)).toEqual(['XXX-NUEV-001', '7800000000105'])
  })

  test('un reporte vacío, con columnas raras o que calza con menos del 50 % NO se aplica', () => {
    expect(lectorLeerReporte([]).ok).toBe(false)
    expect(lectorLeerReporte([['Hola', 'Mundo'], ['a', 'b']]).ok).toBe(false)
    expect(lectorLeerReporte([['SKU', 'Stock']]).ok).toBe(false)
    const catalogo = catalogoPlanilla()
    const parcial = lectorLeerReporte([['SKU', 'Stock'], ...catalogo.slice(0, Math.floor(catalogo.length * 0.3)).map(c => [c.sku, 0])])
    const r = lectorAplicarReporte(catalogo, parcial, {})
    expect(r.ok).toBe(false)
    expect(r.error).toContain('No se actualizó nada')
  })

  test('con el simulado completo, calzan todos los productos publicados', () => {
    const r = lectorAplicarReporte(catalogoPlanilla(), lectorLeerReporte(lectorParsearCsv(csvSimulado)), {})
    expect(r.ok).toBe(true)
    expect(r.coincidencia).toBeGreaterThan(0.5)
    // lo que no calza son solo productos que hoy no se publican (no están en productos.json)
    const publicados = new Set(skus.map(x => x.sku))
    expect(r.sinMatch.filter(x => publicados.has(x.sku))).toHaveLength(0)
  })
})

test.describe('disponibilidad (sin unidades)', () => {
  const simple = productos.find(p => !p.tallas && !p.granel && typeof p.precio === 'number')
  const conTallas = productos.find(p => p.tallas && p.tallas.length >= 2)

  test('stock 0 o sin dato = "consultar"; con stock = sin aviso; nunca se oculta', () => {
    expect(disponibilidadDesdeUnidades(0)).toBe('consultar')
    expect(disponibilidadDesdeUnidades(null)).toBe('consultar')
    expect(disponibilidadDesdeUnidades(3)).toBe('con-stock')
    expect(disponibilidadDesdeUnidades(0.05, true)).toBe('consultar')
    expect(estadoDisponibilidad('consultar').texto).toBe('Consultar disponibilidad')
    expect(estadoDisponibilidad('con-stock').texto).toBe('')
    const p = cruzarDisponibilidad([simple], { disponibilidad: { [simple.sku]: 'consultar' } })[0]
    expect(p.disponibilidad).toBe('consultar')
    expect(p).not.toHaveProperty('visible')
  })

  test('las tallas sin stock siguen en el selector con su propia disponibilidad', () => {
    const [t1, ...resto] = conTallas.tallas
    const disponibilidad = { [t1.sku]: 'consultar', ...Object.fromEntries(resto.map(t => [t.sku, 'con-stock'])) }
    const p = cruzarDisponibilidad([conTallas], { disponibilidad })[0]
    expect(p.tallas).toHaveLength(conTallas.tallas.length)
    expect(p.tallas[0].disponibilidad).toBe('consultar')
    expect(p.disponibilidad).toBe('con-stock')
  })
})

test.describe('GitHub Action: planilla (CSV) → stock.json', () => {
  const csvDe = filas => ['sku,nombre,marca,categoria,precio,unidades,nuevo,actualizado,reporte', ...filas.map(f => f.join(','))].join('\n')
  const todasLasFilas = (cambios = {}) => skus.map(s => [s.sku, `"${s.nombre}"`, '', '', s.precio ?? '', cambios[s.sku] ?? (stock.unidades[s.sku] ?? ''), '', '', '2026-10-26T10:00:00-03:00'])

  test('actualiza unidades, agrega productos nuevos y respeta "sin dato"', () => {
    const objetivo = skus.find(s => !stock.unidades[s.sku]).sku
    const filas = todasLasFilas({ [objetivo]: 3 })
    filas.push(['GAT-NUEVO-001', 'SOBRE GATO NUEVO SABOR ATUN 85G', 'Nueva Marca', 'Gatos', '990', '7', 'sí', '', '2026-10-26T10:00:00-03:00'])
    const r = aplicarCsv({ csvTexto: csvDe(filas), productos, stock })
    expect(r.ok).toBe(true)
    expect(r.stock.unidades[objetivo]).toBe(3)
    expect(r.stock.unidades['GAT-NUEVO-001']).toBe(7)
    const nuevo = r.productos.find(p => p.sku === 'GAT-NUEVO-001')
    expect(nuevo).toMatchObject({ categoria: 'gatos', subcategoria: 'Alimento húmedo', precio: 990, nuevo: true })
    expect(nuevo.imagen).toBeUndefined() // se muestra con el placeholder
    expect(r.stock.actualizado).toBe(new Date('2026-10-26T10:00:00-03:00').toISOString())
  })

  test('el granel con decimales del CSV se lee en kilos (2.805 = 2,805 kg)', () => {
    const granel = skus.find(s => s.sku.startsWith('GRA-')).sku
    const r = aplicarCsv({ csvTexto: csvDe(todasLasFilas({ [granel]: '2.805' })), productos, stock })
    expect(r.ok).toBe(true)
    expect(r.stock.unidades[granel]).toBe(2.805)
  })

  test('si la planilla no cambió, stock.json queda idéntico (sin commit)', () => {
    const filas = todasLasFilas().map(f => [...f.slice(0, 7), '2026-10-26T10:00:00.000Z', ''])
    const r = aplicarCsv({ csvTexto: csvDe(filas), productos, stock, ahora: new Date('2030-01-01') })
    expect(r.ok).toBe(true)
    expect(r.stock.actualizado).toBe('2026-10-26T10:00:00.000Z')
  })

  test('un CSV vacío, raro o incompleto NO cambia nada', () => {
    expect(aplicarCsv({ csvTexto: '', productos, stock }).ok).toBe(false)
    expect(aplicarCsv({ csvTexto: 'a,b\n1,2', productos, stock }).ok).toBe(false)
    expect(aplicarCsv({ csvTexto: csvDe([]), productos, stock }).ok).toBe(false)
    const pocas = todasLasFilas().slice(0, Math.floor(skus.length * 0.4))
    const r = aplicarCsv({ csvTexto: csvDe(pocas), productos, stock })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('No se actualizó nada')
  })

  test('stock.json nunca contiene costos, unidades ni datos por sucursal', () => {
    const texto = readFileSync(join(RAIZ, 'stock.json'), 'utf8').toLowerCase()
    for (const palabra of ['costo', 'neto', 'proveedor', 'bodega', 'aldunate', 'hornillas', 'lengas', 'precio']) expect(texto).not.toContain(palabra)
    expect(Object.keys(stockPublico)).toEqual(['disponibilidad'])
    for (const v of Object.values(stockPublico.disponibilidad)) expect(['con-stock', 'consultar']).toContain(v)
  })
})
