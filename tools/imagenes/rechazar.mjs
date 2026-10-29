#!/usr/bin/env node
// Descarta fotos revisadas y malas: pasa el SKU a grupo C ("sin imagen") con el motivo, borra la foto y
// guarda de dónde venía (para no volver a elegirla si se reintenta).
// Uso: node tools/imagenes/rechazar.mjs --motivo "texto" SKU1 SKU2 ...
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RUTA = join(RAIZ, 'tools', 'catalogo', 'fotos-progreso.json')
const args = process.argv.slice(2)
const i = args.indexOf('--motivo')
const motivo = i >= 0 ? args.splice(i, 2)[1] : 'foto descartada en la revisión'
const progreso = JSON.parse(readFileSync(RUTA, 'utf8'))
let n = 0
for (const sku of args) {
  const e = progreso[sku]
  if (!e) { console.log(`(no está en el avance: ${sku})`); continue }
  const archivo = join(RAIZ, 'assets', 'productos', `${sku}.webp`)
  if (existsSync(archivo)) unlinkSync(archivo)
  progreso[sku] = { grupo: 'C', motivo, descartadas: [...(e.descartadas || []), ...(e.origen ? [e.origen] : [])], fecha: new Date().toISOString().slice(0, 10) }
  n++
}
writeFileSync(RUTA, JSON.stringify(progreso, null, 1))
console.log(`${n} fotos descartadas.`)
