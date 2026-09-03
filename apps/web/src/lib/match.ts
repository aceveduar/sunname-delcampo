// Emparejamiento aproximado de texto contra nombres del catálogo.
//
// Vive aparte porque lo usan dos flujos con el mismo problema de fondo
// ("tengo un texto que se parece a un producto, ¿a cuál?") pero orígenes
// distintos:
//   - Comandos de voz en Caja: el reconocimiento oye "guajio" por
//     "guajillo".
//   - Captura de compras por foto: el ticket del proveedor dice
//     "CHILE PULLA HERRADURA" y el catálogo tiene "Chile Puya".
//
// Nunca elige solo: siempre regresa candidatos ordenados y quien llama
// decide si hay suficiente certeza para actuar o hay que preguntarle a
// una persona.
import { normalizeSearch } from './text'

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
  // Tolera errores chicos de una o dos letras -- típicos tanto de un
  // reconocimiento de voz que oye "guajio" en vez de "guajillo" como de
  // una lectura de ticket arrugado.
  const maxDistance = queryToken.length <= 4 ? 1 : 2
  return levenshtein(queryToken, candidateToken) <= maxDistance
}

/** Qué tan bien "query" describe "candidateName", de 0 a 1. */
export function matchScore(query: string, candidateName: string): number {
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

export type Candidate<T> = { item: T; score: number }

/** Los elementos más parecidos al texto, mejor primero. */
export function rankCandidates<T>(
  query: string,
  items: T[],
  getName: (item: T) => string,
): Candidate<T>[] {
  return items
    .map((item) => ({ item, score: matchScore(query, getName(item)) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
}
