#!/usr/bin/env node
// ============================================================
// Arma la carpeta que clasp sube a Google Apps Script (.tmp/clasp/):
//   - apps-script/*.js y appsscript.json (código del repositorio)
//   - vendor: SheetJS 0.20.3 (para leer xlsx sin pedir permiso de Drive)
//   - CatalogoInicial.js: el catálogo (SKU, código de barras, nombre, precio,
//     stock) para la primera carga de la hoja "Stock". Se genera desde el
//     Excel y NO se guarda en el repositorio.
// Uso: npm run catalogo && node tools/stock/preparar-apps-script.mjs
// ============================================================
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIAS } from '../catalogo/reglas.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DESTINO = join(RAIZ, '.tmp', 'clasp')
mkdirSync(DESTINO, { recursive: true })

for (const f of readdirSync(join(RAIZ, 'apps-script'))) {
  if (/\.(js|json)$/.test(f)) copyFileSync(join(RAIZ, 'apps-script', f), join(DESTINO, f))
}
copyFileSync(join(RAIZ, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js'), join(DESTINO, '00_xlsx.js'))

const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
const nombreCategoria = new Map(CATEGORIAS.map(c => [c.id, c.nombre]))
const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
const catalogo = internos.map(p => ({
  sku: p.sku, codigo: p.codigo, nombre: p.nombre, marca: p.marca, categoria: nombreCategoria.get(p.categoria) || '',
  precio: p.precio, unidades: stock.unidades[p.sku] ?? null, actualizado: stock.actualizado
}))
writeFileSync(join(DESTINO, 'CatalogoInicial.js'), `// Generado por tools/stock/preparar-apps-script.mjs (no está en el repositorio)\nvar CATALOGO_INICIAL = ${JSON.stringify(catalogo)}\n`)
if (!existsSync(join(DESTINO, '.claspignore'))) writeFileSync(join(DESTINO, '.claspignore'), '.clasp.json\n')
console.log(`Carpeta para clasp lista: ${DESTINO} (${catalogo.length} productos en el catálogo inicial)`)
