import { expect, it } from 'vitest'
import { cashCountTotal } from './cashCount'
it('suma billetes y monedas en centavos, incluido el mismo valor de distinta clase', () => {
  expect(
    cashCountTotal({
      bill500: '2',
      bill20: '1',
      coin20: '3',
      coin50c: '3',
      coin20c: '2',
      coin10c: '1',
    }),
  ).toBe(108200)
  expect(cashCountTotal({})).toBe(0)
  expect(cashCountTotal({ bill1000: '', coin1: '0' })).toBe(0)
})
it.each(['-1', '1.5', 'NaN', 'Infinity', '1e3', '1000000', ' '])(
  'rechaza conteos inválidos: %s',
  (value) => {
    expect(cashCountTotal({ coin10c: value })).toBeNull()
  },
)
