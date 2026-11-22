'use client'

import { Printer } from 'lucide-react'

/** Prints a colouring page (opens it on its own so only the picture prints). */
export function PrintButton({ url, label }: { url: string; label: string }) {
  const print = () => {
    if (url.endsWith('.pdf')) { window.open(url, '_blank', 'noopener'); return }
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><title>${label}</title><style>@page{margin:10mm}body{margin:0;display:flex;justify-content:center}img{max-width:100%;max-height:100vh}</style><img src="${url}" onload="setTimeout(()=>print(),200)">`)
    w.document.close()
  }
  return <button type="button" onClick={print} className="flex items-center gap-2 rounded-full bg-amber-300 px-5 py-3 font-black text-black hover:bg-amber-200"><Printer className="size-5" />{label}</button>
}
