'use client'

import { Printer } from 'lucide-react'

export function PrintButton({ label }: { label: string }) {
  return <button type="button" onClick={() => window.print()} className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted print:hidden"><Printer className="size-4" />{label}</button>
}
