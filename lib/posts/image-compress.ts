/** Shrinks photos in the browser before upload (max 2048 px, JPEG 82%) to save members' data. GIFs are kept as they are. */
export async function compressImage(file: File): Promise<{ file: File; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  if (file.type === 'image/gif') { bitmap.close(); return { file, width, height } }
  const scale = Math.min(1, 2048 / Math.max(width, height))
  const w = Math.round(width * scale), h = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
  if (!blob || (blob.size >= file.size && scale === 1)) return { file, width, height }
  return { file: new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }), width: w, height: h }
}
