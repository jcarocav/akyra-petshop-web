#!/usr/bin/env node
// ============================================================
// Arma assets/iconos.svg (un "sprite" con todos los íconos del sitio)
// a partir de lucide-static (licencia ISC). Así no se carga ninguna
// librería de íconos desde internet. Uso en HTML:
//   <svg class="icono" aria-hidden="true"><use href="assets/iconos.svg#search"></use></svg>
// Para agregar un ícono: súmalo a ICONOS y corre  npm run iconos
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGEN = join(RAIZ, 'node_modules', 'lucide-static', 'icons')

export const ICONOS = [
  'search', 'message-circle', 'shopping-bag', 'menu', 'x', 'arrow-left', 'arrow-right', 'chevron-down',
  'chevron-left', 'chevron-right', 'life-buoy', 'map-pin', 'scale', 'circle-check', 'sliders-horizontal',
  'minus', 'plus', 'trash-2', 'pause', 'play', 'store', 'truck', 'clock', 'mail', 'phone', 'package',
  'info', 'triangle-alert', 'copy', 'external-link', 'paw-print', 'bone', 'cat', 'dog', 'shirt',
  'heart-pulse', 'sparkles', 'rabbit', 'box', 'map'
]

const simbolos = ICONOS.map(nombre => {
  const svg = readFileSync(join(ORIGEN, `${nombre}.svg`), 'utf8')
  const interior = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '')
    .replace(/\s*\n\s*/g, '').trim()
  return `<symbol id="${nombre}" viewBox="0 0 24 24">${interior}</symbol>`
})

const sprite = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<!-- Íconos: Lucide (lucide.dev), licencia ISC. Generado por tools/construir-iconos.mjs -->
${simbolos.join('\n')}
</svg>
`
writeFileSync(join(RAIZ, 'assets', 'iconos.svg'), sprite)
console.log(`assets/iconos.svg: ${ICONOS.length} íconos`)
