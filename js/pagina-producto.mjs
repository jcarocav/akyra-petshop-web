// ============================================================
// FICHA DE PRODUCTO (producto.html?id=...) — foto, precio, talla,
// cantidad + "Añadir", datos para buscadores (schema.org Product/Offer:
// solo precio y disponibilidad) y productos relacionados.
// ============================================================
import { estadoDe, filaCompra, imagenProducto, tarjetaProducto } from './componentes.mjs'
import { CONFIG, categoriaPorId, preciosDe, productoPorId, productos, sinPrecio, textoAlternativo, urlProducto } from './datos.mjs'
import { $, formatoCLP, h } from './utilidades.mjs'

const SITIO = document.querySelector('link[rel="canonical"]')?.href.replace(/producto\.html.*$/, '') || location.href.replace(/producto\.html.*$/, '')

function meta(selector, atributo, valor) {
  const el = document.querySelector(selector)
  if (el) el.setAttribute(atributo, valor)
}

function datosEstructurados(p) {
  const precios = preciosDe(p)
  const datos = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nombre,
    sku: p.sku,
    brand: { '@type': 'Brand', name: p.marca },
    category: categoriaPorId.get(p.categoria)?.nombre
  }
  if (p.imagen) datos.image = SITIO + p.imagen
  if (precios.length) {
    const oferta = {
      '@type': precios.length > 1 ? 'AggregateOffer' : 'Offer',
      priceCurrency: 'CLP',
      availability: 'https://schema.org/InStock',
      url: SITIO + urlProducto(p)
    }
    if (precios.length > 1) { oferta.lowPrice = Math.min(...precios); oferta.highPrice = Math.max(...precios); oferta.offerCount = precios.length }
    else oferta.price = precios[0]
    datos.offers = oferta
  }
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(datos).replace(/</g, '\\u003c')
  document.head.append(script)
}

function pintar(p) {
  const cat = categoriaPorId.get(p.categoria)
  const precio = sinPrecio(p) ? 'Precio a consultar' : (p.granel ? `${formatoCLP(p.precio)} por kg` : formatoCLP(Math.min(...preciosDe(p))))
  const titulo = `${textoAlternativo(p)} | Maskotería Akyra`
  const descripcion = `${p.nombre} (${p.marca}) en Maskotería Akyra, Punta Arenas. ${precio}. Retira en nuestras 3 sucursales o pide despacho a domicilio por WhatsApp.`
  document.title = titulo
  meta('meta[name="description"]', 'content', descripcion)
  meta('meta[property="og:title"]', 'content', titulo)
  meta('meta[property="og:description"]', 'content', descripcion)
  meta('link[rel="canonical"]', 'href', SITIO + urlProducto(p))
  meta('meta[property="og:url"]', 'content', SITIO + urlProducto(p))
  if (p.imagen) meta('meta[property="og:image"]', 'content', SITIO + p.imagen)
  const agotado = p.visible === false
  if (agotado) meta('meta[name="robots"]', 'content', 'noindex, follow')
  else datosEstructurados(p)

  $('#miga-categoria').href = `catalogo.html?categoria=${p.categoria}`
  $('#miga-categoria').textContent = cat?.nombre || 'Catálogo'
  $('#miga-actual').textContent = p.nombre

  const ficha = $('#ficha')
  ficha.dataset.producto = p.id
  ficha.dataset.talla = ''
  $('#ficha-media').replaceChildren(imagenProducto(p, { prioridad: true, tamano: 800 }))
  $('#ficha-marca').textContent = p.marca
  $('#ficha-nombre').textContent = p.nombre
  $('#ficha-sku').textContent = `SKU ${p.sku}`
  $('#ficha-categoria').textContent = [cat?.nombre, p.subcategoria].filter(Boolean).join(' · ')

  const estado = estadoDe(p)
  const stockEl = $('#ficha-stock')
  stockEl.textContent = estado.texto
  stockEl.className = `estado-stock estado-stock--${estado.clave}`
  if (agotado) {
    $('#ficha-precio').append(...(sinPrecio(p) ? [] : [h('span', { class: 'precio__valor', text: formatoCLP(Math.min(...preciosDe(p))) })]))
    const texto = `Hola, vi que ${p.nombre} (SKU ${p.sku}) está agotado. ¿Cuándo vuelve a llegar?`
    $('#ficha-agotado-whatsapp').href = `https://wa.me/${CONFIG.whatsappTienda}?text=${encodeURIComponent(texto)}`
    $('#ficha-agotado').hidden = false
    $('#ficha-compra').remove()
  } else {
    pintarCompra(p)
  }
  $('#ficha').hidden = false
  $('#ficha-cargando').hidden = true
  pintarRelacionados(p)
}

function pintarCompra(p) {
  // La card y la ficha comparten el mismo bloque de compra: se toma de una
  // card armada y se mueven sus partes a la ficha.
  const tarjeta = tarjetaProducto(p, { nivelTitulo: 'h2' })
  $('#ficha-precio').replaceChildren(...tarjeta.querySelector('[data-precio]').childNodes)
  $('#ficha-precio').setAttribute('data-precio', '')
  const subtotal = tarjeta.querySelector('[data-subtotal]')
  if (subtotal) $('#ficha-precio').after(subtotal)
  const tallas = tarjeta.querySelector('.tallas')
  const compra = $('#ficha-compra')
  compra.replaceChildren()
  if (tallas) compra.append(tallas)
  const aviso = tarjeta.querySelector('[data-aviso]')
  compra.append(filaDesde(tarjeta), aviso)
  if (p.granel) $('#ficha-granel').hidden = false
  if (sinPrecio(p)) $('#ficha-consultar').hidden = false
  // la insignia de la card ya no hace falta (la ficha tiene la suya)
  $('#ficha').dataset.producto = p.id
}

function pintarRelacionados(p) {
  // Relacionados: misma subcategoría, con foto primero
  const relacionados = productos
    .filter(x => x.id !== p.id && x.categoria === p.categoria && x.subcategoria === p.subcategoria)
    .sort((a, b) => (b.imagen ? 1 : 0) - (a.imagen ? 1 : 0))
    .slice(0, 4)
  if (relacionados.length) {
    $('#relacionados-lista').replaceChildren(...relacionados.map(x => h('li', {}, tarjetaProducto(x, { nivelTitulo: 'h3' }))))
    $('#relacionados').hidden = false
  }
}

// La fila de compra de la card (− cantidad + y Añadir)
function filaDesde(tarjeta) {
  return tarjeta.querySelector('.compra') || filaCompra(productoPorId.get(tarjeta.dataset.producto))
}

const id = new URLSearchParams(location.search).get('id') || ''
const producto = productoPorId.get(id.slice(0, 80))
if (producto) {
  pintar(producto)
} else {
  $('#ficha-cargando').hidden = true
  $('#no-encontrado').hidden = false
  document.title = 'Producto no disponible | Maskotería Akyra'
  meta('meta[name="robots"]', 'content', 'noindex')
}
