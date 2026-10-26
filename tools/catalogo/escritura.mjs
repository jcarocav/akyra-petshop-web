// Escribe productos.json y stock.json (sin dependencias: lo usa también el GitHub Action).
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAMPOS_PUBLICOS, CATEGORIAS } from './reglas.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export function verificarSinDatosInternos(productos) {
  for (const p of productos) {
    for (const k of Object.keys(p)) if (!CAMPOS_PUBLICOS.has(k)) throw new Error(`Campo no permitido en productos.json: ${k} (${p.sku})`)
    for (const t of p.tallas || []) for (const k of Object.keys(t)) if (!CAMPOS_PUBLICOS.has(k)) throw new Error(`Campo no permitido en tallas: ${k} (${p.sku})`)
  }
}

export function escribirCatalogo(productos, { fuente }) {
  const ordenCat = new Map(CATEGORIAS.map((c, i) => [c.id, i]))
  productos.sort((a, b) => ordenCat.get(a.categoria) - ordenCat.get(b.categoria) || a.nombre.localeCompare(b.nombre, 'es'))
  verificarSinDatosInternos(productos)
  const categorias = CATEGORIAS.map(c => ({
    id: c.id, nombre: c.nombre, titulo: c.titulo,
    subcategorias: [...new Set(productos.filter(p => p.categoria === c.id).map(p => p.subcategoria))].sort((a, b) => a.localeCompare(b, 'es'))
  }))
  const datos = { generado: new Date().toISOString(), fuente, categorias, productos }
  // Una línea por producto: los cambios se leen fácil en git
  const json = '{\n' +
    `"generado": ${JSON.stringify(datos.generado)},\n"fuente": ${JSON.stringify(fuente)},\n` +
    `"categorias": ${JSON.stringify(categorias)},\n"productos": [\n` +
    productos.map(p => JSON.stringify(p)).join(',\n') + '\n]\n}\n'
  writeFileSync(join(RAIZ, 'productos.json'), json)
}

export function escribirStock(unidades, actualizado = new Date()) {
  const ordenado = Object.fromEntries(Object.entries(unidades).sort(([a], [b]) => a.localeCompare(b)))
  const json = `{\n"actualizado": ${JSON.stringify(actualizado.toISOString())},\n"unidades": {\n` +
    Object.entries(ordenado).map(([k, v]) => `${JSON.stringify(k)}: ${v === null ? 'null' : v}`).join(',\n') + '\n}\n}\n'
  writeFileSync(join(RAIZ, 'stock.json'), json)
}

