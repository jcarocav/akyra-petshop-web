// ============================================================
// COMPONENTES: card de producto, selector de talla y selector de
// cantidad (− número +) con el botón "Añadir". Los mismos se usan en
// el catálogo, en los destacados del inicio y en la ficha de producto.
// El comportamiento va "delegado" en el documento (activarCompra), así
// funciona también con las cards que se agregan después.
// ============================================================
import * as carrito from './carrito.mjs'
import {
  CONFIG, preciosDe, precioMinimo, productoPorId, sinPrecio, textoAlternativo, urlProducto, variante
} from './datos.mjs'
import { estadoStock } from './stock.mjs'
import { anunciar, formatoCLP, formatoCantidad, formatoDecimal, h, icono, leerNumero } from './utilidades.mjs'

let contador = 0
const nuevoId = prefijo => `${prefijo}-${++contador}`

// ---------- Imagen o placeholder ----------
export function imagenProducto(producto, { prioridad = false, tamano = 400 } = {}) {
  const alt = textoAlternativo(producto)
  if (producto.imagen) {
    return h('img', {
      src: producto.imagen,
      alt,
      width: tamano,
      height: tamano,
      loading: prioridad ? 'eager' : 'lazy',
      decoding: 'async',
      fetchpriority: prioridad ? 'high' : null,
      class: 'producto-foto'
    })
  }
  return h('div', { class: 'foto-pendiente', role: 'img', 'aria-label': `${alt} (foto no disponible)` },
    h('img', { src: 'assets/logo/logo-akyra-recortado.svg', alt: '', width: 976, height: 330, class: 'foto-pendiente__logo', loading: 'lazy' }),
    h('span', { class: 'foto-pendiente__texto', 'aria-hidden': 'true', text: producto.nombre })
  )
}

// ---------- Precio ----------
function textoPrecio(producto, talla) {
  if (producto.granel) return { principal: formatoCLP(producto.precio), sufijo: ' por kg' }
  if (talla) {
    const v = variante(producto, talla)
    return v && typeof v.precio === 'number' ? { principal: formatoCLP(v.precio), sufijo: '' } : null
  }
  const precios = preciosDe(producto)
  if (!precios.length) return null
  const distintos = new Set(precios).size > 1
  return { principal: (distintos ? 'Desde ' : '') + formatoCLP(precioMinimo(producto)), sufijo: '' }
}

// ---------- Disponibilidad (texto real, no solo color) ----------
export function estadoDe(producto, talla = null) {
  if (producto.visible === false) return estadoStock(0)
  if (talla) {
    const v = variante(producto, talla)
    return estadoStock(v ? v.unidades : 0, false)
  }
  return estadoStock(producto.unidades ?? null, !!producto.granel)
}

export function insigniaStock(producto, talla = null) {
  const e = estadoDe(producto, talla)
  return h('p', { class: `estado-stock estado-stock--${e.clave}`, 'data-estado-stock': '', text: e.texto })
}

function pintarInsignia(raiz, producto, talla) {
  const el = raiz.querySelector('[data-estado-stock]')
  if (!el) return
  const e = estadoDe(producto, talla)
  el.className = `estado-stock estado-stock--${e.clave}`
  el.textContent = e.texto
}

function bloquePrecio(producto) {
  const contenedor = h('p', { class: 'precio', 'data-precio': '' })
  pintarPrecio(contenedor, producto, null)
  return contenedor
}

function pintarPrecio(contenedor, producto, talla) {
  contenedor.replaceChildren()
  const t = textoPrecio(producto, talla)
  if (!t) {
    contenedor.append(h('span', { class: 'insignia insignia--consultar', text: 'Consultar precio' }))
    return
  }
  contenedor.append(h('span', { class: 'precio__valor', text: t.principal }))
  if (t.sufijo) contenedor.append(h('span', { class: 'precio__sufijo', text: t.sufijo }))
}

// ---------- Selector de talla ----------
function selectorTallas(producto, idAviso) {
  const idTitulo = nuevoId('talla-titulo')
  const grupo = h('div', { class: 'tallas', role: 'group', 'aria-labelledby': idTitulo },
    h('span', { class: 'tallas__titulo', id: idTitulo, text: 'Talla' }))
  const lista = h('div', { class: 'tallas__opciones' })
  for (const t of producto.tallas) {
    lista.append(h('button', {
      type: 'button',
      class: 'talla',
      'aria-pressed': 'false',
      'aria-describedby': idAviso,
      dataset: { talla: t.talla },
      'aria-label': `Talla ${t.talla}${typeof t.precio === 'number' ? `, ${formatoCLP(t.precio)}` : ''}`,
      text: t.talla
    }))
  }
  grupo.append(lista)
  return grupo
}

// ---------- Selector de cantidad + Añadir ----------
export function filaCompra(producto, { idAviso } = {}) {
  const nombre = producto.nombre
  const granel = !!producto.granel
  const tieneTallas = !!producto.tallas
  const consultar = sinPrecio(producto)
  const fila = h('div', { class: 'compra' })

  if (consultar) {
    const texto = `Hola, quiero consultar el precio de: ${nombre} (SKU ${producto.sku}). ¿Lo tienen disponible?`
    fila.append(h('a', {
      class: 'boton boton--whatsapp compra__consultar',
      href: `https://wa.me/${CONFIG.whatsappTienda}?text=${encodeURIComponent(texto)}`,
      target: '_blank',
      rel: 'noopener',
      'aria-label': `Consultar precio de ${nombre} por WhatsApp (se abre en una pestaña nueva)`
    }, icono('message-circle'), h('span', { text: 'Consultar precio' })))
    return fila
  }

  const v = tieneTallas ? null : variante(producto, null)
  const tope = v ? v.tope : null
  const idCampo = nuevoId('cantidad')
  const minimo = granel ? carrito.MIN_GRANEL : 1
  const unidad = granel ? 'medio kilo' : 'uno'

  const selector = h('div', {
    class: 'cantidad',
    'data-cantidad': '',
    'data-granel': granel ? '1' : null,
    'data-tope': tope ?? null
  },
  h('label', { class: 'visualmente-oculto', for: idCampo, text: granel ? `Kilos de ${nombre}` : `Cantidad de ${nombre}` }),
  h('button', { type: 'button', class: 'cantidad__boton', 'data-accion': 'restar', 'aria-label': `Restar ${unidad} a ${nombre}`, 'aria-disabled': 'true' }, icono('minus')),
  h('input', {
    id: idCampo,
    class: 'cantidad__campo',
    type: 'text',
    size: 3,
    inputmode: granel ? 'decimal' : 'numeric',
    autocomplete: 'off',
    value: granel ? formatoDecimal(minimo) : '1',
    'data-valor': minimo,
    'aria-describedby': idAviso
  }),
  granel ? h('span', { class: 'cantidad__unidad', 'aria-hidden': 'true', text: 'kg' }) : null,
  h('button', { type: 'button', class: 'cantidad__boton', 'data-accion': 'sumar', 'aria-label': `Sumar ${unidad} a ${nombre}`, 'aria-disabled': tope !== null && tope <= minimo ? 'true' : 'false' }, icono('plus'))
  )

  const anadir = h('button', {
    type: 'button',
    class: 'boton boton--primario compra__anadir',
    'data-accion': 'anadir',
    'aria-disabled': tieneTallas ? 'true' : 'false',
    'aria-describedby': idAviso,
    'aria-label': `Añadir ${nombre} al carrito`
  }, icono('shopping-bag'), h('span', { text: 'Añadir' }))

  fila.append(selector, anadir)
  return fila
}

// ---------- Card ----------
export function tarjetaProducto(producto, { nivelTitulo = 'h3', prioridad = false } = {}) {
  const idAviso = nuevoId('aviso')
  const url = urlProducto(producto)
  const tarjeta = h('article', { class: 'tarjeta', 'data-producto': producto.id, 'data-talla': '' })

  const media = h('a', { class: 'tarjeta__media', href: url, tabindex: '-1' }, imagenProducto(producto, { prioridad }))
  if (sinPrecio(producto)) media.append(h('span', { class: 'insignia insignia--consultar insignia--flotante', 'aria-hidden': 'true', text: 'Consultar precio' }))

  const cuerpo = h('div', { class: 'tarjeta__cuerpo' },
    h('p', { class: 'tarjeta__marca', text: producto.marca }),
    h(nivelTitulo, { class: 'tarjeta__nombre' }, h('a', { href: url, text: producto.nombre })),
    bloquePrecio(producto),
    insigniaStock(producto)
  )
  if (producto.granel) cuerpo.append(h('p', { class: 'tarjeta__subtotal', 'data-subtotal': '', text: `Subtotal: ${formatoCLP(producto.precio * carrito.MIN_GRANEL)}` }))
  if (producto.tallas && !sinPrecio(producto)) cuerpo.append(selectorTallas(producto, idAviso))

  const pie = h('div', { class: 'tarjeta__pie' }, filaCompra(producto, { idAviso }))
  pie.append(h('p', {
    class: 'tarjeta__aviso',
    id: idAviso,
    'data-aviso': '',
    text: producto.tallas && !sinPrecio(producto) ? 'Elige una talla para añadir.' : ''
  }))
  tarjeta.append(media, cuerpo, pie)
  return tarjeta
}

// ============================================================
// Comportamiento (delegado)
// ============================================================
function estadoTarjeta(raiz) {
  const producto = productoPorId.get(raiz.dataset.producto)
  const talla = raiz.dataset.talla || null
  return { producto, talla, v: producto ? variante(producto, talla) : null }
}

function topeActual(raiz) {
  const { producto, v } = estadoTarjeta(raiz)
  if (!producto) return null
  if (producto.tallas && !raiz.dataset.talla) return null
  return v ? v.tope : null
}

function leerCantidad(selector) {
  return Number(selector.querySelector('.cantidad__campo').dataset.valor)
}

function fijarCantidad(raiz, selector, valor, { anunciarCambio = false } = {}) {
  const granel = selector.dataset.granel === '1'
  const tope = topeActual(raiz)
  const n = carrito.ajustarCantidad(valor, { granel, tope })
  const campo = selector.querySelector('.cantidad__campo')
  campo.dataset.valor = String(n)
  campo.value = granel ? formatoDecimal(n) : String(n)
  const minimo = granel ? carrito.MIN_GRANEL : 1
  const maximo = tope ?? Infinity
  selector.querySelector('[data-accion="restar"]').setAttribute('aria-disabled', String(n <= minimo))
  selector.querySelector('[data-accion="sumar"]').setAttribute('aria-disabled', String(n >= maximo))
  const aviso = raiz.querySelector('[data-aviso]')
  const enMaximo = tope !== null && n >= tope
  if (aviso && (raiz.dataset.talla || !productoPorId.get(raiz.dataset.producto)?.tallas)) {
    aviso.textContent = enMaximo ? `Máximo disponible: ${formatoCantidad(tope, granel)}.` : ''
  }
  const subtotal = raiz.querySelector('[data-subtotal]')
  const { v } = estadoTarjeta(raiz)
  if (subtotal && v && typeof v.precio === 'number') subtotal.textContent = `Subtotal: ${formatoCLP(v.precio * n)}`
  if (anunciarCambio) {
    const texto = granel ? `${formatoDecimal(n)} kilos` : `Cantidad: ${n}`
    anunciar(enMaximo ? `${texto}. Máximo disponible.` : texto)
  }
  return n
}

function elegirTalla(raiz, boton) {
  const { producto } = estadoTarjeta(raiz)
  const talla = boton.dataset.talla
  raiz.dataset.talla = talla
  raiz.querySelectorAll('.talla').forEach(b => b.setAttribute('aria-pressed', String(b === boton)))
  const precio = raiz.querySelector('[data-precio]')
  if (precio) pintarPrecio(precio, producto, talla)
  pintarInsignia(raiz, producto, talla)
  const anadir = raiz.querySelector('[data-accion="anadir"]')
  if (anadir) {
    anadir.setAttribute('aria-disabled', 'false')
    anadir.setAttribute('aria-label', `Añadir ${producto.nombre}, talla ${talla}, al carrito`)
  }
  const aviso = raiz.querySelector('[data-aviso]')
  if (aviso) aviso.textContent = ''
  const selector = raiz.querySelector('[data-cantidad]')
  if (selector) fijarCantidad(raiz, selector, leerCantidad(selector))
  const v = variante(producto, talla)
  anunciar(`Talla ${talla} elegida${v && typeof v.precio === 'number' ? `, ${formatoCLP(v.precio)}` : ''}.`)
}

let alAgregar = () => {}
export function cuandoSeAgregue(fn) { alAgregar = fn }

function anadirAlCarrito(raiz, boton) {
  const { producto } = estadoTarjeta(raiz)
  if (!producto) return
  const aviso = raiz.querySelector('[data-aviso]')
  if (producto.tallas && !raiz.dataset.talla) {
    if (aviso) aviso.textContent = 'Primero elige una talla.'
    anunciar('Primero elige una talla.', { urgente: true })
    raiz.querySelector('.talla')?.focus()
    return
  }
  if (boton.getAttribute('aria-disabled') === 'true') return
  const selector = raiz.querySelector('[data-cantidad]')
  const cantidad = leerCantidad(selector)
  const r = carrito.agregar(producto.id, raiz.dataset.talla || null, cantidad)
  if (!r.ok) {
    if (aviso) aviso.textContent = r.motivo
    anunciar(r.motivo, { urgente: true })
    return
  }
  const descripcion = `${formatoCantidad(r.cantidadAgregada, producto.granel)} × ${producto.nombre}${r.linea.talla ? ` (talla ${r.linea.talla})` : ''}`
  const mensaje = r.limitado
    ? `Agregado: ${descripcion}. Llegaste al máximo disponible.`
    : `Agregado: ${descripcion}`
  alAgregar(mensaje)
  fijarCantidad(raiz, selector, producto.granel ? carrito.MIN_GRANEL : 1)
  boton.classList.remove('compra__anadir--ok')
  void boton.offsetWidth
  boton.classList.add('compra__anadir--ok')
}

export function activarCompra(raizDocumento = document) {
  raizDocumento.addEventListener('click', e => {
    const boton = e.target.closest('button')
    if (!boton) return
    const raiz = boton.closest('[data-producto]')
    if (!raiz) return
    if (boton.classList.contains('talla')) return elegirTalla(raiz, boton)
    const accion = boton.dataset.accion
    if (!accion) return
    const selector = raiz.querySelector('[data-cantidad]')
    if (accion === 'restar' || accion === 'sumar') {
      if (boton.getAttribute('aria-disabled') === 'true') {
        if (accion === 'sumar' && topeActual(raiz) !== null) anunciar('Máximo disponible.')
        return
      }
      const paso = selector.dataset.granel === '1' ? carrito.PASO_GRANEL : 1
      fijarCantidad(raiz, selector, leerCantidad(selector) + (accion === 'sumar' ? paso : -paso), { anunciarCambio: true })
    } else if (accion === 'anadir') {
      anadirAlCarrito(raiz, boton)
    }
  })

  // Escribir la cantidad a mano: se valida al salir del campo o con Enter.
  const confirmarCampo = campo => {
    const raiz = campo.closest('[data-producto]')
    const selector = campo.closest('[data-cantidad]')
    if (!raiz || !selector) return
    const n = leerNumero(campo.value)
    fijarCantidad(raiz, selector, Number.isNaN(n) ? leerCantidad(selector) : n, { anunciarCambio: true })
  }
  raizDocumento.addEventListener('change', e => {
    if (e.target.matches('.cantidad__campo')) confirmarCampo(e.target)
  })
  raizDocumento.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('.cantidad__campo')) {
      e.preventDefault()
      confirmarCampo(e.target)
    }
  })
}
