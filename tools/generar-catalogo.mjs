#!/usr/bin/env node
// ============================================================
// GENERAR CATÁLOGO — lee el Excel de inventario y escribe:
//   productos.json  catálogo completo (con y sin stock), solo datos públicos
//   stock.json      { actualizado, unidades: { SKU: unidades | null } }
//
// Uso (desde la carpeta del sitio):   npm run catalogo
// Con otra planilla:                   npm run catalogo -- --excel "C:\ruta\Inventario_v54.xlsx"
// (o doble clic en ACTUALIZAR-CATALOGO.bat, en la carpeta de arriba)
//
// Fuente: la UNIÓN de dos hojas, por código de barras.
//   - "Resumen": todo lo contado en las 3 tiendas y 2 bodegas (manda en el STOCK).
//   - "Base Rosa (1004)": la lista maestra de Rosa (manda en nombre, precio,
//     fabricante y categoría). Lo que solo está acá entra con stock 0.
// Stock sin dato (cantidad vacía en las 5 hojas de conteo) = null:
// el sitio lo muestra como "Consultar disponibilidad".
// NUNCA se publica costo, proveedor ni unidades por sucursal: eso va solo a
// .tmp/catalogo-interno.json (fuera de git), para el informe de imágenes.
// ============================================================
import ExcelJS from 'exceljs'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  agruparTallas, categoriaDesdeExcel, deducirEdad, deducirSubcategoria,
  formatoMarca, formatoTitulo, generarSku, nombreGranel, nombreIncluyeMarca, precioPublico, slug
} from './catalogo/reglas.mjs'
import { normalizarUnidades } from '../js/stock.mjs'
import { escribirCatalogo, escribirStock } from './catalogo/escritura.mjs'
import { tipoDeImagen } from './catalogo/fotos.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOJA_RESUMEN = 'Resumen'
const HOJA_BASE = 'Base Rosa (1004)'
const HOJAS_CONTEO = ['BODEGA CENTRAL', 'BODEGA HORNILLAS', 'ALDUNATE', 'HORNILLAS', 'LAS LENGAS']
const PRIMERA_FILA_DATOS = 5 // filas 1-4: títulos y encabezados
const ARCHIVO_SKUS = join(RAIZ, 'tools', 'catalogo', 'skus-generados.json')

function argumento(nombre) {
  const i = process.argv.indexOf(nombre)
  return i >= 0 ? process.argv[i + 1] : null
}

function buscarExcel() {
  const indicado = argumento('--excel')
  if (indicado) return resolve(indicado)
  const carpetas = [RAIZ, resolve(RAIZ, '..')]
  const candidatos = carpetas.flatMap(c => readdirSync(c)
    .filter(f => /^Inventario.*\.xlsx$/i.test(f) && !f.startsWith('~$'))
    .map(f => join(c, f)))
  if (!candidatos.length) throw new Error('No encontré ningún Inventario*.xlsx. Indica la ruta con --excel "ruta".')
  return candidatos.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
}

// ExcelJS entrega fórmulas como { formula, result }: nos quedamos con el resultado calculado.
function valor(celda) {
  const v = celda?.value
  if (v === null || v === undefined) return null
  if (typeof v === 'object') {
    if ('formula' in v || 'sharedFormula' in v || 'result' in v) return v.result ?? null
    if ('richText' in v) return v.richText.map(t => t.text).join('')
    if ('text' in v) return v.text
    if (v instanceof Date) return v.toISOString()
    return null
  }
  return v
}
const texto = celda => { const v = valor(celda); return v === null ? '' : String(v).trim() }
function codigo(celda) {
  const v = valor(celda)
  if (v === null || v === '') return null
  return typeof v === 'number' ? BigInt(Math.round(v)).toString() : String(v).trim()
}

// Si la planilla se guardó sin valores calculados, LibreOffice la recalcula.
function recalcularConLibreOffice(ruta) {
  const candidatos = ['soffice', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe', '/usr/bin/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice']
  const salida = join(RAIZ, '.tmp', 'recalculado')
  mkdirSync(salida, { recursive: true })
  for (const bin of candidatos) {
    try {
      execFileSync(bin, ['--headless', '--convert-to', 'xlsx', '--outdir', salida, ruta], { stdio: 'ignore', timeout: 180000 })
      const nuevo = join(salida, basename(ruta))
      if (existsSync(nuevo)) return nuevo
    } catch { /* probar el siguiente */ }
  }
  throw new Error('La hoja "Resumen" no tiene valores calculados. Abre el Excel, guárdalo (Ctrl+S) y vuelve a correr, o instala LibreOffice.')
}

export async function leerExcel(ruta, { yaRecalculado = false } = {}) {
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.readFile(ruta)
  const base = libro.getWorksheet(HOJA_BASE)
  const resumen = libro.getWorksheet(HOJA_RESUMEN)
  if (!base) throw new Error(`Falta la hoja "${HOJA_BASE}" en ${basename(ruta)}`)
  if (!resumen) throw new Error(`Falta la hoja "${HOJA_RESUMEN}" en ${basename(ruta)}`)

  // ---- Base Rosa: A código, B nombre, C costo (NO se usa), D precio, F fabricante, G categoría, J código del saco (granel)
  const maestro = new Map()
  base.eachRow((fila, n) => {
    if (n < PRIMERA_FILA_DATOS) return
    const cod = codigo(fila.getCell(1))
    const nombre = texto(fila.getCell(2))
    if (!cod || !nombre) return
    maestro.set(cod, {
      codigo: cod,
      nombreExcel: nombre,
      precio: valor(fila.getCell(4)),
      fabricante: texto(fila.getCell(6)),
      categoriaExcel: texto(fila.getCell(7)),
      codigoSaco: codigo(fila.getCell(10))
    })
  })

  // ---- Resumen: A SKU, C nombre, D código, E precio, F fabricante, G categoría, K unidades, M–Q por lugar
  const filasResumen = new Map()
  let filasConFormulaSinValor = 0
  resumen.eachRow((fila, n) => {
    if (n < PRIMERA_FILA_DATOS) return
    const crudo = fila.getCell(1).value
    if (crudo && typeof crudo === 'object' && 'formula' in crudo && (crudo.result === undefined || crudo.result === null)) filasConFormulaSinValor++
    const sku = texto(fila.getCell(1))
    const cod = codigo(fila.getCell(4))
    if (!sku || !cod || /^(TOTALES|SKU$)/i.test(sku)) return
    const porLugar = {}
    HOJAS_CONTEO.forEach((lugar, i) => {
      const u = valor(fila.getCell(13 + i))
      if (u !== null && u !== '' && Number(u) > 0) porLugar[lugar] = Number(u)
    })
    if (!filasResumen.has(cod)) {
      filasResumen.set(cod, {
        skus: [sku], nombreExcel: texto(fila.getCell(3)), precio: valor(fila.getCell(5)),
        fabricante: texto(fila.getCell(6)), categoriaExcel: texto(fila.getCell(7)),
        unidades: valor(fila.getCell(11)), porLugar
      })
    } else filasResumen.get(cod).skus.push(sku)
  })
  if (filasResumen.size === 0 && filasConFormulaSinValor > 0) {
    if (yaRecalculado) throw new Error('La hoja "Resumen" sigue sin valores después de recalcular.')
    return leerExcel(recalcularConLibreOffice(ruta), { yaRecalculado: true })
  }

  // ---- Hojas de conteo: solo para saber si la cantidad está VACÍA en todas
  // (en el Resumen esa suma aparece como 0, pero no significa agotado).
  const registrado = new Map() // código → true si alguna hoja tiene un número escrito
  for (const nombreHoja of HOJAS_CONTEO) {
    const hoja = libro.getWorksheet(nombreHoja)
    if (!hoja) throw new Error(`Falta la hoja de conteo "${nombreHoja}"`)
    hoja.eachRow((fila, n) => {
      if (n < PRIMERA_FILA_DATOS) return
      const cod = codigo(fila.getCell(4))
      if (!cod) return
      const u = valor(fila.getCell(11))
      const tiene = u !== null && u !== ''
      registrado.set(cod, (registrado.get(cod) || false) || tiene)
    })
  }
  return { maestro, resumen: filasResumen, registrado }
}

// Marca pública: el fabricante de la planilla, salvo que el nombre comience
// claramente con OTRA marca conocida ("LATA PEDIGREE ..." cargada como Fit Formula).
function elegirMarca(nombre, fabricante, marcasConocidas, avisos) {
  const marca = formatoMarca(fabricante)
  if (nombreIncluyeMarca(nombre, marca)) return marca
  const palabras = slug(nombre).split('-')
  const inicio = ' ' + palabras.slice(0, 4).join(' ') + ' '
  const otra = marcasConocidas.find(m => {
    if (m === marca || m === 'Genérico' || m.length < 4) return false
    const pos = inicio.indexOf(' ' + slug(m).replace(/-/g, ' ') + ' ')
    return pos >= 0 && inicio.slice(0, pos).trim().split(' ').filter(Boolean).length <= 1
  })
  if (otra) {
    avisos.push(`Marca corregida: "${nombre}" — planilla dice "${marca}", el nombre dice "${otra}"`)
    return otra
  }
  return marca
}

export function construirCatalogo({ maestro, resumen, registrado }) {
  const avisos = []
  const todos = new Map() // código → datos unidos
  for (const [cod, r] of resumen) todos.set(cod, { codigo: cod, ...r, enResumen: true })
  for (const [cod, b] of maestro) {
    const r = todos.get(cod)
    // Base Rosa manda en nombre, precio, fabricante y categoría; Resumen en stock y SKU
    todos.set(cod, { ...(r || { skus: [], unidades: 0, porLugar: {}, enResumen: false }), ...b, codigo: cod, enBase: true })
  }

  const marcasConocidas = [...new Set([...todos.values()].map(p => formatoMarca(p.fabricante)))].sort((a, b) => b.length - a.length)

  // SKU: los del Resumen; los que faltan se generan (y se recuerdan entre corridas)
  const guardados = existsSync(ARCHIVO_SKUS) ? JSON.parse(readFileSync(ARCHIVO_SKUS, 'utf8')) : {}
  const usados = new Set([...todos.values()].flatMap(p => p.skus))
  for (const s of Object.values(guardados)) usados.add(s)
  const abreviaturas = new Map()
  for (const p of todos.values()) {
    const partes = (p.skus[0] || '').split('-')
    if (partes.length === 3 && p.fabricante && !abreviaturas.has(slug(p.fabricante))) abreviaturas.set(slug(p.fabricante), partes[1])
  }
  const skusNuevos = []
  const stats = { base: maestro.size, resumen: resumen.size, soloBase: 0, soloResumen: 0, sinCategoria: 0, skusNuevos: 0 }

  const filas = []
  const vistosSku = new Set()
  for (const p of [...todos.values()].sort((a, b) => a.codigo.localeCompare(b.codigo))) {
    if (!p.enResumen) stats.soloBase++
    if (!p.enBase) stats.soloResumen++
    const categoria = categoriaDesdeExcel(p.categoriaExcel)
    if (!categoria) {
      stats.sinCategoria++
      avisos.push(`Sin categoría válida (${p.categoriaExcel || 'vacía'}): ${p.nombreExcel}`)
      continue
    }
    let sku = p.skus[0] || guardados[p.codigo]
    if (!sku) {
      sku = generarSku(categoria, p.fabricante, abreviaturas, usados)
      guardados[p.codigo] = sku
      skusNuevos.push({ sku, nombre: p.nombreExcel })
      stats.skusNuevos++
    }
    if (p.skus.length > 1) avisos.push(`Código ${p.codigo} con varios SKU (${p.skus.join(', ')}): se usa ${sku}`)
    if (vistosSku.has(sku)) { avisos.push(`SKU repetido ${sku} (código ${p.codigo}): se le agrega un sufijo`); sku = `${sku}-${p.codigo.slice(-4)}` }
    vistosSku.add(sku)

    const granel = categoria === 'granel'
    // Stock: sin ninguna cantidad escrita en las 5 hojas → null ("Consultar disponibilidad").
    // Solo en Base Rosa → 0.
    let unidades
    if (!p.enResumen) unidades = 0
    else if (!registrado.get(p.codigo)) unidades = null
    else unidades = normalizarUnidades(p.unidades) ?? 0

    filas.push({
      codigo: p.codigo, codigoSaco: p.codigoSaco || null, sku, nombreExcel: p.nombreExcel, categoria, granel,
      nombre: granel ? nombreGranel(p.nombreExcel) : formatoTitulo(p.nombreExcel),
      marca: elegirMarca(p.nombreExcel, p.fabricante, marcasConocidas, avisos),
      precio: precioPublico(p.precio), unidades, porLugar: p.porLugar || {}, enResumen: !!p.enResumen
    })
  }
  writeFileSync(ARCHIVO_SKUS, JSON.stringify(Object.fromEntries(Object.entries(guardados).sort()), null, 1) + '\n')

  // ---- Tallas (dentro de la misma categoría)
  const grupos = agruparTallas(filas.map(f => ({ ...f, nombre: f.nombreExcel })))
  const enGrupo = new Map()
  for (const g of grupos) for (const it of g.items) enGrupo.set(it.codigo, g)

  const skuPorCodigo = new Map(filas.map(f => [f.codigo, f.sku]))
  const productos = []
  const stock = {}
  const vistos = new Set()
  for (const f of filas) {
    const g = enGrupo.get(f.codigo)
    if (g) {
      if (vistos.has(g)) continue
      vistos.add(g)
      const variantes = g.items.map(it => filas.find(x => x.codigo === it.codigo))
      for (const v of variantes) stock[v.sku] = v.unidades
      productos.push(armarProducto({
        ...variantes[0],
        nombre: formatoTitulo(g.base),
        tallas: g.items.map((it, i) => ({ talla: it.talla, sku: variantes[i].sku, precio: variantes[i].precio }))
      }, skuPorCodigo))
      continue
    }
    stock[f.sku] = f.unidades
    productos.push(armarProducto(f, skuPorCodigo))
  }
  return { productos, stock, filas, grupos, avisos, skusNuevos, stats }
}

function armarProducto(f, skuPorCodigo) {
  const p = {
    id: slug(f.sku),
    sku: f.sku,
    nombre: f.nombre,
    marca: f.marca,
    categoria: f.categoria,
    subcategoria: deducirSubcategoria(f.categoria, f.nombreExcel)
  }
  const edad = deducirEdad(f.categoria, f.nombreExcel)
  if (edad) p.edad = edad
  if (f.tallas) p.tallas = f.tallas
  else p.precio = f.precio
  if (f.granel) p.granel = true
  // Imagen: assets/productos/<SKU>.webp; el granel usa la del saco que se abre.
  const candidatos = [f.sku]
  if (f.granel && f.codigoSaco && skuPorCodigo.get(f.codigoSaco)) candidatos.push(skuPorCodigo.get(f.codigoSaco))
  const conFoto = candidatos.find(s => existsSync(join(RAIZ, 'assets', 'productos', `${s}.webp`)))
  if (conFoto) { p.imagen = `assets/productos/${conFoto}.webp`; p.imagenTipo = tipoDeImagen(conFoto) }
  return p
}

async function main() {
  const rutaExcel = buscarExcel()
  console.log(`Leyendo ${rutaExcel}`)
  const datos = await leerExcel(rutaExcel)
  const { productos, stock, filas, grupos, avisos, skusNuevos, stats } = construirCatalogo(datos)
  escribirCatalogo(productos, { fuente: basename(rutaExcel) })
  escribirStock(stock)

  // Datos internos (sucursales, códigos de barra): solo local, fuera de git.
  const visibleFila = f => f.unidades === null || (f.granel ? f.unidades >= 0.1 : f.unidades > 0)
  mkdirSync(join(RAIZ, '.tmp'), { recursive: true })
  const internos = filas.map(f => ({
    sku: f.sku, codigo: f.codigo, codigoSaco: f.granel ? f.codigoSaco : null, nombre: f.nombre, nombreExcel: f.nombreExcel,
    marca: f.marca, categoria: f.categoria, precio: f.precio, unidades: f.unidades,
    lugares: Object.keys(f.porLugar), sinCantidadRegistrada: f.unidades === null, visible: visibleFila(f), soloBaseRosa: !f.enResumen
  }))
  const visiblesProducto = productos.filter(p => p.tallas ? p.tallas.some(t => visibleFila(filas.find(f => f.sku === t.sku))) : visibleFila(filas.find(f => f.sku === p.sku)))
  const resumenNumeros = {
    productosCatalogo: productos.length,
    visibles: visiblesProducto.length,
    ocultosStock0: productos.length - visiblesProducto.length,
    consultarDisponibilidad: productos.filter(p => !p.tallas && stock[p.sku] === null).length,
    soloBaseRosa: stats.soloBase,
    skusNuevos: skusNuevos.length,
    gruposTallas: grupos.length,
    sinPrecio: productos.filter(p => p.tallas ? p.tallas.every(t => t.precio === null) : p.precio === null).length,
    sinPrecioVisibles: visiblesProducto.filter(p => p.tallas ? p.tallas.every(t => t.precio === null) : p.precio === null).length,
    conImagen: productos.filter(p => p.imagen).length,
    conImagenVisibles: visiblesProducto.filter(p => p.imagen).length
  }
  writeFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), JSON.stringify({
    internos, numeros: resumenNumeros, skusNuevos, avisos,
    grupos: grupos.map(g => ({ base: g.base, tallas: g.items.map(i => `${i.talla}:${i.sku}`) }))
  }, null, 1))

  console.log(`
Catálogo generado → productos.json + stock.json
  En "Resumen" (contados) ............ ${stats.resumen}
  En "Base Rosa" ..................... ${stats.base}
  Solo en Base Rosa (stock 0) ........ ${stats.soloBase}
  Productos en el catálogo ........... ${resumenNumeros.productosCatalogo}
  Visibles para el cliente ........... ${resumenNumeros.visibles}
  Ocultos por stock 0 ................ ${resumenNumeros.ocultosStock0}
  "Consultar disponibilidad" ......... ${resumenNumeros.consultarDisponibilidad}
  Grupos de tallas ................... ${resumenNumeros.gruposTallas}
  SKU nuevos generados ............... ${resumenNumeros.skusNuevos}
  Sin precio (visibles / total) ...... ${resumenNumeros.sinPrecioVisibles} / ${resumenNumeros.sinPrecio}
  Con imagen (visibles / total) ...... ${resumenNumeros.conImagenVisibles} / ${resumenNumeros.conImagen}`)
  if (avisos.length) {
    console.log(`\nAvisos para revisar en la planilla (${avisos.length}):`)
    for (const a of avisos.slice(0, 40)) console.log('  · ' + a)
    if (avisos.length > 40) console.log(`  … y ${avisos.length - 40} más (ver .tmp/catalogo-interno.json)`)
  }
}

if (process.argv[1] && process.argv[1].endsWith('generar-catalogo.mjs')) {
  main().catch(err => {
    console.error('\nERROR: ' + err.message)
    process.exit(1)
  })
}
