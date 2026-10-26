/* =========================================================
   variety.js
   Amplía la variedad de NPCs y reseñas con nombres, pueblos y comentarios
   de toda Tenerife. Se aplica sobre los bancos existentes sin duplicar código.
   ========================================================= */
import { NAMES } from './config.js';
import { REVIEW_BANK, PRAISE, DETAIL } from './report.js';

// ---------- Nombres y pueblos de toda la isla ----------
NAMES.turista.push(
  'Elena, Berlín','Jonas, Múnich','Marta, Varsovia','Lucas, Lyon','Chloé, Bruselas',
  'Sofía, Bogotá','Mateo, Buenos Aires','Camila, Ciudad de México','Andrés, Madrid',
  'Nora, Oslo','Erik, Estocolmo','Inés, Lisboa','Pedro, Oporto','Anna, Viena',
  'Sara, Milán','Tomás, Dublín','Julia, Ámsterdam','Ben, Londres','Mia, Copenhague',
  'Diego, Santiago de Chile'
);
NAMES.local.push(
  'Gara, La Laguna','Adán, Santa Cruz','Nira, La Orotava','Ayoze, Los Realejos',
  'Candelaria, Güímar','Zebenzui, Fasnia','Nerea, Arico','Yeray, Granadilla',
  'Garañona, San Miguel','Aday, Arona','Noa, Adeje','Chaxiraxi, Guía de Isora',
  'Arona, Vilaflor','Iballa, Santiago del Teide','Echedey, Buenavista',
  'Aday, Garachico','Nira, Icod de los Vinos','Ayoze, La Guancha',
  'Gara, San Juan de la Rambla','Adán, Los Silos','Nira, El Tanque',
  'Ayoze, Tacoronte','Candelaria, El Sauzal','Zebenzui, La Matanza',
  'Nerea, La Victoria','Yeray, Santa Úrsula','Garañona, La Esperanza'
);
NAMES.surfista.push(
  'Nauzet, El Médano','Iballa, Las Américas','Aday, Costa Adeje','Gara, La Caleta',
  'Echedey, Puerto de la Cruz','Noa, Alcalá','Arona, Playa Paraíso',
  'Iballa, La Jaquita','Aday, El Poris','Gara, Abades','Echedey, Güímar',
  'Noa, La Nea','Arona, Radazul','Iballa, Las Galletas','Aday, La Tejita'
);

// ---------- Reseñas: más variantes por caso ----------
REVIEW_BANK.colaLenta.push(
  'La cola iba más lenta que el tráfico en la TF-1 un viernes.',
  'Esperamos tanto que nos dio tiempo a ver tres olas grandes.',
  'Con la calima y esa cola, se hizo eterno el mediodía.',
  'La fila avanzaba despacito, como el guagua de la línea 470.',
  'Entre la marea de gente y la espera, se nos fue la mañana.',
  'Hicimos más cola que para el barco a La Gomera.',
  'La espera se nos hizo larga, aunque el sitio prometía.',
  'Con esa cola, el sol nos hizo más daño que la sed.'
);
REVIEW_BANK.colaLlena.push(
  'Había tanta gente que parecía la bajada del Carmen en Candelaria.',
  'Ni en las fiestas de La Laguna se ve una fila así.',
  'Dimos la vuelta al ver la cola: otro día será.',
  'La fila llegaba hasta la orilla, mejor nos fuimos al chiringuito de al lado.',
  'Ni de broma: había más cola que en el Teide en agosto.',
  'Pasamos, vimos la marea de gente y seguimos caminando.',
  'Con esa cola, mejor nos compramos un agua en el kiosco de la playa.'
);
REVIEW_BANK.preciosAltos.push(
  'Buen sitio, pero la cuenta nos dejó más calientes que la calima.',
  'Cobran como si la playa fuera la Costa Adeje premium.',
  'Por ese precio, en el pueblo comemos pescado entero.',
  'Está bien para un día, pero no para venir cada semana.',
  'La cuenta subió más que la marea con viento del norte.',
  'Caro, aunque el barraquito estaba bueno.',
  'Nos pareció caro para lo que es un chiringuito de playa.'
);
REVIEW_BANK.sinStock.push(
  'Justo el día que apetecía pescado, no quedaba.',
  'Se nos acabó la suerte: lo que queríamos, agotado.',
  'Con media carta agotada, tocó improvisar.',
  'Fuimos por el batido y no había: qué rabia.',
  'Nos quedamos con las ganas de las papas con mojo.',
  'El género se agotó pronto; habrá que llegar más temprano.',
  'Lo que pedimos no estaba; nos tocó cambiar de plan.'
);
REVIEW_BANK.mesasSucias.push(
  'Las gaviotas se comieron más tranquilo que nosotros.',
  'Había mesas sin recoger desde hacía rato.',
  'Con las mesas así, mejor nos quedamos en la toalla.',
  'Pedimos que limpiaran la mesa y tardaron en venir.',
  'La terraza estaba regular por las mesas sin recoger.',
  'Más de una mesa con vasos de antes; no da buena imagen.'
);
REVIEW_BANK.sinMesa.push(
  'Ni sombra ni mesa: a la toalla, que ya está bien.',
  'Queríamos sentarnos y no hubo manera.',
  'Con la playa llena, tocó comer de pie.',
  'Nos llevamos la comida a la arena, sin más.',
  'No había mesa ni en la terraza ni en la arena.',
  'Dimos una vuelta buscando mesa y al final, para llevar.'
);
REVIEW_BANK.decepcion.push(
  'Esperábamos más de un sitio con esas vistas.',
  'Está bien, pero hoy no nos convenció.',
  'Regular: ni fu ni fa.',
  'Nos quedamos con ganas de más.',
  'El sitio mola, pero el servicio flojeó.',
  'Un día normal, sin más historia.'
);
REVIEW_BANK.habitual.push(
  'Nuestra parada de siempre en la playa.',
  'Venimos cada verano y no falla.',
  'El chiringuito de confianza, como cada año.',
  'Otra vez por aquí, y bien atendidos.',
  'Ya somos de la casa.',
  'Cada vez que bajamos a la playa, aquí estamos.'
);
REVIEW_BANK.pedidoPerfecto.push(
  'Todo tal cual lo pedimos, ni un fallo.',
  'Pedido completo y bien servido.',
  'Exactamente lo que queríamos, sin cambios.',
  'Ni una pega: pedido redondo.',
  'Lo pedido es lo servido, perfecto.',
  'Todo completo y en su punto.'
);
REVIEW_BANK.servicioRapido.push(
  'En plena hora punta y nos atendieron volando.',
  'Ni tiempo a sudar la calima y ya teníamos el pedido.',
  'Rapidísimos, incluso con la playa llena.',
  'Pedimos y en un momento lo teníamos.',
  'Servicio de récord, para repetir.',
  'Con esa marea de gente, nos sorprendió la rapidez.'
);
REVIEW_BANK.calima.push(
  'Con la calima, la sombra del chiringuito se agradece.',
  'Bochorno de polvo, pero el batido salvó la tarde.',
  'Calima fuerte, pero el sitio tiene su encanto.',
  'Con ese calor del Sáhara, cualquier sombra es oro.',
  'La calima apretaba y el barraquito nos levantó el ánimo.',
  'Día de polvo, pero bien resueltos con una bebida fría.'
);
REVIEW_BANK.templado.push(
  'Correcto para un día de playa.',
  'Cumple para matar la sed.',
  'Ni fu ni fa, pero bien para un rato.',
  'Sitio agradable, servicio normal.',
  'Para un refresco, va bien.',
  'Sin más, pero la playa acompaña.'
);

// ---------- Elogios con más sabor canario ----------
PRAISE.cerveza.push(
  'La cerveza bien fría, como debe ser en el sur.',
  'Dorada helada, perfecta para la calima.'
);
PRAISE.barraquito.push(
  'El barraquito con su canela, como los de toda la vida.',
  'Un barraquito bien hecho, de los que quitan las penas.'
);
PRAISE.batido.push(
  'Batido de plátano de Canarias, espeso y buenísimo.',
  'El plátano se notaba de aquí, no de importado.'
);
PRAISE.papas.push(
  'Papas arrugadas con mojo verde, como las de casa.',
  'El mojo picón tenía su punto, muy canario.'
);
PRAISE.queso.push(
  'Queso asado con mojo, en su punto justo.',
  'El queso de la isla, bien dorado.'
);
PRAISE.pescado.push(
  'Pescado del día, fresco y bien hecho.',
  'Se notaba que era pescado de la isla, muy bueno.'
);

// ---------- Detalles con más variantes ----------
DETAIL.order.push(
  'Pedimos {items}.',
  'Fuimos de {items}.',
  'Nuestro plan: {items}.',
  'Pedimos {items}, sin más.'
);
DETAIL.wait.push(
  'Esperamos {mins} minutos, que se hicieron largos.',
  'Con {mins} minutos de cola, se hace cuesta arriba.',
  'Nos tocaron {mins} minutos de espera.'
);
DETAIL.tableYes.push(
  'Mesa con vistas al mar, un acierto.',
  'Comimos mirando las olas, muy bien.',
  'Mesa en primera línea, repetiremos.'
);
DETAIL.tableNo.push(
  'Sin mesa, tocó toalla.',
  'Nos lo llevamos a la arena.',
  'Comimos de pie, como se pudo.'
);
DETAIL.dataPosNW.push(
  'Cuenta de {price}, contentos.',
  'Por {price}, bien servidos.'
);
DETAIL.dataTipNW.push(
  '{price} y propina de {tip}, merecido.',
  'Cuenta de {price} y propina: repetiremos.'
);
