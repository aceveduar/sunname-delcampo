/** Normaliza texto libre a Título (una mayúscula por palabra), para que
 * catálogo no dependa de cómo cada quien haya tecleado el nombre. */
export function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-MX')
    .replace(/(^|[\s/-])\p{L}/gu, (letter) => letter.toLocaleUpperCase('es-MX'))
}

/** Normaliza códigos cortos (unidades, SKU) a mayúsculas. */
export function toCode(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-MX')
}

/** Quita acentos/diacríticos y mayúsculas antes de comparar -- así buscar
 * "cafe" encuentra "Café" aunque el texto tecleado no lleve el acento. */
export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/** Convierte la descripción de un ticket de proveedor en un nombre
 * razonable para el catálogo propio.
 *
 * El proveedor escribe para su almacén, no para tu catálogo: mete el
 * tamaño del empaque y sus propias claves ("ARROZ SAMAN C/25 KG",
 * "MOLE ALMENDRADO (C-5 POLVO)"). Guardar eso tal cual ensucia el
 * catálogo para siempre, y ese nombre es el que después se usa para
 * buscar en Caja. Se quita el ruido de empaque y se deja el nombre; de
 * todos modos el campo queda editable, porque el nombre bueno es el que
 * usa el negocio, no el del proveedor. */
export function nombreDesdeTicket(descripcion: string) {
  const limpio = descripcion
    // Paréntesis y corchetes completos: casi siempre son clave o empaque.
    .replace(/[([{][^)\]}]*[)\]}]/g, ' ')
    // "C/25 KG", "C-5", "C/ 12": la forma en que se anota cuántas piezas
    // o kilos trae el bulto.
    .replace(/\bc\s*[/-]\s*\d+([.,]\d+)?\s*[a-z]*\b/gi, ' ')
    // Un tamaño pegado al final: "180ML", "25 KG", "1 LT".
    .replace(/\b\d+([.,]\d+)?\s*(kg|kgs|gr|grs|g|ml|lt|lts|l|pz|pzs|oz)\b\.?\s*$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Si limpiar dejó poco o nada, se devuelve el original: es mejor un
  // nombre feo que uno vacío o mutilado.
  return toTitleCase(limpio.length >= 3 ? limpio : descripcion)
}

/** Cuántas unidades trae el empaque, según lo dice la descripción del
 * ticket: "ARROZ SAMAN C/25 KG" -> 25. null si no lo dice.
 *
 * Sirve de primera propuesta cuando todavía no hay una equivalencia
 * guardada para ese proveedor. El negocio compra por bulto y vende por
 * kilo, así que sin esto habría que capturar la conversión a mano en cada
 * renglón la primera vez. Es una propuesta, no un dato: siempre se muestra
 * para que una persona la confirme o la corrija. */
export function empaqueDesdeTicket(descripcion: string): number | null {
  // "C/25 KG", "C-25KG", "C/ 25 kg": la forma en que el proveedor anota
  // cuánto trae el bulto.
  const conBarra = descripcion.match(/\bc\s*[/-]\s*(\d+([.,]\d+)?)\s*(kg|kgs|g|gr|grs|lt|lts|l|ml|pz|pzs)?\b/i)
  if (conBarra) {
    const valor = Number(conBarra[1].replace(',', '.'))
    return Number.isFinite(valor) && valor > 0 ? valor : null
  }
  // "ARROZ 25 KG", "ACEITE 180ML": el tamaño suelto al final.
  const suelto = descripcion.match(/\b(\d+([.,]\d+)?)\s*(kg|kgs|lt|lts|l)\b\.?\s*$/i)
  if (suelto) {
    const valor = Number(suelto[1].replace(',', '.'))
    return Number.isFinite(valor) && valor > 0 ? valor : null
  }
  return null
}
