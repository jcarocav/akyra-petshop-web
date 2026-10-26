// Actualización de stock: lector del reporte de Gesnex (apps-script/Lector.js),
// cruce con el catálogo y el paso planilla → stock.json del GitHub Action.
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { cruzarStock, estadoStock } from '../../js/stock.mjs'
import { aplicarCsv } from '../../tools/stock/actualizar-desde-sheet.mjs'
import { lectorAplicarReporte, lectorLeerReporte, lectorParsearCsv } from '../../tools/stock/lector.mjs'

const RAIZ = resolve(import.meta.dirname, '..', '..')
const XLSX = createRequire(import.meta.url)('xlsx')
const productos = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8')).productos
const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
const csvSimulado = readFileSync(join(RAIZ, 'tests', 'fixtures', 'gesnex-simulado.csv'), 'utf8')

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

  test('con el simulado completo, la planilla queda con el mismo stock que stock.json', () => {
    const r = lectorAplicarReporte(catalogoPlanilla(), lectorLeerReporte(lectorParsearCsv(csvSimulado)), {})
    expect(r.ok).toBe(true)
    expect(r.coincidencia).toBeGreaterThan(0.5)
    expect(r.sinMatch).toHaveLength(0)
  })
})

test.describe('reglas de visibilidad con el stock nuevo', () => {
  const simple = productos.find(p => !p.tallas && !p.granel && typeof p.precio === 'number')
  const conTallas = productos.find(p => p.tallas && p.tallas.length >= 2)

  test('un producto pasa de 0 a 3 y aparece; de 3 a 0 y desaparece', () => {
    const con0 = cruzarStock([simple], { unidades: { [simple.sku]: 0 } })[0]
    expect(con0.visible).toBe(false)
    const con3 = cruzarStock([simple], { unidades: { [simple.sku]: 3 } })[0]
    expect(con3.visible).toBe(true)
    expect(con3.tope).toBe(3)
    expect(estadoStock(3).texto).toBe('¡Últimas 3 unidades!')
    expect(estadoStock(12).texto).toBe('Disponible')
    expect(estadoStock(null).texto).toBe('Consultar disponibilidad')
    expect(estadoStock(0).texto).toBe('Agotado por ahora')
  })

  test('una talla en 0 sale del selector; si todas quedan en 0, la card se oculta', () => {
    const [t1, ...resto] = conTallas.tallas
    const unidades = { [t1.sku]: 0, ...Object.fromEntries(resto.map(t => [t.sku, 2])) }
    const p = cruzarStock([conTallas], { unidades })[0]
    expect(p.visible).toBe(true)
    expect(p.tallas.filter(t => t.visible).map(t => t.sku)).not.toContain(t1.sku)
    const todas0 = cruzarStock([conTallas], { unidades: Object.fromEntries(conTallas.tallas.map(t => [t.sku, 0])) })[0]
    expect(todas0.visible).toBe(false)
  })
})

test.describe('GitHub Action: planilla (CSV) → stock.json', () => {
  const csvDe = filas => ['sku,nombre,marca,categoria,precio,unidades,nuevo,actualizado,reporte', ...filas.map(f => f.join(','))].join('\n')
  const todasLasFilas = (cambios = {}) => skus.map(s => [s.sku, `"${s.nombre}"`, '', '', s.precio ?? '', cambios[s.sku] ?? (stock.unidades[s.sku] ?? ''), '', '', '2026-10-26T10:00:00-03:00'])

  test('actualiza unidades, agrega productos nuevos y respeta "sin dato"', () => {
    const objetivo = skus.find(s => stock.unidades[s.sku] === 0).sku
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

  test('stock.json nunca contiene costos ni datos por sucursal', () => {
    const texto = readFileSync(join(RAIZ, 'stock.json'), 'utf8').toLowerCase()
    for (const palabra of ['costo', 'neto', 'proveedor', 'bodega', 'aldunate', 'hornillas', 'lengas', 'precio']) expect(texto).not.toContain(palabra)
    expect(Object.keys(stock).sort()).toEqual(['actualizado', 'unidades'])
    for (const v of Object.values(stock.unidades)) expect(v === null || typeof v === 'number').toBe(true)
  })
})
