#!/usr/bin/env node
// ============================================================
// LOGOS DE MARCAS — baja los logos oficiales (tools/marcas/fuentes.json), los optimiza
// (WebP < 15 KB con alto 96 px, o SVG limpio) y los deja en assets/marcas/ + assets/marcas/marcas.json.
// Las marcas sin logo oficial quedan en el JSON sin "archivo": el sitio muestra su nombre.
//
// Uso: node tools/marcas/construir-logos.mjs
// ============================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '..', '..')
const SALIDA = join(RAIZ, 'assets', 'marcas')
const CACHE = join(RAIZ, '.tmp', 'marcas')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
mkdirSync(SALIDA, { recursive: true })
mkdirSync(CACHE, { recursive: true })

async function original(m) {
  if (m.local) return readFileSync(join(AQUI, m.local))
  const ruta = join(CACHE, `${m.id}.bin`)
  if (existsSync(ruta)) return readFileSync(ruta)
  const r = await fetch(m.url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`${m.url} → ${r.status}`)
  const b = Buffer.from(await r.arrayBuffer())
  writeFileSync(ruta, b)
  return b
}

const lista = JSON.parse(readFileSync(join(AQUI, 'fuentes.json'), 'utf8')).marcas
const salida = []
for (const m of lista) {
  const ficha = { marca: m.marca, id: m.id, fondo: m.fondo === 'oscuro' ? 'oscuro' : 'claro' }
  if (m.local || m.url) {
    const buf = await original(m)
    const esSvg = buf.subarray(0, 400).toString('utf8').includes('<svg')
    if (esSvg) {
      const svg = buf.toString('utf8').replace(/<\?xml[^>]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').trim()
      writeFileSync(join(SALIDA, `${m.id}.svg`), svg)
      const vb = svg.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/)
      ficha.archivo = `${m.id}.svg`; ficha.ancho = Math.round(96 * Number(vb[1]) / Number(vb[2])); ficha.alto = 96
    } else {
      let calidad = 88
      let out
      const base = sharp(buf).trim({ threshold: 12 }).resize({ height: 96, width: 420, fit: 'inside', withoutEnlargement: false })
      do { out = await base.clone().webp({ quality: calidad, alphaQuality: 90, effort: 6 }).toBuffer({ resolveWithObject: true }); calidad -= 8 } while (out.data.length > 15000 && calidad > 30)
      writeFileSync(join(SALIDA, `${m.id}.webp`), out.data)
      ficha.archivo = `${m.id}.webp`; ficha.ancho = out.info.width; ficha.alto = out.info.height
    }
    ficha.origen = m.origen
  }
  salida.push(ficha)
  console.log(ficha.archivo ? `✔ ${m.marca}  ${ficha.archivo} ${ficha.ancho}×${ficha.alto}` : `· ${m.marca}  (sin logo oficial: se muestra el nombre)`)
}
writeFileSync(join(SALIDA, 'marcas.json'), JSON.stringify(salida, null, 2) + '\n')

// Lista del carrusel de marcas del inicio (cada marca lleva al catálogo filtrado por ella)
const esc = t => t.replace(/&/g, "&amp;")
const li = f => {
  const href = `catalogo.html?marca=${encodeURIComponent(f.marca)}`
  const clase = `marca__enlace${f.fondo === 'oscuro' ? ' marca__enlace--oscuro' : ''}`
  if (!f.archivo) return `<li class="marca"><a class="${clase}" href="${href}">${esc(f.marca)}</a></li>`
  return `<li class="marca"><a class="${clase}" href="${href}"><img src="assets/marcas/${f.archivo}" alt="${esc(f.marca)}" width="${f.ancho}" height="${f.alto}" loading="lazy" decoding="async"></a></li>`
}
const rutaIndex = join(RAIZ, 'index.html')
const html = readFileSync(rutaIndex, 'utf8')
const nuevo = html.replace(/(<ul class="cinta__pista">\s*)[\s\S]*?(\s*<\/ul>\s*<\/div>\s*<\/div>\s*<\/section>\s*<\/main>)/, (_, a, b) => `${a}${salida.map(li).join('')}${b}`)
if (nuevo === html) console.log('index.html ya estaba al día')
else { writeFileSync(rutaIndex, nuevo); console.log('index.html: lista de marcas actualizada') }
