// ============================================================
// Pasos comunes para escribir el catálogo publicado:
//   catálogo base (.tmp/catalogo-base.json, sale del Excel)
//   + ajustes (tools/catalogo/ajustes-catalogo.json)
//   + regla de publicación (publicar.mjs)
//   → productos.json (solo publicados) y stock.json (solo disponibilidad).
// Lo usan tools/generar-catalogo.mjs y tools/catalogo/aplicar-fotos.mjs.
// ============================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { escribirCatalogo, escribirStock } from './escritura.mjs'
import { ajustesVacios, publicarCatalogo } from './publicar.mjs'
import { generarSku } from './reglas.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const RUTA_BASE = join(RAIZ, '.tmp', 'catalogo-base.json')
export const RUTA_AJUSTES = join(RAIZ, 'tools', 'catalogo', 'ajustes-catalogo.json')
const ARCHIVO_SKUS = join(RAIZ, 'tools', 'catalogo', 'skus-generados.json')

export function guardarBase({ productos, unidades, fuente }) {
  const base = { generado: new Date().toISOString(), fuente, productos, unidades }
  mkdirSync(dirname(RUTA_BASE), { recursive: true })
  writeFileSync(RUTA_BASE, JSON.stringify(base))
  return base
}

export function leerBase() {
  if (!existsSync(RUTA_BASE)) throw new Error('Falta .tmp/catalogo-base.json: corre primero `npm run catalogo` (lee el Excel).')
  return JSON.parse(readFileSync(RUTA_BASE, 'utf8'))
}

export function leerAjustes(ruta = RUTA_AJUSTES) {
  if (!existsSync(ruta)) return ajustesVacios()
  return { ...ajustesVacios(), ...JSON.parse(readFileSync(ruta, 'utf8')) }
}

// Los productos agregados sin SKU reciben uno nuevo (CATEGORIA-MARCA-NNN), recordado en skus-generados.json.
export function asignarSkusAgregados(base, ajustes) {
  const guardados = existsSync(ARCHIVO_SKUS) ? JSON.parse(readFileSync(ARCHIVO_SKUS, 'utf8')) : {}
  const usados = new Set([...base.productos.flatMap(p => (p.tallas ? p.tallas.map(t => t.sku) : [p.sku])), ...Object.values(guardados)])
  const abreviaturas = new Map()
  for (const s of usados) {
    const partes = s.split('-')
    if (partes.length === 3) abreviaturas.set(partes[1].toLowerCase(), partes[1])
  }
  let cambio = false
  const agregados = (ajustes.agregados || []).map(a => {
    if (a.sku) return a
    const clave = a.codigo || `nuevo:${a.nombre}`
    let sku = guardados[clave]
    if (!sku) { sku = generarSku(a.granel ? 'granel' : a.categoria, a.marca, abreviaturas, usados); guardados[clave] = sku; cambio = true }
    return { ...a, sku }
  })
  if (cambio) writeFileSync(ARCHIVO_SKUS, JSON.stringify(Object.fromEntries(Object.entries(guardados).sort()), null, 1) + '\n')
  return { ...ajustes, agregados }
}

export function publicarYEscribir(base, { ajustes = leerAjustes() } = {}) {
  const conSkus = asignarSkusAgregados(base, ajustes)
  const resultado = publicarCatalogo(base, conSkus, { existeImagen: ruta => existsSync(join(RAIZ, ruta)) })
  escribirCatalogo(resultado.publicados, { fuente: base.fuente })
  escribirStock(resultado.disponibilidad)
  return resultado
}
