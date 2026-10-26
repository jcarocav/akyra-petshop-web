/* ============================================================
   LECTOR DEL REPORTE DE STOCK DE GESNEX (funciones puras).
   Se usa en Google Apps Script (planilla "Akyra · Stock web") y en
   las pruebas de Node (tests/unit/gesnex.spec.mjs), así que no usa
   nada propio de Apps Script ni del navegador.

   Entrada: una tabla (arreglo de filas) leída del xlsx o csv.
   Salida: unidades por producto (sumando todas las bodegas).
   ============================================================ */

// Nombres de columna que se aceptan (sin tildes ni mayúsculas). Si el
// reporte real usa otros nombres, se agregan en Config.js → COLUMNAS.
var COLUMNAS_POR_DEFECTO = {
  sku: ['sku', 'codigo interno', 'cod interno', 'codigo producto', 'cod producto', 'referencia', 'codigo sku'],
  codigo: ['codigo de barras', 'codigo barras', 'cod barras', 'ean', 'ean13', 'barcode', 'codigo barra', 'cod barra'],
  descripcion: ['descripcion', 'nombre', 'producto', 'nombre producto', 'detalle', 'glosa'],
  bodega: ['bodega', 'sucursal', 'local', 'almacen', 'tienda'],
  unidades: ['stock', 'unidades', 'cantidad', 'saldo', 'existencia', 'stock actual', 'stock disponible', 'disponible'],
  precio: ['precio', 'precio venta', 'precio de venta', 'pvp', 'precio bruto', 'precio venta bruto', 'valor venta']
}

function lectorNormalizarTexto(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// "1.234,5" → 1234.5 · "12,5" → 12.5 · "$12.990" → 12990 · 15 → 15
function lectorNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return isFinite(valor) ? valor : null
  var t = String(valor).replace(/[$\s]/g, '')
  if (!t) return null
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d+,\d+$/.test(t)) t = t.replace(',', '.')
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '')
  var n = Number(t)
  return isFinite(n) ? n : null
}

// Código de barras como texto, sin ".0" ni notación científica
function lectorCodigo(valor) {
  if (valor === null || valor === undefined || valor === '') return ''
  if (typeof valor === 'number') return valor.toFixed(0)
  var t = String(valor).trim().replace(/\.0+$/, '')
  if (/^\d+(\.\d+)?e\+\d+$/i.test(t)) return Number(t).toFixed(0)
  return t.replace(/\s+/g, '')
}

function lectorSku(valor) {
  return String(valor === null || valor === undefined ? '' : valor).trim().toUpperCase()
}

// Busca la fila de encabezados en las primeras 15 filas
function lectorDetectarColumnas(filas, columnas) {
  var alias = columnas || COLUMNAS_POR_DEFECTO
  var limite = Math.min(filas.length, 15)
  for (var i = 0; i < limite; i++) {
    var encontradas = {}
    var celdas = filas[i] || []
    for (var c = 0; c < celdas.length; c++) {
      var nombre = lectorNormalizarTexto(celdas[c])
      if (!nombre) continue
      for (var campo in alias) {
        if (encontradas[campo] !== undefined) continue
        if (alias[campo].indexOf(nombre) >= 0) encontradas[campo] = c
      }
    }
    if (encontradas.unidades !== undefined && (encontradas.sku !== undefined || encontradas.codigo !== undefined)) {
      return { filaEncabezado: i, columnas: encontradas }
    }
  }
  return null
}

// Lee la tabla y suma las unidades por producto (todas las bodegas).
// Devuelve { ok, error, productos: [{ clave, sku, codigo, descripcion, unidades, precio }], filasLeidas }
function lectorLeerReporte(filas, columnas) {
  if (!filas || !filas.length) return { ok: false, error: 'El reporte viene vacío.', productos: [], filasLeidas: 0 }
  var deteccion = lectorDetectarColumnas(filas, columnas)
  if (!deteccion) {
    return { ok: false, error: 'No encontré las columnas de stock y de SKU o código de barras (revisa COLUMNAS en Config.js).', productos: [], filasLeidas: 0 }
  }
  var col = deteccion.columnas
  var porClave = {}
  var orden = []
  var filasLeidas = 0
  var errores = 0
  for (var i = deteccion.filaEncabezado + 1; i < filas.length; i++) {
    var f = filas[i] || []
    var sku = col.sku !== undefined ? lectorSku(f[col.sku]) : ''
    var codigo = col.codigo !== undefined ? lectorCodigo(f[col.codigo]) : ''
    if (!sku && !codigo) continue
    if (/^total/i.test(sku) || /^total/i.test(lectorNormalizarTexto(f[col.descripcion]))) continue
    var unidades = lectorNumero(f[col.unidades])
    if (unidades === null) { errores++; continue }
    filasLeidas++
    var clave = sku || ('#' + codigo)
    if (!porClave[clave]) {
      porClave[clave] = {
        clave: clave, sku: sku, codigo: codigo,
        descripcion: col.descripcion !== undefined ? String(f[col.descripcion] || '').trim() : '',
        unidades: 0, precio: null
      }
      orden.push(clave)
    }
    var p = porClave[clave]
    p.unidades = Math.round((p.unidades + Math.max(0, unidades)) * 1000) / 1000
    if (!p.codigo && codigo) p.codigo = codigo
    if (col.precio !== undefined) {
      var precio = lectorNumero(f[col.precio])
      if (precio !== null && precio > 1) p.precio = Math.round(precio)
    }
  }
  if (!filasLeidas) return { ok: false, error: 'El reporte no trae ninguna fila con stock.', productos: [], filasLeidas: 0, filasConError: errores }
  return { ok: true, error: null, productos: orden.map(function (k) { return porClave[k] }), filasLeidas: filasLeidas, filasConError: errores, columnas: col }
}

// Cruza el reporte con el catálogo que ya conocemos (hoja "Stock").
// catalogo: [{ sku, codigo, nombre, precio, unidades, ... }]
// Devuelve { ok, error, filas (catálogo actualizado), actualizados, nuevos, sinMatch, coincidencia }
// Regla de seguridad: si calzan menos del 50 % de los productos conocidos, NO se aplica nada.
function lectorAplicarReporte(catalogo, reporte, opciones) {
  var minimo = (opciones && opciones.minimoCoincidencia) || 0.5
  var fecha = (opciones && opciones.fecha) || ''
  if (!reporte || !reporte.ok) return { ok: false, error: (reporte && reporte.error) || 'Reporte inválido.' }
  var porSku = {}
  var porCodigo = {}
  var filas = catalogo.map(function (f) { return Object.assign({}, f) })
  filas.forEach(function (f, i) {
    if (f.sku) porSku[lectorSku(f.sku)] = i
    if (f.codigo) porCodigo[lectorCodigo(f.codigo)] = i
  })
  var vistos = {}
  var actualizados = 0
  var nuevos = []
  var sinMatch = []
  reporte.productos.forEach(function (r) {
    var i = r.sku && porSku[r.sku] !== undefined ? porSku[r.sku] : (r.codigo && porCodigo[r.codigo] !== undefined ? porCodigo[r.codigo] : undefined)
    if (i === undefined) {
      sinMatch.push(r)
      return
    }
    vistos[i] = true
    var f = filas[i]
    var cambio = Number(f.unidades) !== r.unidades || (r.precio && Number(f.precio) !== r.precio)
    f.unidades = r.unidades
    if (r.precio) f.precio = r.precio
    if (cambio) { f.actualizado = fecha; actualizados++ }
  })
  var conocidos = catalogo.length
  var coincidencia = conocidos ? Object.keys(vistos).length / conocidos : 1
  if (conocidos && coincidencia < minimo) {
    return {
      ok: false,
      error: 'El reporte solo calza con el ' + Math.round(coincidencia * 100) + '% de los productos conocidos (mínimo ' + Math.round(minimo * 100) + '%). No se actualizó nada.',
      coincidencia: coincidencia, sinMatch: sinMatch
    }
  }
  // Productos nuevos: los que no calzan pero traen nombre y SKU o código
  sinMatch.forEach(function (r) {
    if (!r.descripcion) return
    nuevos.push({
      sku: r.sku || '', codigo: r.codigo || '', nombre: r.descripcion, marca: '', categoria: '',
      precio: r.precio || '', unidades: r.unidades, nuevo: 'sí', actualizado: fecha
    })
  })
  return {
    ok: true, error: null, filas: filas.concat(nuevos), actualizados: actualizados,
    nuevos: nuevos, sinMatch: sinMatch, coincidencia: coincidencia
  }
}

// CSV simple (separador "," o ";", comillas dobles)
function lectorParsearCsv(texto) {
  var t = String(texto || '').replace(/^﻿/, '')
  var primera = t.split(/\r?\n/)[0] || ''
  var sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ','
  var filas = []
  var fila = []
  var campo = ''
  var comillas = false
  for (var i = 0; i < t.length; i++) {
    var ch = t[i]
    if (comillas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++ }
      else if (ch === '"') comillas = false
      else campo += ch
    } else if (ch === '"') comillas = true
    else if (ch === sep) { fila.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      fila.push(campo); filas.push(fila); fila = []; campo = ''
    } else campo += ch
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila) }
  return filas.filter(function (f) { return f.some(function (c) { return String(c).trim() !== '' }) })
}

if (typeof module !== 'undefined') {
  module.exports = { COLUMNAS_POR_DEFECTO: COLUMNAS_POR_DEFECTO, lectorNumero: lectorNumero, lectorCodigo: lectorCodigo, lectorDetectarColumnas: lectorDetectarColumnas, lectorLeerReporte: lectorLeerReporte, lectorAplicarReporte: lectorAplicarReporte, lectorParsearCsv: lectorParsearCsv }
}
