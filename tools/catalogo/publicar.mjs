// ============================================================
// QUÉ SE PUBLICA — reglas del catálogo sin Gesnex (noviembre 2026).
// Función pura: la usan el generador (tools/generar-catalogo.mjs), tools/catalogo/aplicar-fotos.mjs,
// la herramienta de revisión (tools/revision/) y las pruebas.
//
// Orden:
//   1. Catálogo base (Excel: Resumen + Base Rosa) con la disponibilidad que traía el Excel.
//   2. Ajustes del catálogo (tools/catalogo/ajustes-catalogo.json): productos agregados, datos
//      modificados (nombre, marca, descripción, precio, categoría, disponibilidad, foto) y excluidos.
//      Los ajustes SIEMPRE ganan: regenerar desde el Excel no devuelve un dato a su valor original.
//   3. Regla de publicación:
//        - excluido ("Eliminar de la web") → no se publica;
//        - Mondo Mascota / Marben Pets / Leon Pet (y sus variantes) SIN ninguna foto → no se publica;
//        - todo lo demás se publica, tenga o no stock y tenga o no foto.
// El stock ya no oculta nada: solo decide el aviso "Consultar disponibilidad".
// ============================================================
import { disponibilidadDesdeUnidades, normalizarDisponibilidad } from '../../js/stock.mjs'
import { CAMPOS_PUBLICOS, CATEGORIAS, categoriaDesdeExcel, deducirEdad, deducirSubcategoria, formatoMarca, precioPublico, sinTildes, slug } from './reglas.mjs'

// Marcas que sin foto no se publican. Se revisan fabricante, marca y nombre (todas las formas de escribirlas:
// "Mundo Mascota", "Marbenpets", "Marben Pet", "Wonder Dog/Cat/Pet", "León Pet", "... MONDO (11177)").
const MARCAS_CON_FOTO_OBLIGATORIA = [
  { id: 'mondo', nombre: 'Mondo Mascota', patron: /\bmondo\b|\bmundo\s*mascota\b/ },
  { id: 'marben', nombre: 'Marben Pets', patron: /\bmarben\s*pets?\b|\bmarbenpets?\b|\bmarben\b|\bwonder\s*(dog|cat|pet)s?\b/ },
  { id: 'leon', nombre: 'Leon Pet', patron: /\bleon\s*pets?\b|\bleonpet\b/ }
]

// Accesorios y ropa de estas marcas: ocultos "hasta nuevo aviso" salvo los que tengan foto exacta (oficial o propia).
// Pedido de la dueña, noviembre 2026. Snacks y alimentos de estas marcas siguen la regla de arriba.
const MARCAS_ACCESORIOS_OCULTOS = [...MARCAS_CON_FOTO_OBLIGATORIA, { id: 'buen-amigo', nombre: 'Buen Amigo', patron: /\bbuen\s*amigo\b/ }]
const CATEGORIAS_ACCESORIOS = new Set(['accesorios', 'ropa'])
// Accesorios cargados en otra categoría (por ejemplo un arnés en "Perros"); los de salud e higiene no cuentan
const NOMBRE_ACCESORIO = /\b(arnes|collar|correa|pechera|tirador|chaqueta|parka|chaleco|polera|poleron|sweater|sueter|vestido|impermeable|bandana|cama|cojin|frazada|manta|juguete|pelota|plato|comedero|bebedero|alfombra|transportador|rascador|mochila|bozal|placa|jaula|arenero|pala|peine)\b/

export function accesorioOculto(producto) {
  const esAccesorio = CATEGORIAS_ACCESORIOS.has(producto.categoria) ||
    (producto.categoria !== 'salud-higiene' && NOMBRE_ACCESORIO.test(sinTildes(producto.nombre || '').toLowerCase()))
  if (!esAccesorio) return null
  if (producto.imagen && producto.imagenTipo !== 'referencial') return null
  const texto = ' ' + sinTildes([producto.fabricante, producto.marca, producto.nombreExcel, producto.nombre].filter(Boolean).join(' | ')).toLowerCase() + ' '
  return MARCAS_ACCESORIOS_OCULTOS.find(m => m.patron.test(texto))?.nombre || null
}

// Devuelve el nombre de la marca ("Mondo Mascota", "Marben Pets", "Leon Pet") o null.
export function marcaConFotoObligatoria(producto) {
  const texto = ' ' + sinTildes([producto.fabricante, producto.marca, producto.nombreExcel, producto.nombre].filter(Boolean).join(' | ')).toLowerCase() + ' '
  return MARCAS_CON_FOTO_OBLIGATORIA.find(m => m.patron.test(texto))?.nombre || null
}

// Acepta el nombre del Excel ("Perros", "Salud/Higiene") o el id del sitio ("perros", "salud-higiene").
export function categoriaValida(valor) {
  if (!valor) return null
  return categoriaDesdeExcel(valor) || (CATEGORIAS.some(c => c.id === valor) ? valor : null)
}

export function ajustesVacios() {
  return { version: 1, excluidos: {}, modificados: {}, agregados: [] }
}

const copia = x => JSON.parse(JSON.stringify(x))
const tienePrecio = v => typeof v === 'number' && v > 0

// Precio desde los ajustes: número entero positivo; 1, 0 o vacío = sin precio ("Consultar precio").
function precioAjuste(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  return precioPublico(valor)
}

// Producto nuevo (de los ajustes) en el mismo formato que los del Excel.
export function productoAgregado(a) {
  const categoria = categoriaValida(a.categoria) || 'accesorios'
  const p = {
    id: slug(a.sku), sku: a.sku, nombre: String(a.nombre || '').trim(), marca: formatoMarca(a.marca || 'Genérico'),
    categoria, subcategoria: a.subcategoria || deducirSubcategoria(categoria, a.nombre || ''),
    codigo: a.codigo || null, fabricante: a.marca || '', nombreExcel: a.nombre || '', nuevo: true
  }
  const edad = deducirEdad(categoria, a.nombre || '')
  if (edad) p.edad = edad
  if (Array.isArray(a.tallas) && a.tallas.length) {
    p.tallas = a.tallas.map((t, i) => ({ talla: String(t.talla), sku: t.sku || `${a.sku}-${i + 1}`, precio: precioAjuste(t.precio) }))
  } else p.precio = precioAjuste(a.precio)
  if (a.granel || categoria === 'granel') p.granel = true
  if (a.descripcion) p.descripcion = String(a.descripcion)
  if (a.imagen) { p.imagen = a.imagen; p.imagenTipo = a.imagenTipo === 'referencial' ? 'referencial' : 'exacta' }
  return p
}

// base: { productos: [...con campos internos codigo/fabricante/nombreExcel], unidades: { SKU: n | null } }
// ajustes: tools/catalogo/ajustes-catalogo.json
// existeImagen(ruta): para no publicar una foto de los ajustes que todavía no está en assets/ (por defecto: sí existe)
// Devuelve { todos, publicados, disponibilidad, resumen }:
//   todos       → cada producto con `publicado` (true/false) y `motivo` ('eliminado' | 'accesorio-sin-foto-oficial' | 'falta-foto' | null)
//   publicados  → listos para productos.json (solo campos públicos)
//   disponibilidad → { SKU: 'con-stock' | 'consultar' } de los publicados (para stock.json)
export function publicarCatalogo(base, ajustes = ajustesVacios(), { existeImagen = () => true } = {}) {
  const aj = { ...ajustesVacios(), ...ajustes }
  const unidades = base.unidades || {}
  const todos = []
  const disp = {}

  for (const original of base.productos) {
    const p = copia(original)
    if (p.tallas) for (const t of p.tallas) disp[t.sku] = disponibilidadDesdeUnidades(unidades[t.sku] ?? null, false)
    else disp[p.sku] = disponibilidadDesdeUnidades(unidades[p.sku] ?? null, !!p.granel)
    todos.push(p)
  }
  const skusUsados = new Set(todos.flatMap(p => (p.tallas ? [p.sku, ...p.tallas.map(t => t.sku)] : [p.sku])))
  for (const a of aj.agregados || []) {
    if (!a || !a.sku || !a.nombre || skusUsados.has(a.sku)) continue
    const p = productoAgregado(a)
    if (p.tallas) for (const t of p.tallas) disp[t.sku] = normalizarDisponibilidad(a.tallas.find(x => String(x.talla) === t.talla)?.disponibilidad ?? a.disponibilidad)
    else disp[p.sku] = normalizarDisponibilidad(a.disponibilidad)
    skusUsados.add(p.sku)
    todos.push(p)
  }

  for (const p of todos) {
    const m = aj.modificados?.[p.sku]
    if (m) {
      for (const campo of ['nombre', 'marca', 'descripcion', 'subcategoria']) if (typeof m[campo] === 'string' && m[campo].trim()) p[campo] = m[campo].trim()
      if (m.categoria && categoriaValida(m.categoria)) p.categoria = categoriaValida(m.categoria)
      if ('precio' in m && !p.tallas) p.precio = precioAjuste(m.precio)
      if (typeof m.granel === 'boolean') { if (m.granel) p.granel = true; else delete p.granel }
      if (m.disponibilidad) {
        if (p.tallas) for (const t of p.tallas) disp[t.sku] = normalizarDisponibilidad(m.disponibilidad)
        else disp[p.sku] = normalizarDisponibilidad(m.disponibilidad)
      }
      if (p.tallas && m.tallas) {
        for (const t of p.tallas) {
          const mt = m.tallas[t.talla]
          if (!mt) continue
          if ('precio' in mt) t.precio = precioAjuste(mt.precio)
          if (mt.disponibilidad) disp[t.sku] = normalizarDisponibilidad(mt.disponibilidad)
        }
      }
      if (m.imagen && existeImagen(m.imagen)) { p.imagen = m.imagen; p.imagenTipo = m.imagenTipo === 'referencial' ? 'referencial' : 'exacta' }
    }
    const excluido = aj.excluidos?.[p.sku]
    const marca = marcaConFotoObligatoria(p)
    p.marcaFotoObligatoria = marca
    const accesorio = accesorioOculto(p)
    if (excluido) { p.publicado = false; p.motivo = 'eliminado' } else if (accesorio) { p.publicado = false; p.motivo = 'accesorio-sin-foto-oficial' } else if (marca && !p.imagen) { p.publicado = false; p.motivo = 'falta-foto' } else { p.publicado = true; p.motivo = null }
    p.disponibilidad = p.tallas ? (p.tallas.some(t => disp[t.sku] === 'con-stock') ? 'con-stock' : 'consultar') : disp[p.sku]
    if (p.tallas) for (const t of p.tallas) t.disponibilidad = disp[t.sku]
  }

  const publicados = todos.filter(p => p.publicado).map(soloPublico)
  const disponibilidad = {}
  for (const p of todos.filter(x => x.publicado)) {
    if (p.tallas) for (const t of p.tallas) disponibilidad[t.sku] = disp[t.sku]
    else disponibilidad[p.sku] = disp[p.sku]
  }
  const sinFoto = todos.filter(p => !p.imagen)
  const resumen = {
    total: todos.length,
    publicados: publicados.length,
    consultarDisponibilidad: todos.filter(p => p.publicado && p.disponibilidad === 'consultar').length,
    eliminados: todos.filter(p => p.motivo === 'eliminado').length,
    ocultosFaltaFoto: todos.filter(p => p.motivo === 'falta-foto').length,
    ocultosAccesorios: todos.filter(p => p.motivo === 'accesorio-sin-foto-oficial').length,
    ocultosFaltaFotoPorMarca: Object.fromEntries(MARCAS_CON_FOTO_OBLIGATORIA.map(m => [m.nombre, todos.filter(p => p.motivo === 'falta-foto' && p.marcaFotoObligatoria === m.nombre).length])),
    sinFoto: sinFoto.length,
    sinFotoPublicados: sinFoto.filter(p => p.publicado).length,
    consultarPrecio: todos.filter(p => p.publicado && (p.tallas ? !p.tallas.some(t => tienePrecio(t.precio)) : !tienePrecio(p.precio))).length,
    consultarPrecioTotal: todos.filter(p => (p.tallas ? !p.tallas.some(t => tienePrecio(t.precio)) : !tienePrecio(p.precio))).length
  }
  return { todos, publicados, disponibilidad, resumen }
}

// Deja solo los campos que pueden ir a productos.json (nunca código de barras, fabricante ni stock).
export function soloPublico(p) {
  const salida = {}
  for (const [k, v] of Object.entries(p)) {
    if (!CAMPOS_PUBLICOS.has(k) || v === undefined) continue
    if (k === 'tallas') salida.tallas = v.map(t => ({ talla: t.talla, sku: t.sku, precio: t.precio ?? null }))
    else salida[k] = v
  }
  return salida
}
