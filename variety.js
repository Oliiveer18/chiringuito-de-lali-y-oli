/* =========================================================
   variety.js · v3
   Variedad profesional de NPCs y reseñas para un chiringuito de Tenerife.
   Añade voz canaria, intensidad emocional y más matices por caso.
   Nota: la selección estricta por tipo de cliente y la firma con pueblo
   requieren tocar el generador de reseñas (report.js); aquí se amplían
   los bancos compartidos con frases de voz e intensidad variadas.
   ========================================================= */
import { NAMES } from './config.js?v=27.4';
import { REVIEW_BANK, PRAISE, DETAIL } from './report.js?v=27.4';

const add = (arr, items) => { for (const it of items) if (!arr.includes(it)) arr.push(it); };

// ---------- Nombres y pueblos (turistas, locales y surfistas) ----------
add(NAMES.turista, [
  'Hannah, Hamburgo','Liam, Mánchester','Sofie, Copenhague','Giulia, Milán','Ana, Madrid',
  'Pierre, Lyon','Olga, Helsinki','Marta, Barcelona','Jon, Dublín','Ingrid, Oslo',
  'Marco, Roma','Nils, Estocolmo','Elena, Berlín','Jonas, Múnich','Marta, Varsovia',
  'Lucas, Lyon','Chloé, Bruselas','Sofía, Bogotá','Mateo, Buenos Aires','Camila, Ciudad de México',
  'Andrés, Madrid','Nora, Oslo','Erik, Estocolmo','Inés, Lisboa','Pedro, Oporto',
  'Anna, Viena','Sara, Milán','Tomás, Dublín','Julia, Ámsterdam','Ben, Londres',
  'Mia, Copenhague','Diego, Santiago de Chile','Léa, París','Finn, Hamburgo','Sanne, Ámsterdam',
  'Kasper, Copenhague','Elisa, Milán','Pablo, Bilbao','Lucía, Valencia','Marta, Sevilla',
  'Iván, Moscú','Nina, Berlín','Tom, Bristol','Eva, Praga','Klara, Viena',
  'Oskar, Varsovia','Lotte, Bruselas','Mads, Aarhus','Freja, Aarhus','Sven, Estocolmo'
]);
add(NAMES.local, [
  'Gara, La Laguna','Adán, Santa Cruz','Nira, La Orotava','Ayoze, Los Realejos',
  'Candelaria, Güímar','Zebenzui, Fasnia','Nerea, Arico','Yeray, Granadilla',
  'Garañona, San Miguel','Aday, Arona','Noa, Adeje','Chaxiraxi, Guía de Isora',
  'Arona, Vilaflor','Iballa, Santiago del Teide','Echedey, Buenavista',
  'Aday, Garachico','Nira, Icod de los Vinos','Ayoze, La Guancha',
  'Gara, San Juan de la Rambla','Adán, Los Silos','Nira, El Tanque',
  'Ayoze, Tacoronte','Candelaria, El Sauzal','Zebenzui, La Matanza',
  'Nerea, La Victoria','Yeray, Santa Úrsula','Garañona, La Esperanza',
  'Gara, Anaga','Adán, San Andrés','Nira, Taganana','Ayoze, Igueste',
  'Candelaria, La Laguna','Zebenzui, La Cuesta','Nerea, Taco','Yeray, La Salud',
  'Garañona, La Candelaria','Aday, Arafo','Noa, Fasnia','Chaxiraxi, Arico',
  'Arona, Granadilla','Iballa, San Isidro','Echedey, Los Abrigos','Aday, El Médano',
  'Nira, La Camella','Ayoze, Costa del Silencio','Gara, Las Chafiras',
  'Adán, Guargacho','Nira, Los Cristianos','Ayoze, Playa de la Arena',
  'Candelaria, Puerto de Santiago','Zebenzui, Tamaimo','Nerea, Santiago del Teide',
  'Yeray, Las Portelas','Garañona, Masca','Aday, Buenavista','Noa, Los Silos'
]);
add(NAMES.surfista, [
  'Nauzet, El Médano','Iballa, Las Américas','Aday, Costa Adeje','Gara, La Caleta',
  'Echedey, Puerto de la Cruz','Noa, Alcalá','Arona, Playa Paraíso',
  'Iballa, La Jaquita','Aday, El Poris','Gara, Abades','Echedey, Güímar',
  'Noa, La Nea','Arona, Radazul','Iballa, Las Galletas','Aday, La Tejita',
  'Gara, El Cabezo','Echedey, La Jaquita','Noa, La Tejita','Arona, El Médano',
  'Iballa, Las Américas','Aday, La Caleta','Gara, Alcalá','Echedey, Puerto de la Cruz',
  'Noa, Playa Paraíso','Arona, La Jaquita','Iballa, El Poris','Aday, Abades',
  'Gara, Güímar','Echedey, La Nea','Noa, Radazul','Arona, Las Galletas',
  'Iballa, La Tejita','Aday, El Cabezo','Gara, Las Américas','Echedey, La Caleta'
]);

// ---------- Reseñas: voz canaria + intensidad por caso ----------
// Cola lenta: desde incómoda hasta muy molesta
add(REVIEW_BANK.colaLenta, [
  'La cola iba más lenta que el tráfico en la TF-1 un viernes.',
  'Esperamos tanto que nos dio tiempo a ver tres olas grandes.',
  'Con la calima y esa cola, se hizo eterno el mediodía.',
  'La fila avanzaba despacito, como el guagua de la línea 470.',
  'Entre la marea de gente y la espera, se nos fue la mañana.',
  'Hicimos más cola que para el barco a La Gomera.',
  'La espera se nos hizo larga, aunque el sitio prometía.',
  'Con esa cola, el sol nos hizo más daño que la sed.',
  'Más de veinte minutos esperando y con la calima encima.',
  'La cola no avanzaba y los niños ya estaban de mala leche.',
  'Esperamos tanto que nos dio tiempo a discutir el pedido.',
  'Con la marea de gente, la espera se hizo cuesta arriba.',
  'La fila era larga y el sol apretaba; no fue nuestro día.',
  'Esperamos un buen rato, aunque el barraquito estaba bueno.',
  'La cola se hizo eterna, pero el sitio tiene su encanto.',
  'Una espera de las que te hacen replantearte la playa.',
  'Con esa cola, mejor venir con sombrero y paciencia.',
  'La espera nos quitó las ganas de pedir más.',
  'Cola lenta, sol fuerte y calima: trío poco amable.',
  'Esperamos un rato de los que se recuerdan.',
  'La fila avanzaba despacio, aunque el sitio es bonito.',
  'Con esa espera, se agradece que el pedido estuviera bien.',
  'La cola nos dejó más tostados que la calima.',
  'Esperamos tanto que la marea cambió dos veces.'
]);
// Cola llena: desde “no cabíamos” hasta “mejor ni acercarse”
add(REVIEW_BANK.colaLlena, [
  'Había tanta gente que parecía la bajada del Carmen en Candelaria.',
  'Ni en las fiestas de La Laguna se ve una fila así.',
  'Dimos la vuelta al ver la cola: otro día será.',
  'La fila llegaba hasta la orilla, mejor nos fuimos al chiringuito de al lado.',
  'Ni de broma: había más cola que en el Teide en agosto.',
  'Pasamos, vimos la marea de gente y seguimos caminando.',
  'Con esa cola, mejor nos compramos un agua en el kiosco de la playa.',
  'Ni en el carnaval de Santa Cruz se ve una fila así.',
  'Había cola para pedir y cola para respirar.',
  'La fila llegaba hasta la arena; mejor nos fuimos.',
  'Con esa marea, mejor venir temprano o no venir.',
  'Vimos la cola desde la hamaca y decidimos seguir de paseo.',
  'La cola daba la vuelta al chiringuito; otra vez será.',
  'Demasiada gente para un chiringuito de playa.',
  'Ni un hueco en la fila; seguimos de largo.',
  'La cola era de las que quitan las ganas.',
  'Con esa marea, mejor venir entre semana.',
  'Ni mirar: la fila llegaba a la orilla.',
  'Había más cola que en el Teide en agosto.',
  'Pasamos de largo: la fila lo decía todo.',
  'La cola llegaba hasta la orilla; mejor otro día.',
  'Con esa gente, mejor un agua y a la toalla.',
  'La fila era de las que desaniman.',
  'Ni acercarse: la cola lo decía todo.',
  'Demasiada marea de gente para un chiringuito.'
]);
// Precios: desde “caro” hasta “no vuelvo”
add(REVIEW_BANK.preciosAltos, [
  'Buen sitio, pero la cuenta nos dejó más calientes que la calima.',
  'Cobran como si la playa fuera la Costa Adeje premium.',
  'Por ese precio, en el pueblo comemos pescado entero.',
  'Está bien para un día, pero no para venir cada semana.',
  'La cuenta subió más que la marea con viento del norte.',
  'Caro, aunque el barraquito estaba bueno.',
  'Nos pareció caro para lo que es un chiringuito de playa.',
  'Por lo que costó la cuenta, en La Laguna comemos mejor.',
  'Bueno, bonito y caro: dos de tres no está mal.',
  'La cuenta nos dejó helados, y no por la cerveza.',
  'Caro para lo que es, aunque el sitio es agradable.',
  'Con esa cuenta, mejor comer en el pueblo.',
  'Nos pareció caro, pero la vista acompaña.',
  'El precio no acompañó tanto como el sol.',
  'Cobran como en el puerto deportivo; ojo con la cuenta.',
  'La cuenta nos dejó helados; no por la cerveza.',
  'Caro para un chiringuito de playa.',
  'Por ese precio, mejor comer en el pueblo.',
  'La cuenta subió más que la marea.',
  'Caro, aunque la vista acompaña.',
  'Nos pareció caro para lo que es.',
  'El precio no acompañó.',
  'Cobran como en el puerto deportivo.',
  'La cuenta nos dejó helados.',
  'Caro para lo que es.'
]);
// Sin stock: desde “una pena” hasta “qué rabia”
add(REVIEW_BANK.sinStock, [
  'Justo el día que apetecía pescado, no quedaba.',
  'Se nos acabó la suerte: lo que queríamos, agotado.',
  'Con media carta agotada, tocó improvisar.',
  'Fuimos por el batido y no había: qué rabia.',
  'Nos quedamos con las ganas de las papas con mojo.',
  'El género se agotó pronto; habrá que llegar más temprano.',
  'Lo que pedimos no estaba; nos tocó cambiar de plan.',
  'Justo lo que apetecía, agotado; qué mala suerte.',
  'No quedaba de lo nuestro; tocó buscar alternativa.',
  'Con la carta a medias, se nos fue el hambre.',
  'El pescado se acabó pronto; habrá que madrugar.',
  'Sin stock de lo que queríamos, nos fuimos con las ganas.',
  'Agotado lo que pedimos; otra vez será.',
  'Nos quedamos sin lo nuestro de siempre.',
  'La carta estaba coja por los agotados.',
  'Justo lo que apetecía, agotado.',
  'No quedaba de lo nuestro.',
  'Con la carta a medias, tocó improvisar.',
  'El pescado se acabó pronto.',
  'Sin stock de lo que queríamos.',
  'Agotado lo que pedimos.',
  'Nos quedamos con las ganas.',
  'La carta estaba coja.',
  'Lo que pedimos no estaba.',
  'Se nos acabó la suerte.'
]);
// Mesas sucias: desde “regular” hasta “no da buena imagen”
add(REVIEW_BANK.mesasSucias, [
  'Las gaviotas se comieron más tranquilo que nosotros.',
  'Había mesas sin recoger desde hacía rato.',
  'Con las mesas así, mejor nos quedamos en la toalla.',
  'Pedimos que limpiaran la mesa y tardaron en venir.',
  'La terraza estaba regular por las mesas sin recoger.',
  'Más de una mesa con vasos de antes; no da buena imagen.',
  'Las mesas tardaban y la arena estaba llena de vasos.',
  'Con esas mesas, el sitio perdía puntos.',
  'Nos tocó pedir que nos arreglaran la mesa.',
  'Había mesas sucias y nadie las recogía.',
  'La limpieza de la terraza flojeó ese día.',
  'Con las mesas así, el hambre se nos fue.',
  'Las gaviotas comían mejor servidas que nosotros.',
  'La terraza necesitaba una pasada de limpieza.',
  'Mesas sin recoger; no da buena impresión.',
  'Había mesas sin recoger.',
  'La terraza estaba regular.',
  'Con esas mesas, mejor la toalla.',
  'La limpieza flojeó.',
  'Mesas sin recoger.',
  'No da buena imagen.',
  'La terraza necesitaba limpieza.',
  'Las gaviotas comían mejor.',
  'Con esas mesas, el sitio perdía.',
  'La limpieza flojeó ese día.'
]);
// Sin mesa: desde “tocó toalla” hasta “no cabía un alfiler”
add(REVIEW_BANK.sinMesa, [
  'Ni sombra ni mesa: a la toalla, que ya está bien.',
  'Queríamos sentarnos y no hubo manera.',
  'Con la playa llena, tocó comer de pie.',
  'Nos llevamos la comida a la arena, sin más.',
  'No había mesa ni en la terraza ni en la arena.',
  'Dimos una vuelta buscando mesa y al final, para llevar.',
  'Sin mesa, pero con las vistas no se sufre tanto.',
  'Nos tocó comer de pie como los cormoranes.',
  'No cabía un alfiler; tocó toalla.',
  'Buscamos mesa un buen rato y nada.',
  'Con la terraza llena, tocó llevarse el pedido.',
  'Sin mesa y con calima: no fue nuestro día.',
  'La mesa nunca llegó; nos fuimos con el papel de aluminio.',
  'Para llevar y a la arena, como buenamente se pudo.',
  'Ni sombra ni mesa; otra vez será.',
  'No cabía un alfiler.',
  'Tocó toalla.',
  'Comimos de pie.',
  'Sin mesa ni sombra.',
  'Buscamos mesa y nada.',
  'Con la terraza llena, para llevar.',
  'La mesa nunca llegó.',
  'Para llevar y a la arena.',
  'Ni sombra ni mesa.',
  'No hubo manera.'
]);
// Decepción: desde “regular” hasta “esperábamos más”
add(REVIEW_BANK.decepcion, [
  'Esperábamos más de un sitio con esas vistas.',
  'Está bien, pero hoy no nos convenció.',
  'Regular: ni fu ni fa.',
  'Nos quedamos con ganas de más.',
  'El sitio mola, pero el servicio flojeó.',
  'Un día normal, sin más historia.',
  'Con lo bonito que es el sitio, esperábamos mejor servicio.',
  'Nos dejó tibios, siendo sinceros.',
  'No es malo, pero hoy no acertamos con el día.',
  'El sitio promete, pero hoy no estuvo a la altura.',
  'Regular; esperábamos más por lo que cuesta.',
  'Ni fu ni fa; la playa manda.',
  'Nos fuimos con la sensación de que podía estar mejor.',
  'Un poco desganado el servicio hoy.',
  'No acabamos de disfrutar la visita.',
  'Esperábamos más.',
  'Regular, sin más.',
  'Nos dejó tibios.',
  'El servicio flojeó.',
  'No estuvo a la altura.',
  'Ni fu ni fa.',
  'Un día normal.',
  'Podía estar mejor.',
  'No nos convenció.',
  'Sin más historia.'
]);
// Habituales: desde “ya somos de la casa” hasta “no falla”
add(REVIEW_BANK.habitual, [
  'Nuestra parada de siempre en la playa.',
  'Venimos cada verano y no falla.',
  'El chiringuito de confianza, como cada año.',
  'Otra vez por aquí, y bien atendidos.',
  'Ya somos de la casa.',
  'Cada vez que bajamos a la playa, aquí estamos.',
  'Nuestra parada fija después del baño.',
  'Cuando volvemos a la isla, aquí sin falta.',
  'El chiringuito de siempre, y no falla.',
  'Repetimos visita y seguimos contentos.',
  'Ya nos conocen, y eso se agradece.',
  'Nuestro sitio de cada verano.',
  'Como cada año, bien atendidos.',
  'La parada fija de la familia.',
  'El chiringuito de confianza, sin más.',
  'Nuestra parada de siempre.',
  'Venimos cada verano.',
  'El chiringuito de confianza.',
  'Ya somos de la casa.',
  'Nuestra parada fija.',
  'Cuando volvemos, aquí estamos.',
  'El de siempre, y no falla.',
  'Repetimos y contentos.',
  'Ya nos conocen.',
  'Nuestro sitio de cada verano.'
]);
// Pedido perfecto: desde “bien” hasta “ni un fallo”
add(REVIEW_BANK.pedidoPerfecto, [
  'Todo tal cual lo pedimos, ni un fallo.',
  'Pedido completo y bien servido.',
  'Exactamente lo que queríamos, sin cambios.',
  'Ni una pega: pedido redondo.',
  'Lo pedido es lo servido, perfecto.',
  'Todo completo y en su punto.',
  'Pedido exacto y bien presentado.',
  'Ni un cambio ni una falta: perfecto.',
  'Todo como lo pedimos, sin sustos.',
  'Pedido redondo, para repetir.',
  'Exactamente lo que pedimos, genial.',
  'Sin faltas ni cambios, perfecto.',
  'Todo en su punto y tal cual.',
  'Pedido completo, bien servido.',
  'Tal cual lo pedimos, sin más.',
  'Todo tal cual, ni un fallo.',
  'Pedido completo.',
  'Exactamente lo que queríamos.',
  'Ni una pega.',
  'Lo pedido es lo servido.',
  'Todo en su punto.',
  'Pedido exacto.',
  'Ni un cambio.',
  'Todo como lo pedimos.',
  'Pedido redondo.'
]);
// Servicio rápido: desde “rápido” hasta “como un reloj”
add(REVIEW_BANK.servicioRapido, [
  'En plena hora punta y nos atendieron volando.',
  'Ni tiempo a sudar la calima y ya teníamos el pedido.',
  'Rapidísimos, incluso con la playa llena.',
  'Pedimos y en un momento lo teníamos.',
  'Servicio de récord, para repetir.',
  'Con esa marea de gente, nos sorprendió la rapidez.',
  'A la hora punta y todo como un reloj.',
  'Ni nos dio tiempo a decidirnos y ya estaba.',
  'Rapidez de récord, para aplaudir.',
  'En un visto y no visto teníamos el pedido.',
  'Con la barra llena, nos sirvieron en nada.',
  'Rápidos incluso con la hora punta encima.',
  'Pedimos, parpadeamos y ya estaba listo.',
  'Servicio rápido y bien hecho.',
  'Con la playa llena, todo volando.',
  'En plena hora punta, volando.',
  'Rapidísimos.',
  'En un momento lo teníamos.',
  'Servicio de récord.',
  'Todo como un reloj.',
  'Ni tiempo a decidirnos.',
  'Rapidez de récord.',
  'En un visto y no visto.',
  'Nos sirvieron en nada.',
  'Todo volando.'
]);
// Calima: desde “se agradece la sombra” hasta “el batido salvó la tarde”
add(REVIEW_BANK.calima, [
  'Con la calima, la sombra del chiringuito se agradece.',
  'Bochorno de polvo, pero el batido salvó la tarde.',
  'Calima fuerte, pero el sitio tiene su encanto.',
  'Con ese calor del Sáhara, cualquier sombra es oro.',
  'La calima apretaba y el barraquito nos levantó el ánimo.',
  'Día de polvo, pero bien resueltos con una bebida fría.',
  'Con la calima, la cerveza fría es un alivio.',
  'Bochorno del Sáhara, pero el sitio se defiende.',
  'Calima y calor, pero la sombra acompañó.',
  'Con ese viento de calima, la sombra era un lujo.',
  'La calima no perdonaba, pero el chiringuito sí.',
  'Día de polvo, pero el barraquito nos levantó.',
  'Con la calima, cualquier sombra es un acierto.',
  'Bochorno, pero la bebida fría salvó la tarde.',
  'Calima fuerte; el sitio se las arregla bien.',
  'Con la calima, la sombra se agradece.',
  'Bochorno de polvo.',
  'Calima fuerte.',
  'Con ese calor del Sáhara.',
  'La calima apretaba.',
  'Día de polvo.',
  'Con la calima, la cerveza fría es un alivio.',
  'Bochorno del Sáhara.',
  'Calima y calor.',
  'La calima no perdonaba.'
]);
// Templado: mucho más variado para que no suene siempre igual
add(REVIEW_BANK.templado, [
  'Correcto para un día de playa.',
  'Cumple para matar la sed.',
  'Ni fu ni fa, pero bien para un rato.',
  'Sitio agradable, servicio normal.',
  'Para un refresco, va bien.',
  'Sin más, pero la playa acompaña.',
  'Correcto, sin más historia.',
  'Cumple, sin más.',
  'Bien para un rato, sin más.',
  'Sitio normal, la playa manda.',
  'Para un día de playa, correcto.',
  'Ni fu ni fa; la vista acompaña.',
  'Cumple para un refresco.',
  'Correcto, sin más.',
  'Bien para un rato en la playa.',
  'Correcto para la playa.',
  'Cumple para la sed.',
  'Ni fu ni fa.',
  'Sitio agradable.',
  'Para un refresco, bien.',
  'Sin más, la playa acompaña.',
  'Correcto.',
  'Cumple.',
  'Bien para un rato.',
  'Sitio normal.',
  'Para un día de playa, bien.',
  'La vista acompaña.',
  'Para un refresco, correcto.',
  'Sin más.',
  'Bien en la playa.'
]);

// ---------- Elogios con más sabor canario ----------
add(PRAISE.cerveza, [
  'La cerveza bien fría, como debe ser en el sur.',
  'Dorada helada, perfecta para la calima.',
  'La cerveza a su punto, ni fría ni caliente.',
  'Bien tirada y bien fría, como manda la tradición.'
]);
add(PRAISE.barraquito, [
  'El barraquito con su canela, como los de toda la vida.',
  'Un barraquito bien hecho, de los que quitan las penas.',
  'El barraquito estaba de otro nivel.',
  'Con su licor y su canela, como manda la tradición.'
]);
add(PRAISE.batido, [
  'Batido de plátano de Canarias, espeso y buenísimo.',
  'El plátano se notaba de aquí, no de importado.',
  'Batido espeso y frío, para repetir.',
  'El plátano canario se notaba, muy bueno.'
]);
add(PRAISE.papas, [
  'Papas arrugadas con mojo verde, como las de casa.',
  'El mojo picón tenía su punto, muy canario.',
  'Papas del país con su mojo, para chuparse los dedos.',
  'El mojo estaba hecho en el mortero, se notaba.'
]);
add(PRAISE.queso, [
  'Queso asado con mojo, en su punto justo.',
  'El queso de la isla, bien dorado.',
  'Queso asado con mojo verde, muy bueno.',
  'El queso estaba en su punto, para repetir.'
]);
add(PRAISE.pescado, [
  'Pescado del día, fresco y bien hecho.',
  'Se notaba que era pescado de la isla, muy bueno.',
  'Pescado fresco, en su punto.',
  'El pescado del día, para repetir.'
]);

// ---------- Detalles con más variantes ----------
add(DETAIL.order, [
  'Pedimos {items}.',
  'Fuimos de {items}.',
  'Nuestro plan: {items}.',
  'Pedimos {items}, sin más.',
  'Entre los dos: {items}.',
  'Nuestro pedido: {items}.'
]);
add(DETAIL.wait, [
  'Esperamos {mins} minutos, que se hicieron largos.',
  'Con {mins} minutos de cola, se hace cuesta arriba.',
  'Nos tocaron {mins} minutos de espera.',
  'Cola de {mins} minutos, al sol.',
  'Una espera de {mins} minutos, no es lo ideal.'
]);
add(DETAIL.tableYes, [
  'Mesa con vistas al mar, un acierto.',
  'Comimos mirando las olas, muy bien.',
  'Mesa en primera línea, repetiremos.',
  'Mesa en la arena, qué más se puede pedir.',
  'Mesa para nosotros, y con vistas de sobra.'
]);
add(DETAIL.tableNo, [
  'Sin mesa, tocó toalla.',
  'Nos lo llevamos a la arena.',
  'Comimos de pie, como se pudo.',
  'Para llevar y a la arena.',
  'Sin mesa, pero con las vistas no se sufre tanto.'
]);
add(DETAIL.dataPosNW, [
  'Cuenta de {price}, contentos.',
  'Por {price}, bien servidos.',
  'Cuenta de {price}, sin queja.',
  'Por {price}, bien gastados.'
]);
add(DETAIL.dataTipNW, [
  '{price} y propina de {tip}, merecido.',
  'Cuenta de {price} y propina: repetiremos.',
  'Con {price} pagados y {tip} de propina, quedamos tan a gusto.',
  'Cuenta de {price} y propina de {tip}: señal de que repetiremos.'
]);
