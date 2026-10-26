// ============================================================
// Mensaje del pedido para WhatsApp. Funciones puras (sin tocar la
// página), así se pueden probar solas: tests/unit/whatsapp.spec.mjs
//
// El sitio no puede enviar el mensaje por su cuenta (eso requiere la
// API pagada de WhatsApp Business): arma el texto y abre WhatsApp con
// el mensaje listo; el cliente aprieta "Enviar".
// ============================================================

// Mismo formato que js/utilidades.mjs, repetido acá para que este
// archivo no dependa de nada del navegador.
export function formatoCLP(monto) {
  const n = Math.round(Number(monto) || 0)
  return (n < 0 ? '-$' : '$') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function formatoDecimal(numero) {
  return String(Math.round(Number(numero) * 100) / 100).replace('.', ',')
}

// oxlint-disable-next-line no-control-regex -- se buscan justamente los caracteres de control
const INVISIBLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g

// Limpia un texto para el mensaje: sin caracteres de control ni
// invisibles, sin los símbolos que WhatsApp usa para dar formato
// (* _ ~ `) y con largo máximo. Los saltos de línea solo se permiten
// en campos de varias líneas (comentarios).
export function limpiarCampo(valor, { max = 120, multilinea = false } = {}) {
  let t = String(valor ?? '').replace(INVISIBLES, '').replace(/[*_~`]/g, '')
  if (multilinea) {
    t = t.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).slice(0, 6).join('\n')
  } else {
    t = t.replace(/\s+/g, ' ')
  }
  return t.trim().slice(0, max)
}

export function fechaHora(fecha = new Date()) {
  const d = n => String(n).padStart(2, '0')
  return `${d(fecha.getDate())}-${d(fecha.getMonth() + 1)}-${fecha.getFullYear()} ${d(fecha.getHours())}:${d(fecha.getMinutes())}`
}

export function subtotalLinea(linea) {
  return Math.round(linea.precio * linea.cantidad)
}

export function calcularTotales(lineas, despacho) {
  const productos = lineas.reduce((s, l) => s + subtotalLinea(l), 0)
  const costoDespacho = despacho ? despacho.valor : 0
  return { productos, despacho: costoDespacho, total: productos + costoDespacho }
}

function describirCantidad(linea) {
  return linea.granel ? `${formatoDecimal(linea.cantidad)} kg` : String(linea.cantidad)
}

// lineas: [{ nombre, sku, talla, precio, cantidad, granel }]
// cliente: { nombre, telefono, entrega: 'retiro'|'despacho', sucursal:{nombre,direccion},
//            direccion, zona:{nombre,valor}, pago, comentarios }
export function construirMensaje({ lineas, cliente, tienda = 'Maskotería Akyra', fecha = new Date(), compacto = false }) {
  const despacho = cliente.entrega === 'despacho' ? cliente.zona : null
  const totales = calcularTotales(lineas, despacho)
  const partes = []
  partes.push(`*Nuevo pedido web — ${tienda}*`)
  partes.push(`Fecha: ${fechaHora(fecha)}`)
  partes.push('')
  partes.push(`*Productos (${lineas.length})*`)
  lineas.forEach((l, i) => {
    const nombre = limpiarCampo(l.nombre, { max: 140 }) + (l.talla ? ` (talla ${limpiarCampo(l.talla, { max: 12 })})` : '')
    const unitario = l.granel ? `${formatoCLP(l.precio)} por kg` : `${formatoCLP(l.precio)} c/u`
    if (compacto) {
      partes.push(`${i + 1}. ${describirCantidad(l)} × ${nombre} [${l.sku}] ${unitario} = ${formatoCLP(subtotalLinea(l))}`)
    } else {
      partes.push(`${i + 1}. ${describirCantidad(l)} × ${nombre}`)
      partes.push(`    SKU ${l.sku} · ${unitario} · Subtotal ${formatoCLP(subtotalLinea(l))}`)
    }
  })
  partes.push('')
  partes.push(`Subtotal productos: ${formatoCLP(totales.productos)}`)
  if (despacho) partes.push(`Despacho (${despacho.nombre.toLowerCase()}): ${formatoCLP(despacho.valor)}`)
  partes.push(`*Total: ${formatoCLP(totales.total)}*`)
  partes.push('')
  partes.push('*Datos del cliente*')
  partes.push(`Nombre: ${limpiarCampo(cliente.nombre, { max: 80 })}`)
  partes.push(`Teléfono: ${limpiarCampo(cliente.telefono, { max: 20 })}`)
  if (cliente.entrega === 'despacho') {
    partes.push(`Entrega: Despacho a domicilio (${despacho.nombre.toLowerCase()})`)
    partes.push(`Dirección: ${limpiarCampo(cliente.direccion, { max: 160 })}`)
  } else {
    partes.push(`Entrega: Retiro en sucursal ${cliente.sucursal.nombre} (${cliente.sucursal.direccion})`)
  }
  partes.push(`Método de pago: ${limpiarCampo(cliente.pago, { max: 40 })}`)
  const comentarios = limpiarCampo(cliente.comentarios, { max: 400, multilinea: true })
  partes.push(`Comentarios: ${comentarios ? (comentarios.includes('\n') ? '\n' + comentarios : comentarios) : '(sin comentarios)'}`)
  return partes.join('\n')
}

export function enlaceWhatsapp(numero, texto) {
  const limpio = String(numero).replace(/\D/g, '')
  return `https://wa.me/${limpio}?text=${encodeURIComponent(texto)}`
}

// Algunos teléfonos cortan los enlaces muy largos: sobre este largo se
// usa el formato compacto (una línea por producto).
export const LARGO_MAXIMO_ENLACE = 4000

export function enlacePedido({ numero, ...datos }) {
  let texto = construirMensaje(datos)
  let enlace = enlaceWhatsapp(numero, texto)
  if (enlace.length > LARGO_MAXIMO_ENLACE) {
    texto = construirMensaje({ ...datos, compacto: true })
    enlace = enlaceWhatsapp(numero, texto)
  }
  return { texto, enlace }
}
