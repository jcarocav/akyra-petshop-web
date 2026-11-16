#!/usr/bin/env node
// Carga en revision-catalogo/revision.json las propuestas del 16-11-2026 (documento Word de la dueña
// "OBVERSACIONES PAGINA WEB", lista de Joaquín, productos repetidos y nombres de la revisión del 15-11)
// como cambios con origen "Propuesta", para que Rosa las vea en REVISAR-CATALOGO.bat y las confirme o deshaga.
// No toca el sitio. Correr SOLO con la herramienta cerrada. Se puede correr más de una vez: no repite lo ya cargado.
// Uso: node tools/revision/cargar-propuestas-2026-11-16.mjs
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Revision } from './estado.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DATOS = resolve(process.env.AKYRA_REVISION_DIR || join(RAIZ, '..', 'revision-catalogo'))
if (!existsSync(join(DATOS, 'revision.json'))) throw new Error(`No encontré ${join(DATOS, 'revision.json')}`)

const FALTA_IMAGEN = 'Falta imagen: la busco en internet al aplicar los cambios.'
const repetido = (de, queda) => ({ eliminar: { motivo: `Repetido de «${queda}» (${de}). Confirmar.` } })

// SKU → datos a cambiar (mismos campos que la herramienta)
const MODIFICAR = {
  // ---- Granel (Word) ----
  'GRA-CATC-003': { nombre: 'Cat Chow Gato Adulto Sabor Carne a granel', nota: 'Word: «Falta Catchow carne $4.100»: estaba como «Purina Catchow adulto carne». Precio $4.100 sin cambio.' },
  'GRA-CATC-004': { eliminar: { motivo: 'Word: eliminar Catchow kitten a granel $2.950' } },
  'GRA-CATC-002': { eliminar: { motivo: 'Word y lista: Purina Cat Chow gatitos repetido (queda «Cat Chow Gatitos a granel»)' } },
  'GAT-CATC-002': { nombre: 'Sobre Cat Chow Esterilizados Sabor Carne 85 g', nota: 'Lista: unificar marca Cat Chow' },
  'GAT-CATC-001': { nombre: 'Sobre Cat Chow Esterilizados Sabor Pollo 85 g', nota: 'Lista: unificar marca Cat Chow' },
  'GRA-DOGC-002': { eliminar: { motivo: 'Word: eliminar Dog Chow cachorro raza mini y pequeña a granel' } },
  'GRA-DOGC-003': { eliminar: { motivo: 'Lista: «eliminar alimento a granel Dog Chow (2 cards)». Confirmar que es esta.' } },
  'GRA-DOGC-001': { nombre: 'Dog Chow Adulto Raza Mediana y Grande Sabor Carne a granel', nota: `Word y lista pedían agregarlo a $3.200: ya existía con ese precio (no se agrega otro). ${FALTA_IMAGEN}` },
  'GRA-FITF-001': { precio: 3400, nota: 'Word: Fit gato $3.400' },
  'GRA-MAST-009': { nota: `Word: Master Cat mixto $3.000 (sin cambio de precio). ${FALTA_IMAGEN}` },
  'GRA-MAST-005': { nombre: 'Master Dog Cachorro Carne y Leche a granel', nota: `Word y lista: Master Dog cachorro $2.550 a granel: ya existía con ese precio. Usar la imagen del saco 19,5 kg. ${FALTA_IMAGEN}` },
  'GRA-MAST-006': { nota: `Word: Master Dog adulto raza pequeña $2.100 (sin cambio de precio). ${FALTA_IMAGEN}` },
  'GRA-NOMA-004': { precio: 2700, nota: 'Word: Nomade adulto raza mediana y grande $2.700' },
  'GRA-NOMA-001': { precio: 3500, nota: 'Word: Nomade gato $3.500' },
  'GRA-NOMA-005': { precio: 3000, nota: 'Word: Nomade senior raza mediana y grande $3.000' },
  'GRA-PEDI-001': { precio: 2900, nota: 'Word: Pedigree perro adulto $2.900 (antes $1.900: sube más de 50 %, confirmar)' },
  'GRA-GATT-002': { nombre: 'Gati Gato Adulto Sabor Carne y Pollo a granel', marca: 'Purina Gati', nota: 'Word: decía «Purina Gatti gato adulto». La marca se escribe Gati (Purina Gati).' },
  'GRA-GATT-001': { nombre: 'Gati Gato Adulto Sabor Pescado y Salmón a granel', marca: 'Purina Gati', nota: 'La marca se escribe Gati (Purina Gati).' },
  'GRA-SUPE-002': { nota: `Word: Super Pet perro cachorro. ${FALTA_IMAGEN}` },
  'GRA-ALFA-002': { nota: `Word: Alfa Dog perro cachorro. ${FALTA_IMAGEN}` },
  'GRA-ANCE-002': { nota: `Word: Ancestral perro cachorro. ${FALTA_IMAGEN}` },
  'GRA-PEDI-002': { nota: `Word: Pedigree perro cachorro. ${FALTA_IMAGEN}` },
  'GRA-FORA-001': { nota: `Word: Forastero. ${FALTA_IMAGEN}` },
  'GRA-APPE-001': { nombre: 'Appetit Gato Adulto Mix Proteínas a granel', descripcion: 'Alimento para gatos adultos.', nota: `Word y lista: decir que es alimento para gato adulto. ${FALTA_IMAGEN}` },
  'GAT-APPE-001': { nombre: 'Alimento Appetit Gato Carne y Avena, 10 Kg', nota: 'Marca unificada: Appetit (decía «Appetite»).' },
  // ---- Precios y eliminar (Word) ----
  'ACC-PETB-009': { precio: 3500, nota: 'Word: acondicionador Petbrilho $3.500' },
  'ACC-MOND-109': { eliminar: { motivo: 'Word y lista: eliminar alfombra código 11218' } },
  'ACC-MOND-064': { precio: 4200, nota: 'Word y lista: alfombra 0410 a $4.200. Igual queda oculta (accesorio Mondo sin foto oficial).' },
  'ACC-MOND-085': { eliminar: { motivo: 'Word: eliminar alfombra plástica $4.900' } },
  'GAT-AKAN-001': { eliminar: { motivo: 'Word: eliminar Acana Bountiful Catch' } },
  'GAT-AGIL-003': { precio: 10300, nota: 'Word: Agility gatito $10.300' },
  'PER-ALFA-001': { precio: 26500, nota: 'Word: Alfa Dog adulto raza pequeña $26.500' },
  'PER-ALFA-002': { precio: 11900, nota: 'Word: Alfa Dog senior +7 raza pequeña 3 kg $11.900' },
  'GAT-AMIT-005': { nota: 'Word: Amity sterilized 2 kg $21.200 (ya está a ese precio). La lista dice $19.200: confirmar cuál vale.' },
  'GAT-AMIT-003': { nota: 'Lista: Amity esterilizado 7 kg $54.900: ya existía con ese precio (no se agrega otro).' },
  'PER-ANCE-001': { precio: 30900, nota: 'Word: Ancestral perro adulto raza pequeña $30.900' },
  'PER-ANCE-003': { precio: 47000, nota: 'Word: Ancestral perro adulto 20 kg $47.000' },
  'PER-ANCE-002': { precio: 31000, nota: `Word: «Falta Ancestral cachorro $31.000»: ya existía, se le pone el precio. ${FALTA_IMAGEN}` },
  'GAT-BIOF-002': { eliminar: { motivo: 'Word: Biofresh gatito 1,5 kg $21.900 repetido (queda «Biofresh Gato Gatitos 1,5 Kg»)' } },
  'GAT-BIOF-006': { precio: 86600, nota: 'Word: Biofresh gato adulto 7,5 kg $86.600 (antes $21.900: confirmar)' },
  'GAT-BIOF-007': { precio: 86600, nota: 'Word: Biofresh gato castrado 7,5 kg $86.600' },
  'PER-BOKA-002': { eliminar: { motivo: 'Word: eliminar Bokato cachorro' } },
  'PER-BOKA-001': { eliminar: { motivo: 'Word: eliminar Bokato adulto' } },
  // ---- Marcas mal escritas (logos oficiales) ----
  'PER-ALPH-001': { nombre: 'Alimento Alfa Dog Senior Razas Medianas y Grandes 20 Kg', nota: 'La marca se escribe Alfa Dog (logo oficial), decía «Alpha Dog».' },
  // ---- Nombres de la revisión del 15-11 como el resto del sitio ----
  'PER-GPT-004': { nombre: 'Snack Tasty Farm Recorte de Orejas 80 Gr', marca: 'Tasty Farm', nota: 'Nombre como el resto del sitio y marca Tasty Farm.' },
  'PER-MARB-015': { nombre: 'Healthy Life Snack Cuidado Dental 200 Gr' },
  'PER-MARB-014': { nombre: 'Healthy Life Snack Cuidado Articular' },
  'PER-MARB-016': { nombre: 'Healthy Life Snack Piel y Pelaje' },
  'PER-VITF-002': { nota: 'Ojo: le pusieron foto y precio nuevos, pero quedó para eliminar («ya no hay»). ¿Se elimina igual?' },
  // ---- Productos repetidos (mismo producto en dos cards) ----
  'PER-FORA-002': repetido('código 22, sin stock', 'Alimento Forastero Adulto, Saco 20 Kg'),
  'GAT-LEON-012': repetido('otro código de barras', 'Sobre Leonardo Drink Gato, Sabor Pollo 40 Gr'),
  'GAT-FANC-005': repetido('otro código de barras', 'Lata Fancy Feast Sabor Atún'),
  'GAT-FANC-006': repetido('otro código de barras', 'Lata Fancy Feast Sabor Salmón'),
  'GAT-CATS-011': repetido('otro código de barras', 'Galletas Cats Snack Sabor Salmón con Hierba Gatera'),
  'GAT-CATS-007': repetido('otro código de barras', 'Galletas Cats Snack Sabor Atún con Hierba Gatera'),
  'PER-MARB-017': repetido('el precio ya se corrigió en el otro', 'Snack Tasty Farm Marben Pets Sabor Pollo 100 Gr'),
  'GAT-CHAM-009': repetido('sin foto', 'Sobre Champion Cat, Sabor Carne'),
  'GAT-CHAM-007': repetido('sin foto', 'Sobre Champion Cat, Sabor Pollo Gatitos'),
  'GAT-CHAM-011': repetido('otro código de barras', 'Sobre Champion Cat, Sabor Atún'),
  'PER-FITF-013': repetido('otro código de barras', 'Alimento Fit Formula Perro Cachorro 10 Kg'),
  'ACC-MISI-002': repetido('otro código de barras', 'Arena Sanitaria Aglutinante, Misifus, 4 Kg'),
  'OTR-BETA-002': { nota: 'Hay dos «Snack Betapol 60 Gr» con distinto código: agregar el sabor al nombre de cada uno.' },
  'OTR-BETA-003': { nota: 'Hay dos «Snack Betapol 60 Gr» con distinto código: agregar el sabor al nombre de cada uno.' },
  'OTR-STAY-001': { nota: 'Hay dos «Juguete Perro Stay Wild» con distinto precio: agregar el modelo al nombre de cada uno.' },
  'OTR-STAY-002': { nota: 'Hay dos «Juguete Perro Stay Wild» con distinto precio: agregar el modelo al nombre de cada uno.' }
}

// Productos nuevos (granel)
const NUEVOS = {
  'NUEVO-PROP-DOGC-CACH': { nombre: 'Dog Chow Cachorro Raza Grande a granel', marca: 'Dog Chow', categoria: 'granel', subcategoria: 'Perro', precio: 3400, granel: true, disponibilidad: 'consultar', nota: `Word: agregar Dog Chow cachorro raza grande $3.400. ${FALTA_IMAGEN}` },
  'NUEVO-PROP-GATI-GATITOS': { nombre: 'Gati Gatitos Carne y Leche a granel', marca: 'Purina Gati', categoria: 'granel', subcategoria: 'Gato', precio: 2950, granel: true, disponibilidad: 'consultar', nota: 'Word: «Falta Gatti Kitten $2.950». Lista: agregar todas las variedades: solo encontré Gati Gatitos Carne y Leche. Si tienen otras, agréguenlas y borren las que no tengan.' },
  'NUEVO-PROP-SUPE-GATO': { nombre: 'Superpet Gato Adulto a granel', marca: 'Super Pet', categoria: 'granel', subcategoria: 'Gato', precio: 2300, granel: true, disponibilidad: 'consultar', descripcion: 'Alimento para gatos adultos.', nota: `Word: agregar Super Pet gato $2.300 con imagen y descripción. ${FALTA_IMAGEN}` }
}

// Nombres que Joaquín aprobó corregir (16-11) aunque ya se habían cambiado en la herramienta
const APROBADOS = new Set(['PER-GPT-004|nombre', 'PER-MARB-015|nombre', 'PER-MARB-014|nombre', 'PER-MARB-016|nombre'])

const revision = new Revision(DATOS)
let cargados = 0
let saltados = 0
const poner = (sku, campo, valor, nombre) => {
  const actual = revision.datos.cambios[sku]?.[campo]
  // No pisar lo que Rosa o Joaquín ya decidieron en la herramienta
  if (actual && actual.dispositivo !== 'Propuesta' && !APROBADOS.has(`${sku}|${campo}`)) { saltados++; return }
  if (actual && JSON.stringify(actual.valor) === JSON.stringify(valor)) return
  const r = revision.cambiar({ sku, campo, valor, dispositivo: 'Propuesta', nombre })
  if (!r.ok) throw new Error(`${sku} ${campo}: ${r.error}`)
  cargados++
}
for (const [sku, datos] of Object.entries(NUEVOS)) {
  poner(sku, 'nuevo', true, datos.nombre)
  for (const [campo, valor] of Object.entries(datos)) poner(sku, campo, valor, datos.nombre)
}
for (const [sku, datos] of Object.entries(MODIFICAR)) {
  for (const [campo, valor] of Object.entries(datos)) poner(sku, campo, valor, '')
}
revision.respaldar({ forzar: true })
console.log(`Propuestas cargadas: ${cargados} datos en ${Object.keys(MODIFICAR).length + Object.keys(NUEVOS).length} productos · respetados (ya decididos en la herramienta): ${saltados}`)
