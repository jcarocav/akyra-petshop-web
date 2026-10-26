#!/usr/bin/env node
// ============================================================
// Optimiza las imágenes de diseño del sitio (portadas y fondos) a
// WebP livianos, en 2 tamaños (celular y escritorio).
// Uso: npm run optimizar-imagenes   (las originales quedan en assets/originales/)
// ============================================================
import sharp from 'sharp'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const TRABAJOS = [
  // [origen, destino (sin extensión), anchos, recortar transparencia]
  ['assets/originales/portada-lanzamiento.png', 'assets/hero/portada-lanzamiento', [560, 1000], true],
  ['assets/originales/portada-granel.webp', 'assets/hero/portada-granel', [640, 1100], false],
  ['assets/originales/portada-fiestas-patrias.webp', 'assets/hero/portada-fiestas-patrias', [560, 1000], false],
  ['assets/originales/fondo-granel.jpg', 'assets/img/fondo-granel', [800, 1400], false],
  ['assets/originales/hornillas.jpg', 'assets/img/lugares/hornillas', [640], false]
]

for (const [origen, destino, anchos, recortar] of TRABAJOS) {
  const ruta = join(RAIZ, origen)
  if (!existsSync(ruta)) { console.log(`(falta ${origen}, se omite)`); continue }
  mkdirSync(dirname(join(RAIZ, destino)), { recursive: true })
  for (const ancho of anchos) {
    let img = sharp(ruta)
    if (recortar) img = img.trim()
    const salida = join(RAIZ, `${destino}-${ancho}.webp`)
    await img.resize({ width: ancho, withoutEnlargement: true }).webp({ quality: 78, effort: 6 }).toFile(salida)
    const meta = await sharp(salida).metadata()
    console.log(`${destino}-${ancho}.webp  ${meta.width}×${meta.height}  ${Math.round(statSync(salida).size / 1024)} KB`)
  }
}
