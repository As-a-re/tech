'use client'

/** Last-resort screen if the whole app fails to render (no providers available here). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100dvh', margin: 0, textAlign: 'center', padding: 24 }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={64} height={64} style={{ borderRadius: '50%' }} />
          <h1 style={{ fontSize: 24, margin: '16px 0 8px' }}>Something went wrong</h1>
          <p style={{ color: '#666', margin: 0 }}>Sorry, PAPA could not load. Please try again.</p>
          <button onClick={reset} style={{ marginTop: 20, background: '#1E3FA0', color: '#fff', border: 0, borderRadius: 999, padding: '10px 20px', fontWeight: 600 }}>Try again</button>
        </div>
      </body>
    </html>
  )
}
