// ============================================================
// Utilidades compartidas: formato de números, limpieza de texto y
// creación de elementos SIN innerHTML (todo el texto entra con
// textContent, así nada de lo que escribe el usuario se interpreta
// como HTML).
// ============================================================

export const $ = (selector, raiz = document) => raiz.querySelector(selector)
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)]

// $12.345 (formato chileno, sin depender del idioma del navegador)
export function formatoCLP(monto) {
  const n = Math.round(Number(monto) || 0)
  const miles = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (n < 0 ? '-$' : '$') + miles
}

// 1.5 → "1,5"   2 → "2"
export function formatoDecimal(numero) {
  const r = Math.round(Number(numero) * 100) / 100
  return String(r).replace('.', ',')
}

export function formatoCantidad(cantidad, granel) {
  return granel ? `${formatoDecimal(cantidad)} kg` : String(cantidad)
}

export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Quita caracteres de control e invisibles (incluidos los que invierten
// la dirección del texto) y recorta al largo máximo.
// oxlint-disable-next-line no-control-regex -- se buscan justamente los caracteres de control
const INVISIBLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g
export function textoSeguro(valor, max = 200, { multilinea = false } = {}) {
  let t = String(valor ?? '').replace(INVISIBLES, '')
  t = multilinea ? t.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n') : t.replace(/\s+/g, ' ')
  return t.trim().slice(0, max)
}

// Interpreta "1,5" o "1.5" o "2" → número (o NaN)
export function leerNumero(texto) {
  const t = String(texto ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN
  return Number(t)
}

// Crea un elemento: h('a', { href: '#', class: 'x', text: 'Hola' }, hijo1, hijo2)
export function h(etiqueta, props = {}, ...hijos) {
  const el = document.createElement(etiqueta)
  for (const [clave, valor] of Object.entries(props || {})) {
    if (valor === null || valor === undefined || valor === false) continue
    if (clave === 'class') el.className = valor
    else if (clave === 'text') el.textContent = valor
    else if (clave === 'dataset') Object.assign(el.dataset, valor)
    else if (clave.startsWith('on') && typeof valor === 'function') el.addEventListener(clave.slice(2), valor)
    else el.setAttribute(clave, valor === true ? '' : String(valor))
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)))
  }
  return el
}

const SVG = 'http://www.w3.org/2000/svg'
export function icono(nombre, clase = '') {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('class', `icono ${clase}`.trim())
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const use = document.createElementNS(SVG, 'use')
  use.setAttribute('href', `assets/iconos.svg#${nombre}`)
  svg.append(use)
  return svg
}

// Mensajes para lectores de pantalla (región aria-live del pie de página).
let temporizadorAnuncio = null
export function anunciar(mensaje, { urgente = false } = {}) {
  const region = document.getElementById(urgente ? 'anuncios-urgentes' : 'anuncios')
  if (!region) return
  region.textContent = ''
  clearTimeout(temporizadorAnuncio)
  // Pequeña pausa para que se anuncie aunque el texto sea el mismo de antes
  temporizadorAnuncio = setTimeout(() => { region.textContent = mensaje }, 60)
}

export function debounce(fn, ms = 250) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

export const reducirMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// localStorage puede fallar (modo privado, almacenamiento lleno): nunca rompe la página.
export const almacen = {
  leer(clave, porDefecto = null, sesion = false) {
    try {
      const crudo = (sesion ? sessionStorage : localStorage).getItem(clave)
      return crudo === null ? porDefecto : JSON.parse(crudo)
    } catch {
      return porDefecto
    }
  },
  guardar(clave, valor, sesion = false) {
    try { (sesion ? sessionStorage : localStorage).setItem(clave, JSON.stringify(valor)) } catch { /* sin almacenamiento */ }
  },
  borrar(clave, sesion = false) {
    try { (sesion ? sessionStorage : localStorage).removeItem(clave) } catch { /* sin almacenamiento */ }
  }
}

// Límite de envíos por tiempo (anti-spam del lado del navegador).
export function permitirEnvio(clave, { maximo = 3, ventanaMs = 10 * 60 * 1000, separacionMs = 8000 } = {}) {
  const ahora = Date.now()
  const historial = (almacen.leer(clave, []) || []).filter(t => typeof t === 'number' && ahora - t < ventanaMs)
  const ultimo = historial[historial.length - 1]
  if (historial.length >= maximo) return { ok: false, motivo: 'Ya enviaste varios mensajes seguidos. Espera unos minutos y vuelve a intentarlo.' }
  if (ultimo && ahora - ultimo < separacionMs) return { ok: false, motivo: 'Espera unos segundos antes de volver a enviar.' }
  historial.push(ahora)
  almacen.guardar(clave, historial)
  return { ok: true }
}
