#!/usr/bin/env node
// ============================================================
// Dibuja las decoraciones de temporada en assets/temas/ (SVG livianos, sin librerías).
//   <tema>-guirnalda.svg : tramo de guirnalda que se repite a lo ancho (banderines y figuras)
//   <tema>-hero.svg      : detalle para una esquina de la portada
//   <tema>-pie.svg       : detalle para el pie (solo algunos temas)
// La guirnalda de Fiestas Patrias es la original del sitio (no se dibuja aquí).
// Uso: node tools/temas/construir-temas.mjs
// Las fechas, prioridades y qué archivo usa cada tema están en js/temas-config.mjs.
// ============================================================
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DESTINO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'temas')
const CUERDA = '#3b2f33'

// ---------- Figuras (centradas en 0,0; tamaño aprox. 20 x 20) ----------
const F = {
  patita: c => `<g fill="${c}"><ellipse cx="0" cy="4" rx="5.5" ry="4.5"/><circle cx="-6" cy="-3" r="2.4"/><circle cx="-2.2" cy="-7" r="2.5"/><circle cx="2.2" cy="-7" r="2.5"/><circle cx="6" cy="-3" r="2.4"/></g>`,
  corazon: c => `<path fill="${c}" d="M0 8C-3-1.5-10-.5-10-5.5-10-9.5-5.5-11 -2.6-8.5L0-6.2 2.6-8.5C5.5-11 10-9.5 10-5.5 10-.5 3-1.5 0 8Z"/>`,
  hueso: c => `<g fill="${c}"><rect x="-7" y="-2.2" width="14" height="4.4" rx="2"/><circle cx="-7.5" cy="-2.6" r="2.8"/><circle cx="-7.5" cy="2.6" r="2.8"/><circle cx="7.5" cy="-2.6" r="2.8"/><circle cx="7.5" cy="2.6" r="2.8"/></g>`,
  estrella: c => `<path fill="${c}" d="M0-10 2.9-3.1 10.5-3.1 4.3 1.5 6.7 9 0 4.4-6.7 9-4.3 1.5-10.5-3.1-2.9-3.1Z"/>`,
  calabaza: () => `<g><path d="M-1-9C-1-11 1.5-12.5 3-12" stroke="#3d6b2a" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="-4.5" cy="0" rx="6" ry="8" fill="#e8741c"/><ellipse cx="4.5" cy="0" rx="6" ry="8" fill="#e8741c"/><ellipse cx="0" cy="0" rx="5.5" ry="8.6" fill="#f28a2e"/><path d="M-4-1.5-2-4 0-1.5ZM4-1.5 2-4 0-1.5Z" fill="#5a2a0c"/><path d="M-4.5 3Q0 6.5 4.5 3" stroke="#5a2a0c" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`,
  murcielago: c => `<path fill="${c}" d="M0-3C1.3-5.5 2.4-5.5 3-3 6-6 10-6 12.5-3 10.5-2 9.5 1 10 3 7.5 1.5 5 2.2 3.6 4.5 2.5 3.6 1.2 3.4 0 4.6-1.2 3.4-2.5 3.6-3.6 4.5-5 2.2-7.5 1.5-10 3-9.5 1-10.5-2-12.5-3-10-6-6-6-3-3-2.4-5.5-1.3-5.5 0-3Z"/>`,
  gato: () => `<g fill="#1f1a24"><path d="M-7 10C-9 3-8-3-5-5L-6-11-2-7H2L6-11 5-5C8-3 9 3 7 10Z"/><path d="M7 9C11 9 13 5 11 1" stroke="#1f1a24" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="-2.3" cy="-3.5" r="1.1" fill="#ffd35c"/><circle cx="2.3" cy="-3.5" r="1.1" fill="#ffd35c"/></g>`,
  pez: c => `<g fill="${c}"><ellipse cx="-1" cy="0" rx="7.5" ry="4.5"/><path d="M5.5 0 11-5V5Z"/><circle cx="-4.5" cy="-1" r="1" fill="#fff"/></g>`,
  ovillo: c => `<g><circle r="7" fill="${c}"/><path d="M-6-3Q0 1 6-3M-6.5 1.5Q0 6 6.5 1.5M-3-6.3Q2 0-1 6.8" stroke="#fff" stroke-opacity=".6" stroke-width="1.1" fill="none"/></g>`,
  globo: c => `<g><ellipse cx="0" cy="-3" rx="6" ry="7.5" fill="${c}"/><path d="M-1.4 4.5H1.4L0 6Z" fill="${c}"/><path d="M0 6Q2 9 0 12" stroke="${CUERDA}" stroke-width=".8" fill="none"/><ellipse cx="-2" cy="-6" rx="1.4" ry="2.2" fill="#fff" fill-opacity=".5"/></g>`,
  bola: c => `<g><rect x="-2" y="-9.5" width="4" height="3" rx=".8" fill="#c9a227"/><circle cy="0" r="7" fill="${c}"/><path d="M-6.5 1Q0 4 6.5 1" stroke="#fff" stroke-opacity=".7" stroke-width="1.3" fill="none"/></g>`,
  flor: c => `<g><g fill="${c}"><circle cx="0" cy="-5" r="3.6"/><circle cx="4.8" cy="-1.5" r="3.6"/><circle cx="3" cy="4" r="3.6"/><circle cx="-3" cy="4" r="3.6"/><circle cx="-4.8" cy="-1.5" r="3.6"/></g><circle r="2.6" fill="#ffd35c"/></g>`,
  copa: () => `<g fill="#f2c94c"><path d="M-5-9H5L3 0Q0 3-3 0Z"/><rect x="-.7" y="1" width="1.4" height="6"/><rect x="-4" y="7" width="8" height="1.6" rx=".8"/><circle cx="1.5" cy="-5" r=".9" fill="#fff"/><circle cx="-1.2" cy="-3" r=".7" fill="#fff"/></g>`,
  confeti: c => `<g><rect x="-6" y="-6" width="3" height="5" rx=".6" fill="${c}" transform="rotate(-25)"/><rect x="3" y="-4" width="3" height="5" rx=".6" fill="#ffd35c" transform="rotate(30)"/><circle cx="-1" cy="5" r="1.8" fill="#00b0a3"/></g>`,
  corbata: c => `<g fill="${c}"><path d="M-3-9H3L1.8-6H-1.8Z"/><path d="M-1.8-6H1.8L4 6 0 10-4 6Z"/><path d="M-1.2-2H1.2M-1.8 2H1.8" stroke="#fff" stroke-opacity=".5" stroke-width="1.1"/></g>`
}

const usar = (figura, color, x, y, escala = 1, giro = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${giro}) scale(${escala})">${F[figura](color)}</g>`

// ---------- Guirnalda: cuerda + banderines (y, si corresponde, una figura colgando) ----------
function guirnalda({ colores, figuras = [], colorFigura = [] }) {
  const ancho = 120
  const piezas = []
  piezas.push(`<path d="M0 6Q30 12 60 6T120 6" stroke="${CUERDA}" stroke-width="1.2" fill="none"/>`)
  const posiciones = [15, 45, 75, 105]
  posiciones.forEach((x, i) => {
    const y = 6 + 3 * Math.sin(((x % 60) / 60) * Math.PI)
    const giro = i % 2 ? 6 : -6
    const figura = figuras[i % (figuras.length || 1)]
    if (figura && i % 2 === 1) {
      // figura colgando de un hilo
      piezas.push(`<g transform="translate(${x} ${y}) rotate(${giro})"><path d="M0 0V6" stroke="${CUERDA}" stroke-width=".8"/>${usar(figura, colorFigura[i % colorFigura.length] || colores[0], 0, 17, 0.9)}</g>`)
    } else {
      const color = colores[i % colores.length]
      piezas.push(`<g transform="translate(${x} ${y}) rotate(${giro})"><path d="M-9 0H9L0 22Z" fill="${color}"/><path d="M-9 0H9" stroke="${CUERDA}" stroke-width="1"/></g>`)
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} 36" width="${ancho}" height="36">${piezas.join('')}</svg>\n`
}

// ---------- Detalle de la portada: varias figuras en un recuadro de 160 x 120 ----------
function composicion(elementos, { ancho = 160, alto = 120 } = {}) {
  const cuerpo = elementos.map(([figura, color, x, y, escala, giro]) => usar(figura, color, x, y, escala, giro)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">${cuerpo}</svg>\n`
}

const TEMAS = {
  halloween: {
    guirnalda: guirnalda({ colores: ['#e8741c', '#5b2a86', '#1f1a24'], figuras: ['murcielago', 'calabaza'], colorFigura: ['#1f1a24'] }),
    hero: composicion([
      ['calabaza', null, 112, 92, 2.6, 0], ['gato', null, 58, 88, 2.4, 0],
      ['murcielago', '#1f1a24', 40, 28, 1.6, -10], ['murcielago', '#1f1a24', 120, 22, 1.2, 12], ['patita', '#ffffff', 150, 60, 0.9, 20]
    ]),
    pie: composicion([['gato', null, 30, 40, 2.6, 0], ['calabaza', null, 82, 44, 2, 0]], { ancho: 110, alto: 70 })
  },
  'dia-animal': {
    hero: composicion([['patita', '#ffffff', 40, 40, 2, -15], ['corazon', '#ffd35c', 92, 70, 1.6, 8], ['patita', '#ffffff', 135, 96, 1.4, 20]])
  },
  navidad: {
    guirnalda: guirnalda({ colores: ['#c8102e', '#1e7a46', '#f2c94c'], figuras: ['bola', 'estrella'], colorFigura: ['#c8102e', '#f2c94c'] }),
    hero: composicion([['estrella', '#ffd35c', 120, 26, 2.2, 0], ['bola', '#1e7a46', 50, 70, 2, -8], ['bola', '#ffffff', 98, 88, 1.6, 10], ['patita', '#ffffff', 150, 92, 0.9, 15]])
  },
  'ano-nuevo': {
    guirnalda: guirnalda({ colores: ['#f2c94c', '#00b0a3', '#ffffff'], figuras: ['estrella'], colorFigura: ['#f2c94c'] }),
    hero: composicion([['copa', null, 60, 70, 2.4, -10], ['copa', null, 108, 70, 2.4, 10], ['confeti', '#ffffff', 30, 30, 1.8, 0], ['estrella', '#ffd35c', 140, 26, 1.3, 0]])
  },
  'san-valentin': {
    guirnalda: guirnalda({ colores: ['#ffffff', '#ffb3c7', '#9c1241'], figuras: ['corazon'], colorFigura: ['#ffffff'] }),
    hero: composicion([['corazon', '#ffffff', 60, 52, 2.6, -10], ['corazon', '#ffb3c7', 118, 84, 1.8, 12], ['patita', '#ffffff', 138, 30, 1, 15]])
  },
  'dia-madre': {
    guirnalda: guirnalda({ colores: ['#ffb3c7', '#ffffff', '#ffd35c'], figuras: ['flor'], colorFigura: ['#ffffff'] }),
    hero: composicion([['flor', '#ffffff', 52, 58, 2.6, 0], ['flor', '#ffb3c7', 112, 84, 1.8, 0], ['corazon', '#ffd35c', 128, 30, 1.2, 10]])
  },
  'dia-padre': {
    guirnalda: guirnalda({ colores: ['#1d4e89', '#ffffff', '#ffd35c'], figuras: ['corbata'], colorFigura: ['#1d4e89'] }),
    hero: composicion([['corbata', '#ffffff', 56, 60, 2.6, -8], ['hueso', '#ffd35c', 116, 86, 2, 15], ['patita', '#ffffff', 132, 30, 1.1, 10]])
  },
  'dia-nino': {
    guirnalda: guirnalda({ colores: ['#ffd35c', '#00b0a3', '#ffffff'], figuras: ['globo'], colorFigura: ['#ffd35c', '#ffffff'] }),
    hero: composicion([['globo', '#ffd35c', 50, 50, 2.6, -8], ['globo', '#ffffff', 96, 40, 2.2, 6], ['globo', '#00b0a3', 132, 64, 2, 12]])
  },
  'dia-perro': {
    guirnalda: guirnalda({ colores: ['#ffd35c', '#ffffff', '#00b0a3'], figuras: ['hueso'], colorFigura: ['#ffffff'] }),
    hero: composicion([['hueso', '#ffffff', 60, 70, 3, -20], ['patita', '#ffd35c', 120, 34, 1.8, 15], ['patita', '#ffffff', 136, 92, 1.3, -10]])
  },
  'dia-gato': {
    guirnalda: guirnalda({ colores: ['#ffffff', '#ffd35c', '#00b0a3'], figuras: ['pez', 'ovillo'], colorFigura: ['#ffffff', '#ffd35c'] }),
    hero: composicion([['ovillo', '#ffd35c', 56, 76, 2.8, 0], ['pez', '#ffffff', 118, 40, 2.2, -12], ['patita', '#ffffff', 136, 96, 1.2, 10]])
  }
}

let total = 0
for (const [id, piezas] of Object.entries(TEMAS)) {
  for (const [parte, svg] of Object.entries(piezas)) {
    writeFileSync(join(DESTINO, `${id}-${parte}.svg`), svg)
    total++
  }
}
console.log(`${total} dibujos en ${DESTINO}`)
