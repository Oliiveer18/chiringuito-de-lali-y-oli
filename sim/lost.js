/* v29.2: reglas de jornada extraídas a módulo sin dependencias para poder
   probarlas en Node sin navegador. Sin información extra en el informe:
   lo que no pasó en el servicio no se cuenta dos veces. */

/* v29.2: todo cliente que come en mesa deja la mesa sucia. Antes era una
   lotería del 75%. Centralizado aquí para probarlo sin el simulador. */
export function tableStateAfterMeal(){ return 'dirty'; }
