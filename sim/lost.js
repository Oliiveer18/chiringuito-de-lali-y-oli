/* v29.2: reglas de jornada extraídas a módulo sin dependencias para poder
   probarlas en Node sin navegador. Sin información extra en el informe:
   lo que no pasó en el servicio no se cuenta dos veces. */
import { DRINKS } from '../config.js?v=30.0.0';

/* v29.5: solo ensucia la mesa quien ha comido comida (papas, queso, pescado):
   las consumiciones de bebida no dejan restos; si pidieron comida y bebida,
   la mesa sí queda sucia. Centralizado aquí para probarlo sin el simulador. */
export function tableStateAfterMeal(c){
  return c && Array.isArray(c.served) && c.served.some(id=>!DRINKS.includes(id)) ? 'dirty' : 'free';
}
