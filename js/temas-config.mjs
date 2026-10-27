// ============================================================
// CALENDARIO DE TEMAS DE TEMPORADA (Chile) — el único archivo que hay que tocar
// para cambiar fechas, agregar un tema o cambiar sus decoraciones.
//
// Cada tema:
//   id          nombre corto (se usa en la URL: ?tema=halloween para verlo sin esperar la fecha)
//   nombre      para las personas
//   fechas      una de estas formas (siempre hora de Chile, ambos días incluidos):
//                 { desde: 'MM-DD', hasta: 'MM-DD' }        fijo; si "hasta" es menor, cruza el año
//                 { alrededor: 'MM-DD', dias: 3 }            3 días antes y 3 después (una semana)
//                 { domingo: { mes: 5, numero: 2 }, diasAntes: 7 }
//                                                           2.º domingo de mayo y la semana anterior
//   prioridad   si dos temas se cruzan gana el número más alto
//   capa        'principal' (por defecto: guirnalda + detalles) o 'detalle' (solo suma un detalle
//               en la portada, sin tapar el tema principal; por ejemplo, el Día del Animal en Halloween)
//   decoracion  archivos en assets/temas/ (se dibujan con tools/temas/construir-temas.mjs):
//                 guirnalda  tramo que se repite arriba de la página
//                 hero       detalle en una esquina de la portada del inicio
//                 pie        detalle sobre el pie de página
//   portada     diapositiva del inicio que se muestra solo en estas fechas
//               (en index.html: <div class="hero__diapositiva" data-portada="id">)
// ============================================================

export const TEMAS = [
  {
    id: 'fiestas-patrias', nombre: 'Fiestas Patrias', prioridad: 50,
    fechas: { desde: '09-01', hasta: '09-30' },
    decoracion: { guirnalda: 'assets/temas/fiestas-patrias-guirnalda.svg' },
    portada: { id: 'fiestas-patrias', desde: '09-01', hasta: '09-20' }
  },
  {
    id: 'halloween', nombre: 'Halloween', prioridad: 40,
    fechas: { desde: '10-01', hasta: '10-31' },
    decoracion: { guirnalda: 'assets/temas/halloween-guirnalda.svg', hero: 'assets/temas/halloween-hero.svg', pie: 'assets/temas/halloween-pie.svg' }
  },
  {
    id: 'dia-animal', nombre: 'Día del Animal', prioridad: 60, capa: 'detalle',
    fechas: { alrededor: '10-04', dias: 3 },
    decoracion: { hero: 'assets/temas/dia-animal-hero.svg' }
  },
  {
    id: 'navidad', nombre: 'Navidad', prioridad: 50,
    fechas: { desde: '12-01', hasta: '12-25' },
    decoracion: { guirnalda: 'assets/temas/navidad-guirnalda.svg', hero: 'assets/temas/navidad-hero.svg' }
  },
  {
    id: 'ano-nuevo', nombre: 'Año Nuevo', prioridad: 50,
    fechas: { desde: '12-26', hasta: '01-02' },
    decoracion: { guirnalda: 'assets/temas/ano-nuevo-guirnalda.svg', hero: 'assets/temas/ano-nuevo-hero.svg' }
  },
  {
    id: 'san-valentin', nombre: 'San Valentín', prioridad: 60,
    fechas: { desde: '02-07', hasta: '02-14' },
    decoracion: { guirnalda: 'assets/temas/san-valentin-guirnalda.svg', hero: 'assets/temas/san-valentin-hero.svg' }
  },
  {
    id: 'dia-madre', nombre: 'Día de la Madre', prioridad: 70,
    fechas: { domingo: { mes: 5, numero: 2 }, diasAntes: 7 },
    decoracion: { guirnalda: 'assets/temas/dia-madre-guirnalda.svg', hero: 'assets/temas/dia-madre-hero.svg' }
  },
  {
    id: 'dia-padre', nombre: 'Día del Padre', prioridad: 70,
    fechas: { domingo: { mes: 6, numero: 3 }, diasAntes: 7 },
    decoracion: { guirnalda: 'assets/temas/dia-padre-guirnalda.svg', hero: 'assets/temas/dia-padre-hero.svg' }
  },
  {
    id: 'dia-perro', nombre: 'Día Internacional del Perro', prioridad: 80,
    fechas: { alrededor: '07-26', dias: 3 },
    decoracion: { guirnalda: 'assets/temas/dia-perro-guirnalda.svg', hero: 'assets/temas/dia-perro-hero.svg' }
  },
  {
    // Se cruza con el Día del Niño: gana el gato (tienda de mascotas) y el niño sigue el resto de su semana
    id: 'dia-gato', nombre: 'Día Internacional del Gato', prioridad: 80,
    fechas: { alrededor: '08-08', dias: 3 },
    decoracion: { guirnalda: 'assets/temas/dia-gato-guirnalda.svg', hero: 'assets/temas/dia-gato-hero.svg' }
  },
  {
    id: 'dia-nino', nombre: 'Día del Niño', prioridad: 60,
    fechas: { domingo: { mes: 8, numero: 2 }, diasAntes: 7 },
    decoracion: { guirnalda: 'assets/temas/dia-nino-guirnalda.svg', hero: 'assets/temas/dia-nino-hero.svg' }
  }
]
