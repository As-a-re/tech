'use client'

/** Uploads one file with progress (0–100). Resolves to the stored file's URL, or throws an error code. */
export function uploadFile(file: File, target: 'pub' | 'kids' | 'live' | 'posts' | 'res' | 'live', onProgress?: (n: number) => void): Promise<{ url: string; kind: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', target === 'posts' ? '/api/uploads' : `/api/uploads?for=${target}`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      let json: { url?: string; kind?: string; mime?: string; error?: string } = {}
      try { json = JSON.parse(xhr.responseText) } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && json.url) resolve({ url: json.url, kind: json.kind ?? '', mime: json.mime ?? '' })
      else reject(new Error(json.error === 'too_large' ? 'too_large' : json.error === 'unsupported' ? 'unsupported' : 'upload'))
    }
    xhr.onerror = () => reject(new Error('upload'))
    const fd = new FormData(); fd.append('file', file); xhr.send(fd)
  })
}
