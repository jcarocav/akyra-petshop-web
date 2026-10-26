#!/usr/bin/env node
// ============================================================
// Revisa que no haya enlaces ni imágenes rotas en el sitio:
// recorre todas las páginas desde el inicio (linkinator) y además
// comprueba cada imagen de producto declarada en productos.json.
// Los enlaces externos (WhatsApp, Google Maps, redes) no se visitan.
// Uso: npm run enlaces
// ============================================================
import { LinkChecker } from 'linkinator'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUERTO = 4174
const servidor = spawn(process.execPath, [join(RAIZ, 'tools', 'servidor.mjs'), String(PUERTO)], { stdio: 'ignore' })
await new Promise(r => setTimeout(r, 800))

let rotos = []
try {
  const checker = new LinkChecker()
  const resultado = await checker.check({
    path: `http://localhost:${PUERTO}/index.html`,
    recurse: true,
    linksToSkip: [/^https?:\/\/(?!localhost)/, /^mailto:/, /^tel:/],
    concurrency: 8
  })
  rotos = resultado.links.filter(l => l.state === 'BROKEN').map(l => `${l.status} ${l.url} (en ${l.parent})`)
  console.log(`Enlaces revisados: ${resultado.links.length}`)

  // Imágenes de productos y archivos del sitemap
  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
  for (const p of catalogo.productos) {
    if (p.imagen && !existsSync(join(RAIZ, p.imagen))) rotos.push(`imagen faltante: ${p.imagen} (${p.sku})`)
  }
  for (const archivo of ['sitemap.xml', 'robots.txt', 'llms.txt', '.well-known/security.txt', 'stock.json', 'productos.json']) {
    const r = await fetch(`http://localhost:${PUERTO}/${archivo}`)
    if (!r.ok) rotos.push(`${r.status} ${archivo}`)
  }
} finally {
  servidor.kill()
}

if (rotos.length) {
  console.error(`\n${rotos.length} enlaces o imágenes rotas:`)
  for (const r of rotos) console.error('  ' + r)
  process.exit(1)
}
console.log('Sin enlaces ni imágenes rotas.')
