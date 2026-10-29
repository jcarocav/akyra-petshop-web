#!/usr/bin/env node
// Arma la galería de revisión de fotos nuevas: ../comparar/fotos-datos.json (lo lee ../comparar/revisar-fotos.html).
// Lleva el código de barras (dato interno): el archivo queda fuera del repositorio, en la carpeta de comparación.
// Uso: node tools/imagenes/galeria.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIAS } from '../catalogo/reglas.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SALIDA = resolve(RAIZ, '..', 'comparar', 'fotos-datos.json')
const progreso = JSON.parse(readFileSync(join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json'), 'utf8'))
const catalogo = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
const interno = new Map(internos.map(i => [i.sku, i]))
const nombreCategoria = new Map(CATEGORIAS.map(c => [c.id, c.nombre]))
const items = []
for (const p of catalogo.productos) {
  const e = progreso[p.sku]
  if (!e || !e.archivo || !existsSync(join(RAIZ, e.archivo))) continue
  const i = interno.get(p.sku) || interno.get(p.tallas?.[0]?.sku)
  items.push({
    sku: p.sku, nombre: p.nombre, marca: p.marca, codigo: i?.codigo || '', categoria: nombreCategoria.get(p.categoria) || p.categoria,
    grupo: e.grupo, archivo: e.archivo, titulo: e.titulo || '', pagina: e.pagina || '', origen: e.origen || '', motivo: e.motivo || ''
  })
}
writeFileSync(SALIDA, JSON.stringify({ generado: new Date().toISOString(), items }))
console.log(`Galería: ${items.length} fotos nuevas → ${SALIDA}`)
