#!/usr/bin/env node
// ============================================================
// Servidor local para probar el sitio: npm run servidor
// (o doble clic en VER-SITIO.bat). Abre http://localhost:8080
//
// Imita a GitHub Pages: archivos estáticos, compresión gzip y caché
// corta (10 minutos). No necesita instalar nada más que Node.
// ============================================================
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PUERTO = Number(process.env.PORT || process.argv[2] || 8080)

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
}
const COMPRIMIBLES = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.xml', '.webmanifest'])
// Carpetas que existen en el repositorio pero no son parte del sitio
const PRIVADAS = ['node_modules', '.git', '.tmp', 'tests', 'tools', '.claude', 'test-results', 'playwright-report']

const servidor = createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    // Igual que en GitHub Pages, el sitio también responde bajo /akyra-petshop-web/
    let ruta = decodeURIComponent(url.pathname).replace(/^\/akyra-petshop-web(?=\/|$)/, '') || '/'
    if (ruta.endsWith('/')) ruta += 'index.html'
    const archivo = normalize(join(RAIZ, ruta))
    const relativa = archivo.slice(RAIZ.length + 1).split(sep)
    if (!archivo.startsWith(RAIZ + sep) || PRIVADAS.includes(relativa[0]) || relativa.some(p => p.startsWith('.') && p !== '.well-known')) {
      return enviarError(res, 404)
    }
    if (!existsSync(archivo) || !statSync(archivo).isFile()) return enviarError(res, 404)

    const ext = extname(archivo).toLowerCase()
    const cabeceras = {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache', // en local, siempre la última versión (GitHub Pages usa 10 min)
      'X-Content-Type-Options': 'nosniff'
    }
    const aceptaGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '')
    if (COMPRIMIBLES.has(ext) && aceptaGzip) {
      res.writeHead(200, { ...cabeceras, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' })
      if (req.method === 'HEAD') return res.end()
      createReadStream(archivo).pipe(createGzip()).pipe(res)
    } else {
      res.writeHead(200, { ...cabeceras, 'Content-Length': statSync(archivo).size })
      if (req.method === 'HEAD') return res.end()
      createReadStream(archivo).pipe(res)
    }
  } catch {
    enviarError(res, 400)
  }
})

function enviarError(res, codigo) {
  const pagina404 = join(RAIZ, '404.html')
  if (codigo === 404 && existsSync(pagina404)) {
    res.writeHead(404, { 'Content-Type': TIPOS['.html'] })
    return createReadStream(pagina404).pipe(res)
  }
  res.writeHead(codigo, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(codigo === 404 ? 'No encontrado' : 'Solicitud no válida')
}

servidor.listen(PUERTO, () => {
  console.log(`Sitio de Maskotería Akyra en http://localhost:${PUERTO}  (Ctrl+C para detener)`)
})
