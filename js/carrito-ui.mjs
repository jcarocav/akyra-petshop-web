// ============================================================
// CARRITO (panel lateral) — flujo de 2 pasos + confirmación:
//   Paso 1: productos, cantidades y total.
//   Paso 2: datos del cliente, entrega y método de pago.
//   Confirmación: se abrió WhatsApp con el pedido; falta apretar "Enviar".
// ============================================================
import * as carrito from './carrito.mjs'
import { CONFIG, productoPorId, urlProducto } from './datos.mjs'
import { crearDialogo } from './dialogo.mjs'
import { $, $$, almacen, anunciar, formatoCLP, formatoCantidad, formatoDecimal, h, icono, leerNumero, permitirEnvio, textoSeguro } from './utilidades.mjs'
import { calcularTotales, enlacePedido } from './whatsapp.mjs'

const CLAVE_CLIENTE = 'akyra_cliente'
let dialogo = null
let ultimoPedido = null

// ---------- Contador del ícono ----------
function actualizarContador() {
  const n = carrito.totalArticulos()
  const boton = $('#boton-carrito')
  const insignia = $('#contador-carrito')
  if (insignia) {
    insignia.textContent = String(n)
    insignia.hidden = n === 0
  }
  if (boton) boton.setAttribute('aria-label', n === 0 ? 'Carrito, vacío' : `Carrito, ${n} ${n === 1 ? 'producto' : 'productos'}`)
}

// ---------- Paso 1: lista ----------
function filaLinea(l) {
  const nombre = l.nombre + (l.talla ? ` (talla ${l.talla})` : '')
  const producto = productoPorId.get(l.id)
  const minimo = l.granel ? carrito.MIN_GRANEL : 1
  const unidad = l.granel ? 'medio kilo' : 'uno'
  const idCampo = `carrito-cantidad-${l.clave.replace(/[^a-z0-9]/gi, '-')}`
  return h('li', { class: 'linea', 'data-clave': l.clave },
    h('div', { class: 'linea__info' },
      h('a', { class: 'linea__nombre', href: producto ? urlProducto(producto) : '#', text: nombre }),
      h('p', { class: 'linea__detalle' },
        h('span', { text: `SKU ${l.sku}` }),
        h('span', { text: l.granel ? `${formatoCLP(l.precio)} por kg` : `${formatoCLP(l.precio)} c/u` }))
    ),
    h('div', { class: 'linea__controles' },
      h('div', { class: 'cantidad cantidad--compacta' },
        h('label', { class: 'visualmente-oculto', for: idCampo, text: l.granel ? `Kilos de ${nombre}` : `Cantidad de ${nombre}` }),
        h('button', { type: 'button', class: 'cantidad__boton', 'data-linea': 'restar', 'aria-label': `Restar ${unidad} a ${nombre}`, 'aria-disabled': String(l.cantidad <= minimo) }, icono('minus')),
        h('input', { id: idCampo, class: 'cantidad__campo', type: 'text', inputmode: l.granel ? 'decimal' : 'numeric', autocomplete: 'off', 'data-linea': 'campo', value: l.granel ? formatoDecimal(l.cantidad) : String(l.cantidad) }),
        l.granel ? h('span', { class: 'cantidad__unidad', 'aria-hidden': 'true', text: 'kg' }) : null,
        h('button', { type: 'button', class: 'cantidad__boton', 'data-linea': 'sumar', 'aria-label': `Sumar ${unidad} a ${nombre}`, 'aria-disabled': String(l.tope !== null && l.cantidad >= l.tope) }, icono('plus'))
      ),
      h('p', { class: 'linea__subtotal' }, h('span', { class: 'visualmente-oculto', text: 'Subtotal: ' }), formatoCLP(l.precio * l.cantidad)),
      h('button', { type: 'button', class: 'linea__quitar', 'data-linea': 'quitar', 'aria-label': `Quitar ${nombre} del carrito` }, icono('trash-2'))
    ),
    l.tope !== null && l.cantidad >= l.tope
      ? h('p', { class: 'linea__aviso', text: `Máximo disponible: ${formatoCantidad(l.tope, l.granel)}.` })
      : null
  )
}

function pintarCarrito() {
  const lineas = carrito.obtenerLineas()
  const lista = $('#carrito-lista')
  if (!lista) return
  // Recordar qué control tenía el foco para devolverlo tras redibujar
  const activo = document.activeElement
  const claveActiva = activo?.closest?.('[data-clave]')?.dataset.clave
  const controlActivo = activo?.dataset?.linea

  lista.replaceChildren(...lineas.map(filaLinea))
  const vacio = lineas.length === 0
  $('#carrito-vacio').hidden = !vacio
  $('#carrito-resumen').hidden = vacio
  $('#carrito-continuar').hidden = vacio
  $('#carrito-subtotal').textContent = formatoCLP(carrito.totalProductos())
  actualizarContador()
  pintarTotalesPedido()

  if (claveActiva && controlActivo) {
    const fila = lista.querySelector(`[data-clave="${CSS.escape(claveActiva)}"]`)
    const destino = fila?.querySelector(`[data-linea="${controlActivo}"]`)
    if (destino) destino.focus({ preventScroll: true })
    else if (controlActivo === 'quitar') (lista.querySelector('[data-linea="quitar"]') || $('#carrito-titulo')).focus()
  }
  // Si se vació el carrito estando en el paso 2, se vuelve al paso 1
  if (vacio && !$('#carrito-paso-2').hidden) mostrarPaso(1)
}

function activarLista() {
  const lista = $('#carrito-lista')
  lista.addEventListener('click', e => {
    const boton = e.target.closest('button[data-linea]')
    if (!boton) return
    const clave = boton.closest('[data-clave]').dataset.clave
    const linea = carrito.obtenerLineas().find(l => l.clave === clave)
    if (!linea) return
    const accion = boton.dataset.linea
    if (accion === 'quitar') {
      carrito.quitar(clave)
      anunciar(`${linea.nombre} quitado del carrito. Total: ${formatoCLP(carrito.totalProductos())}.`)
      return
    }
    if (boton.getAttribute('aria-disabled') === 'true') {
      if (accion === 'sumar') anunciar('Máximo disponible.')
      return
    }
    const paso = linea.granel ? carrito.PASO_GRANEL : 1
    const nueva = carrito.cambiarCantidad(clave, linea.cantidad + (accion === 'sumar' ? paso : -paso))
    anunciar(`${formatoCantidad(nueva.cantidad, nueva.granel)} × ${nueva.nombre}. Total: ${formatoCLP(carrito.totalProductos())}.`)
  })
  const confirmar = campo => {
    const clave = campo.closest('[data-clave]').dataset.clave
    const linea = carrito.obtenerLineas().find(l => l.clave === clave)
    const n = leerNumero(campo.value)
    const nueva = carrito.cambiarCantidad(clave, Number.isNaN(n) ? linea.cantidad : n)
    if (nueva) anunciar(`${formatoCantidad(nueva.cantidad, nueva.granel)} × ${nueva.nombre}. Total: ${formatoCLP(carrito.totalProductos())}.`)
  }
  lista.addEventListener('change', e => { if (e.target.matches('[data-linea="campo"]')) confirmar(e.target) })
  lista.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('[data-linea="campo"]')) { e.preventDefault(); confirmar(e.target) }
  })
}

// ---------- Pasos ----------
function mostrarPaso(n) {
  for (const i of [1, 2, 3]) $(`#carrito-paso-${i}`).hidden = i !== n
  $('#carrito-titulo').textContent = n === 1 ? 'Tu carrito' : n === 2 ? 'Tus datos' : 'Pedido listo'
  const indicador = $('#carrito-indicador')
  if (indicador) indicador.textContent = n === 3 ? '' : `Paso ${n} de 2`
  if (dialogo?.abierto) $('#carrito-titulo').focus({ preventScroll: true })
}

// ---------- Paso 2: formulario ----------
function leerCliente() {
  const form = $('#form-pedido')
  const entrega = form.querySelector('[name="entrega"]:checked')?.value || 'retiro'
  const sucursal = CONFIG.sucursales.find(s => s.id === $('#pedido-sucursal').value) || null
  const zonaId = form.querySelector('[name="zona"]:checked')?.value || ''
  return {
    nombre: textoSeguro($('#pedido-nombre').value, 80),
    telefono: textoSeguro($('#pedido-telefono').value, 20),
    entrega,
    sucursal,
    direccion: textoSeguro($('#pedido-direccion').value, 160),
    zonaId,
    zona: CONFIG.despacho[zonaId] || null,
    pago: form.querySelector('[name="pago"]:checked')?.value || '',
    comentarios: textoSeguro($('#pedido-comentarios').value, 400, { multilinea: true })
  }
}

function guardarCliente() {
  const c = leerCliente()
  almacen.guardar(CLAVE_CLIENTE, {
    nombre: c.nombre, telefono: c.telefono, entrega: c.entrega, sucursal: c.sucursal?.id || '',
    direccion: c.direccion, zona: c.zonaId, pago: c.pago
  }, true)
}

function restaurarCliente() {
  const c = almacen.leer(CLAVE_CLIENTE, null, true)
  if (!c || typeof c !== 'object') return
  const poner = (sel, v) => { const el = $(sel); if (el && typeof v === 'string') el.value = v.slice(0, Number(el.maxLength) > 0 ? el.maxLength : 200) }
  poner('#pedido-nombre', c.nombre)
  poner('#pedido-telefono', c.telefono)
  poner('#pedido-direccion', c.direccion)
  if (CONFIG.sucursales.some(s => s.id === c.sucursal)) $('#pedido-sucursal').value = c.sucursal
  const marcar = (nombre, valor) => {
    const r = $$(`#form-pedido [name="${nombre}"]`).find(x => x.value === valor)
    if (r) r.checked = true
  }
  marcar('entrega', c.entrega)
  marcar('zona', c.zona)
  marcar('pago', c.pago)
}

function sincronizarEntrega() {
  const despacho = $('#form-pedido [name="entrega"]:checked')?.value === 'despacho'
  $('#bloque-retiro').hidden = despacho
  $('#bloque-despacho').hidden = !despacho
  $('#nota-pago-despacho').hidden = !despacho
  pintarTotalesPedido()
}

function pintarTotalesPedido() {
  const c = $('#form-pedido') ? leerCliente() : null
  const despacho = c && c.entrega === 'despacho' ? c.zona : null
  const t = calcularTotales(carrito.obtenerLineas(), despacho)
  const poner = (sel, v) => { const el = $(sel); if (el) el.textContent = v }
  poner('#pedido-subtotal', formatoCLP(t.productos))
  poner('#pedido-despacho', c && c.entrega === 'despacho' ? (despacho ? formatoCLP(despacho.valor) : 'Elige la zona') : 'Gratis (retiro)')
  poner('#pedido-total', formatoCLP(t.total))
}

const REGLAS = [
  { campo: '#pedido-nombre', validar: c => c.nombre.length >= 2, mensaje: 'Escribe tu nombre.' },
  { campo: '#pedido-telefono', validar: c => /^\+?[\d\s-]{8,16}$/.test(c.telefono) && c.telefono.replace(/\D/g, '').length >= 8, mensaje: 'Escribe un teléfono válido (por ejemplo +56 9 1234 5678).' },
  { campo: '#pedido-sucursal', si: c => c.entrega === 'retiro', validar: c => !!c.sucursal, mensaje: 'Elige la sucursal de retiro.' },
  { campo: '#pedido-direccion', si: c => c.entrega === 'despacho', validar: c => c.direccion.length >= 5, mensaje: 'Escribe la dirección de despacho.' },
  { campo: '#zona-urbano', grupo: '#grupo-zona', si: c => c.entrega === 'despacho', validar: c => !!c.zona, mensaje: 'Elige la zona de despacho.' },
  { campo: '#pago-0', grupo: '#grupo-pago', validar: c => !!c.pago, mensaje: 'Elige el método de pago.' }
]

function limpiarErrores() {
  $$('#form-pedido [aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'))
  $$('#form-pedido .campo__error').forEach(el => { el.textContent = ''; el.hidden = true })
  const resumen = $('#pedido-errores')
  resumen.hidden = true
  resumen.replaceChildren()
}

function validar(cliente) {
  limpiarErrores()
  const errores = REGLAS.filter(r => (!r.si || r.si(cliente)) && !r.validar(cliente))
  for (const r of errores) {
    const objetivo = r.grupo ? $(r.grupo) : $(r.campo)
    if (!r.grupo) objetivo.setAttribute('aria-invalid', 'true')
    const msg = $(`${r.grupo || r.campo}-error`)
    if (msg) { msg.textContent = r.mensaje; msg.hidden = false }
  }
  if (errores.length) {
    const resumen = $('#pedido-errores')
    resumen.append(h('p', { text: errores.length === 1 ? 'Falta 1 dato:' : `Faltan ${errores.length} datos:` }),
      h('ul', {}, errores.map(r => h('li', {}, h('a', { href: r.campo, text: r.mensaje })))))
    resumen.hidden = false
    anunciar(`No se pudo enviar. ${errores.map(r => r.mensaje).join(' ')}`, { urgente: true })
    $(errores[0].campo).focus()
  }
  return errores.length === 0
}

function enviarPedido(e) {
  e.preventDefault()
  const form = e.currentTarget
  if (form.querySelector('[name="sitio_web"]').value) return // trampa para robots: se ignora en silencio
  const lineas = carrito.obtenerLineas()
  if (!lineas.length) { mostrarPaso(1); return }
  const cliente = leerCliente()
  if (!validar(cliente)) return
  const permiso = permitirEnvio('akyra_envios_pedido', { maximo: 5, separacionMs: 5000 })
  if (!permiso.ok) {
    const resumen = $('#pedido-errores')
    resumen.replaceChildren(h('p', { text: permiso.motivo }))
    resumen.hidden = false
    anunciar(permiso.motivo, { urgente: true })
    return
  }
  ultimoPedido = enlacePedido({ numero: CONFIG.whatsappTienda, lineas, cliente, tienda: CONFIG.nombreTienda })
  $('#pedido-enlace').href = ultimoPedido.enlace
  window.open(ultimoPedido.enlace, '_blank', 'noopener')
  mostrarPaso(3)
}

async function copiarPedido() {
  if (!ultimoPedido) return
  const estado = $('#pedido-copiado')
  try {
    await navigator.clipboard.writeText(ultimoPedido.texto)
    estado.textContent = 'Pedido copiado. Puedes pegarlo en WhatsApp.'
  } catch {
    estado.textContent = 'No se pudo copiar automáticamente. Usa el botón "Abrir WhatsApp".'
  }
}

// ---------- Toast ----------
let temporizadorToast = null
export function mostrarAviso(mensaje) {
  const toast = $('#toast')
  if (!toast) return anunciar(mensaje)
  $('#toast-texto').textContent = mensaje
  toast.classList.add('visible')
  clearTimeout(temporizadorToast)
  temporizadorToast = setTimeout(() => toast.classList.remove('visible'), 3200)
  const boton = $('#boton-carrito')
  boton?.classList.remove('rebote')
  void boton?.offsetWidth
  boton?.classList.add('rebote')
}

export function abrirCarrito(origen) {
  mostrarPaso(1)
  dialogo.abrir(origen, { enfocar: $('#carrito-titulo') })
}

export function iniciarCarrito() {
  const panel = $('#carrito')
  if (!panel) return
  dialogo = crearDialogo(panel, { fondo: $('#carrito-fondo') })
  restaurarCliente()
  sincronizarEntrega()
  activarLista()
  pintarCarrito()
  carrito.suscribir(pintarCarrito)

  $('#boton-carrito')?.addEventListener('click', e => abrirCarrito(e.currentTarget))
  $('#carrito-cerrar').addEventListener('click', () => dialogo.cerrar())
  $('#carrito-seguir').addEventListener('click', () => dialogo.cerrar())
  $('#carrito-vacio-seguir')?.addEventListener('click', () => dialogo.cerrar())
  $('#carrito-continuar').addEventListener('click', () => { mostrarPaso(2); pintarTotalesPedido() })
  $('#carrito-volver').addEventListener('click', () => mostrarPaso(1))
  $('#pedido-volver-tienda').addEventListener('click', () => dialogo.cerrar())
  $('#pedido-vaciar').addEventListener('click', () => {
    carrito.vaciar()
    anunciar('Carrito vaciado.')
    dialogo.cerrar()
  })
  $('#pedido-copiar').addEventListener('click', copiarPedido)

  const form = $('#form-pedido')
  form.addEventListener('submit', enviarPedido)
  // El mensaje de error de un campo se quita mientras se corrige (al escribir o
  // elegir), nunca al salir del campo: si se quitara al salir, el formulario se
  // movería justo cuando la persona hace clic más abajo y el clic se perdería.
  const quitarError = el => {
    const objetivo = el.type === 'radio' ? el.closest('fieldset') : el
    if (!objetivo) return
    if (objetivo.getAttribute('aria-invalid') === 'true') objetivo.removeAttribute('aria-invalid')
    const msg = $(`#${objetivo.id}-error`)
    if (msg && !msg.hidden) msg.hidden = true
  }
  form.addEventListener('input', e => {
    if (e.target.matches('input[type="text"], input[type="tel"], textarea')) quitarError(e.target)
    guardarCliente()
    pintarTotalesPedido()
  })
  form.addEventListener('change', e => {
    if (e.target.name === 'entrega') sincronizarEntrega()
    if (e.target.matches('select, input[type="radio"]')) quitarError(e.target)
    guardarCliente()
    pintarTotalesPedido()
  })
  $('#pedido-errores').addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]')
    if (!a) return
    e.preventDefault()
    $(a.getAttribute('href'))?.focus()
  })
}
