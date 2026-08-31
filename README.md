# Mascotería Akyra — sitio web

Construido tomando como plantilla el sitio de Cocobian (mismo motor de
carrito → WhatsApp, filtros de catálogo y ficha de producto), con datos,
paleta, logo real y contenido propios de Mascotería Akyra.

## Qué está listo
- **SEO y AEO** (posicionamiento en buscadores y en motores de
  respuesta tipo IA):
  - **og-image real** (`assets/og/og-image.jpg`, 1200×630 — el
    tamaño estándar): la diseñé con el logo, el perrito y la gata,
    y el fondo magenta de la marca. Antes el sitio *apuntaba* a una
    imagen que no existía (`og-image.jpg` suelto, nunca se había
    creado) — por eso, al compartir el link por WhatsApp o
    Instagram, no salía ninguna vista previa. Ya está enlazada
    correctamente.
  - **Open Graph + Twitter Card completos en las 7 páginas** — antes
    solo `index.html` los tenía (y con la imagen rota); ahora cada
    página (catálogo, producto, contacto, las 3 políticas) tiene su
    propio título/descripción/imagen para cuando se comparte esa
    página puntual, no solo el home.
  - **`robots.txt`** y **`sitemap.xml`** — no existían. El sitemap
    lista las 6 páginas fijas del sitio; no incluye fichas de
    producto individuales (`producto.html?id=...`) porque hoy el
    catálogo es de ejemplo — conviene regenerarlo cuando esté el
    catálogo real, para que cada producto tenga su propia URL
    indexada.
  - **Datos estructurados (schema.org) ampliados** — antes listaba
    una sola sucursal sin horario; ahora describe las 3 (Casa
    Matriz, Hornillas, Circunvalación) cada una con su dirección y
    horario real, para que Google pueda mostrarlos directamente en
    los resultados de búsqueda.
  - **`llms.txt`** — un archivo nuevo (convención todavía no
    universal, pero cada vez más usada) pensado específicamente para
    que los motores de IA (ChatGPT, Perplexity, etc.) entiendan de
    qué trata el sitio, sus sucursales, horarios y políticas, de
    forma directa y sin tener que interpretar todo el HTML. Como es
    una convención emergente, no todos los motores la usan todavía,
    pero no cuesta nada tenerla lista.
  - **Importante**: todo lo de arriba usa `https://[tudominio].cl/`
    como marcador de posición (son 41 apariciones en total, entre
    HTML, `robots.txt` y `sitemap.xml`) — cuando tengas el dominio
    real, es un buscar-y-reemplazar de `[tudominio].cl` por tu
    dominio real en todos los archivos; avísame cuando lo tengas y
    te lo dejo hecho yo mismo en vez de que lo hagas a mano.
- **Favicon** (el ícono que sale en la pestaña del navegador) — lo
  diseñé yo, tomando la patita como motivo (ya se usaba en el patrón
  de fondo del sitio) sobre el turquesa de la marca, en
  `assets/favicon/`, en todos los tamaños que hacen falta (16, 32,
  48, 180 para iPhone, y un `.ico`) y ya está enlazado en las 7
  páginas del sitio.
- **Horario de Circunvalación confirmado**: lunes a sábado, 10:30 a
  13:00 y 15:10 a 20:00, domingo cerrado — actualizado en la sección
  de Ubicaciones del home y en `politica-despacho-retiro.html`.
- **Política de Cambios y Devoluciones**: agregué que el cambio de
  producto no tiene costo si vienes tú a la tienda, pero se cobra el
  despacho si necesitas que te lo llevemos a domicilio — y que
  siempre hay que traer la boleta o comprobante de compra.
- **Reseñas reales de Google** (las 6 que pasaste) reemplazando a las
  de ejemplo, y la sección pasó de una grilla fija de 3 a un
  **carrusel continuo** — mismo patrón que el de Marcas (lista
  duplicada + animación CSS en loop, se pausa al pasar el mouse por
  encima). Cada tarjeta muestra nombre, si es Local Guide y cuántas
  reseñas/fotos tiene, hace cuánto la dejó, y el texto completo. Los
  datos están en `script.js` (`REVIEWS`) — agregar o cambiar una
  reseña más adelante es solo editar ese arreglo.
- **Fotos reales en Categorías** (`assets/img/categorias/`) — las 3
  que mandaste, quedaron muy bien con el fondo magenta que ya
  traían, combina directo con la paleta del sitio.
- **Logo del navbar más grande** (85px, antes 52px). Esto movió la
  altura de toda la fila de arriba del header (72px → 100px), así
  que de paso encontré y corregí un bug que ya existía antes de este
  cambio: en el catálogo, al hacer scroll, **la barra de categorías
  (Perros/Gatos/...) y el sidebar de filtros quedaban tapados detrás
  del header fijo** — el número que los posicionaba databa de antes
  de que el header creciera a 2 filas y nunca se había actualizado.
  Ya se ve todo bien, lo verifiqué haciendo scroll de verdad en las
  pruebas.
- **Footer en magenta** (antes esa parte de arriba era clara/crema) —
  con los textos y links en blanco, y el mail de contacto destacado
  en amarillo para que se lea bien sobre el magenta.
- **Footer rediseñado en 2 tonos**, como la referencia de Dr.Pet que
  mandaste: parte de arriba con 4 columnas (datos de
  contacto+logo, Tienda, Ayuda, Mascotería Akyra —con las 3
  políticas—), y una barra oscura abajo con los íconos sociales
  (ahora cuadrados, no círculos) y el copyright. Saqué el botón
  "Escríbenos" que había en esta zona porque ya está repetido en el
  navbar y en el botón flotante de WhatsApp — no hacía falta un
  tercero acá.
- **Sobre Nosotros**: más separación entre el párrafo y el botón
  "Escríbenos por WhatsApp" (estaban muy pegados).
- **Sidebar de filtros fijo**: ahora, además de quedarse pegado
  arriba al hacer scroll (ya lo hacía), tiene su propio límite de
  alto (`max-height` + scroll interno) — así el panel completo
  (Solo ofertas, Tipo de producto, Marca, Edad) se ve siempre cerca
  del tope, sin tener que bajar hasta el final de la página para ver
  las últimas opciones.
- **Carrito más separado** del botón "Escríbenos" en escritorio (con
  más margen entre los dos, en vez de quedar pegados).
- **Categorías**: quedó un solo texto, "Comprar por categorías" (antes
  eran 3: el eyebrow "Categorías", el título "Encuentra lo tuyo" y el
  subtítulo "Compra aquí lo que necesites").
- **Tarjetas de categoría**: el halo turquesa al pasar el mouse se
  cambió por un levantamiento más notorio (con sombra suave), sin
  el resplandor de color.
- **3 páginas de políticas con contenido real** — Privacidad, Despacho
  y Retiro, y Cambios y Devoluciones (`politica-privacidad.html`,
  `politica-despacho-retiro.html`, `politica-cambios-devoluciones.html`).
  Me pasaste los 3 textos base de otra tienda (Dr.Pet) y los adapté a
  cómo trabaja realmente Akyra — sin login/cuentas de usuario (el
  sitio no tiene), sin la estructura de "múltiples comercios" de
  Dr.Pet (Akyra es un solo negocio), con las 3 direcciones/horarios
  reales de las sucursales, los costos de despacho reales ($2.000
  zona urbana / $3.500 periferia), y sin inventar cosas que no sé si
  aplican (no dejé el despacho express de 3 horas, ni el
  almacenamiento en servidores de AWS EE.UU., ni los nombres de
  encargados de marketing que traía el texto original — eso era
  específico de Dr.Pet). También ajusté la sección de cookies: como
  el sitio no usa cookies de seguimiento ni de publicidad (solo
  `localStorage` para el carrito y para recordar que ya aceptaste el
  aviso de privacidad), la política lo dice tal cual es, en vez de
  prometer un manejo de cookies que el sitio no tiene. Si algo de
  esto no calza con cómo trabaja realmente la tienda (plazos, montos,
  zona de despacho), avísame y lo ajusto. Están enlazadas desde la
  columna "Mascotería Akyra" del footer del home — como el resto de
  las páginas del sitio no tienen footer propio (solo el home lo
  tiene), ese es el único lugar donde aparecen enlazadas por ahora.
- **Navbar arreglado**: la fila de arriba ahora usa 3 columnas reales
  (logo / buscador centrado / Escríbenos + carrito), y la fila de
  categorías reparte los links en todo el ancho — antes las dos
  quedaban apeñuscadas a la izquierda con un hueco vacío grande a la
  derecha en pantallas anchas.
- **Hero**: el título "¡Inauguramos nuestro Sitio Web!" quedó más
  grande (usa más ancho hacia la derecha) y con rebote + sombra;
  abajo un subtítulo nuevo, "Ven y descubre nuestras increíbles
  Ofertas!", con sombra pero sin rebote.
- **Patrón de fondo**: ahora es solo patitas de perro y gato (antes
  también tenía empanaditas y copas de vino, de la campaña de
  Fiestas Patrias) — y se agregó también a la sección Redes
  Sociales, que antes no lo tenía.
- **Categorías**: subtítulo nuevo, "Compra aquí lo que necesites".
- **Ofertas**: eyebrow cambiado a "Promociones" y el título a "¡Ofertas
  exclusivas!" (antes "Ofertas de la semana"), con el botón "Ver
  todas las ofertas" movido justo debajo del título (antes estaba
  al final, después del carrusel) — lleva directo al catálogo con el
  filtro de ofertas ya aplicado (`catalogo.html?...&ofertas=1`).
- **Sección "¿No encuentras lo que necesitas?"**, entre Sobre
  Nosotros y Reseñas, con fondo magenta plano (sin degradado, por
  eso el botón "Enviar formulario" va en blanco con texto magenta,
  para que no desaparezca contra el fondo) y sin el eyebrow que
  tenía antes ("¿Buscas algo puntual?"). Lleva a `contactenos.html`.
- **Catálogo**: el encabezado (con el título y ahora también con
  "Resultados para X" cuando hay una búsqueda activa) pasó de
  turquesa a **magenta**, para que se distinga bien del navbar (que
  sigue turquesa). El check de los filtros de la izquierda ("Solo
  ofertas", tipo de producto, marca, edad) también pasó a magenta al
  seleccionarlos — antes se marcaban en turquesa.
- **`contactenos.html`** — página nueva con el formulario de
  contacto (Asunto, Email, Nombres, Teléfono, Mensaje), inspirado en
  la referencia que mandaste. **Importante**: el sitio es estático
  (sin servidor propio), así que no puede mandar el correo en
  silencio — el botón arma un `mailto:` con todo el detalle ya
  redactado y abre la aplicación de correo del visitante, apuntando
  a `maskoteria.akyra@gmail.com`. Si más adelante quieres que se
  envíe automático sin que el cliente tenga que apretar "enviar" en
  su propio correo, hay que sumar un servicio de formularios (por
  ejemplo Formspree, tiene plan gratis) — eso ya requiere que crees
  una cuenta ahí, así que no lo dejé armado a la fuerza sin que lo
  decidas tú. La lógica del formulario está al final de
  `contactenos.html`, en un `<script>` chico y comentado.
- **Header en 2 filas** (inspirado en el sitio de Dr.Pet que me
  pasaste): arriba el logo, un **buscador funcional** y los botones
  de Escríbenos/carrito; abajo la barra de navegación (Inicio,
  Categorías, Ofertas — con la etiqueta roja "¡Descuentos
  exclusivos!" —, Novedades, Nosotros, Ubicaciones, Contacto, Ver
  catálogo). En mobile la fila de abajo se esconde dentro del menú
  hamburguesa (como ya funcionaba antes), y el buscador se hace
  compacto (solo el ícono en el botón).
- **Buscador real**: escribe cualquier término (nombre, marca o tipo
  de producto) y te lleva a `catalogo.html?buscar=texto` con los
  resultados de TODO el catálogo (no solo una categoría). Si ya
  estás en el catálogo, busca al toque sin recargar la página. Hay
  un botón "✕ Quitar búsqueda" para volver a navegar por categorías
  normal. La lógica vive en `catalogo.js` (`setSearchQuery`,
  `clearSearch`, y el `normalize()` que ignora tildes/mayúsculas).
- **Hero más bajo**: ya no ocupa toda la pantalla al cargar — se
  ajustó la altura (`min-height: 560px` en vez de `88vh`) para que,
  igual que en la referencia, se alcance a ver algo más de la página
  de entrada (el header de 2 filas y la franja de abajo).
- **Franja "¿Necesitas ayuda? / Sucursales"** debajo del hero —
  adaptación a 2 accesos de los 4 que tenía la referencia (los otros
  dos, "Mis Pedidos" y "Preguntas frecuentes", no aplican porque acá
  no hay cuentas de usuario ni un sistema de pedidos con seguimiento
  propio). "¿Necesitas ayuda?" abre WhatsApp, "Sucursales" baja
  directo a la sección de Ubicaciones.
- **Sin degradados entre secciones**: cada sección corta directo a
  la siguiente con su color plano (a pedido tuyo) — antes algunas se
  desvanecían gradualmente hacia el color de la que seguía. Los
  únicos degradados que quedan en `styles.css` NO son transiciones
  entre secciones: son velos sobre fotos para que el texto se lea
  bien (Ubicaciones, Alimento a Granel), el oscurecido de las fotos
  de las tarjetas de Categorías, y el difuminado de los bordes del
  carrusel de marcas.
- **Aviso de privacidad (pop-up)**: aparece la primera vez que
  alguien entra al sitio (en cualquier página), con fondo oscurecido
  y la tarjeta al centro hasta que se apreta "Aceptar" — avisa que
  los datos del cliente (nombre, teléfono, dirección) solo se usan
  para coordinar la compra/despacho, sin otros fines. Se recuerda
  con `localStorage` (`akyra_privacy_accepted`) para no volver a
  salir en visitas siguientes — si alguna vez quieres que vuelva a
  aparecer para todos, hay que cambiarle el nombre a esa clave en
  `script.js` (`initPrivacyNotice`). El texto es uno genérico que
  redacté yo, mencionando la Ley 19.628 — si tienes un texto legal
  más específico o revisado por alguien, avísame y lo reemplazo.
- **Logo real** (`assets/logo/logo-akyra.svg`): el archivo que subiste.
  Ojo con un detalle importante — trae el ícono + "Mascoteria" en gris
  oscuro Y "AKYRA" en blanco a la vez, así que **solo se lee completo
  sobre fondo turquesa** (igual que en tu letrero real). Por eso:
  - En el navbar no hace falta nada especial: el navbar ya es turquesa.
  - En el footer (fondo oscuro) le puse una tarjetita turquesa detrás
    (`.footer-logo-banner`) para que ambos textos se sigan leyendo.
  - Si en algún momento lo usas sobre blanco/crema, "AKYRA" se va a ver
    invisible — para eso necesitarías una versión del logo con esa
    palabra en otro color, o mantenerlo siempre sobre turquesa.
- **Paleta exacta** sacada del logo: turquesa `#00b0a3`, magenta/fucsia
  `#d91a5b`, rojo `#ee1d23` (detalle del corazón), gris oscuro `#231f20`
  (antes tenía valores aproximados — ahora son los reales).
- **Header**: sólido turquesa desde el inicio (antes tenía un rgba()
  suelto que quedó con el violeta viejo de Cocobian — ya corregido).
- **Hero — lanzamiento del sitio**:
  - Foto `assets/hero/portada-lanzamiento.png` — el perrito y la gata
    que mandaste, recortados con fondo transparente y con harto
    espacio vacío a la izquierda (a propósito, para el texto). Van
    con sombra (`filter: drop-shadow(...)`) para que no se vean
    "planos" sobre el fondo magenta.
  - Volvió el modo original del hero: mascota(s) recortada(s)
    flotando sobre el color de marca (magenta), en vez de una foto de
    escena completa — por eso el hero también volvió a medir según la
    altura de la ventana (`min-height: 88vh`) en lugar del
    `aspect-ratio` fijo que se había puesto para la foto panorámica
    de Fiestas Patrias (ya no hace falta: sin foto de fondo no hay
    ninguna barra que evitar).
  - La foto queda pegada al lado **derecho** del hero
    (`.hero-media-align-right`, activado con `align: 'right'` en el
    item de `HERO_MEDIA` en `script.js`) — así aprovecha el espacio
    vacío que ya trae de fábrica, en vez de desperdiciarlo centrada.
  - A la izquierda va el texto **"¡Inauguramos nuestro Sitio Web!"**
    (`.hero-launch-text` en `index.html`) — reemplaza al banner
    arqueado de "Felices Fiestas Patrias" que había antes.
  - En mobile no hay ancho para dejar texto e imagen lado a lado, así
    que se apilan: el texto arriba, la foto abajo (centrada, no
    pegada a la derecha).
  - **Nota sobre lo anterior**: la campaña de Fiestas Patrias
    (foto panorámica `fiestas-patrias.jpg`, banner arqueado, estrellas
    con flechas, copihues, colores azul/rojo/blanco) ya no está activa
    — quité el archivo de foto que ya no se usa. El CSS de las
    estrellas/flechas/copihues quedó comentado en `styles.css` por si
    alguna vez lo necesitas de vuelta (búsqueda: "hero-star" o
    "copihue-deco"); el del banner arqueado y el `aspect-ratio` del
    hero panorámico no se guardaron (eran muy específicos de esa foto
    puntual), pero están en el historial de cambios si hace falta
    reconstruirlos.
  - Sobre `HERO_MEDIA` (`script.js`): el item de la foto NO trae
    `mode: 'cover'` (o sea, usa el modo `'contain'`, mascota flotando)
    y sí trae `align: 'right'`. Si en algún momento quieres volver a
    una foto de escena completa (fondo real, no transparente), agrega
    `mode: 'cover'` de nuevo — pero ahí también conviene fijar un
    `aspect-ratio` en `.hero` para que no aparezca una barra de color
    (ver el patrón que se usó con la foto de Fiestas Patrias en el
    historial de `styles.css`).
- **Alimento a Granel** — sección propia en el home, entre
  Categorías y Ofertas (antes solo era una tarjeta más dentro de
  Categorías). Ícono + 3 puntos destacados + botón directo al
  catálogo filtrado en esa categoría. Ahora con la foto real que
  mandaste de fondo (`assets/img/fondo-granel.jpg`, del local con
  el pastor alemán en la pesa) — el texto y la tarjeta quedan
  pegados a la izquierda con un velo claro detrás para que se lean
  bien, y el resto de la foto (con el perro) queda despejado a la
  derecha. En mobile el velo es casi sólido (no hay espacio para
  mostrar foto y texto lado a lado en una pantalla angosta).
- **Navbar con guirnalda de banderitas chilenas** colgando del
  borde inferior (Fiestas Patrias) y **patrón de fondo** con
  patitas de perro/gato, empanadas y copas de vino, muy sutil, en
  Categorías, Ofertas y Sobre Nosotros — para que esas zonas con
  mucho blanco no se vean tan vacías. Todo esto vive en `styles.css`
  (comentarios "FIESTAS PATRIAS" y "PATRÓN DE FONDO") y es fácil de
  sacar más adelante si ya no lo quieres.
- **3 sucursales**:
  - **Casa Matriz** — Av. José Martínez de Aldunate 1431 (lunes a
    sábado 10:00–13:00 y 15:00–20:00). Foto todavía pendiente.
  - **Hornillas 080** (lunes a sábado 10:10–13:00 y 15:00–19:30,
    domingos y feriados cerrado) — **ya con su foto real**
    (`assets/img/lugares/hornillas.jpg`, la fachada con el letrero).
  - **Circunvalación** — Av. Circunvalación 340. Agregada ahora;
    **todavía no tengo el horario**, así que quedó como "Horario por
    confirmar" en la tarjeta — pásamelo y lo actualizo. Foto también
    pendiente.
- **WhatsApp** +56 9 8696 9111, **Instagram** @maskoteria_akyra y
  **Facebook** (Maskotería Akyra) en el footer y en los datos
  estructurados (schema.org) — antes el schema todavía apuntaba a la
  dirección vieja de Cocobian (Quillota 301), ya corregido a Casa
  Matriz.
- **Feed de Instagram — activado ✓**: el widget real de Elfsight que
  me pasaste ya está instalado en `#instagram-feed-embed` en
  `index.html`, reemplazando la tarjeta de espera que había antes.
  Recuerda que el plan gratis de Elfsight tiene tope de 200 vistas al
  mes — si el sitio recibe más tráfico, van a necesitar un plan pago
  para que el widget no se corte.
- **"Salud y Bienestar" (antes "Farmacia y Veterinaria" en Cocobian) —
  quitada**: sacaste esa sección completa del home. Ojo: el catálogo
  todavía tiene la categoría "Cuidado y Salud" (tab en `catalogo.html`,
  con los 28 productos de antiparasitarios/vitaminas/higiene en
  `data.js`) — solo saqué la vitrina del home, no toqué el catálogo.
  Si también quieres sacar esa categoría del catálogo, dímelo.
- **Categorías**: quedaron solo 3 tarjetas (Perros, Gatos, Otras
  mascotas) — saqué la de "Alimento a Granel" porque ahora tiene su
  propia sección con foto de fondo (ver arriba), y quedaba repetida
  dentro de Categorías. Cada tarjeta tiene un halo turquesa alrededor
  al pasar el mouse / tocar / enfocar con teclado, para que quede
  claro qué categoría se está por elegir.
- **Orden de secciones del home**: Categorías → Alimento a Granel →
  Ofertas → Novedades → Ubicaciones → Sobre nosotros → Reseñas →
  Marcas.

## Catálogo: filtros y ficha de producto
El catálogo (`catalogo.html`) tiene:
- Sidebar de filtros con checkbox (Tipo de producto, Marca, Edad) con
  conteo de resultados, que se recalcula según los demás filtros ya
  marcados.
- Chips de filtros activos con "x" individual + "Limpiar todo".
- Orden: Relevancia / Precio menor a mayor / Precio mayor a menor /
  Nombre A-Z.
- Ficha de producto (`producto.html?id=...`) con imagen grande, marca,
  descripción, selector de variante (Talla, donde aplica) y cantidad.
- Alimento a Granel se agrega directo desde la grilla (campo de
  gramos), sin ficha propia.
- Categorías: Perros, Gatos, Otros productos, Alimento a Granel,
  Cuidado y Salud.

Los datos de todos los productos viven en `data.js` (`PRODUCTS` y
`CATEGORY_META`), compartido por catálogo y ficha de producto.

## Catálogo real vía Google Sheets
Mismo modelo ya definido antes: el catálogo se alimenta desde una
planilla de Google Sheets (o exportaciones de Gesnex), con un Apps
Script que sincroniza stock/precio por SKU. Por ahora `data.js` tiene
un catálogo de ejemplo (marcas y precios inventados) mientras llega tu
inventario real.

## Pendiente / a tu criterio
- **Foto de Casa Matriz** y **foto de la sucursal Circunvalación** —
  hoy son genéricas de ejemplo (loremflickr).
- Confirmar si la sección "Cuidado y Salud" refleja bien lo que Akyra
  vende, o si hay que ajustarla.
- Marcas (`BRANDS` en `script.js`) siguen de ejemplo — las reseñas
  (`REVIEWS`) ya son reales, las 6 de Google que pasaste.
- Precios, marcas y descripciones del catálogo son inventados —
  ajústalos a los reales una vez que termines el inventario (te dejé
  la planilla `Inventario_Mascoteria_Akyra.xlsx` aparte para eso).
- El hero dice "¡Inauguramos nuestro Sitio Web!" — pensado para el
  lanzamiento; avísame cuándo quieras cambiarlo a un mensaje
  permanente (una promesa de marca, por ejemplo, en vez del aviso de
  apertura).

## Estructura
- `index.html` — landing
- `catalogo.html` + `catalogo.js` — grilla filtrable (filtros, chips,
  orden)
- `producto.html` + `producto.js` — ficha de detalle de un producto
  (variante + cantidad → carrito)
- `contactenos.html` — formulario de contacto ("¿No encuentras lo
  que necesitas?"), arma un `mailto:` hacia maskoteria.akyra@gmail.com
- `politica-privacidad.html`, `politica-despacho-retiro.html`,
  `politica-cambios-devoluciones.html` — páginas de políticas,
  contenido pendiente de que me lo pases
- `data.js` — `PRODUCTS` y `CATEGORY_META`, compartido por catálogo y
  ficha de producto
- `script.js` — configuración (WhatsApp, fotos de hero/nosotros/
  sucursales, marcas) y toda la lógica de carrito/menú
- `styles.css` — estilos y paleta (tokens en `:root` al inicio)
- `assets/` — logo real, foto de portada del hero y foto de Hornillas
