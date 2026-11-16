// ============================================================
// Botón "Exportar" de la herramienta de revisión:
//   1. revision-catalogo/cambios-catalogo.xlsx (6 hojas: Eliminar, Modificar, Precios, Disponibilidad,
//      Fotos nuevas, Agregar);
//   2. COPIA del inventario (…v53.xlsx → revision-catalogo/Inventario_Mascoteria_Akyra_v54_precios.xlsx) con los
//      precios nuevos en la columna D (VALOR DE VENTA) de "Base Rosa (1004)" y los productos nuevos al final.
//      Se edita el XML de esa hoja directamente: el original no se toca y las fórmulas del libro se conservan
//      (Excel las recalcula al abrir);
//   3. revision-catalogo/ajustes-catalogo.propuesto.json: los ajustes listos para aplicar en otra tarea
//      (NO se aplican al sitio todavía) y el resumen dentro de revision.json.
// ============================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { CATEGORIAS } from '../catalogo/reglas.mjs'
import { cambiosAAjustes, formatoPrecio } from './convertir.mjs'

const HOJA_BASE = 'Base Rosa (1004)'
const NOMBRE_CATEGORIA = new Map(CATEGORIAS.map(c => [c.id, c.excel]))
const ETIQUETA = { nombre: 'Nombre', marca: 'Marca', descripcion: 'Descripción', categoria: 'Categoría', subcategoria: 'Subcategoría', disponibilidad: 'Disponibilidad', nota: 'Nota para Joaquín' }
const texto = v => (v === null || v === undefined ? '' : String(v))
const disp = v => (v === 'con-stock' ? 'Disponible' : v === 'consultar' ? 'Consultar disponibilidad' : texto(v))

// productos: los de la herramienta ({ sku, codigo, nombre, marca, precio, tallas, disponibilidad, categoria, ... } originales)
// cambios: revision.datos.cambios
export function armarFilas(productos, cambios) {
  const porSku = new Map(productos.map(p => [p.sku, p]))
  const v = (c, campo) => c?.[campo]?.valor ?? null
  const filas = { eliminar: [], modificar: [], precios: [], disponibilidad: [], fotos: [], agregar: [] }
  for (const [sku, c] of Object.entries(cambios)) {
    if (v(c, 'nuevo')) {
      if (v(c, 'eliminar')) continue
      const tallas = v(c, 'tallas') || []
      filas.agregar.push({
        sku, codigo: v(c, 'codigo') || '', nombre: v(c, 'nombre') || '', marca: v(c, 'marca') || '', categoria: NOMBRE_CATEGORIA.get(v(c, 'categoria')) || texto(v(c, 'categoria')),
        subcategoria: v(c, 'subcategoria') || '', precio: tallas.length ? tallas.map(t => `${t.talla}: ${formatoPrecio(v(c, `precio@${t.talla}`) ?? t.precio)}`).join(' · ') : (v(c, 'precio') ?? ''),
        precioNumero: tallas.length ? null : v(c, 'precio'), granel: v(c, 'granel') ? 'Sí (precio por kg)' : '', disponibilidad: disp(v(c, 'disponibilidad') || 'consultar'),
        descripcion: v(c, 'descripcion') || '', foto: v(c, 'foto') ? 'Sí' : 'No', nota: v(c, 'nota') || ''
      })
      continue
    }
    const p = porSku.get(sku)
    if (!p) continue
    const base = { sku, codigo: p.codigo || '', nombre: p.nombre }
    if (v(c, 'eliminar')) filas.eliminar.push({ ...base, marca: p.marca, motivo: v(c, 'eliminar').motivo || '', dispositivo: c.eliminar.dispositivo, fecha: c.eliminar.fecha })
    for (const campo of Object.keys(ETIQUETA)) {
      if (v(c, campo) === null) continue
      const antes = campo === 'disponibilidad' ? disp(p.disponibilidad) : campo === 'categoria' ? NOMBRE_CATEGORIA.get(p.categoria) : texto(p[campo])
      const despues = campo === 'disponibilidad' ? disp(v(c, campo)) : campo === 'categoria' ? NOMBRE_CATEGORIA.get(v(c, campo)) || v(c, campo) : texto(v(c, campo))
      filas.modificar.push({ ...base, dato: ETIQUETA[campo], antes: campo === 'nota' ? '' : antes, despues })
      if (campo === 'disponibilidad') filas.disponibilidad.push({ ...base, talla: '', antes, despues })
    }
    for (const [campo, dato] of Object.entries(c)) {
      const [nombreCampo, talla] = campo.split('@')
      if (dato?.valor == null) continue
      if (nombreCampo === 'precio') {
        const t = talla ? p.tallas?.find(x => x.talla === talla) : null
        const anterior = talla ? t?.precio ?? null : p.precio ?? null
        const nuevo = dato.valor
        filas.precios.push({
          ...base, codigo: (t?.codigo || p.codigo) || '', skuVariante: t?.sku || sku, talla: talla || (p.granel ? 'por kg' : ''),
          anterior, nuevo, diferencia: anterior ? nuevo - anterior : null, porcentaje: anterior ? (nuevo - anterior) / anterior : null
        })
        filas.modificar.push({ ...base, dato: `Precio${talla ? ` talla ${talla}` : p.granel ? ' por kg' : ''}`, antes: anterior ? formatoPrecio(anterior) : 'Consultar precio', despues: formatoPrecio(nuevo) })
      } else if (nombreCampo === 'disponibilidad' && talla) {
        const t = p.tallas?.find(x => x.talla === talla)
        filas.disponibilidad.push({ ...base, talla, antes: disp(t?.disponibilidad), despues: disp(dato.valor) })
      }
    }
    if (v(c, 'foto')) filas.fotos.push({ ...base, marca: p.marca, archivo: v(c, 'foto').archivo, original: v(c, 'foto').original || '', sinFondo: v(c, 'foto').sinFondo ? 'Sí' : 'No', antes: p.imagen ? (p.imagenTipo === 'referencial' ? 'Referencial' : 'Exacta') : 'Sin foto', dispositivo: c.foto.dispositivo })
  }
  return filas
}

function hoja(libro, nombre, columnas, filas) {
  const h = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] })
  h.columns = columnas.map(([header, key, width, numFmt]) => ({ header, key, width, style: numFmt ? { numFmt } : {} }))
  h.getRow(1).font = { bold: true }
  h.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6DC' } }
  for (const f of filas) h.addRow(f)
  h.autoFilter = { from: 'A1', to: { row: 1, column: columnas.length } }
  return h
}

export async function exportarExcelCambios(filas, ruta) {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Revisión del catálogo Akyra'
  const PESO = '"$"#,##0'
  hoja(libro, 'Eliminar', [['SKU', 'sku', 16], ['Código de barras', 'codigo', 18], ['Nombre', 'nombre', 48], ['Marca', 'marca', 18], ['Motivo', 'motivo', 40], ['Desde', 'dispositivo', 10], ['Fecha', 'fecha', 22]], filas.eliminar)
  hoja(libro, 'Modificar', [['SKU', 'sku', 16], ['Código de barras', 'codigo', 18], ['Nombre', 'nombre', 44], ['Dato', 'dato', 20], ['Antes', 'antes', 40], ['Después', 'despues', 40]], filas.modificar)
  hoja(libro, 'Precios', [['SKU', 'skuVariante', 16], ['Código de barras', 'codigo', 18], ['Nombre', 'nombre', 44], ['Talla', 'talla', 10], ['Precio anterior', 'anterior', 15, PESO], ['Precio nuevo', 'nuevo', 15, PESO], ['Diferencia $', 'diferencia', 14, PESO], ['Diferencia %', 'porcentaje', 13, '0.0%']], filas.precios)
  hoja(libro, 'Disponibilidad', [['SKU', 'sku', 16], ['Código de barras', 'codigo', 18], ['Nombre', 'nombre', 44], ['Talla', 'talla', 10], ['Antes', 'antes', 24], ['Después', 'despues', 24]], filas.disponibilidad)
  hoja(libro, 'Fotos nuevas', [['SKU', 'sku', 16], ['Código de barras', 'codigo', 18], ['Nombre', 'nombre', 44], ['Marca', 'marca', 18], ['Foto antes', 'antes', 12], ['Archivo', 'archivo', 36], ['Original', 'original', 40], ['Fondo quitado', 'sinFondo', 12], ['Desde', 'dispositivo', 10]], filas.fotos)
  hoja(libro, 'Agregar', [['SKU provisorio', 'sku', 18], ['Código de barras', 'codigo', 18], ['Nombre', 'nombre', 44], ['Marca', 'marca', 18], ['Categoría', 'categoria', 16], ['Subcategoría', 'subcategoria', 20], ['Precio', 'precio', 22], ['Granel', 'granel', 16], ['Disponibilidad', 'disponibilidad', 22], ['Descripción', 'descripcion', 40], ['Foto', 'foto', 8], ['Nota', 'nota', 40]], filas.agregar)
  await libro.xlsx.writeFile(ruta)
}

// ---------- Copia del inventario con precios nuevos (edición del XML de la hoja) ----------
const escaparXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function rutaHoja(zip, nombre) {
  const wb = await zip.file('xl/workbook.xml').async('string')
  const etiqueta = [...wb.matchAll(/<sheet\b[^>]*>/g)].map(m => m[0]).find(t => t.includes(`name="${escaparXml(nombre)}"`))
  if (!etiqueta) throw new Error(`El inventario no tiene la hoja "${nombre}"`)
  const id = etiqueta.match(/r:id="([^"]+)"/)[1]
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string')
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0]).find(t => t.includes(`Id="${id}"`))
  const destino = rel.match(/Target="([^"]+)"/)[1].replace(/^\/?xl\//, '')
  return { ruta: `xl/${destino}`, wb }
}

function celdaNumero(ref, valor, estilo) {
  return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''} t="n"><v>${valor}</v></c>`
}
function celdaTexto(ref, valor, estilo) {
  return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`
}

// precios: Map(códigoDeBarras → precio nuevo); nuevos: [{ codigo, nombre, precio, marca, categoria }]
// Devuelve { preciosEscritos, sinFila: [códigos que no están en Base Rosa], nuevosAgregados }
export async function copiaInventarioConPrecios({ origen, destino, precios, nuevos = [] }) {
  const zip = await JSZip.loadAsync(readFileSync(origen))
  const { ruta, wb } = await rutaHoja(zip, HOJA_BASE)
  let xml = await zip.file(ruta).async('string')
  // Textos compartidos (por si algún código de barras quedó guardado como texto)
  const archivoTextos = zip.file('xl/sharedStrings.xml')
  const compartidos = archivoTextos
    ? [...(await archivoTextos.async('string')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(t => t[1]).join(''))
    : []
  const pendientes = new Map(precios)
  let escritos = 0
  let ultimaConDatos = 0
  let estiloFila = null
  xml = xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g, (fila, numero, contenido) => {
    const n = Number(numero)
    const celdaA = contenido.match(new RegExp(`<c r="A${n}"[^>]*?(?:/>|>([\\s\\S]*?)</c>)`))
    let valorA = celdaA?.[1]?.match(/<v>([^<]*)<\/v>/)?.[1] ?? celdaA?.[1]?.match(/<t[^>]*>([^<]*)<\/t>/)?.[1]
    if (valorA !== undefined && celdaA[0].includes('t="s"')) valorA = compartidos[Number(valorA)]
    if (n >= 5 && valorA) { ultimaConDatos = n; estiloFila = estiloFila || fila.match(/<c r="A\d+" s="(\d+)"/)?.[1] }
    if (n < 5 || !valorA) return fila
    const codigo = /^\d+(\.\d+)?(E\+\d+)?$/i.test(valorA.trim()) ? BigInt(Math.round(Number(valorA))).toString() : valorA.trim()
    if (!pendientes.has(codigo)) return fila
    const precio = pendientes.get(codigo)
    pendientes.delete(codigo)
    escritos++
    const reD = new RegExp(`<c r="D${n}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`)
    if (reD.test(fila)) {
      return fila.replace(reD, (_c, atributos) => {
        const estilo = atributos.match(/s="(\d+)"/)?.[1]
        return celdaNumero(`D${n}`, precio, estilo)
      })
    }
    // Sin celda D: se agrega después de la C (o al principio de la fila)
    return fila.replace(new RegExp(`(<c r="C${n}"[^>]*?(?:/>|>[\\s\\S]*?</c>))`), `$1${celdaNumero(`D${n}`, precio)}`)
  })

  // Productos nuevos: filas al final (A código, B nombre, D precio, F fabricante, G categoría)
  const estilos = { A: estiloFila || '', B: '', D: '', F: '', G: '' }
  const modelo = xml.match(new RegExp(`<row\\b[^>]*\\br="${ultimaConDatos}"[^>]*>[\\s\\S]*?</row>`))?.[0] || ''
  for (const col of Object.keys(estilos)) estilos[col] = modelo.match(new RegExp(`<c r="${col}${ultimaConDatos}" s="(\\d+)"`))?.[1] || estilos[col]
  let filaNueva = ultimaConDatos
  const agregadas = []
  for (const p of nuevos) {
    filaNueva++
    const r = filaNueva
    const celdas = [
      p.codigo && /^\d{1,15}$/.test(p.codigo) ? celdaNumero(`A${r}`, p.codigo, estilos.A) : celdaTexto(`A${r}`, p.codigo || '', estilos.A),
      celdaTexto(`B${r}`, String(p.nombre || '').toUpperCase(), estilos.B),
      typeof p.precio === 'number' ? celdaNumero(`D${r}`, p.precio, estilos.D) : '',
      celdaTexto(`F${r}`, p.marca || '', estilos.F),
      celdaTexto(`G${r}`, NOMBRE_CATEGORIA.get(p.categoria) || p.categoria || '', estilos.G)
    ].join('')
    const nuevaFila = `<row r="${r}" customFormat="false" ht="14.25" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">${celdas}</row>`
    const existente = new RegExp(`<row\\b[^>]*\\br="${r}"[^>]*>[\\s\\S]*?</row>|<row\\b[^>]*\\br="${r}"[^>]*/>`)
    if (existente.test(xml)) xml = xml.replace(existente, nuevaFila)
    else {
      // se inserta antes de la primera fila con número mayor, o al final de sheetData
      const siguiente = [...xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)].find(m => Number(m[1]) > r)
      xml = siguiente ? xml.slice(0, siguiente.index) + nuevaFila + xml.slice(siguiente.index) : xml.replace('</sheetData>', nuevaFila + '</sheetData>')
    }
    agregadas.push(r)
  }
  if (agregadas.length) {
    xml = xml.replace(/<dimension ref="([A-Z]+\d+):([A-Z]+)(\d+)"\s*\/>/, (m, ini, col, fin) => `<dimension ref="${ini}:${col}${Math.max(Number(fin), filaNueva)}"/>`)
  }
  zip.file(ruta, xml)
  // Excel recalcula las fórmulas al abrir la copia (los totales que usan la columna D quedan al día)
  const wbNuevo = /<calcPr\b[^>]*fullCalcOnLoad=/.test(wb) ? wb : wb.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"')
  zip.file('xl/workbook.xml', wbNuevo.includes('<calcPr') ? wbNuevo : wbNuevo.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>'))
  if (zip.file('xl/calcChain.xml')) zip.remove('xl/calcChain.xml')
  const salida = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  writeFileSync(destino, salida)
  return { preciosEscritos: escritos, sinFila: [...pendientes.keys()], nuevosAgregados: agregadas.length }
}

// Exportación completa. Devuelve el resumen.
export async function exportarTodo({ productos, cambios, carpeta, excelOrigen, ajustesRepo, rutas }) {
  const filas = armarFilas(productos, cambios)
  await exportarExcelCambios(filas, rutas.cambios)
  const precios = new Map()
  for (const f of filas.precios) if (f.codigo) precios.set(f.codigo, f.nuevo)
  let inventario = null
  if (excelOrigen && existsSync(excelOrigen)) {
    inventario = await copiaInventarioConPrecios({
      origen: excelOrigen, destino: rutas.inventario, precios,
      nuevos: filas.agregar.map(a => ({ codigo: a.codigo, nombre: a.nombre, precio: a.precioNumero, marca: a.marca, categoria: Object.entries(cambios[a.sku] || {}).find(([k]) => k === 'categoria')?.[1]?.valor || a.categoria }))
    })
  }
  const ajustes = cambiosAAjustes(cambios)
  writeFileSync(rutas.ajustes, JSON.stringify({ ...ajustes, nota: 'PROPUESTO desde la revisión (no aplicado). Para aplicar: ver CLAUDE.md → "Revisión del catálogo".', basadoEn: ajustesRepo ? 'tools/catalogo/ajustes-catalogo.json' : null }, null, 1))
  return {
    fecha: new Date().toISOString(),
    carpeta,
    archivos: { cambios: rutas.cambios, inventario: inventario ? rutas.inventario : null, ajustes: rutas.ajustes },
    conteos: { eliminar: filas.eliminar.length, modificar: new Set(filas.modificar.map(f => f.sku)).size, precios: filas.precios.length, disponibilidad: filas.disponibilidad.length, fotosNuevas: filas.fotos.length, agregar: filas.agregar.length },
    inventario,
    precios: filas.precios.map(f => ({ sku: f.skuVariante, codigo: f.codigo, nombre: f.nombre, talla: f.talla, anterior: f.anterior, nuevo: f.nuevo })),
    eliminar: filas.eliminar.map(f => ({ sku: f.sku, nombre: f.nombre, motivo: f.motivo })),
    agregar: filas.agregar,
    fotos: filas.fotos.map(f => ({ sku: f.sku, archivo: f.archivo }))
  }
}
