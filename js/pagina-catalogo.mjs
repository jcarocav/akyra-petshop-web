// ============================================================
// CATÁLOGO — categorías, buscador (nombre, marca o código SKU),
// filtros (tipo, marca, edad, talla), orden y carga progresiva de a
// 24 productos. Todo se refleja en la URL para poder compartirla.
// ============================================================
import { tarjetaProducto } from './componentes.mjs'
import { categoriaPorId, coincideBusqueda, errorCarga, fechaStock, precioMinimo, productos, sinPrecio } from './datos.mjs'
import { crearDialogo } from './dialogo.mjs'
import { $, $$, anunciar, debounce, h, icono, normalizar } from './utilidades.mjs'

const POR_PAGINA = 24
const MARCAS_VISIBLES = 10

const estado = {
  categoria: '',
  busqueda: '',
  subcategorias: new Set(),
  marcas: new Set(),
  edades: new Set(),
  tallas: new Set(),
  orden: 'relevancia',
  mostrados: POR_PAGINA,
  verTodasLasMarcas: false
}

const FACETAS = {
  subcategorias: { campo: 'subcategoria', contenedor: '#filtro-subcategoria', titulo: 'Tipo de producto', param: 'tipo' },
  marcas: { campo: 'marca', contenedor: '#filtro-marca', titulo: 'Marca', param: 'marca' },
  edades: { campo: 'edad', contenedor: '#filtro-edad', titulo: 'Edad', param: 'edad' },
  tallas: { campo: 'tallas', contenedor: '#filtro-talla', titulo: 'Talla', param: 'talla' }
}
const ORDEN_EDAD = ['Cachorro o gatito', 'Adulto', 'Senior']
const ORDEN_TALLA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', '5XL']

function valoresDe(producto, faceta) {
  if (faceta === 'tallas') return (producto.tallas || []).map(t => t.talla)
  const v = producto[FACETAS[faceta].campo]
  return v ? [v] : []
}

// ---------- Filtrado ----------
function base() {
  return productos.filter(p =>
    (!estado.categoria || p.categoria === estado.categoria) &&
    coincideBusqueda(p, estado.busqueda))
}

function cumple(producto, excepto = null) {
  for (const faceta of Object.keys(FACETAS)) {
    if (faceta === excepto) continue
    const elegidos = estado[faceta]
    if (!elegidos.size) continue
    if (!valoresDe(producto, faceta).some(v => elegidos.has(v))) return false
  }
  return true
}

function ordenar(lista) {
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es')
  const copia = [...lista]
  switch (estado.orden) {
    case 'precio-asc':
    case 'precio-desc': {
      const signo = estado.orden === 'precio-asc' ? 1 : -1
      return copia.sort((a, b) => {
        if (sinPrecio(a) !== sinPrecio(b)) return sinPrecio(a) ? 1 : -1 // "Consultar precio" al final
        return signo * ((precioMinimo(a) ?? 0) - (precioMinimo(b) ?? 0)) || porNombre(a, b)
      })
    }
    case 'nombre':
      return copia.sort(porNombre)
    default: {
      // Relevancia: si hay búsqueda, primero lo que empieza con lo buscado;
      // después, con foto y precio; luego por nombre.
      const q = normalizar(estado.busqueda)
      const puntaje = p => (q && normalizar(p.nombre).startsWith(q) ? 4 : 0) + (p.imagen ? 2 : 0) + (sinPrecio(p) ? 0 : 1)
      return copia.sort((a, b) => puntaje(b) - puntaje(a) || porNombre(a, b))
    }
  }
}

// ---------- Filtros (panel) ----------
function opcionesDe(faceta, lista) {
  const conteo = new Map()
  for (const p of lista) {
    if (!cumple(p, faceta)) continue
    for (const v of valoresDe(p, faceta)) conteo.set(v, (conteo.get(v) || 0) + 1)
  }
  // Los elegidos se mantienen visibles aunque queden en 0
  for (const v of estado[faceta]) if (!conteo.has(v)) conteo.set(v, 0)
  let valores = [...conteo.keys()]
  if (faceta === 'edades') valores.sort((a, b) => ORDEN_EDAD.indexOf(a) - ORDEN_EDAD.indexOf(b))
  else if (faceta === 'tallas') valores.sort((a, b) => (ORDEN_TALLA.indexOf(a) + 1 || 99) - (ORDEN_TALLA.indexOf(b) + 1 || 99) || a.localeCompare(b))
  else valores.sort((a, b) => a.localeCompare(b, 'es'))
  return valores.map(v => ({ valor: v, cantidad: conteo.get(v) }))
}

function pintarFiltros(lista) {
  for (const [faceta, cfg] of Object.entries(FACETAS)) {
    const fieldset = $(cfg.contenedor)
    if (!fieldset) continue
    let opciones = opcionesDe(faceta, lista)
    fieldset.hidden = opciones.length === 0 || (opciones.length === 1 && !estado[faceta].size)
    const caja = $('.filtro__opciones', fieldset)
    const total = opciones.length
    if (faceta === 'marcas' && !estado.verTodasLasMarcas && total > MARCAS_VISIBLES) {
      const elegidas = opciones.filter(o => estado.marcas.has(o.valor))
      const resto = opciones.filter(o => !estado.marcas.has(o.valor)).sort((a, b) => b.cantidad - a.cantidad).slice(0, MARCAS_VISIBLES - elegidas.length)
      opciones = [...elegidas, ...resto].sort((a, b) => a.valor.localeCompare(b.valor, 'es'))
    }
    caja.replaceChildren(...opciones.map(({ valor, cantidad }) => {
      const id = `f-${cfg.param}-${normalizar(valor).replace(/[^a-z0-9]+/g, '-')}`
      return h('div', { class: 'opcion' },
        h('input', { type: 'checkbox', id, 'data-faceta': faceta, value: valor, checked: estado[faceta].has(valor) }),
        h('label', { for: id },
          h('span', { class: 'opcion__texto', text: faceta === 'tallas' ? `Talla ${valor}` : valor }),
          h('span', { class: 'opcion__cantidad', text: String(cantidad) }, h('span', { class: 'visualmente-oculto', text: cantidad === 1 ? ' producto' : ' productos' }))
        ))
    }))
    if (faceta === 'marcas') {
      const boton = $('#marcas-ver-todas')
      boton.hidden = total <= MARCAS_VISIBLES
      boton.setAttribute('aria-expanded', String(estado.verTodasLasMarcas))
      boton.textContent = estado.verTodasLasMarcas ? 'Ver menos marcas' : `Ver todas las marcas (${total})`
    }
  }
}

function pintarActivos() {
  const caja = $('#filtros-activos')
  const chips = []
  for (const [faceta, cfg] of Object.entries(FACETAS)) {
    for (const v of estado[faceta]) {
      chips.push(h('li', {}, h('button', {
        type: 'button', class: 'chip', 'data-quitar-faceta': faceta, 'data-valor': v,
        'aria-label': `Quitar filtro ${cfg.titulo}: ${v}`
      }, h('span', { text: faceta === 'tallas' ? `Talla ${v}` : v }), icono('x'))))
    }
  }
  if (estado.busqueda) {
    chips.unshift(h('li', {}, h('button', { type: 'button', class: 'chip', 'data-quitar-busqueda': '', 'aria-label': `Quitar búsqueda: ${estado.busqueda}` },
      h('span', { text: `“${estado.busqueda}”` }), icono('x'))))
  }
  if (chips.length > 1) {
    chips.push(h('li', {}, h('button', { type: 'button', class: 'chip chip--limpiar', 'data-limpiar-todo': '', text: 'Quitar todos' })))
  }
  caja.replaceChildren(...chips)
  caja.hidden = chips.length === 0
  const n = Object.keys(FACETAS).reduce((s, f) => s + estado[f].size, 0)
  const insignia = $('#filtros-cantidad')
  if (insignia) { insignia.textContent = n ? String(n) : ''; insignia.hidden = !n }
}

// ---------- Resultados ----------
let ultimoTotal = null
const claveResultados = total => [total, estado.categoria, estado.busqueda, ...Object.keys(FACETAS).map(f => [...estado[f]].join(','))].join('|')
const anunciarResultados = debounce(total => {
  anunciar(total === 0 ? 'No hay productos con ese filtro.' : `${total} ${total === 1 ? 'producto encontrado' : 'productos encontrados'}.`)
}, 450)

function pintarResultados({ enfocarDesde = null } = {}) {
  const lista = base()
  const filtrados = ordenar(lista.filter(p => cumple(p)))
  const total = filtrados.length
  const visibles = filtrados.slice(0, estado.mostrados)

  const ul = $('#catalogo-lista')
  const desde = enfocarDesde ?? 0
  if (enfocarDesde !== null) {
    ul.append(...visibles.slice(desde).map(p => h('li', {}, tarjetaProducto(p))))
  } else {
    ul.replaceChildren(...visibles.map((p, i) => h('li', {}, tarjetaProducto(p, { prioridad: i < 2 }))))
  }
  ul.setAttribute('aria-busy', 'false')
  $('#catalogo-vacio').hidden = total !== 0
  $('#catalogo-conteo').textContent = total === 0 ? 'Sin resultados'
    : `Mostrando ${visibles.length} de ${total} ${total === 1 ? 'producto' : 'productos'}`
  const mas = $('#catalogo-mas')
  mas.hidden = visibles.length >= total
  mas.textContent = `Mostrar ${Math.min(POR_PAGINA, total - visibles.length)} productos más`
  pintarFiltros(lista)
  pintarActivos()
  $('#filtros-ver-resultados').textContent = `Ver ${total} ${total === 1 ? 'resultado' : 'resultados'}`

  if (enfocarDesde !== null) {
    ul.children[desde]?.querySelector('.tarjeta__nombre a')?.focus()
    anunciar(`Se agregaron ${visibles.length - desde} productos. Mostrando ${visibles.length} de ${total}.`)
  } else if (ultimoTotal !== null && ultimoTotal !== claveResultados(total)) {
    anunciarResultados(total)
  }
  ultimoTotal = claveResultados(total)
}

function pintarEncabezado() {
  const cat = categoriaPorId.get(estado.categoria)
  const titulo = estado.busqueda
    ? `Resultados para “${estado.busqueda}”${cat ? ` en ${cat.nombre}` : ''}`
    : (cat ? cat.titulo : 'Todo el catálogo')
  $('#catalogo-titulo').textContent = titulo
  document.title = `${estado.busqueda ? `Buscar “${estado.busqueda}”` : (cat ? cat.titulo : 'Catálogo')} | Maskotería Akyra`
  for (const a of $$('[data-categoria]')) {
    const activa = a.dataset.categoria === estado.categoria
    if (activa) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  }
  const campo = $('#catalogo-buscar')
  if (campo && document.activeElement !== campo) campo.value = estado.busqueda
  const cabecera = $('#buscador-campo')
  if (cabecera) cabecera.value = estado.busqueda
}

// ---------- URL ----------
function leerUrl() {
  const p = new URLSearchParams(location.search)
  const cat = p.get('categoria') || ''
  estado.categoria = categoriaPorId.has(cat) ? cat : ''
  estado.busqueda = (p.get('buscar') || '').trim().slice(0, 80)
  for (const [faceta, cfg] of Object.entries(FACETAS)) {
    estado[faceta] = new Set(p.getAll(cfg.param).map(v => v.slice(0, 60)).filter(Boolean))
  }
  const orden = p.get('orden')
  estado.orden = ['relevancia', 'precio-asc', 'precio-desc', 'nombre'].includes(orden) ? orden : 'relevancia'
  $('#catalogo-orden').value = estado.orden
}

function escribirUrl() {
  const p = new URLSearchParams()
  if (estado.categoria) p.set('categoria', estado.categoria)
  if (estado.busqueda) p.set('buscar', estado.busqueda)
  for (const [faceta, cfg] of Object.entries(FACETAS)) for (const v of estado[faceta]) p.append(cfg.param, v)
  if (estado.orden !== 'relevancia') p.set('orden', estado.orden)
  const qs = p.toString()
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname)
}

function actualizar() {
  estado.mostrados = POR_PAGINA
  escribirUrl()
  pintarEncabezado()
  pintarResultados()
}

function limpiarFiltros() {
  for (const f of Object.keys(FACETAS)) estado[f].clear()
}

// ---------- Panel de filtros en celular ----------
function iniciarPanelFiltros() {
  const panel = $('#filtros')
  const boton = $('#filtros-abrir')
  const movil = window.matchMedia('(max-width: 1000px)')
  const dialogo = crearDialogo(panel, {
    fondo: $('#filtros-fondo'),
    usarHidden: false,
    alAbrir: () => { boton.setAttribute('aria-expanded', 'true'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true') },
    alCerrar: () => { boton.setAttribute('aria-expanded', 'false'); panel.removeAttribute('role'); panel.removeAttribute('aria-modal') }
  })
  boton.addEventListener('click', () => dialogo.abrir(boton, { enfocar: $('#filtros-titulo') }))
  $('#filtros-cerrar').addEventListener('click', () => dialogo.cerrar())
  $('#filtros-ver-resultados').addEventListener('click', () => dialogo.cerrar())
  movil.addEventListener('change', () => { if (!movil.matches && dialogo.abierto) dialogo.cerrar({ devolverFoco: false }) })
}

function iniciar() {
  leerUrl()

  // Pestañas de categoría (son enlaces: sin JS también funcionan)
  $('#categorias-nav').addEventListener('click', e => {
    const a = e.target.closest('a[data-categoria]')
    if (!a) return
    e.preventDefault()
    estado.categoria = a.dataset.categoria
    limpiarFiltros()
    actualizar()
    $('#catalogo-titulo').focus({ preventScroll: false })
  })

  // Buscador del catálogo (filtra mientras se escribe)
  const campo = $('#catalogo-buscar')
  const buscar = debounce(() => {
    estado.busqueda = campo.value.trim().slice(0, 80)
    actualizar()
  }, 300)
  campo.addEventListener('input', buscar)
  // Si alguien escribió antes de que terminara de cargar el catálogo, se aplica ahora
  if (campo.value.trim() && campo.value.trim() !== estado.busqueda) buscar()
  $('#catalogo-busqueda').addEventListener('submit', e => {
    e.preventDefault()
    estado.busqueda = campo.value.trim().slice(0, 80)
    actualizar()
  })

  // Buscador de la cabecera: en esta página filtra sin recargar
  $('#buscador')?.addEventListener('submit', e => {
    e.preventDefault()
    const q = $('#buscador-campo').value.trim().slice(0, 80)
    if (!q) return
    estado.busqueda = q
    estado.categoria = ''
    limpiarFiltros()
    actualizar()
    $('#catalogo-titulo').focus()
  })

  $('#filtros').addEventListener('change', e => {
    const input = e.target.closest('input[data-faceta]')
    if (!input) return
    const set = estado[input.dataset.faceta]
    if (input.checked) set.add(input.value); else set.delete(input.value)
    const id = input.id
    actualizar()
    document.getElementById(id)?.focus() // el panel se redibuja: se devuelve el foco a la misma opción
  })
  $('#marcas-ver-todas').addEventListener('click', () => {
    estado.verTodasLasMarcas = !estado.verTodasLasMarcas
    pintarFiltros(base())
    $('#marcas-ver-todas').focus()
  })
  $('#filtros-limpiar').addEventListener('click', () => { limpiarFiltros(); actualizar() })

  $('#filtros-activos').addEventListener('click', e => {
    const b = e.target.closest('button')
    if (!b) return
    if (b.hasAttribute('data-limpiar-todo')) { limpiarFiltros(); estado.busqueda = '' }
    else if (b.hasAttribute('data-quitar-busqueda')) estado.busqueda = ''
    else estado[b.dataset.quitarFaceta]?.delete(b.dataset.valor)
    actualizar()
    ;($('#filtros-activos button') || $('#catalogo-titulo')).focus()
  })

  $('#catalogo-limpiar').addEventListener('click', () => {
    limpiarFiltros()
    estado.busqueda = ''
    actualizar()
    $('#catalogo-titulo').focus()
  })

  $('#catalogo-orden').addEventListener('change', e => {
    estado.orden = e.target.value
    actualizar()
  })

  $('#catalogo-mas').addEventListener('click', () => {
    const desde = estado.mostrados
    estado.mostrados += POR_PAGINA
    pintarResultados({ enfocarDesde: desde })
  })

  iniciarPanelFiltros()
  const fecha = fechaStock()
  if (fecha) $('#stock-actualizado').textContent = `Stock actualizado: ${fecha}`
  if (errorCarga) {
    const aviso = $('#aviso-carga')
    aviso.textContent = errorCarga === 'catalogo'
      ? 'No pudimos cargar el catálogo. Revisa tu conexión y recarga la página, o escríbenos por WhatsApp.'
      : 'No pudimos cargar la disponibilidad: confirmaremos el stock por WhatsApp.'
    aviso.hidden = false
  }
  pintarEncabezado()
  pintarResultados()
}

iniciar()
