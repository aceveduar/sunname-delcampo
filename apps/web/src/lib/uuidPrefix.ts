/** UUID bounds let PostgREST search the printed short folio without casting IDs. */
export function uuidPrefixRange(value: string) {
  const hex = value.trim().toLowerCase().replaceAll('-', '')
  if (hex && !/^[0-9a-f]{4,32}$/.test(hex)) {
    throw new Error(
      'Escribe al menos 4 caracteres del folio (letras de A a F y números).',
    )
  }
  const uuid = (text: string) =>
    text.slice(0, 8) +
    '-' +
    text.slice(8, 12) +
    '-' +
    text.slice(12, 16) +
    '-' +
    text.slice(16, 20) +
    '-' +
    text.slice(20)
  return {
    lowerId: hex ? uuid(hex.padEnd(32, '0')) : null,
    upperId: hex ? uuid(hex.padEnd(32, 'f')) : null,
  }
}
