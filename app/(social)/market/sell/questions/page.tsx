import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { requireShop } from '@/server/market/require-shop'
import { unansweredQuestions } from '@/server/market/seller'
import { TimeAgo } from '@/components/posts/time-ago'
import { AnswerInline } from '@/components/market/answer-inline'

export const metadata = { title: 'Questions' }

export default async function SellerQuestions() {
  const [{ me }, t] = await Promise.all([requireShop('/market/sell/questions'), getT()])
  const rows = await unansweredQuestions(me)
  const waiting = rows.filter((q) => !q.answer).length
  return (
    <>
      <h1 className="px-4 pt-5 text-xl font-bold">{t('market.sell.questions.title')}</h1>
      {waiting > 0 && <p className="px-4 pt-1 text-sm font-semibold text-brand-red">{t('market.sell.questions.unanswered')} · {waiting}</p>}
      {rows.length === 0 ? <p className="px-8 py-14 text-center text-muted-foreground">{t('market.sell.questions.none')}</p> : (
        <ul className="mt-3 divide-y border-t" data-inbox={rows.length}>{rows.map((q) => (
          <li key={q.id} className="flex gap-3 px-4 py-3">
            <Link href={`/market/p/${q.product_id}#questions`} className="size-12 shrink-0 overflow-hidden rounded-lg border bg-muted">{q.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={q.image} alt="" className="size-full object-cover" />}</Link>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs text-muted-foreground">{t('market.sell.questions.on', { title: q.title })} · {q.asker} · <TimeAgo iso={q.created_at} /></p>
              <p className="font-semibold">{q.body}</p>
              {q.answer && <p className="rounded-xl bg-muted px-3 py-2 text-sm">{q.answer}</p>}
              <AnswerInline id={q.id} initial={q.answer} />
            </div>
          </li>))}</ul>
      )}
    </>
  )
}
