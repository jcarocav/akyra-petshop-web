// Catálogo COMPLETO para las herramientas internas (búsqueda de fotos, reportes): incluye los productos que no se
// publican (por ejemplo Mondo / Marben / Leon Pet sin foto, que son justo los que necesitan foto).
// Usa .tmp/catalogo-base.json (lo escribe `npm run catalogo`); si no está, productos.json (solo publicados).
// Cada producto trae `visible` (= se publica) y `disponibilidad`, como antes traía el cruce con el stock.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicarCatalogo } from './publicar.mjs'
import { leerAjustes } from './proceso.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export function productosCompletos() {
  const rutaBase = join(RAIZ, '.tmp', 'catalogo-base.json')
  if (existsSync(rutaBase)) {
    const { todos } = publicarCatalogo(JSON.parse(readFileSync(rutaBase, 'utf8')), leerAjustes())
    return todos.map(p => ({ ...p, visible: p.publicado }))
  }
  return JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8')).productos.map(p => ({ ...p, visible: true }))
}
