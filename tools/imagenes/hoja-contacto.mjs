#!/usr/bin/env node
// Hoja de contactos para revisar fotos de a muchas: node tools/imagenes/hoja-contacto.mjs <salida.png> <SKU...>
// (o --grupo A --desde 0 --cuantas 20 para tomar del archivo de avance)
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const salida = args.shift()
const progreso = JSON.parse(readFileSync(join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json'), 'utf8'))
const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
const nombre = new Map(catalogo.productos.map(p => [p.sku, p.nombre]))
let skus = args.filter(a => !a.startsWith('--'))
const opt = n => (args.includes(n) ? args[args.indexOf(n) + 1] : null)
if (opt('--grupo')) {
  const g = opt('--grupo')
  skus = Object.entries(progreso).filter(([, v]) => v.grupo === g && v.archivo).map(([k]) => k)
  skus = skus.slice(Number(opt('--desde') || 0), Number(opt('--desde') || 0) + Number(opt('--cuantas') || 20))
}
const W = 250, H = 290, COLS = 5
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const celdas = []
for (const [i, sku] of skus.entries()) {
  const x = (i % COLS) * W, y = Math.floor(i / COLS) * H
  try {
    const img = await sharp(join(RAIZ, 'assets', 'productos', `${sku}.webp`)).resize(W - 10, 200, { fit: 'contain', background: '#fff' }).flatten({ background: '#fff' }).png().toBuffer()
    celdas.push({ input: img, left: x + 5, top: y + 5 })
  } catch { /* sin imagen */ }
  const n = String(nombre.get(sku) || '').slice(0, 78)
  const l1 = n.slice(0, 39), l2 = n.slice(39, 78)
  celdas.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="80"><text x="5" y="14" font-size="13" font-family="Arial,sans-serif" font-weight="bold" fill="#00695c">${esc(sku)}</text><text x="5" y="32" font-size="12" font-family="Arial,sans-serif" fill="#000">${esc(l1)}</text><text x="5" y="48" font-size="12" font-family="Arial,sans-serif" fill="#000">${esc(l2)}</text></svg>`), left: x, top: y + 208 })
}
await sharp({ create: { width: COLS * W, height: Math.ceil(skus.length / COLS) * H, channels: 3, background: '#e6e6e6' } }).composite(celdas).png().toFile(salida)
console.log(`${skus.length} fotos → ${salida}`)
