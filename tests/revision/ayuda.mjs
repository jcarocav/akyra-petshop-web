// Ayudas para probar la herramienta de revisión: levanta el servidor con un catálogo de prueba
// (tests/fixtures/revision/catalogo-base.json) y un inventario Excel falso, en una carpeta temporal.
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import ExcelJS from 'exceljs'
import sharp from 'sharp'

export const RAIZ = resolve(import.meta.dirname, '..', '..')
export const BASE = join(RAIZ, 'tests', 'fixtures', 'revision', 'catalogo-base.json')
export const catalogoPrueba = JSON.parse(readFileSync(BASE, 'utf8'))

// Inventario falso con la misma forma que el real: hoja "Base Rosa (1004)" (A código, B nombre, C costo, D precio,
// F fabricante, G categoría; datos desde la fila 5) y una hoja con una fórmula que usa la columna D.
export async function crearInventario(ruta) {
  const libro = new ExcelJS.Workbook()
  const resumen = libro.addWorksheet('Resumen')
  const base = libro.addWorksheet('Base Rosa (1004)')
  base.getCell('A1').value = 'BASE ROSA'
  base.getRow(4).values = ['CÓDIGO', 'NOMBRE', 'COSTO NETO', 'VALOR DE VENTA', 'MARGEN', 'FABRICANTE', 'CATEGORÍA']
  let fila = 5
  for (const p of catalogoPrueba.productos) {
    for (const v of p.tallas || [p]) {
      base.getRow(fila).values = [Number(v.codigo), p.nombreExcel + (p.tallas ? ` ${v.talla}` : ''), 1000, v.precio ?? 1, null, p.fabricante, p.categoria]
      fila++
    }
  }
  resumen.getCell('A1').value = 'Total precios'
  resumen.getCell('B1').value = { formula: `SUM('Base Rosa (1004)'!D5:D${fila - 1})` }
  await libro.xlsx.writeFile(ruta)
  return { filas: fila - 5 }
}

// Levanta la herramienta. Devuelve { url, origen, clave, carpeta, detener() }.
export async function iniciarHerramienta({ carpeta = mkdtempSync(join(tmpdir(), 'akyra-revision-')), excel = null, clave = randomBytes(8).toString('hex') } = {}) {
  if (!excel) { excel = join(carpeta, 'Inventario_Prueba_v1.xlsx'); await crearInventario(excel) }
  const proceso = spawn(process.execPath, [join(RAIZ, 'tools', 'revision', 'servidor.mjs'), '--sin-navegador'], {
    env: { ...process.env, PORT: '0', AKYRA_CLAVE: clave, AKYRA_REVISION_DIR: join(carpeta, 'revision-catalogo'), AKYRA_BASE: BASE, AKYRA_EXCEL: excel },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let salida = ''
  const puerto = await new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new Error('La herramienta no partió:\n' + salida)), 30000)
    const leer = d => {
      salida += d
      const m = salida.match(/En este PC: http:\/\/localhost:(\d+)\//)
      if (m) { clearTimeout(reloj); resolver(Number(m[1])) }
    }
    proceso.stdout.on('data', leer)
    proceso.stderr.on('data', leer)
    proceso.on('exit', c => rechazar(new Error(`La herramienta se cerró (${c}):\n${salida}`)))
  })
  const origen = `http://localhost:${puerto}`
  return {
    origen, puerto, clave, carpeta, excel,
    datos: join(carpeta, 'revision-catalogo'),
    url: (extra = '') => `${origen}/?clave=${clave}&sin-qr=1${extra}`,
    salida: () => salida,
    detener: () => new Promise(r => { proceso.once('exit', r); proceso.kill() })
  }
}

export function leerRevision(h) {
  return JSON.parse(readFileSync(join(h.datos, 'revision.json'), 'utf8'))
}

// ---- Imagen de un código de barras EAN-13 (para probar la lectura por foto) ----
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARIDAD = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
export function digitoControl(doce) {
  const suma = [...doce].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0)
  return String((10 - (suma % 10)) % 10)
}
export async function imagenEan13(codigo) {
  const c = codigo.length === 12 ? codigo + digitoControl(codigo) : codigo
  const d = [...c].map(Number)
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (PARIDAD[d[0]][i - 1] === 'L' ? L : G)[d[i]]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[d[i]]
  bits += '101'
  const modulo = 6
  const ancho = (bits.length + 22) * modulo
  const barras = [...bits].map((b, i) => (b === '1' ? `<rect x="${(i + 11) * modulo}" y="40" width="${modulo}" height="260"/>` : '')).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="360"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${barras}</g></svg>`
  return sharp(Buffer.from(svg)).extend({ top: 120, bottom: 120, left: 120, right: 120, background: '#f4f1ea' }).jpeg({ quality: 92 }).toBuffer()
}
