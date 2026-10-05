/** La consulta define un orden estable y solicita count: exact para no truncar totales al límite de PostgREST. */
export async function readAllPages<T>(
  read: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>,
) {
  const rows: T[] = []
  for (;;) {
    const { data, error, count } = await read(rows.length, rows.length + 499)
    if (error) throw error
    if (data === null || count === null) throw new Error('Respuesta incompleta')
    rows.push(...data)
    if (rows.length >= count) return rows
    if (!data.length)
      throw new Error(
        'La lista cambió durante la consulta. Actualiza el resumen.',
      )
  }
}
