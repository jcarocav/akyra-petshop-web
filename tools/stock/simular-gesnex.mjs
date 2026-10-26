#!/usr/bin/env node
// ============================================================
// Genera un reporte de stock "como de Gesnex" para probar el lector
// mientras no llega uno real: tests/fixtures/gesnex-simulado.csv y .xlsx
// Columnas típicas: SKU, Código, Descripción, Bodega, Stock, Precio.
//
// Sale del Excel v53 (npm run catalogo deja .tmp/catalogo-interno.json).
// El TOTAL por producto es el real; el reparto por bodega es inventado
// (con una semilla fija) para no publicar el stock real de cada sucursal.
// ============================================================
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const XLSX = createRequire(import.meta.url)('xlsx')
const BODEGAS = ['BODEGA CENTRAL', 'ALDUNATE', 'HORNILLAS', 'LAS LENGAS']

let semilla = 20261026
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648 }

const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
const filas = [['SKU', 'Código', 'Descripción', 'Bodega', 'Stock', 'Precio']]
for (const p of internos) {
  if (p.unidades === null) continue // dictados sin cantidad: Gesnex todavía no los tiene
  const total = p.unidades
  const partes = total === 0 ? 1 : 1 + Math.floor(azar() * 3)
  let restante = total
  for (let i = 0; i < partes; i++) {
    const bodega = BODEGAS[(i + Math.floor(azar() * 4)) % BODEGAS.length]
    const cantidad = i === partes - 1 ? restante : Math.round(restante * azar() * (p.categoria === 'granel' ? 100 : 1)) / (p.categoria === 'granel' ? 100 : 1)
    restante = Math.round((restante - cantidad) * 1000) / 1000
    // formato chileno con coma decimal, como suele exportar Gesnex
    filas.push([p.sku, p.codigo, p.nombreExcel, bodega, String(cantidad).replace('.', ','), p.precio ?? ''])
  }
}
mkdirSync(join(RAIZ, 'tests', 'fixtures'), { recursive: true })
const csv = filas.map(f => f.map(v => {
  const t = String(v)
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}).join(';')).join('\r\n')
writeFileSync(join(RAIZ, 'tests', 'fixtures', 'gesnex-simulado.csv'), '﻿' + csv)
const libro = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['Reporte de stock por bodega'], ['Generado: 26-10-2026'], [], ...filas]), 'Stock')
XLSX.writeFile(libro, join(RAIZ, 'tests', 'fixtures', 'gesnex-simulado.xlsx'))
console.log(`Reporte simulado: ${filas.length - 1} filas → tests/fixtures/gesnex-simulado.csv y .xlsx`)
