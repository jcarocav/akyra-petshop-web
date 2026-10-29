// Tipo de cada foto del catálogo: "exacta" (el producto real) o "referencial" (foto de un producto igual
// en forma y uso, sin marca de otro). Lo decide tools/catalogo/fotos-progreso.json (grupo A = exacta, B = referencial).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
let progreso = null
function leer() {
  if (!progreso) {
    const ruta = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
    progreso = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : {}
  }
  return progreso
}

// SKU de la foto (assets/productos/<SKU>.webp) → 'referencial' | 'exacta'
export function tipoDeImagen(skuFoto) {
  return leer()[skuFoto]?.grupo === 'B' ? 'referencial' : 'exacta'
}
