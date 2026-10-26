/* ============================================================
   AKYRA · STOCK WEB — Google Apps Script ligado a la planilla.

   Cada hora (8:00 a 23:00, hora de Chile):
     1. Busca en Gmail el correo con el reporte de stock de Gesnex
        (los que todavía no tienen la etiqueta "akyra-procesado").
     2. Lee el adjunto (xlsx o csv) y suma el stock por SKU de todas las bodegas.
     3. Valida: si viene vacío, con columnas raras o calza con menos del 50 %
        de los productos conocidos, NO toca nada, lo anota en "Historial" y
        manda un correo de aviso.
     4. Actualiza la hoja "Stock" (por SKU y, si no, por código de barras),
        agrega los productos nuevos y anota lo que no calzó en "Sin match".
     5. Etiqueta el correo como "akyra-procesado".
   El sitio NO consulta esta planilla: un GitHub Action descarga cada hora
   el CSV público (doGet, solo columnas públicas) y actualiza stock.json.
   ============================================================ */

function instalar() {
  var libro = SpreadsheetApp.getActiveSpreadsheet()
  var stock = asegurarHoja_(libro, CONFIG.HOJAS.stock, COLUMNAS_STOCK)
  asegurarHoja_(libro, CONFIG.HOJAS.historial, ['Fecha', 'Archivo', 'Productos leídos', 'Actualizados', 'Nuevos', 'Sin match', 'Errores'])
  asegurarHoja_(libro, CONFIG.HOJAS.sinMatch, ['Fecha', 'Archivo', 'SKU', 'Código de barras', 'Descripción', 'Unidades', 'Precio'])

  // Catálogo inicial (generado desde el Excel v53 al instalar; no está en el repositorio)
  if (stock.getLastRow() < 2 && typeof CATALOGO_INICIAL !== 'undefined') {
    var filas = CATALOGO_INICIAL.map(function (p) {
      return [p.sku, p.codigo, p.nombre, p.marca, p.categoria, p.precio === null ? '' : p.precio, p.unidades === null ? '' : p.unidades, '', p.actualizado || '']
    })
    stock.getRange(2, 1, filas.length, COLUMNAS_STOCK.length).setValues(filas)
    stock.getRange(2, 2, filas.length, 1).setNumberFormat('@')
  }

  var propiedades = PropertiesService.getScriptProperties()
  // La clave del CSV viene de la instalación (Token.js, no está en el repositorio) para guardarla
  // también como secreto en GitHub; si no está, se crea una al azar.
  if (!propiedades.getProperty('TOKEN_CSV')) {
    propiedades.setProperty('TOKEN_CSV', typeof TOKEN_INICIAL !== 'undefined' ? TOKEN_INICIAL : Utilities.getUuid().replace(/-/g, ''))
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'procesarCorreos') ScriptApp.deleteTrigger(t)
  })
  ScriptApp.newTrigger('procesarCorreos').timeBased().everyHours(1).create()
  etiqueta_()
  return { filasStock: stock.getLastRow() - 1, token: propiedades.getProperty('TOKEN_CSV') }
}

function asegurarHoja_(libro, nombre, encabezados) {
  var hoja = libro.getSheetByName(nombre) || libro.insertSheet(nombre)
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold')
    hoja.setFrozenRows(1)
  }
  return hoja
}

function etiqueta_() {
  var nombre = CONFIG.etiquetaProcesado
  var lista = Gmail.Users.Labels.list('me').labels || []
  for (var i = 0; i < lista.length; i++) if (lista[i].name === nombre) return lista[i].id
  return Gmail.Users.Labels.create({ name: nombre, labelListVisibility: 'labelShow', messageListVisibility: 'show' }, 'me').id
}

function enHorario_() {
  var hora = Number(Utilities.formatDate(new Date(), CONFIG.zonaHoraria, 'H'))
  return hora >= CONFIG.horaInicio && hora <= CONFIG.horaFin
}

function procesarCorreos() {
  if (!enHorario_()) return
  var candado = LockService.getScriptLock()
  if (!candado.tryLock(30000)) return
  try {
    var idEtiqueta = etiqueta_()
    var q = CONFIG.busquedaGmail + ' -label:' + CONFIG.etiquetaProcesado
    var respuesta = Gmail.Users.Messages.list('me', { q: q, maxResults: 10 })
    var mensajes = (respuesta.messages || []).reverse() // del más antiguo al más nuevo
    mensajes.forEach(function (m) {
      var mensaje = Gmail.Users.Messages.get('me', m.id)
      var adjuntos = adjuntos_(mensaje.payload)
      if (!adjuntos.length) {
        registrar_({ archivo: '(correo sin adjunto válido)', error: 'El correo no traía un xlsx o csv.' })
      }
      adjuntos.forEach(function (a) { procesarAdjunto_(m.id, a) })
      Gmail.Users.Messages.modify({ addLabelIds: [idEtiqueta] }, 'me', m.id)
    })
  } finally {
    candado.releaseLock()
  }
}

function adjuntos_(parte) {
  var lista = []
  ;(function recorrer(p) {
    if (!p) return
    if (p.filename && /\.(xlsx|xls|csv)$/i.test(p.filename) && p.body && (p.body.attachmentId || p.body.data)) lista.push(p)
    ;(p.parts || []).forEach(recorrer)
  })(parte)
  return lista
}

function leerTabla_(nombre, bytes) {
  if (/\.csv$/i.test(nombre)) {
    var texto = Utilities.newBlob(bytes).getDataAsString('UTF-8')
    if (texto.indexOf('�') >= 0) texto = Utilities.newBlob(bytes).getDataAsString('ISO-8859-1')
    return lectorParsearCsv(texto)
  }
  var libro = XLSX.read(bytes, { type: 'array' })
  // Si hay varias hojas se usa la primera que tenga columnas de stock reconocibles
  for (var i = 0; i < libro.SheetNames.length; i++) {
    var filas = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[i]], { header: 1, raw: true, defval: '' })
    if (lectorDetectarColumnas(filas, CONFIG.COLUMNAS)) return filas
  }
  return XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1, raw: true, defval: '' })
}

function procesarAdjunto_(idMensaje, parte) {
  var archivo = parte.filename
  try {
    var datos = parte.body.data || Gmail.Users.Messages.Attachments.get('me', idMensaje, parte.body.attachmentId).data
    var bytes = Utilities.base64DecodeWebSafe(datos)
    var reporte = lectorLeerReporte(leerTabla_(archivo, bytes), CONFIG.COLUMNAS)
    if (!reporte.ok) return registrar_({ archivo: archivo, error: reporte.error })
    aplicarAPlanilla_(archivo, reporte)
  } catch (e) {
    registrar_({ archivo: archivo, error: 'Error al leer el archivo: ' + e.message })
  }
}

// También se puede usar a mano: procesarArchivoDeDrive no existe a propósito
// (la planilla solo pide permiso para Gmail, no para Drive).
function aplicarAPlanilla_(archivo, reporte) {
  var libro = SpreadsheetApp.getActiveSpreadsheet()
  var hoja = libro.getSheetByName(CONFIG.HOJAS.stock)
  var valores = hoja.getDataRange().getValues()
  var catalogo = valores.slice(1).filter(function (f) { return f[0] || f[1] }).map(function (f) {
    return { sku: f[0], codigo: lectorCodigo(f[1]), nombre: f[2], marca: f[3], categoria: f[4], precio: f[5], unidades: f[6], nuevo: f[7], actualizado: f[8] }
  })
  var fecha = Utilities.formatDate(new Date(), CONFIG.zonaHoraria, "yyyy-MM-dd'T'HH:mm:ssXXX")
  var r = lectorAplicarReporte(catalogo, reporte, { minimoCoincidencia: CONFIG.minimoCoincidencia, fecha: fecha })
  if (!r.ok) return registrar_({ archivo: archivo, leidos: reporte.productos.length, sinMatch: (r.sinMatch || []).length, error: r.error })

  var filas = r.filas.map(function (p) {
    return [p.sku, p.codigo, p.nombre, p.marca, p.categoria, p.precio === null ? '' : p.precio, p.unidades === null ? '' : p.unidades, p.nuevo || '', p.actualizado || '']
  })
  hoja.getRange(2, 1, Math.max(hoja.getLastRow() - 1, 1), COLUMNAS_STOCK.length).clearContent()
  hoja.getRange(2, 1, filas.length, COLUMNAS_STOCK.length).setValues(filas)
  hoja.getRange(2, 2, filas.length, 1).setNumberFormat('@')

  if (r.sinMatch.length) {
    var sinMatch = libro.getSheetByName(CONFIG.HOJAS.sinMatch)
    var nuevasFilas = r.sinMatch.map(function (s) { return [fecha, archivo, s.sku, s.codigo, s.descripcion, s.unidades, s.precio || ''] })
    sinMatch.getRange(sinMatch.getLastRow() + 1, 1, nuevasFilas.length, 7).setValues(nuevasFilas)
  }
  PropertiesService.getScriptProperties().setProperty('ULTIMO_PROCESO', fecha)
  registrar_({ archivo: archivo, leidos: reporte.productos.length, actualizados: r.actualizados, nuevos: r.nuevos.length, sinMatch: r.sinMatch.length })
}

function registrar_(d) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.historial)
  var fecha = Utilities.formatDate(new Date(), CONFIG.zonaHoraria, 'yyyy-MM-dd HH:mm')
  hoja.appendRow([fecha, d.archivo || '', d.leidos || 0, d.actualizados || 0, d.nuevos || 0, d.sinMatch || 0, d.error || ''])
  if (d.error) {
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      subject: 'Akyra · El reporte de stock NO se aplicó',
      body: 'El reporte "' + (d.archivo || '') + '" no se aplicó y la tienda sigue con el último stock bueno.\n\n' +
        'Motivo: ' + d.error + '\n\nRevisa la hoja "Historial" de la planilla "Akyra · Stock web".\n' +
        SpreadsheetApp.getActiveSpreadsheet().getUrl()
    })
  }
}

// CSV público para el GitHub Action: SOLO columnas públicas (sin código de barras).
// https://script.google.com/macros/s/<id>/exec?token=<TOKEN_CSV>
function doGet(e) {
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN_CSV')
  if (!token || !e || !e.parameter || e.parameter.token !== token) {
    return ContentService.createTextOutput('acceso denegado').setMimeType(ContentService.MimeType.TEXT)
  }
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJAS.stock)
  var valores = hoja.getDataRange().getValues().slice(1)
  var reporte = PropertiesService.getScriptProperties().getProperty('ULTIMO_PROCESO') || ''
  var csv = [['sku', 'nombre', 'marca', 'categoria', 'precio', 'unidades', 'nuevo', 'actualizado', 'reporte']]
  valores.forEach(function (f) {
    if (!f[0]) return
    csv.push([f[0], f[2], f[3], f[4], f[5], f[6], f[7], f[8] instanceof Date ? f[8].toISOString() : f[8], reporte])
  })
  var texto = csv.map(function (fila) {
    return fila.map(function (v) {
      var t = String(v === null || v === undefined ? '' : v)
      return /[",\n;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
    }).join(',')
  }).join('\n')
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.CSV)
}

// Para probar a mano desde el editor: procesa el correo más reciente aunque esté fuera de horario
function probarAhora() {
  CONFIG.horaInicio = 0
  CONFIG.horaFin = 24
  procesarCorreos()
}
