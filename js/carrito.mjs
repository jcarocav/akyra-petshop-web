// ============================================================
// CARRITO — se guarda en el navegador (localStorage) para que no se
// pierda al recargar ni al cambiar de página. Lo guardado NUNCA se usa
// tal cual: al cargar, cada línea se vuelve a armar con los datos del
// catálogo (nombre, precio, tope), y lo que no calza se descarta.
// ============================================================
import { productoPorId, variante } from './datos.mjs'
import { almacen } from './utilidades.mjs'

const CLAVE = 'akyra_carrito_v2'
const MAX_LINEAS = 80
export const MIN_GRANEL = 0.1
export const PASO_GRANEL = 0.1
const MAX_SIN_TOPE = 99
const MAX_GRANEL_SIN_TOPE = 50

const oyentes = new Set()
let lineas = cargar()
// Se reescribe lo guardado ya limpio (sin productos agotados, inexistentes ni datos alterados)
almacen.guardar(CLAVE, lineas.map(l => ({ id: l.id, talla: l.talla, cantidad: l.cantidad })))

export function claveLinea(id, talla) {
  return talla ? `${id}|${talla}` : id
}

// Cantidad válida para un producto: unidades enteras (mín. 1) o kilos con hasta 3 decimales
// (gramos; mín. 0,1 kg), nunca sobre el tope de stock.
// Los botones − y + mueven de a 0,1 kg (PASO_GRANEL).
export function ajustarCantidad(cantidad, { granel, tope }) {
  const minimo = granel ? MIN_GRANEL : 1
  const maximo = tope ?? (granel ? MAX_GRANEL_SIN_TOPE : MAX_SIN_TOPE)
  let n = Number(cantidad)
  if (!Number.isFinite(n)) n = minimo
  n = granel ? Math.round(n * 1000) / 1000 : Math.round(n)
  return Math.min(Math.max(n, minimo), Math.max(maximo, minimo))
}

// Interpreta lo que se escribió a mano en un campo de kilos ("1,3", "1.3", "0,250").
// Devuelve { n, aviso }: n es la cantidad válida más cercana (null si no era un número: se deja la anterior)
// y aviso explica lo que se corrigió (o null si estaba bien).
export function interpretarKilos(texto, { tope = null } = {}) {
  const t = String(texto ?? '').trim().replace(',', '.')
  if (!/^[+-]?\d+(\.\d*)?$|^[+-]?\.\d+$/.test(t)) {
    return { n: null, aviso: `“${String(texto).trim().slice(0, 20)}” no es una cantidad válida. Escribe los kilos con números, por ejemplo 1,3.` }
  }
  const valor = Number(t)
  const maximo = tope ?? MAX_GRANEL_SIN_TOPE
  if (valor <= 0) return { n: MIN_GRANEL, aviso: 'La cantidad mínima es 0,1 kg.' }
  if (valor > maximo) return { n: maximo, aviso: tope === null ? `La cantidad máxima por pedido es ${MAX_GRANEL_SIN_TOPE} kg.` : `Máximo disponible: ${String(tope).replace('.', ',')} kg.` }
  const redondeado = Math.round(valor * 1000) / 1000
  if (redondeado !== valor) return { n: Math.max(redondeado, MIN_GRANEL), aviso: 'Usamos hasta 3 decimales (gramos).' }
  return { n: Math.max(valor, MIN_GRANEL), aviso: null }
}

function armarLinea(id, talla, cantidad) {
  const producto = productoPorId.get(id)
  if (!producto || producto.visible === false) return null // agotado: sale del carrito
  const v = variante(producto, talla)
  if (!v || !v.visible || typeof v.precio !== 'number') return null
  const granel = !!producto.granel
  return {
    clave: claveLinea(id, v.talla),
    id,
    sku: v.sku,
    nombre: producto.nombre,
    talla: v.talla,
    precio: v.precio,
    granel,
    tope: v.tope,
    imagen: producto.imagen || null,
    cantidad: ajustarCantidad(cantidad, { granel, tope: v.tope })
  }
}

function cargar() {
  const guardado = almacen.leer(CLAVE, [])
  if (!Array.isArray(guardado)) return []
  const vistas = new Set()
  const resultado = []
  for (const item of guardado.slice(0, MAX_LINEAS)) {
    if (!item || typeof item.id !== 'string' || item.id.length > 80) continue
    const talla = typeof item.talla === 'string' && item.talla.length <= 12 ? item.talla : null
    const linea = armarLinea(item.id, talla, item.cantidad)
    if (!linea || vistas.has(linea.clave)) continue
    vistas.add(linea.clave)
    resultado.push(linea)
  }
  return resultado
}

function guardar() {
  // Solo se guarda lo mínimo; el resto se reconstruye desde el catálogo.
  almacen.guardar(CLAVE, lineas.map(l => ({ id: l.id, talla: l.talla, cantidad: l.cantidad })))
  oyentes.forEach(fn => fn(obtenerLineas()))
}

export function obtenerLineas() {
  return lineas.map(l => ({ ...l }))
}

export function suscribir(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

// Devuelve { ok, linea, cantidadAgregada, limitado, motivo }
export function agregar(id, talla, cantidad) {
  const nueva = armarLinea(id, talla, cantidad)
  if (!nueva) return { ok: false, motivo: 'Este producto no se puede agregar.' }
  const existente = lineas.find(l => l.clave === nueva.clave)
  const pedida = Number(cantidad)
  if (existente) {
    const antes = existente.cantidad
    existente.cantidad = ajustarCantidad(antes + pedida, existente)
    const agregada = Math.round((existente.cantidad - antes) * 1000) / 1000
    guardar()
    return { ok: agregada > 0, linea: { ...existente }, cantidadAgregada: agregada, limitado: agregada < pedida, motivo: agregada > 0 ? null : 'Ya tienes en el carrito el máximo disponible.' }
  }
  if (lineas.length >= MAX_LINEAS) return { ok: false, motivo: 'El carrito está lleno.' }
  lineas.push(nueva)
  guardar()
  return { ok: true, linea: { ...nueva }, cantidadAgregada: nueva.cantidad, limitado: nueva.cantidad < pedida }
}

export function cambiarCantidad(clave, cantidad) {
  const linea = lineas.find(l => l.clave === clave)
  if (!linea) return null
  linea.cantidad = ajustarCantidad(cantidad, linea)
  guardar()
  return { ...linea }
}

export function quitar(clave) {
  lineas = lineas.filter(l => l.clave !== clave)
  guardar()
}

export function vaciar() {
  lineas = []
  guardar()
}

// Cantidad para el ícono del carrito: unidades, y cada producto a granel cuenta como 1.
export function totalArticulos() {
  return lineas.reduce((s, l) => s + (l.granel ? 1 : l.cantidad), 0)
}

export function totalProductos() {
  return lineas.reduce((s, l) => s + Math.round(l.precio * l.cantidad), 0)
}

// Otra pestaña cambió el carrito: se recarga.
window.addEventListener('storage', e => {
  if (e.key !== CLAVE) return
  lineas = cargar()
  oyentes.forEach(fn => fn(obtenerLineas()))
})
