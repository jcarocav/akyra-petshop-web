# Revisión de diseño del inicio (rama `mejoras-landing`)

Revisión crítica de `index.html` en escritorio (1366 px) y celular (390 px), hecha **antes** de cambiar nada.
Herramientas: guías de las skills **ui-ux-pro-max** (layout, tipografía, toque) y **emil-design-eng**
(movimiento, pulido), el plugin **impeccable** (`critique`/`layout` y su detector automático) y capturas
de `respaldo-2` (carpeta `capturas/antes/`, fuera del repositorio).

Regla: sin cambiar los colores de la empresa (turquesa `#00b0a3`, magenta `#d91a5b`) ni el logo, y sin romper
el carrito, WhatsApp, el stock automático, la accesibilidad, la seguridad ni Lighthouse.

## Prioridad alta

| # | Hallazgo | Por qué importa |
|---|---|---|
| A1 | **Celular: la grilla de categorías se sale de la pantalla.** La 2.ª columna termina en 433 px con una pantalla de 390 px: se cortan "Salud/Higie…", "Alimento seco, húmedo y s…" y no se ve "desde 0,5 kg". | Contenido y enlaces cortados en la sección que más se usa para navegar. Causa: columnas `1fr` que no pueden achicarse bajo el ancho de su palabra más larga. |
| A2 | **Celular: los puntos amarillos decorativos del hero quedan encima del texto** ("MASKOTERÍA AKYRA") y del botón "anterior" del carrusel. | Una decoración no puede tapar texto ni controles; se ve como error. |
| A3 | **Orden de lectura:** los productos destacados (la acción principal: añadir al carrito) aparecen recién en la 5.ª sección, detrás de granel; las reseñas (confianza) quedan después del llamado final. | En una página que vende, la acción principal y la prueba social deben llegar temprano; el cierre debe ser el llamado. |
| A4 | **Reseñas en una cinta que se mueve sola.** Leer párrafos en movimiento cuesta (sobre todo en celular) y la primera tarjeta parte pegada al borde, desalineada del título. | Legibilidad: el texto largo no debe moverse. La pausa existe, pero obliga a pelear con la sección. |
| A5 | **Escritorio: hueco grande en el hero** entre "MASKOTERÍA AKYRA" y el título (el texto queda anclado abajo de un bloque de 380 px) y los controles del carrusel van pegados al botón "Ver el catálogo". | El primer pantallazo pierde jerarquía: el ojo cae en un vacío y el botón principal compite con flechas. |

## Prioridad media

| # | Hallazgo | Por qué importa |
|---|---|---|
| M1 | **Sucursales:** tarjetas de distinto alto, cajas "Ver mapa" de 120 px vacías y "Cómo llegar" como enlace chico. En celular la sección ocupa casi 3 pantallas. | Mucho espacio sin información; la acción útil (cómo llegar) es la menos visible. |
| M2 | **Sección de Instagram:** franja delgada y casi vacía (un título y un botón) entre destacados y sucursales. | Corta el ritmo y aporta un solo enlace; cabe como acción secundaria en "Sobre Maskotería". |
| M3 | **Ritmo entre secciones:** casi todas las secciones claras usan el mismo fondo con patitas y el mismo espaciado, así que no se distingue dónde termina una y empieza otra. | Sin alternancia no hay cadencia: todo pesa igual. |
| M4 | **Pie en celular:** las 3 listas de enlaces van en una sola columna (cerca de 1,5 pantallas). | Se puede leer en 2 columnas sin perder tamaño de toque. |
| M5 | **Atajos en celular:** 3 filas altas antes de las categorías. | Empujan hacia abajo la primera sección útil; se pueden compactar. |

## Prioridad baja (no se aplican ahora)

| # | Hallazgo | Decisión |
|---|---|---|
| B1 | La cinta de marcas se mueve sola (el detector la marca). | Se mantiene: son nombres cortos, tiene pausa y se detiene con "movimiento reducido". |
| B2 | En celular la sección de granel no muestra la foto de la tienda (solo un fondo tenue). | Se mantiene por rendimiento. |
| B3 | El llamado "¿No encuentras lo que necesitas?" repite el magenta del hero. | Aceptable: es el cierre de la página. |
| B4 | Detector: "padding apretado" en secciones, interlineado 1,2 en títulos y sombra de color sobre fondo oscuro. | Falsos positivos o correctos para títulos; se revisan después de los cambios. |
| B5 | El botón de WhatsApp repite "Escríbenos" en 3 lugares (cabecera, nosotros y flotante). | Se mantiene: son puntos de entrada distintos. |
