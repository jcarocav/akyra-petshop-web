// ============================================================
// Herramienta de revisión del catálogo — pantalla (PC y celular).
// Usa las MISMAS reglas que el sitio para saber si un producto se ve en la web
// (tools/catalogo/publicar.mjs) y guarda cada cambio al instante en el PC.
// Sin innerHTML con datos: todo se arma con nodos de texto.
// ============================================================
import { marcaConFotoObligatoria, publicarCatalogo } from '/repo/tools/catalogo/publicar.mjs'
import { cambioGrande, cambiosAAjustes, formatoPrecio, juntarAjustes, leerPrecio, marcasDeCambios } from '/repo/tools/revision/convertir.mjs'

// ---------- Utilidades ----------
const $ = s => document.querySelector(s)
function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta)
  for (const [k, v] of Object.entries(atributos || {})) {
    if (v === null || v === undefined || v === false) continue
    if (k === 'text') el.textContent = v
    else if (k === 'class') el.className = v
    else if (k === 'dataset') Object.assign(el.dataset, v)
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v)
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const hijo of hijos.flat()) if (hijo !== null && hijo !== undefined && hijo !== false) el.append(hijo)
  return el
}
const normalizar = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const parametros = new URLSearchParams(location.search)
const MI_DISPOSITIVO = parametros.get('dispositivo') === 'Celular' || parametros.get('dispositivo') === 'PC'
  ? parametros.get('dispositivo')
  : (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? 'PC' : 'Celular')
document.documentElement.dataset.dispositivo = MI_DISPOSITIVO
if (parametros.has('clave')) {
  // La clave ya quedó en una cookie: se saca de la barra de direcciones
  parametros.delete('clave')
  history.replaceState(null, '', location.pathname + (parametros.toString() ? `?${parametros}` : ''))
}

async function api(ruta, { metodo = 'GET', datos, cuerpo, tipo } = {}) {
  const opciones = { method: metodo, headers: { 'X-Dispositivo': MI_DISPOSITIVO }, credentials: 'same-origin' }
  if (datos !== undefined) { opciones.body = JSON.stringify(datos); opciones.headers['Content-Type'] = 'application/json' }
  if (cuerpo !== undefined) { opciones.body = cuerpo; opciones.headers['Content-Type'] = tipo || 'application/octet-stream' }
  const r = await fetch(ruta, opciones)
  const json = await r.json().catch(() => ({}))
  if (!r.ok || json.ok === false) throw new Error(json.error || 'No se pudo guardar. Revisa que el PC siga encendido.')
  return json
}

let temporizadorAviso
function avisar(texto, { error = false } = {}) {
  const el = $('#aviso')
  el.textContent = texto
  el.classList.toggle('aviso--error', error)
  el.classList.add('aviso--visible')
  clearTimeout(temporizadorAviso)
  temporizadorAviso = setTimeout(() => el.classList.remove('aviso--visible'), error ? 6000 : 2500)
}

// ---------- Estado ----------
const estado = {
  base: null, ajustesRepo: null, codigosBaseRosa: [], categorias: [],
  cambios: {}, pila: {}, version: 0,
  originales: new Map(), vista: [], porSku: new Map(),
  pestana: 'catalogo', mostrados: 48, editando: null, // SKU con el precio abierto en la card
  dialogoSku: null, subidas: new Set(), presencia: { PC: false, Celular: false }
}
const POR_PAGINA = 48
const nombreCategoria = id => estado.categorias.find(c => c.id === id)?.nombre || id

function recalcular() {
  const ajustes = juntarAjustes(estado.ajustesRepo || {}, cambiosAAjustes(estado.cambios, { incluirNuevosEliminados: true }))
  const { todos } = publicarCatalogo(estado.base, ajustes, { existeImagen: () => true })
  estado.vista = todos.map(p => ({ ...p, cambios: estado.cambios[p.sku] || {}, original: estado.originales.get(p.sku) || null }))
  estado.vista.sort((a, b) => (b.cambios.nuevo ? 1 : 0) - (a.cambios.nuevo ? 1 : 0))
  estado.porSku = new Map(estado.vista.map(p => [p.sku, p]))
}

// setTimeout (y no requestAnimationFrame): también repinta con la pestaña en segundo plano
let pintado = null
function repintar() {
  clearTimeout(pintado)
  pintado = setTimeout(() => {
    recalcular()
    pintarContadores()
    if (estado.pestana === 'catalogo') pintarLista()
    else pintarFotos()
    refrescarDialogo()
  }, 30)
}

const valor = (p, campo) => p.cambios[campo]?.valor ?? null
const tieneFotoNueva = p => !!valor(p, 'foto')
const esNuevo = p => valor(p, 'nuevo') === true
const sinPrecio = p => (p.tallas ? !p.tallas.some(t => typeof t.precio === 'number') : typeof p.precio !== 'number')
const precioCambiado = p => !esNuevo(p) && Object.keys(p.cambios).some(k => k.split('@')[0] === 'precio' && p.cambios[k]?.valor != null)
const fotoUrl = p => {
  const f = valor(p, 'foto')
  if (f && f.estado === 'lista') return `/${f.archivo}?v=${encodeURIComponent(f.cambio || f.listaEn || f.id)}`
  if (f) return null
  return p.imagen ? `/repo/${p.imagen}` : null
}
const tieneFoto = p => !!p.imagen || tieneFotoNueva(p)

// ---------- Contadores ----------
function pintarContadores() {
  const v = estado.vista
  const n = {
    'Publicados': v.filter(p => p.publicado).length,
    'No publicados por falta de foto': v.filter(p => p.motivo === 'falta-foto').length,
    'Fotos nuevas sacadas': v.filter(tieneFotoNueva).length,
    'Precios cambiados': v.filter(precioCambiado).length,
    'Revisados': v.filter(p => valor(p, 'revisado')).length,
    'Sin cambios': v.filter(p => !esNuevo(p) && Object.keys(p.cambios).length === 0).length,
    'Para eliminar': v.filter(p => valor(p, 'eliminar')).length,
    'Para modificar': v.filter(p => marcasDeCambios(p.cambios).includes('Modificar')).length,
    'Nuevos': v.filter(esNuevo).length
  }
  $('#contadores').replaceChildren(...Object.entries(n).map(([k, x]) => h('li', { class: 'contador' }, h('strong', { text: String(x) }), ` ${k}`)))
  const faltan = porSacar().length
  $('#pestana-fotos-n').textContent = `(${faltan})`
}

// ---------- Filtros ----------
function llenarSelect(select, valores, { etiqueta = v => v } = {}) {
  const actual = select.value
  select.replaceChildren(h('option', { value: '', text: 'Todas' }), ...valores.map(v => h('option', { value: v, text: etiqueta(v) })))
  if (valores.includes(actual)) select.value = actual
}

function prepararFiltros() {
  llenarSelect($('#filtro-categoria'), estado.categorias.map(c => c.id), { etiqueta: nombreCategoria })
  actualizarOpcionesFiltros()
  for (const id of ['#filtro-buscar', '#filtro-categoria', '#filtro-subcategoria', '#filtro-marca', '#filtro-web', '#filtro-stock', '#filtro-cambios']) {
    $(id).addEventListener(id === '#filtro-buscar' ? 'input' : 'change', () => {
      if (id === '#filtro-categoria') actualizarOpcionesFiltros()
      estado.mostrados = POR_PAGINA
      pintarLista()
    })
  }
  $('#filtro-limpiar').addEventListener('click', () => {
    for (const id of ['#filtro-buscar', '#filtro-categoria', '#filtro-subcategoria', '#filtro-marca', '#filtro-web', '#filtro-stock', '#filtro-cambios']) $(id).value = ''
    actualizarOpcionesFiltros()
    estado.mostrados = POR_PAGINA
    pintarLista()
  })
  $('#boton-mas').addEventListener('click', () => { estado.mostrados += POR_PAGINA; pintarLista() })
  $('#fotos-buscar').addEventListener('input', pintarFotos)
  $('#fotos-marca').addEventListener('change', pintarFotos)
}

function actualizarOpcionesFiltros() {
  const cat = $('#filtro-categoria').value
  const lista = estado.vista.filter(p => !cat || p.categoria === cat)
  llenarSelect($('#filtro-subcategoria'), [...new Set(lista.map(p => p.subcategoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')))
  llenarSelect($('#filtro-marca'), [...new Set(lista.map(p => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')))
  llenarSelect($('#fotos-marca'), [...new Set(estado.vista.map(p => p.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')))
}

function textoBusqueda(p) {
  return normalizar([p.nombre, p.marca, p.sku, p.codigo, p.subcategoria, ...(p.tallas || []).flatMap(t => [t.sku, t.codigo])].join(' '))
}

function filtrar() {
  const palabras = normalizar($('#filtro-buscar').value).split(/\s+/).filter(Boolean)
  const cat = $('#filtro-categoria').value
  const sub = $('#filtro-subcategoria').value
  const marca = $('#filtro-marca').value
  const web = $('#filtro-web').value
  const stock = $('#filtro-stock').value
  const cambios = $('#filtro-cambios').value
  return estado.vista.filter(p => {
    if (cat && p.categoria !== cat) return false
    if (sub && p.subcategoria !== sub) return false
    if (marca && p.marca !== marca) return false
    if (web === 'si' && !p.publicado) return false
    if (web === 'no' && p.publicado) return false
    if (stock && p.disponibilidad !== stock) return false
    if (cambios === 'precio-cambiado' && !precioCambiado(p)) return false
    if (cambios === 'sin-precio' && !sinPrecio(p)) return false
    if (cambios === 'eliminar' && !valor(p, 'eliminar')) return false
    if (cambios === 'modificar' && !marcasDeCambios(p.cambios).includes('Modificar')) return false
    if (cambios === 'foto-nueva' && !tieneFotoNueva(p)) return false
    if (cambios === 'nuevo' && !esNuevo(p)) return false
    if (cambios === 'sin-cambios' && (esNuevo(p) || Object.keys(p.cambios).length)) return false
    if (palabras.length) {
      const t = textoBusqueda(p)
      if (!palabras.every(w => t.includes(w))) return false
    }
    return true
  })
}

// ---------- Card ----------
function etiquetaMarca(texto) {
  const clase = { Eliminar: 'eliminar', Modificar: 'modificar', 'Precio cambiado': 'precio', 'Foto nueva': 'foto', OK: 'ok', Nuevo: 'nuevo' }[texto] || 'modificar'
  return h('span', { class: `marca marca--${clase}`, text: texto })
}

function bloqueFoto(p) {
  const f = valor(p, 'foto')
  const url = fotoUrl(p)
  const caja = h('div', { class: 'tarjeta__foto' })
  if (f && f.estado === 'procesando') caja.append(h('div', { class: 'foto-vacia foto-vacia--procesando', role: 'img', 'aria-label': 'Foto nueva procesándose' }, h('span', { text: 'Procesando foto…' })))
  else if (f && f.estado === 'error') caja.append(h('div', { class: 'foto-vacia', role: 'img', 'aria-label': 'Error en la foto' }, h('span', { text: f.aviso || 'No se pudo procesar la foto' })))
  else if (url) caja.append(h('img', { src: url, alt: p.nombre, loading: 'lazy', width: 300, height: 300 }))
  else caja.append(h('div', { class: 'foto-vacia', role: 'img', 'aria-label': 'Sin foto' }, h('img', { src: '/repo/assets/logo/logo-akyra-recortado.svg', alt: '', width: 160, height: 54 }), h('span', { text: 'Sin foto' })))
  if (!f && p.imagen && p.imagenTipo === 'referencial') caja.append(h('p', { class: 'nota-referencial', text: 'Imagen referencial' }))
  if (f) caja.append(h('p', { class: 'nota-foto', text: f.estado === 'lista' ? (f.eleccion === 'simple' ? 'Foto propia (sin quitar fondo)' : 'Foto propia') : 'Foto propia en proceso' }))
  return caja
}

function textoPrecioOriginal(p, talla) {
  const o = p.original
  if (!o) return null
  const precio = talla ? o.tallas?.find(t => t.talla === talla)?.precio : o.precio
  return typeof precio === 'number' ? precio : null
}

function filaPrecio(p, { talla = null } = {}) {
  const campo = talla ? `precio@${talla}` : 'precio'
  const actual = talla ? p.tallas.find(t => t.talla === talla)?.precio ?? null : p.precio ?? null
  const original = esNuevo(p) ? null : textoPrecioOriginal(p, talla)
  const cambiado = !esNuevo(p) && p.cambios[campo]?.valor != null
  const sufijo = p.granel ? ' por kg' : ''
  const etiqueta = talla ? `Talla ${talla}: ` : (p.granel ? 'Precio por kilo: ' : '')
  const fila = h('div', { class: `precio${cambiado ? ' precio--cambiado' : ''}`, dataset: { campo } })
  if (estado.editando === `${p.sku}|${campo}`) {
    const id = `precio-${p.sku}-${talla || 'unico'}`
    const entrada = h('input', { id, class: 'precio__campo', type: 'text', inputmode: 'numeric', autocomplete: 'off', value: actual ? formatoPrecio(actual) : '', 'aria-describedby': `${id}-ayuda` })
    fila.append(
      h('label', { for: id, class: 'precio__etiqueta', text: `${etiqueta || 'Precio'}${sufijo ? ' (por kg)' : ''}` }),
      entrada,
      h('p', { id: `${id}-ayuda`, class: 'ayuda', text: 'Solo números: 12345, 12.345 o $12.345. Enter guarda, Esc cancela.' }),
      h('div', { class: 'fila-botones' },
        h('button', { type: 'button', class: 'boton boton--primario', dataset: { accion: 'guardar-precio', campo }, text: 'Guardar precio' }),
        h('button', { type: 'button', class: 'boton', dataset: { accion: 'cancelar-precio' }, text: 'Cancelar' }))
    )
    queueMicrotask(() => { entrada.focus(); entrada.select() })
    return fila
  }
  const texto = actual ? `${formatoPrecio(actual)}${sufijo}` : 'Consultar precio (sin precio)'
  fila.append(...[
    h('span', { class: 'precio__etiqueta', text: etiqueta }),
    cambiado ? h('s', { class: 'precio__antes', text: original ? formatoPrecio(original) : 'Consultar precio', 'aria-label': `Antes: ${original ? formatoPrecio(original) : 'Consultar precio'}` }) : null,
    h('button', { type: 'button', class: `precio__valor${actual ? '' : ' precio__valor--sin'}`, dataset: { accion: 'editar-precio', campo }, 'aria-label': `${actual ? `Precio ${texto}` : texto}${talla ? `, talla ${talla}` : ''}. Tocar para cambiar`, text: texto }),
    cambiado ? h('span', { class: 'marca marca--precio', text: 'Precio cambiado' }) : null
  ].filter(Boolean))
  return fila
}

function interruptorDisponibilidad(p) {
  const conStock = p.disponibilidad === 'con-stock'
  return h('button', { type: 'button', role: 'switch', 'aria-checked': String(conStock), class: 'interruptor', dataset: { accion: 'disponibilidad' } },
    h('span', { class: 'interruptor__opcion', text: 'Con stock' }),
    h('span', { class: 'interruptor__opcion', text: 'Consultar' }))
}

function tarjeta(p) {
  const marcas = marcasDeCambios(p.cambios)
  const t = h('li', { class: `tarjeta${valor(p, 'eliminar') ? ' tarjeta--eliminar' : ''}${marcas.length ? ' tarjeta--marcada' : ''}`, dataset: { sku: p.sku } })
  const cabeza = h('div', { class: 'tarjeta__marcas' }, ...marcas.map(etiquetaMarca))
  if (!p.publicado) cabeza.append(h('span', { class: 'marca marca--oculto', text: p.motivo === 'falta-foto' ? 'No se ve en la web: falta foto' : 'No se ve en la web: eliminado' }))
  t.append(cabeza, bloqueFoto(p))
  const cuerpo = h('div', { class: 'tarjeta__cuerpo' },
    h('p', { class: 'tarjeta__marca', text: p.marca }),
    h('h3', { class: 'tarjeta__nombre', text: p.nombre }),
    h('p', { class: 'tarjeta__codigos', text: `SKU ${p.sku}${p.codigo ? ` · Código ${p.codigo}` : ''}` }),
    h('p', { class: 'tarjeta__categoria', text: [nombreCategoria(p.categoria), p.subcategoria].filter(Boolean).join(' · ') })
  )
  if (p.descripcion) cuerpo.append(h('p', { class: 'tarjeta__descripcion', text: p.descripcion }))
  if (p.tallas) {
    cuerpo.append(...p.tallas.map(x => filaPrecio(p, { talla: x.talla })))
    cuerpo.append(h('button', { type: 'button', class: 'boton boton--chico', dataset: { accion: 'mismo-precio' }, text: 'Mismo precio para todas las tallas' }))
  } else cuerpo.append(filaPrecio(p))
  cuerpo.append(h('p', { class: 'tarjeta__web', text: sinPrecio(p) ? 'En la web: "Consultar precio" (sin botón Añadir)' : 'En la web: se vende con botón Añadir' }))
  if (p.disponibilidad === 'consultar') cuerpo.append(h('p', { class: 'estado-consultar', text: 'Consultar disponibilidad' }))
  if (p.tallas) {
    const sin = p.tallas.filter(x => x.disponibilidad === 'consultar').map(x => x.talla)
    if (sin.length && sin.length < p.tallas.length) cuerpo.append(h('p', { class: 'tarjeta__nota', text: `Tallas para consultar: ${sin.join(', ')}` }))
  }
  cuerpo.append(h('div', { class: 'campo-interruptor' }, h('span', { text: 'Disponibilidad:' }), interruptorDisponibilidad(p)))
  if (valor(p, 'nota')) cuerpo.append(h('p', { class: 'tarjeta__nota', text: `Nota: ${valor(p, 'nota')}` }))
  if (valor(p, 'eliminar')?.motivo) cuerpo.append(h('p', { class: 'tarjeta__nota', text: `Motivo: ${valor(p, 'eliminar').motivo}` }))
  const f = valor(p, 'foto')
  if (f && f.aviso) cuerpo.append(h('p', { class: 'tarjeta__nota', text: f.aviso }))
  t.append(cuerpo)

  const acciones = h('div', { class: 'tarjeta__acciones' },
    h('label', { class: 'boton boton--archivo boton--foto' }, 'Sacar foto', h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto-visual', dataset: { accion: 'foto' }, 'aria-label': `Sacar foto de ${p.nombre}` })),
    h('label', { class: 'boton boton--archivo' }, 'Subir foto', h('input', { type: 'file', accept: 'image/*', class: 'oculto-visual', dataset: { accion: 'foto' }, 'aria-label': `Subir foto de ${p.nombre}` })),
    f && f.estado === 'lista' ? h('button', { type: 'button', class: 'boton', dataset: { accion: 'ver-foto' }, text: 'Ver foto nueva' }) : null,
    h('button', { type: 'button', class: 'boton', dataset: { accion: 'modificar' }, text: 'Modificar' }),
    valor(p, 'eliminar')
      ? h('button', { type: 'button', class: 'boton', dataset: { accion: 'no-eliminar' }, text: 'No eliminar' })
      : h('button', { type: 'button', class: 'boton boton--peligro', dataset: { accion: 'eliminar' }, text: 'Eliminar de la web' }),
    h('button', { type: 'button', class: 'boton', 'aria-pressed': String(!!valor(p, 'revisado')), dataset: { accion: 'revisado' }, text: valor(p, 'revisado') ? 'Revisado ✓' : 'Revisado, está bien' }),
    estado.pila[p.sku] ? h('button', { type: 'button', class: 'boton boton--chico', dataset: { accion: 'deshacer' }, text: 'Deshacer último cambio' }) : null
  )
  t.append(acciones, h('p', { class: 'tarjeta__soltar', text: 'Suelta la foto aquí' }))
  return t
}

// ---------- Lista ----------
function pintarLista() {
  const lista = $('#lista')
  const filtrados = filtrar()
  const visibles = filtrados.slice(0, estado.mostrados)
  const activo = document.activeElement
  const skuActivo = activo?.closest?.('[data-sku]')?.dataset.sku
  const accionActiva = activo?.dataset?.accion
  const existentes = new Map([...lista.children].map(li => [li.dataset.sku, li]))
  const nodos = visibles.map(p => {
    const editandoAqui = estado.editando && estado.editando.startsWith(p.sku + '|') && existentes.get(p.sku)?.querySelector('.precio__campo')
    return editandoAqui ? existentes.get(p.sku) : tarjeta(p)
  })
  lista.replaceChildren(...nodos)
  $('#conteo').textContent = filtrados.length ? `Mostrando ${visibles.length} de ${filtrados.length} productos` : 'No hay productos con esos filtros.'
  $('#boton-mas').hidden = visibles.length >= filtrados.length
  if (skuActivo && accionActiva) lista.querySelector(`[data-sku="${CSS.escape(skuActivo)}"] [data-accion="${accionActiva}"]`)?.focus({ preventScroll: true })
}

// ---------- Fotos por sacar ----------
function porSacar() {
  return estado.vista.filter(p => !tieneFoto(p) && !valor(p, 'eliminar'))
}

function filaFoto(p) {
  return h('li', { class: 'foto-pendiente', dataset: { sku: p.sku } },
    h('div', { class: 'foto-pendiente__datos' },
      h('p', { class: 'foto-pendiente__nombre', text: p.nombre }),
      h('p', { class: 'foto-pendiente__marca', text: p.marca }),
      h('p', { class: 'foto-pendiente__codigo' }, 'Código de barras: ', h('strong', { text: p.codigo || 'sin código' })),
      h('p', { class: 'foto-pendiente__codigo' }, 'SKU: ', h('strong', { text: p.sku })),
      p.motivo === 'falta-foto' ? h('p', { class: 'marca marca--oculto', text: 'No se ve en la web: falta foto' }) : null),
    h('div', { class: 'foto-pendiente__acciones' },
      h('label', { class: 'boton boton--archivo boton--foto boton--grande' }, 'Sacar foto', h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto-visual', dataset: { accion: 'foto' }, 'aria-label': `Sacar foto de ${p.nombre}` })),
      h('label', { class: 'boton boton--archivo' }, 'Subir foto', h('input', { type: 'file', accept: 'image/*', class: 'oculto-visual', dataset: { accion: 'foto' }, 'aria-label': `Subir foto de ${p.nombre}` })))
  )
}

function gruposPorCategoria(lista) {
  const salida = []
  for (const c of estado.categorias) {
    const items = lista.filter(p => p.categoria === c.id)
    if (items.length) salida.push(h('h4', { class: 'grupo__titulo', text: `${c.nombre} (${items.length})` }), h('ul', { class: 'lista-fotos' }, ...items.map(filaFoto)))
  }
  return salida
}

const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Punta_Arenas' }).format(new Date())
function pintarFotos() {
  const palabras = normalizar($('#fotos-buscar').value).split(/\s+/).filter(Boolean)
  const marca = $('#fotos-marca').value
  const coincide = p => (!marca || p.marca === marca) && (!palabras.length || palabras.every(w => textoBusqueda(p).includes(w)))
  const pendientes = porSacar()
  const sacadasHoy = estado.vista.filter(p => tieneFotoNueva(p) && new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Punta_Arenas' }).format(new Date(valor(p, 'foto').fecha)) === hoy()).length
  $('#fotos-contador').textContent = `Faltan ${pendientes.length} fotos · Sacadas hoy ${sacadasHoy}`
  const filtradas = pendientes.filter(coincide)
  const obligatorias = filtradas.filter(p => p.marcaFotoObligatoria)
  const resto = filtradas.filter(p => !p.marcaFotoObligatoria)
  $('#fotos-listas').replaceChildren(
    h('section', { class: 'grupo' }, h('h3', { class: 'subtitulo', text: `Primero: Mondo Mascota, Marben Pets y Leon Pet (${obligatorias.length}) — sin foto no se publican` }), ...gruposPorCategoria(obligatorias)),
    h('section', { class: 'grupo' }, h('h3', { class: 'subtitulo', text: `Otras marcas (${resto.length})` }), ...gruposPorCategoria(resto))
  )
  const nuevas = estado.vista.filter(tieneFotoNueva).sort((a, b) => String(valor(b, 'foto').fecha).localeCompare(String(valor(a, 'foto').fecha)))
  $('#fotos-nuevas').replaceChildren(...nuevas.map(p => {
    const url = fotoUrl(p)
    return h('li', { class: 'miniatura', dataset: { sku: p.sku } },
      url ? h('img', { src: url, alt: p.nombre, width: 120, height: 120, loading: 'lazy' }) : h('div', { class: 'foto-vacia foto-vacia--procesando', text: 'Procesando…' }),
      h('p', { text: p.nombre }),
      valor(p, 'foto').estado === 'lista' ? h('button', { type: 'button', class: 'boton boton--chico', dataset: { accion: 'ver-foto' }, text: 'Ver foto' }) : null)
  }))
  const referenciales = estado.vista.filter(p => p.imagenTipo === 'referencial' && !tieneFotoNueva(p) && !valor(p, 'eliminar')).filter(coincide)
  $('#fotos-referenciales').replaceChildren(...gruposPorCategoria(referenciales))
}

// ---------- Cambios ----------
async function cambiar(sku, campo, valorNuevo, { mensaje = 'Guardado' } = {}) {
  try {
    await api('/api/cambio', { metodo: 'POST', datos: { sku, campo, valor: valorNuevo } })
    avisar(mensaje)
  } catch (e) { avisar(e.message, { error: true }) }
}

function confirmar(titulo, texto, { si = 'Sí, guardar', no = 'No, corregir' } = {}) {
  return new Promise(resolver => {
    abrirDialogo(titulo, [
      h('p', { class: 'confirmar__texto', text: texto }),
      h('div', { class: 'fila-botones' },
        h('button', { type: 'button', class: 'boton boton--primario', onclick: () => { resolver(true); cerrarDialogo() }, text: si }),
        h('button', { type: 'button', class: 'boton', onclick: () => { resolver(false); cerrarDialogo() }, text: no }))
    ], { alCerrar: () => resolver(false) })
  })
}

// Guarda un precio (de la card o del formulario) con las validaciones pedidas
async function guardarPrecio(p, campo, texto) {
  const nuevo = leerPrecio(texto)
  if (nuevo === null) { avisar('Escribe el precio solo con números, por ejemplo 12.345', { error: true }); return false }
  const talla = campo.split('@')[1] || null
  const actual = talla ? p.tallas.find(t => t.talla === talla)?.precio ?? null : p.precio ?? null
  if (cambioGrande(actual, nuevo)) {
    const ok = await confirmar('¿Seguro?', `Antes: ${formatoPrecio(actual)}, ahora: ${formatoPrecio(nuevo)}. Cambia más de la mitad.`)
    if (!ok) return false
  }
  const original = esNuevo(p) ? null : textoPrecioOriginal(p, talla)
  await cambiar(p.sku, campo, nuevo === original ? null : nuevo, { mensaje: 'Precio guardado' })
  return true
}

async function subirFoto(sku, archivo) {
  if (!archivo) return
  if (archivo.type && !archivo.type.startsWith('image/')) { avisar('Ese archivo no es una imagen.', { error: true }); return }
  estado.subidas.add(sku)
  avisar('Subiendo foto…')
  try {
    await api(`/api/foto?sku=${encodeURIComponent(sku)}`, { metodo: 'POST', cuerpo: archivo, tipo: archivo.type || 'image/jpeg' })
    avisar('Foto guardada')
  } catch (e) { estado.subidas.delete(sku); avisar(e.message, { error: true }) }
}

// ---------- Diálogo ----------
let alCerrarDialogo = null
function abrirDialogo(titulo, contenido, { sku = null, alCerrar = null } = {}) {
  const d = $('#dialogo')
  $('#dialogo-titulo').textContent = titulo
  $('#dialogo-cuerpo').replaceChildren(...[contenido].flat())
  $('#dialogo-alerta').hidden = true
  estado.dialogoSku = sku
  alCerrarDialogo = alCerrar
  if (!d.open) d.showModal()
}
function cerrarDialogo() {
  const d = $('#dialogo')
  estado.dialogoSku = null
  const fn = alCerrarDialogo
  alCerrarDialogo = null
  if (d.open) d.close()
  fn?.()
}
let refrescoDialogo = null // función que repinta el diálogo actual con datos nuevos (comparación de fotos)
function refrescarDialogo() { refrescoDialogo?.() }

function avisoDeOtroDispositivo(sku, dispositivo) {
  if (estado.dialogoSku !== sku || dispositivo === MI_DISPOSITIVO) return
  const alerta = $('#dialogo-alerta')
  alerta.textContent = `Este producto se actualizó desde otro dispositivo (${dispositivo}). Lo que escribiste no se borró.`
  alerta.hidden = false
}

// ---- Eliminar ----
function dialogoEliminar(p) {
  const entrada = h('input', { id: 'motivo', type: 'text', maxlength: 200, autocomplete: 'off', placeholder: 'Ej: ya no se vende' })
  abrirDialogo(`Eliminar de la web: ${p.nombre}`, [
    h('p', { text: 'El producto no se publicará. Puedes deshacerlo después.' }),
    h('label', { class: 'campo', for: 'motivo' }, 'Motivo (opcional)', entrada),
    h('div', { class: 'fila-botones' },
      h('button', { type: 'button', class: 'boton boton--peligro', text: 'Eliminar de la web', onclick: async () => { cerrarDialogo(); await cambiar(p.sku, 'eliminar', { motivo: entrada.value.trim().slice(0, 200) }) } }),
      h('button', { type: 'button', class: 'boton', text: 'Cancelar', onclick: cerrarDialogo }))
  ], { sku: p.sku })
  entrada.focus()
}

// ---- Comparar foto original / procesada ----
function dialogoFoto(sku) {
  const pintar = () => {
    const p = estado.porSku.get(sku)
    const f = p && valor(p, 'foto')
    if (!f) { refrescoDialogo = null; cerrarDialogo(); return }
    const cuerpo = [h('p', { text: p.nombre })]
    if (f.estado !== 'lista') cuerpo.push(h('p', { class: 'cargando', text: f.estado === 'error' ? (f.aviso || 'Error') : 'Procesando la foto… (unos segundos)' }))
    else {
      cuerpo.push(h('div', { class: 'comparar' },
        h('figure', {}, h('img', { src: `/${f.original}`, alt: 'Foto original', width: 300, height: 300 }), h('figcaption', { text: 'Original' })),
        h('figure', {}, h('img', { src: `/${f.procesada}?v=${f.id}`, alt: 'Foto procesada (sin fondo)', width: 300, height: 300 }), h('figcaption', { text: f.sinFondo ? 'Procesada (fondo blanco)' : 'Procesada (no se pudo quitar el fondo)' })),
        h('figure', {}, h('img', { src: `/${f.simple}?v=${f.id}`, alt: 'Sin quitar el fondo', width: 300, height: 300 }), h('figcaption', { text: 'Sin quitar fondo' }))))
      if (f.aviso) cuerpo.push(h('p', { class: 'tarjeta__nota', text: f.aviso }))
      cuerpo.push(h('p', { text: `Ahora se usa: ${f.eleccion === 'simple' ? 'sin quitar fondo' : 'la procesada'}.` }))
      cuerpo.push(h('div', { class: 'fila-botones' },
        h('button', { type: 'button', class: 'boton boton--primario', text: 'Usar esta', onclick: () => elegirFoto(sku, 'procesada') }),
        h('button', { type: 'button', class: 'boton', text: 'Usar sin quitar fondo', onclick: () => elegirFoto(sku, 'simple') }),
        h('label', { class: 'boton boton--archivo boton--peligro' }, 'Repetir foto', h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto-visual', onchange: async e => { const archivo = e.target.files[0]; await api('/api/foto/elegir', { metodo: 'POST', datos: { sku, eleccion: 'repetir' } }).catch(() => {}); if (archivo) await subirFoto(sku, archivo) } }))))
    }
    abrirDialogo('Foto nueva', cuerpo, { sku, alCerrar: () => { refrescoDialogo = null } })
  }
  refrescoDialogo = pintar
  pintar()
}
async function elegirFoto(sku, eleccion) {
  try {
    await api('/api/foto/elegir', { metodo: 'POST', datos: { sku, eleccion } })
    refrescoDialogo = null
    cerrarDialogo()
    avisar('Foto guardada')
  } catch (e) { avisar(e.message, { error: true }) }
}

// ---- Modificar / Agregar ----
function opcionesCategoria(seleccion) {
  return estado.categorias.map(c => h('option', { value: c.id, text: c.nombre, selected: c.id === seleccion }))
}
function listaDatos(id, valores) {
  return h('datalist', { id }, ...[...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')).map(v => h('option', { value: v })))
}
function campoTexto(id, etiqueta, valorActual, { multilinea = false, lista = null, requerido = false } = {}) {
  const entrada = multilinea
    ? h('textarea', { id, rows: 3, maxlength: 600 })
    : h('input', { id, type: 'text', maxlength: 200, autocomplete: 'off', list: lista, required: requerido })
  entrada.value = valorActual ?? ''
  return h('label', { class: 'campo', for: id }, etiqueta, entrada)
}
function selectDisponibilidad(id, etiqueta, actual) {
  return h('label', { class: 'campo', for: id }, etiqueta,
    h('select', { id }, h('option', { value: 'con-stock', text: 'Con stock', selected: actual === 'con-stock' }), h('option', { value: 'consultar', text: 'Consultar disponibilidad', selected: actual !== 'con-stock' })))
}
function miniTarjeta(titulo, d) {
  return h('div', { class: 'mini' },
    h('p', { class: 'mini__titulo', text: titulo }),
    h('p', { class: 'tarjeta__marca', text: d.marca }),
    h('p', { class: 'tarjeta__nombre', text: d.nombre }),
    d.descripcion ? h('p', { class: 'tarjeta__descripcion', text: d.descripcion }) : null,
    h('p', { text: `${nombreCategoria(d.categoria)}${d.subcategoria ? ' · ' + d.subcategoria : ''}` }),
    h('p', { class: 'mini__precio', text: d.precioTexto }),
    d.disponibilidad === 'consultar' ? h('p', { class: 'estado-consultar', text: 'Consultar disponibilidad' }) : h('p', { text: 'Con stock' }))
}
const textoPrecios = d => (d.tallas ? d.tallas.map(t => `${t.talla}: ${t.precio ? formatoPrecio(t.precio) : 'consultar'}`).join(' · ') : (d.precio ? `${formatoPrecio(d.precio)}${d.granel ? ' por kg' : ''}` : 'Consultar precio'))

function seccionFotoFormulario(skuDestino) {
  const enlace = h('input', { id: 'f-enlace', type: 'url', placeholder: 'https://…', autocomplete: 'off' })
  const archivoElegido = { archivo: null }
  const nombreArchivo = h('p', { class: 'ayuda', text: '' })
  const alElegir = e => { archivoElegido.archivo = e.target.files[0] || null; nombreArchivo.textContent = archivoElegido.archivo ? `Foto elegida: ${archivoElegido.archivo.name}` : '' }
  const nodo = h('fieldset', { class: 'grupo-campos' }, h('legend', { text: 'Foto' }),
    h('div', { class: 'fila-botones' },
      h('label', { class: 'boton boton--archivo boton--foto' }, 'Sacar foto', h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto-visual', onchange: alElegir })),
      h('label', { class: 'boton boton--archivo' }, 'Subir imagen', h('input', { type: 'file', accept: 'image/*', class: 'oculto-visual', onchange: alElegir }))),
    nombreArchivo,
    h('label', { class: 'campo', for: 'f-enlace' }, 'O pegar el enlace de una imagen', enlace))
  return {
    nodo,
    async enviar(sku = skuDestino) {
      if (archivoElegido.archivo) await subirFoto(sku, archivoElegido.archivo)
      else if (enlace.value.trim()) {
        avisar('Descargando la imagen…')
        await api('/api/foto-enlace', { metodo: 'POST', datos: { sku, enlace: enlace.value.trim() } }).then(() => avisar('Foto guardada')).catch(e => avisar(e.message, { error: true }))
      }
    }
  }
}

function dialogoModificar(p) {
  const actual = { nombre: p.nombre, marca: p.marca, descripcion: p.descripcion || '', categoria: p.categoria, subcategoria: p.subcategoria || '', precio: p.precio ?? null, granel: !!p.granel, disponibilidad: p.disponibilidad, tallas: p.tallas ? p.tallas.map(t => ({ ...t })) : null, nota: valor(p, 'nota') || '' }
  const o = p.original || actual
  const campos = h('div', { class: 'formulario' },
    campoTexto('f-nombre', 'Nombre que se muestra', actual.nombre),
    campoTexto('f-marca', 'Marca', actual.marca, { lista: 'lista-marcas' }),
    listaDatos('lista-marcas', estado.vista.map(x => x.marca)),
    campoTexto('f-descripcion', 'Texto descriptivo (card y ficha)', actual.descripcion, { multilinea: true }),
    h('label', { class: 'campo', for: 'f-categoria' }, 'Categoría', h('select', { id: 'f-categoria' }, ...opcionesCategoria(actual.categoria))),
    campoTexto('f-subcategoria', 'Subcategoría', actual.subcategoria, { lista: 'lista-subcategorias' }),
    listaDatos('lista-subcategorias', estado.vista.filter(x => x.categoria === actual.categoria).map(x => x.subcategoria))
  )
  if (actual.tallas) {
    const grupo = h('fieldset', { class: 'grupo-campos' }, h('legend', { text: 'Precio y disponibilidad por talla' }))
    for (const t of actual.tallas) {
      const precio = h('input', { id: `f-precio-${t.talla}`, type: 'text', inputmode: 'numeric', autocomplete: 'off', class: 'precio__campo' })
      precio.value = t.precio ? formatoPrecio(t.precio) : ''
      grupo.append(h('div', { class: 'fila-talla' },
        h('label', { class: 'campo', for: `f-precio-${t.talla}` }, `Talla ${t.talla}: precio`, precio),
        selectDisponibilidad(`f-disp-${t.talla}`, `Talla ${t.talla}: disponibilidad`, t.disponibilidad)))
    }
    grupo.append(h('button', { type: 'button', class: 'boton boton--chico', text: 'Mismo precio para todas las tallas', onclick: () => {
      const primero = grupo.querySelector('.precio__campo').value
      for (const c of grupo.querySelectorAll('.precio__campo')) c.value = primero
      actualizarVista()
    } }))
    campos.append(grupo)
  } else {
    const precio = h('input', { id: 'f-precio', type: 'text', inputmode: 'numeric', autocomplete: 'off', class: 'precio__campo' })
    precio.value = actual.precio ? formatoPrecio(actual.precio) : ''
    campos.append(h('label', { class: 'campo', for: 'f-precio' }, actual.granel ? 'Precio por kilo' : 'Precio', precio), selectDisponibilidad('f-disp', 'Disponibilidad', actual.disponibilidad))
  }
  const foto = seccionFotoFormulario(p.sku)
  campos.append(foto.nodo, campoTexto('f-nota', 'Nota para Joaquín', actual.nota, { multilinea: true }))
  if (p.marcaFotoObligatoria && !tieneFoto(p)) campos.append(h('p', { class: 'alerta', text: 'Este producto no se ve en la web porque no tiene foto. Con una foto pasa a publicarse.' }))

  const leer = () => {
    const d = {
      nombre: $('#f-nombre').value.trim(), marca: $('#f-marca').value.trim(), descripcion: $('#f-descripcion').value.trim(),
      categoria: $('#f-categoria').value, subcategoria: $('#f-subcategoria').value.trim(), nota: $('#f-nota').value.trim(), granel: actual.granel
    }
    if (actual.tallas) d.tallas = actual.tallas.map(t => ({ talla: t.talla, precio: leerPrecio($(`#f-precio-${CSS.escape(t.talla)}`).value), textoPrecio: $(`#f-precio-${CSS.escape(t.talla)}`).value, disponibilidad: $(`#f-disp-${CSS.escape(t.talla)}`).value }))
    else { d.precio = leerPrecio($('#f-precio').value); d.textoPrecio = $('#f-precio').value; d.disponibilidad = $('#f-disp').value }
    if (actual.tallas) d.disponibilidad = d.tallas.some(t => t.disponibilidad === 'con-stock') ? 'con-stock' : 'consultar'
    return d
  }
  const comparacion = h('div', { class: 'comparar-datos' })
  const actualizarVista = () => {
    const d = leer()
    comparacion.replaceChildren(miniTarjeta('Cómo está ahora', { ...actual, precioTexto: textoPrecios(actual) }), miniTarjeta('Cómo quedaría', { ...d, precioTexto: textoPrecios(d) }))
  }
  campos.addEventListener('input', actualizarVista)
  campos.addEventListener('change', actualizarVista)

  const guardar = async () => {
    const d = leer()
    const datos = {}
    const poner = (campo, nuevo, enOriginal, enActual) => {
      if (nuevo === enActual || (nuevo === '' && !enActual)) return
      datos[campo] = (nuevo === enOriginal || nuevo === '') ? null : nuevo
    }
    for (const campo of ['nombre', 'marca', 'descripcion', 'categoria', 'subcategoria']) poner(campo, d[campo], o[campo] ?? '', actual[campo] ?? '')
    if (d.nota !== actual.nota) datos.nota = d.nota || null
    const preciosAConfirmar = []
    if (actual.tallas) {
      for (const t of d.tallas) {
        const antes = actual.tallas.find(x => x.talla === t.talla)
        const original = o.tallas?.find(x => x.talla === t.talla)
        if (t.textoPrecio.trim() && t.precio === null) { avisar(`Precio de la talla ${t.talla}: escribe solo números, por ejemplo 12.345`, { error: true }); return }
        if (t.precio !== null && t.precio !== antes.precio) { datos[`precio@${t.talla}`] = t.precio === original?.precio ? null : t.precio; preciosAConfirmar.push([antes.precio, t.precio]) }
        if (t.disponibilidad !== antes.disponibilidad) datos[`disponibilidad@${t.talla}`] = t.disponibilidad === original?.disponibilidad ? null : t.disponibilidad
      }
    } else {
      if (d.textoPrecio.trim() && d.precio === null) { avisar('Escribe el precio solo con números, por ejemplo 12.345', { error: true }); return }
      if (d.precio !== null && d.precio !== actual.precio) { datos.precio = d.precio === o.precio ? null : d.precio; preciosAConfirmar.push([actual.precio, d.precio]) }
      if (d.disponibilidad !== actual.disponibilidad) datos.disponibilidad = d.disponibilidad === o.disponibilidad ? null : d.disponibilidad
    }
    for (const [antes, ahora] of preciosAConfirmar) {
      if (cambioGrande(antes, ahora) && !(await confirmar('¿Seguro?', `Antes: ${formatoPrecio(antes)}, ahora: ${formatoPrecio(ahora)}. Cambia más de la mitad.`))) { dialogoModificar(p); return }
    }
    try {
      if (Object.keys(datos).length) await api('/api/cambios', { metodo: 'POST', datos: { sku: p.sku, datos } })
      await foto.enviar()
      cerrarDialogo()
      avisar(Object.keys(datos).some(k => k.startsWith('precio')) ? 'Precio guardado' : 'Guardado')
    } catch (e) { avisar(e.message, { error: true }) }
  }
  abrirDialogo(`Modificar: ${p.nombre}`, [campos, h('h3', { class: 'subtitulo', text: 'Antes y después' }), comparacion,
    h('div', { class: 'fila-botones fila-botones--pie' },
      h('button', { type: 'button', class: 'boton boton--primario', text: 'Guardar cambios', onclick: guardar }),
      h('button', { type: 'button', class: 'boton', text: 'Cancelar', onclick: cerrarDialogo }))], { sku: p.sku })
  actualizarVista()
  $('#f-nombre').focus()
}

function buscarCodigo(codigo) {
  const c = String(codigo || '').trim()
  if (!c) return null
  const enCatalogo = estado.vista.find(p => p.codigo === c || p.tallas?.some(t => t.codigo === c))
  if (enCatalogo) return { tipo: 'catalogo', producto: enCatalogo }
  const enBase = estado.codigosBaseRosa.find(x => x.codigo === c)
  if (enBase) return { tipo: 'base', nombre: enBase.nombre }
  return null
}

function dialogoNuevo(inicial = {}) {
  const avisoCodigo = h('p', { class: 'alerta', hidden: true, role: 'alert' })
  const avisoMarca = h('p', { class: 'alerta', hidden: true })
  const tallasLista = h('div', { class: 'tallas-nuevas' })
  const agregarTalla = (t = {}) => {
    const fila = h('div', { class: 'fila-talla' },
      h('label', { class: 'campo' }, 'Talla', h('input', { type: 'text', maxlength: 12, class: 'n-talla', value: t.talla || '' })),
      h('label', { class: 'campo' }, 'Precio', h('input', { type: 'text', inputmode: 'numeric', class: 'n-talla-precio precio__campo', value: t.precio || '' })),
      h('label', { class: 'campo' }, 'Disponibilidad', h('select', { class: 'n-talla-disp' }, h('option', { value: 'con-stock', text: 'Con stock' }), h('option', { value: 'consultar', text: 'Consultar disponibilidad', selected: true }))),
      h('button', { type: 'button', class: 'boton boton--chico', text: 'Quitar talla', onclick: () => fila.remove() }))
    tallasLista.append(fila)
  }
  const tipoPrecio = h('select', { id: 'n-tipo' }, h('option', { value: 'unico', text: 'Un precio' }), h('option', { value: 'tallas', text: 'Precio por talla' }), h('option', { value: 'granel', text: 'Granel (precio por kilo)' }))
  const bloquePrecioUnico = h('label', { class: 'campo', for: 'n-precio' }, 'Precio', h('input', { id: 'n-precio', type: 'text', inputmode: 'numeric', autocomplete: 'off', class: 'precio__campo' }))
  const bloqueTallas = h('fieldset', { class: 'grupo-campos', hidden: true }, h('legend', { text: 'Tallas' }), tallasLista, h('button', { type: 'button', class: 'boton boton--chico', text: 'Agregar talla', onclick: () => agregarTalla() }))
  tipoPrecio.addEventListener('change', () => {
    bloqueTallas.hidden = tipoPrecio.value !== 'tallas'
    bloquePrecioUnico.hidden = tipoPrecio.value === 'tallas'
    bloquePrecioUnico.firstChild.textContent = tipoPrecio.value === 'granel' ? 'Precio por kilo' : 'Precio'
    if (tipoPrecio.value === 'tallas' && !tallasLista.children.length) { agregarTalla(); agregarTalla() }
  })
  const foto = seccionFotoFormulario(null)
  const codigoEntrada = h('input', { id: 'n-codigo', type: 'text', inputmode: 'numeric', autocomplete: 'off', value: inicial.codigo || '' })
  const revisarCodigo = () => {
    const r = buscarCodigo(codigoEntrada.value)
    avisoCodigo.replaceChildren()
    avisoCodigo.hidden = !r
    if (r?.tipo === 'catalogo') avisoCodigo.append(`Ese código ya existe en el catálogo: ${r.producto.nombre} (SKU ${r.producto.sku}). `, h('button', { type: 'button', class: 'boton boton--chico', text: 'Ver ese producto', onclick: () => { cerrarDialogo(); mostrarProducto(r.producto.sku) } }))
    else if (r?.tipo === 'base') avisoCodigo.append(`Ese código ya está en la Base Rosa: ${r.nombre}. Revisa que no sea el mismo producto.`)
  }
  codigoEntrada.addEventListener('input', revisarCodigo)
  const revisarMarca = () => {
    const marca = marcaConFotoObligatoria({ marca: $('#n-marca').value, nombre: $('#n-nombre').value })
    avisoMarca.hidden = !marca
    avisoMarca.textContent = marca ? `${marca}: sin foto, este producto no se publicará en la web.` : ''
  }
  const leerFoto = h('label', { class: 'boton boton--archivo boton--chico' }, 'Fotografiar código', h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto-visual', onchange: async e => {
    const codigos = await leerCodigoDeFoto(e.target.files[0])
    if (codigos?.length) { codigoEntrada.value = codigos[0]; revisarCodigo() }
  } }))
  const campos = h('div', { class: 'formulario' },
    campoTexto('n-nombre', 'Nombre *', inicial.nombre || '', { requerido: true }),
    h('label', { class: 'campo', for: 'n-codigo' }, 'Código de barras', codigoEntrada), leerFoto, avisoCodigo,
    campoTexto('n-marca', 'Marca', '', { lista: 'lista-marcas-n' }), listaDatos('lista-marcas-n', estado.vista.map(x => x.marca)), avisoMarca,
    h('label', { class: 'campo', for: 'n-categoria' }, 'Categoría *', h('select', { id: 'n-categoria' }, ...opcionesCategoria('accesorios'))),
    campoTexto('n-subcategoria', 'Subcategoría', '', { lista: 'lista-subcategorias-n' }), listaDatos('lista-subcategorias-n', estado.vista.map(x => x.subcategoria)),
    h('label', { class: 'campo', for: 'n-tipo' }, 'Tipo de precio', tipoPrecio), bloquePrecioUnico, bloqueTallas,
    selectDisponibilidad('n-disp', 'Disponibilidad', 'consultar'),
    campoTexto('n-descripcion', 'Descripción', '', { multilinea: true }),
    foto.nodo,
    campoTexto('n-nota', 'Nota para Joaquín', '', { multilinea: true }))
  campos.addEventListener('input', revisarMarca)

  const guardar = async () => {
    const nombre = $('#n-nombre').value.trim()
    if (!nombre) { avisar('Falta el nombre del producto.', { error: true }); $('#n-nombre').focus(); return }
    const datos = { nuevo: true, nombre, codigo: codigoEntrada.value.trim() || null, marca: $('#n-marca').value.trim() || null, categoria: $('#n-categoria').value, subcategoria: $('#n-subcategoria').value.trim() || null, disponibilidad: $('#n-disp').value, descripcion: $('#n-descripcion').value.trim() || null, nota: $('#n-nota').value.trim() || null }
    if (tipoPrecio.value === 'tallas') {
      const tallas = [...tallasLista.children].map(f => ({ talla: f.querySelector('.n-talla').value.trim(), precio: leerPrecio(f.querySelector('.n-talla-precio').value), disponibilidad: f.querySelector('.n-talla-disp').value })).filter(t => t.talla)
      if (!tallas.length) { avisar('Agrega al menos una talla.', { error: true }); return }
      datos.tallas = tallas
    } else {
      const texto = $('#n-precio').value
      const precio = leerPrecio(texto)
      if (texto.trim() && precio === null) { avisar('Escribe el precio solo con números, por ejemplo 12.345', { error: true }); return }
      datos.precio = precio
      if (tipoPrecio.value === 'granel') datos.granel = true
    }
    for (const k of Object.keys(datos)) if (datos[k] === null) delete datos[k]
    const sku = `NUEVO-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`
    try {
      await api('/api/cambios', { metodo: 'POST', datos: { sku, datos } })
      await foto.enviar(sku)
      cerrarDialogo()
      avisar('Guardado')
      mostrarProducto(sku)
    } catch (e) { avisar(e.message, { error: true }) }
  }
  abrirDialogo('Agregar producto nuevo', [campos, h('div', { class: 'fila-botones fila-botones--pie' },
    h('button', { type: 'button', class: 'boton boton--primario', text: 'Guardar producto nuevo', onclick: guardar }),
    h('button', { type: 'button', class: 'boton', text: 'Cancelar', onclick: cerrarDialogo }))])
  if (inicial.codigo) revisarCodigo()
  $('#n-nombre').focus()
}

// ---- Código de barras ----
async function leerCodigoDeFoto(archivo) {
  if (!archivo) return null
  avisar('Leyendo el código de barras…')
  try {
    const r = await api('/api/codigo-barras', { metodo: 'POST', cuerpo: archivo, tipo: archivo.type || 'image/jpeg' })
    if (!r.codigos?.length) { avisar('No pude leer el código. Prueba con más luz y el código más cerca.', { error: true }); return [] }
    return r.codigos
  } catch (e) { avisar(e.message, { error: true }); return null }
}

async function buscarPorFotoDeCodigo(archivo) {
  const codigos = await leerCodigoDeFoto(archivo)
  if (!codigos?.length) return
  for (const c of codigos) {
    const r = buscarCodigo(c)
    if (r?.tipo === 'catalogo') { avisar(`Código ${c}: ${r.producto.nombre}`); mostrarProducto(r.producto.sku); return }
  }
  const c = codigos[0]
  const enBase = buscarCodigo(c)
  abrirDialogo('Código no encontrado', [
    h('p', {}, 'El código ', h('strong', { text: c }), enBase?.tipo === 'base' ? ` está en la Base Rosa (${enBase.nombre}) pero no en el catálogo.` : ' no está en el catálogo.'),
    h('div', { class: 'fila-botones' },
      h('button', { type: 'button', class: 'boton boton--primario', text: 'Agregar producto nuevo', onclick: () => dialogoNuevo({ codigo: c, nombre: enBase?.nombre || '' }) }),
      h('button', { type: 'button', class: 'boton', text: 'Cerrar', onclick: cerrarDialogo }))])
}

function mostrarProducto(sku) {
  cambiarPestana('catalogo')
  for (const id of ['#filtro-categoria', '#filtro-subcategoria', '#filtro-marca', '#filtro-web', '#filtro-stock', '#filtro-cambios']) $(id).value = ''
  $('#filtro-buscar').value = sku
  estado.mostrados = POR_PAGINA
  recalcular()
  pintarLista()
  const card = $(`#lista [data-sku="${CSS.escape(sku)}"]`)
  if (card) { card.classList.add('tarjeta--destacada'); card.scrollIntoView({ block: 'center' }); card.querySelector('button, label')?.focus({ preventScroll: true }) }
}

// ---- Conectar celular ----
async function dialogoConectar() {
  let datos
  try { datos = await api('/api/conexion') } catch (e) { avisar(e.message, { error: true }); return }
  const cuerpo = []
  if (!datos.enlaces.length) {
    cuerpo.push(h('p', { class: 'alerta', text: 'Este PC no está conectado a ninguna red Wi‑Fi.' }),
      h('ol', { class: 'pasos' },
        h('li', { text: 'En el celular, activa la "Zona Wi‑Fi" (Compartir internet / Punto de acceso).' }),
        h('li', { text: 'En el PC, haz clic en el ícono de Wi‑Fi (abajo a la derecha) y conéctate a la red del celular.' }),
        h('li', { text: 'Cuando diga "Conectado", vuelve a tocar "Conectar celular" para ver el código QR.' })))
  } else {
    if (datos.qr) {
      const svg = new DOMParser().parseFromString(datos.qr, 'image/svg+xml').documentElement
      svg.setAttribute('role', 'img')
      svg.setAttribute('aria-label', 'Código QR para abrir la herramienta en el celular')
      svg.setAttribute('class', 'qr')
      cuerpo.push(document.importNode(svg, true))
    }
    cuerpo.push(h('ol', { class: 'pasos' },
      h('li', { text: 'El celular debe estar en la misma red Wi‑Fi que este PC (o el PC conectado a la zona Wi‑Fi del celular).' }),
      h('li', { text: 'Abre la cámara del celular y apunta al código QR.' }),
      h('li', { text: 'Toca el enlace que aparece. La herramienta se abre directo.' })))
    cuerpo.push(h('p', { class: 'ayuda' }, 'Dirección: ', h('code', { text: datos.enlaces[0].url })))
    if (datos.enlaces.length > 1) cuerpo.push(h('p', { class: 'ayuda', text: `Si no conecta, prueba: ${datos.enlaces.slice(1).map(e => e.url).join('  ·  ')}` }))
    const publica = (datos.perfilRed || []).find(r => r.categoria === 'Public')
    if (publica) cuerpo.push(h('p', { class: 'alerta', text: `La red "${publica.nombre}" está marcada como Pública en Windows y bloquea al celular. Cámbiala a Privada: Configuración → Red e Internet → Wi‑Fi → ${publica.nombre} → Tipo de perfil de red: Privada.` }))
  }
  abrirDialogo('Conectar celular', cuerpo)
}

// ---- Exportar ----
async function exportar() {
  avisar('Exportando…')
  try {
    const { resumen } = await api('/api/exportar', { metodo: 'POST' })
    const c = resumen.conteos
    abrirDialogo('Exportado', [
      h('p', { text: 'Se guardaron estos archivos en la carpeta revision-catalogo:' }),
      h('ul', { class: 'pasos' },
        h('li', { text: 'cambios-catalogo.xlsx (Eliminar, Modificar, Precios, Disponibilidad, Fotos nuevas y Agregar)' }),
        resumen.archivos.inventario ? h('li', { text: `Inventario_Mascoteria_Akyra_v54_precios.xlsx (${resumen.inventario.preciosEscritos} precios nuevos y ${resumen.inventario.nuevosAgregados} productos nuevos en Base Rosa)` }) : h('li', { text: 'No encontré el Excel de inventario para hacer la copia v54.' }),
        h('li', { text: 'revision.json (con el resumen) y ajustes-catalogo.propuesto.json' })),
      h('p', { text: `Eliminar: ${c.eliminar} · Modificar: ${c.modificar} · Precios: ${c.precios} · Disponibilidad: ${c.disponibilidad} · Fotos nuevas: ${c.fotosNuevas} · Agregar: ${c.agregar}` }),
      h('div', { class: 'fila-botones' }, h('button', { type: 'button', class: 'boton boton--primario', text: 'Listo', onclick: cerrarDialogo }))])
  } catch (e) { avisar(e.message, { error: true }) }
}

// ---------- Eventos de la pantalla ----------
function cambiarPestana(nombre) {
  estado.pestana = nombre
  $('#pestana-catalogo').setAttribute('aria-pressed', String(nombre === 'catalogo'))
  $('#pestana-fotos').setAttribute('aria-pressed', String(nombre === 'fotos'))
  $('#vista-catalogo').hidden = nombre !== 'catalogo'
  $('#vista-fotos').hidden = nombre !== 'fotos'
  if (nombre === 'catalogo') pintarLista()
  else pintarFotos()
}

function activarPantalla() {
  $('#pestana-catalogo').addEventListener('click', () => cambiarPestana('catalogo'))
  $('#pestana-fotos').addEventListener('click', () => cambiarPestana('fotos'))
  $('#boton-conectar').addEventListener('click', dialogoConectar)
  $('#boton-nuevo').addEventListener('click', () => dialogoNuevo())
  $('#boton-exportar').addEventListener('click', exportar)
  $('#entrada-codigo').addEventListener('change', e => { buscarPorFotoDeCodigo(e.target.files[0]); e.target.value = '' })
  $('#dialogo-cerrar').addEventListener('click', cerrarDialogo)
  $('#dialogo').addEventListener('close', () => {
    // Al cerrar se vacía (así no quedan campos ocultos con los mismos nombres)
    setTimeout(() => { if (!$('#dialogo').open) $('#dialogo-cuerpo').replaceChildren() }, 0)
    if (estado.dialogoSku !== null || alCerrarDialogo) { estado.dialogoSku = null; const fn = alCerrarDialogo; alCerrarDialogo = null; fn?.() }
  })

  const main = $('#contenido')
  main.addEventListener('click', async e => {
    const boton = e.target.closest('button[data-accion]')
    if (!boton) return
    const sku = boton.closest('[data-sku]')?.dataset.sku
    const p = estado.porSku.get(sku)
    if (!p) return
    const accion = boton.dataset.accion
    if (accion === 'editar-precio') { estado.editando = `${sku}|${boton.dataset.campo}`; pintarLista() }
    else if (accion === 'cancelar-precio') { estado.editando = null; pintarLista() }
    else if (accion === 'guardar-precio') {
      const campo = boton.dataset.campo
      const entrada = boton.closest('.precio').querySelector('.precio__campo')
      if (await guardarPrecio(p, campo, entrada.value)) { estado.editando = null; pintarLista() }
    } else if (accion === 'mismo-precio') {
      const entrada = h('input', { id: 'mismo-precio', type: 'text', inputmode: 'numeric', class: 'precio__campo', autocomplete: 'off' })
      abrirDialogo(`Mismo precio para todas las tallas: ${p.nombre}`, [h('label', { class: 'campo', for: 'mismo-precio' }, 'Precio para todas las tallas', entrada),
        h('div', { class: 'fila-botones' }, h('button', { type: 'button', class: 'boton boton--primario', text: 'Guardar precio', onclick: async () => {
          const precio = leerPrecio(entrada.value)
          if (precio === null) { avisar('Escribe el precio solo con números, por ejemplo 12.345', { error: true }); return }
          cerrarDialogo()
          const grande = p.tallas.find(t => cambioGrande(t.precio, precio))
          if (grande && !(await confirmar('¿Seguro?', `Antes: ${formatoPrecio(grande.precio)}, ahora: ${formatoPrecio(precio)}. Cambia más de la mitad.`))) return
          const datos = Object.fromEntries(p.tallas.map(t => [`precio@${t.talla}`, precio === textoPrecioOriginal(p, t.talla) ? null : precio]))
          await api('/api/cambios', { metodo: 'POST', datos: { sku, datos } }).then(() => avisar('Precio guardado')).catch(err => avisar(err.message, { error: true }))
        } }), h('button', { type: 'button', class: 'boton', text: 'Cancelar', onclick: cerrarDialogo }))], { sku })
      entrada.focus()
    } else if (accion === 'disponibilidad') {
      const nuevo = p.disponibilidad === 'con-stock' ? 'consultar' : 'con-stock'
      const original = p.original?.disponibilidad
      if (p.tallas) {
        const datos = { disponibilidad: !esNuevo(p) && nuevo === original ? null : nuevo }
        for (const t of p.tallas) datos[`disponibilidad@${t.talla}`] = null
        await api('/api/cambios', { metodo: 'POST', datos: { sku, datos } }).then(() => avisar('Guardado')).catch(err => avisar(err.message, { error: true }))
      } else await cambiar(sku, 'disponibilidad', !esNuevo(p) && nuevo === original ? null : nuevo)
    } else if (accion === 'modificar') dialogoModificar(p)
    else if (accion === 'eliminar') dialogoEliminar(p)
    else if (accion === 'no-eliminar') await cambiar(sku, 'eliminar', null)
    else if (accion === 'revisado') await cambiar(sku, 'revisado', valor(p, 'revisado') ? null : true)
    else if (accion === 'deshacer') {
      try { await api('/api/deshacer', { metodo: 'POST', datos: { sku } }); avisar('Cambio deshecho') } catch (err) { avisar(err.message, { error: true }) }
    } else if (accion === 'ver-foto') dialogoFoto(sku)
  })
  main.addEventListener('keydown', async e => {
    if (!e.target.matches('#lista .precio__campo')) return
    const fila = e.target.closest('.precio')
    if (e.key === 'Escape') { e.preventDefault(); estado.editando = null; pintarLista() }
    if (e.key === 'Enter') {
      e.preventDefault()
      const p = estado.porSku.get(e.target.closest('[data-sku]').dataset.sku)
      if (await guardarPrecio(p, fila.dataset.campo, e.target.value)) { estado.editando = null; pintarLista() }
    }
  })
  main.addEventListener('change', e => {
    if (!e.target.matches('input[type="file"][data-accion="foto"]')) return
    const sku = e.target.closest('[data-sku]').dataset.sku
    subirFoto(sku, e.target.files[0])
    e.target.value = ''
  })
  // Arrastrar y soltar una foto sobre la card (PC)
  main.addEventListener('dragover', e => {
    const card = e.target.closest('[data-sku]')
    if (!card || !e.dataTransfer?.types.includes('Files')) return
    e.preventDefault()
    card.classList.add('tarjeta--soltar')
  })
  main.addEventListener('dragleave', e => e.target.closest('[data-sku]')?.classList.remove('tarjeta--soltar'))
  main.addEventListener('drop', e => {
    const card = e.target.closest('[data-sku]')
    if (!card) return
    e.preventDefault()
    card.classList.remove('tarjeta--soltar')
    subirFoto(card.dataset.sku, e.dataTransfer.files[0])
  })
}

// ---------- Sincronización en vivo (Server-Sent Events) ----------
function pintarPresencia() {
  const { PC, Celular } = estado.presencia
  $('#presencia').replaceChildren(
    h('span', { class: `presencia__item${PC ? ' presencia__item--si' : ''}`, text: PC ? 'PC conectado' : 'PC desconectado' }),
    h('span', { class: `presencia__item${Celular ? ' presencia__item--si' : ''}`, text: Celular ? 'Celular conectado' : 'Celular desconectado' }))
}

async function recargarEstado() {
  const datos = await api('/api/estado')
  estado.cambios = datos.cambios
  estado.pila = datos.pila
  estado.version = datos.version
}

function conectarEventos() {
  const fuente = new EventSource(`/api/eventos?dispositivo=${encodeURIComponent(MI_DISPOSITIVO)}`)
  fuente.onmessage = async e => {
    const ev = JSON.parse(e.data)
    if (ev.tipo === 'hola') {
      if (ev.version !== estado.version) { await recargarEstado(); repintar() }
    } else if (ev.tipo === 'presencia') {
      estado.presencia = { PC: ev.PC, Celular: ev.Celular }
      pintarPresencia()
    } else if (ev.tipo === 'cambio') {
      const c = estado.cambios[ev.sku] || (estado.cambios[ev.sku] = {})
      if (ev.valor === null) delete c[ev.campo]
      else c[ev.campo] = ev.valor
      if (!Object.keys(c).length) delete estado.cambios[ev.sku]
      if (ev.pila) estado.pila[ev.sku] = ev.pila
      else delete estado.pila[ev.sku]
      estado.version = ev.version
      avisoDeOtroDispositivo(ev.sku, ev.dispositivo)
      // La foto que subió este dispositivo ya está procesada: se muestran original y procesada
      if (ev.campo === 'foto' && ev.valor?.valor?.estado === 'lista' && estado.subidas.has(ev.sku)) {
        estado.subidas.delete(ev.sku)
        recalcular()
        if (!$('#dialogo').open) dialogoFoto(ev.sku)
      }
      repintar()
    }
  }
  fuente.onerror = () => {
    estado.presencia = { PC: MI_DISPOSITIVO === 'PC' && false, Celular: false }
    $('#presencia').textContent = 'Sin conexión con el PC: reintentando…'
  }
}

// ---------- Inicio ----------
async function iniciar() {
  activarPantalla()
  try {
    const [catalogo] = await Promise.all([api('/api/catalogo'), recargarEstado()])
    estado.base = catalogo.base
    estado.ajustesRepo = catalogo.ajustesRepo
    estado.codigosBaseRosa = catalogo.codigosBaseRosa
    estado.categorias = catalogo.categorias
    estado.originales = new Map(publicarCatalogo(estado.base, estado.ajustesRepo || undefined, { existeImagen: () => true }).todos.map(p => [p.sku, p]))
  } catch (e) {
    $('#cargando').textContent = `No se pudo cargar el catálogo: ${e.message}`
    return
  }
  recalcular()
  prepararFiltros()
  $('#cargando').hidden = true
  cambiarPestana(MI_DISPOSITIVO === 'Celular' ? 'fotos' : 'catalogo')
  pintarContadores()
  conectarEventos()
  if (MI_DISPOSITIVO === 'PC' && !sessionStorage.getItem('akyra_qr_visto') && !parametros.has('sin-qr')) {
    sessionStorage.setItem('akyra_qr_visto', '1')
    dialogoConectar()
  }
}
iniciar()
