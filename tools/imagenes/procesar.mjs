#!/usr/bin/env node
// ============================================================
// PROCESAR IMÁGENES — descarga cada foto encontrada (tools/imagenes/
// fuentes.json) y la guarda como assets/productos/<SKU>.webp:
// máximo 800 px por lado, fondo blanco, idealmente bajo 60 KB.
// Las fotos quedan en el sitio (no se enlaza a la tienda de origen).
//
// Uso: npm run imagenes:procesar          (solo las que faltan)
//      npm run imagenes:procesar -- --todo
// Después: npm run catalogo (para que data.js use las fotos nuevas).
// ============================================================
import sharp from 'sharp'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ARCHIVO_FUENTES = join(RAIZ, 'tools', 'imagenes', 'fuentes.json')
const DESTINO = join(RAIZ, 'assets', 'productos')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const MAX_LADO = 800
const OBJETIVO_BYTES = 60 * 1024
const MIN_LADO_ORIGEN = 200

async function descargar(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' }, signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const tipo = r.headers.get('content-type') || ''
  if (!tipo.startsWith('image/')) throw new Error(`no es imagen (${tipo})`)
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length > 15 * 1024 * 1024) throw new Error('imagen demasiado grande')
  return buf
}

export async function optimizar(entrada, salida) {
  const meta = await sharp(entrada).metadata()
  if (!meta.width || Math.max(meta.width, meta.height) < MIN_LADO_ORIGEN) throw new Error(`imagen muy chica (${meta.width}×${meta.height})`)
  let lado = MAX_LADO
  for (const calidad of [80, 72, 64, 56]) {
    const buf = await sharp(entrada)
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: calidad, effort: 6 })
      .toBuffer()
    if (buf.length <= OBJETIVO_BYTES || calidad === 56) {
      if (buf.length > OBJETIVO_BYTES * 1.6 && lado > 600) { lado = 600; continue }
      writeFileSync(salida, buf)
      return buf.length
    }
  }
}

async function main() {
  const fuentes = JSON.parse(readFileSync(ARCHIVO_FUENTES, 'utf8'))
  const todo = process.argv.includes('--todo')
  mkdirSync(DESTINO, { recursive: true })
  let ok = 0
  let fallas = 0
  let pesoTotal = 0
  for (const [sku, f] of Object.entries(fuentes)) {
    if (!f.imagen || f.noEncontrada) continue
    const salida = join(DESTINO, `${sku}.webp`)
    if (!todo && existsSync(salida)) { pesoTotal += statSync(salida).size; continue }
    try {
      const buf = await descargar(f.imagen)
      const peso = await optimizar(buf, salida)
      f.archivo = `assets/productos/${sku}.webp`
      delete f.error
      pesoTotal += peso
      ok++
    } catch (e) {
      // Si no se pudo descargar, se trata como no encontrada (nunca se enlaza al origen)
      f.error = e.message
      fallas++
      console.log(`  ✗ ${sku}: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 200))
  }
  writeFileSync(ARCHIVO_FUENTES, JSON.stringify(fuentes, null, 1))
  console.log(`Imágenes nuevas: ${ok} · con error: ${fallas} · peso total de assets/productos: ${Math.round(pesoTotal / 1024)} KB`)
}

if (process.argv[1].endsWith('procesar.mjs')) main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1) })
