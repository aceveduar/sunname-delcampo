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
