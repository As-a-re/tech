/** Reading screens: the whole screen for the pages, with their own top bar. */
export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>
}
