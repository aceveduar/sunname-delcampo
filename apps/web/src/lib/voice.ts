// Analiza un comando de voz en español ("agrega diez pesos de chile
// guajillo") y lo reduce a monto/cantidad + texto de producto. Nunca
// decide un cobro por sí solo -- eso lo hace siempre create_sale en el
// servidor; esto solo interpreta qué dijo el cajero para llenar el
// mismo formulario que llenaría a mano (VoiceCommandButton exige
// confirmación visible antes de tocar el carrito).
import { normalizeSearch } from './text'

const WAKE_WORDS = ['caja', 'oye caja', 'hey caja']
const ACTION_WORDS = [
  'agregar',
  'agrega',
  'agregame',
  'añadir',
  'añade',
  'anadir',
  'anade',
  'poner',
  'pon',
  'ponme',
  'dame',
  'quiero',
]
const FILLER_PHRASES = ['por favor', 'porfavor']
const AMOUNT_UNIT_WORDS = ['pesos', 'peso']
const QUANTITY_UNIT_WORDS = ['piezas', 'pieza', 'unidades', 'unidad', 'paquetes', 'paquete']

// Números hablados que de verdad se usan al pedir un monto en una tienda
// de mostrador -- no es un parser numérico general, cubre lo que un
// cliente real pide en voz alta (montos y cantidades chicas).
const UNITS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
}
const TENS: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
}
const HUNDRED: Record<string, number> = { cien: 100, ciento: 100 }

/** Quita frases completas (con espacios) del inicio del texto, las veces
 * que aparezcan seguidas -- así "caja agrega" se reduce en dos pasadas. */
function stripLeading(text: string, phrases: string[]): string {
  let result = text
  let changed = true
  while (changed) {
    changed = false
    for (const phrase of phrases) {
      if (result === phrase || result.startsWith(phrase + ' ')) {
        result = result.slice(phrase.length).trim()
        changed = true
      }
    }
  }
  return result
}

/** Reconoce un número al inicio del texto, en dígitos o en las palabras
 * reales de un monto/cantidad de mostrador ("diez", "veinticinco",
 * "treinta y cinco", "cien"). Regresa el valor y lo que sobra sin él. */
function extractLeadingNumber(text: string): { value: number; rest: string } | null {
  const digitMatch = text.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (digitMatch) {
    return { value: Number(digitMatch[1]), rest: digitMatch[2].trim() }
  }

  const words = text.split(/\s+/)
  const [first, second, third] = words

  if (first in HUNDRED) {
    return { value: HUNDRED[first], rest: words.slice(1).join(' ') }
  }
  if (first in TENS) {
    if (second === 'y' && third in UNITS) {
      return { value: TENS[first] + UNITS[third], rest: words.slice(3).join(' ') }
    }
    return { value: TENS[first], rest: words.slice(1).join(' ') }
  }
  if (first in UNITS) {
    return { value: UNITS[first], rest: words.slice(1).join(' ') }
  }
  return null
}

export type VoiceCommand =
  | { kind: 'amount'; amountMxn: number; productQuery: string }
  | { kind: 'quantity'; quantity: number; productQuery: string }
  | { kind: 'plain'; productQuery: string }

/** Reduce una transcripción libre a una acción + texto de producto.
 * `null` significa que no quedó nada útil (frase vacía tras quitar
 * muletillas). */
export function parseVoiceCommand(raw: string): VoiceCommand | null {
  let text = normalizeSearch(raw)
    .replace(/[¿?¡!,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null

  text = stripLeading(text, WAKE_WORDS)
  text = stripLeading(text, ACTION_WORDS)
  text = stripLeading(text, FILLER_PHRASES)
  if (!text) return null

  const numberMatch = extractLeadingNumber(text)
  if (!numberMatch || numberMatch.value <= 0) {
    return { kind: 'plain', productQuery: text }
  }

  const restWords = numberMatch.rest.split(/\s+/).filter(Boolean)
  const unitWord = restWords[0]

  if (AMOUNT_UNIT_WORDS.includes(unitWord)) {
    const productQuery = stripLeading(restWords.slice(1).join(' '), ['de'])
    return productQuery
      ? { kind: 'amount', amountMxn: numberMatch.value, productQuery }
      : null
  }

  if (QUANTITY_UNIT_WORDS.includes(unitWord)) {
    const productQuery = stripLeading(restWords.slice(1).join(' '), ['de'])
    return productQuery
      ? { kind: 'quantity', quantity: numberMatch.value, productQuery }
      : null
  }

  // Sin unidad explícita ("agrega dos chocolates abuelita") -- el número
  // se toma como cantidad de piezas, que es el caso común al no decir
  // "pesos".
  const productQuery = stripLeading(numberMatch.rest, ['de'])
  return productQuery
    ? { kind: 'quantity', quantity: numberMatch.value, productQuery }
    : null
}

function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
    }
  }
  return dp[b.length]
}

function tokenMatches(queryToken: string, candidateToken: string): boolean {
  if (queryToken === candidateToken) return true
  if (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)) return true
  // Tolera errores chicos de una o dos letras -- típicos de un
  // reconocimiento de voz que oye "guajio" en vez de "guajillo".
  const maxDistance = queryToken.length <= 4 ? 1 : 2
  return levenshtein(queryToken, candidateToken) <= maxDistance
}

/** Qué tan bien "query" (lo que se entendió por voz) describe
 * "candidateName" (un nombre real del catálogo), de 0 a 1. */
export function voiceMatchScore(query: string, candidateName: string): number {
  const normalizedCandidate = normalizeSearch(candidateName)
  const normalizedQuery = normalizeSearch(query).trim()
  if (!normalizedQuery) return 0
  if (normalizedCandidate.includes(normalizedQuery)) return 1

  const qTokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const cTokens = normalizedCandidate.split(/\s+/).filter(Boolean)
  if (qTokens.length === 0 || cTokens.length === 0) return 0

  const matched = qTokens.filter((qt) => cTokens.some((ct) => tokenMatches(qt, ct))).length
  return matched / qTokens.length
}

export type VoiceCandidate<T> = { item: T; score: number }

/** Regresa los elementos más parecidos al texto reconocido, mejor
 * primero. Nunca elige solo -- el llamador decide qué tan seguro está
 * el resultado antes de dejar confirmar algo. */
export function rankVoiceCandidates<T>(
  query: string,
  items: T[],
  getName: (item: T) => string,
): VoiceCandidate<T>[] {
  return items
    .map((item) => ({ item, score: voiceMatchScore(query, getName(item)) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
}
