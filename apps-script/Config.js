/* ============================================================
   CONFIGURACIÓN — Akyra · Stock web (Google Apps Script)
   Lo que normalmente se ajusta está acá.
   ============================================================ */

var CONFIG = {
  // Búsqueda en Gmail del correo con el reporte de stock de Gesnex.
  // Ajusta el remitente y el asunto cuando llegue el primer reporte real.
  // (Se agrega solo: -label:akyra-procesado)
  busquedaGmail: 'has:attachment (filename:xlsx OR filename:xls OR filename:csv) subject:(stock) newer_than:7d',

  // Etiqueta que se pone al correo ya procesado
  etiquetaProcesado: 'akyra-procesado',

  // Horario de trabajo (hora de Chile): fuera de este rango no se revisa el correo
  horaInicio: 8,
  horaFin: 23,
  zonaHoraria: 'America/Santiago',

  // Seguridad: si el reporte calza con menos de esta proporción de los
  // productos conocidos, NO se actualiza nada (y llega un correo de aviso).
  minimoCoincidencia: 0.5,

  // Nombres de columna del reporte de Gesnex (sin tildes ni mayúsculas).
  // Se prueba cada alias en orden; agrega aquí el nombre exacto del reporte real.
  COLUMNAS: {
    sku: ['sku', 'codigo interno', 'cod interno', 'codigo producto', 'cod producto', 'referencia', 'codigo sku'],
    codigo: ['codigo de barras', 'codigo barras', 'cod barras', 'ean', 'ean13', 'barcode', 'codigo barra', 'cod barra'],
    descripcion: ['descripcion', 'nombre', 'producto', 'nombre producto', 'detalle', 'glosa'],
    bodega: ['bodega', 'sucursal', 'local', 'almacen', 'tienda'],
    unidades: ['stock', 'unidades', 'cantidad', 'saldo', 'existencia', 'stock actual', 'stock disponible', 'disponible'],
    precio: ['precio', 'precio venta', 'precio de venta', 'pvp', 'precio bruto', 'precio venta bruto', 'valor venta']
  },

  // Nombres de las hojas de la planilla
  HOJAS: { stock: 'Stock', historial: 'Historial', sinMatch: 'Sin match' }
}

// Columnas de la hoja "Stock" (en este orden)
var COLUMNAS_STOCK = ['SKU', 'Código de barras', 'Nombre', 'Marca', 'Categoría', 'Precio', 'Unidades', 'Nuevo', 'Actualizado']
