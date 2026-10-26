// ============================================================
// CONFIGURACIÓN DEL SITIO — Maskotería Akyra
// Lo único que normalmente hay que cambiar a mano está acá.
// ============================================================
window.AKYRA_CONFIG = Object.freeze({
  // WhatsApp que recibe los pedidos y consultas.
  // Formato: código de país + número, sin "+", espacios ni guiones.
  whatsappTienda: '56986969111',

  nombreTienda: 'Maskotería Akyra',
  correo: 'maskoteria.akyra@gmail.com',

  // Valores de despacho (se suman al total del pedido).
  despacho: Object.freeze({
    urbano: Object.freeze({ nombre: 'Zona urbana', valor: 2000 }),
    periferia: Object.freeze({ nombre: 'Periferia', valor: 3500 })
  }),

  // Sucursales para retiro (el orden es el del formulario).
  sucursales: Object.freeze([
    Object.freeze({ id: 'casa-matriz', nombre: 'Casa Matriz', direccion: 'Av. José Martínez de Aldunate 1431' }),
    Object.freeze({ id: 'hornillas', nombre: 'Hornillas', direccion: 'Hornillas 080' }),
    Object.freeze({ id: 'las-lengas', nombre: 'Las Lengas', direccion: 'Av. Circunvalación Ramón Cañas 340' })
  ]),

  metodosPago: Object.freeze(['Transferencia', 'Tarjeta débito/crédito', 'Efectivo']),

  // Productos que se muestran en "Destacados" del inicio (por SKU).
  // Si alguno se agota o no tiene foto, se reemplaza solo por otro.
  destacados: Object.freeze([
    'GAT-ROYA-002', 'PER-FITF-008', 'GAT-BRAV-005', 'PER-DENT-003', 'ACC-VIPC-001',
    'GAT-CHUR-010', 'PER-FITF-027', 'SAL-DRAG-015', 'GAT-FELI-006', 'PER-NOMA-002'
  ])
});
