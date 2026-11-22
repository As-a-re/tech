import { PageHeader } from '@/components/common/page-header'

export function SettingsPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <PageHeader title={title} back="/settings" />
      <div className="space-y-5 p-4 sm:p-6">{children}</div>
    </>
  )
}

export function Card({ title, text, children }: { title?: string; text?: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-5">
      {title && <h2 className="font-bold">{title}</h2>}
      {text && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>}
      {children && <div className={title || text ? 'mt-4' : ''}>{children}</div>}
    </section>
  )
}
