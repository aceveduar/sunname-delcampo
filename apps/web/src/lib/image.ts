// Comprime y redimensiona una foto de producto en el navegador antes de
// subirla a Storage -- una foto de celular sin tocar pesa 2-3MB, y con
// el plan gratis de Supabase (1GB) eso se acaba rápido. Sin esto, cada
// foto nueva competía directo contra ese límite.
export async function compressImage(
  file: File,
  {
    maxDimension = 1200,
    quality = 0.82,
  }: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    )
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) return file

    const name = file.name.replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    // Formatos que el navegador no puede decodificar (ej. algunos HEIC de
    // iPhone) -- mejor subir el original que bloquear la carga.
    return file
  }
}
