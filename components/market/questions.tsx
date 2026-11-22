'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Textarea } from '@/components/ui/textarea'
import { TimeAgo } from '@/components/posts/time-ago'
import { answerQuestionAction, askQuestionAction, removeQuestionAction } from '@/server/actions/market'
import type { QuestionView } from '@/server/market/catalog'

/** Questions & answers on a product: members ask, the seller answers (Tech Admins can hide). */
export function Questions({ productId, items, signedIn, isOwner, isAdmin }: { productId: string; items: QuestionView[]; signedIn: boolean; isOwner: boolean; isAdmin: boolean }) {
  const { t } = useI18n()
  const [body, setBody] = useState('')
  const [answering, setAnswering] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [pending, start] = useTransition()
  const ask = () => start(async () => {
    const r = await askQuestionAction(productId, body)
    if (!r.ok) { toast.error(t(`market.err.${r.error}` as MessageKey)); return }
    setBody(''); toast.success(t('market.qa.sent'))
  })
  const save = (id: string) => start(async () => {
    const r = await answerQuestionAction(id, answer, productId)
    if (!r.ok) { toast.error(t(`market.err.${r.error}` as MessageKey)); return }
    setAnswering(null); setAnswer(''); toast.success(t('market.qa.answered'))
  })
  const remove = (id: string) => start(async () => { if (await removeQuestionAction(id, productId)) toast.success(t('market.admin.done')) })
  return (
    <section id="questions" className="space-y-3 px-4 py-4" data-questions={items.length}>
      <h2 className="text-lg font-bold">{t('market.qa.title')}</h2>
      {signedIn && !isOwner && (
        <div className="space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={2} placeholder={t('market.qa.askPh')} aria-label={t('market.qa.ask')} />
          <button type="button" disabled={pending || body.trim().length < 3} onClick={ask} data-ask className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">{t('market.qa.send')}</button>
        </div>
      )}
      {!signedIn && <Link href={`/login?next=/market/p/${productId}`} className="inline-block rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted">{t('market.qa.ask')}</Link>}
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{t('market.qa.none')}</p> : (
        <ul className="divide-y rounded-2xl border">
          {items.map((q) => (
            <li key={q.id} className="space-y-1.5 px-4 py-3" data-question={q.answer ? 'answered' : 'open'}>
              <p className="flex gap-2 text-[15px] font-semibold"><MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" />{q.body}</p>
              <p className="text-xs text-muted-foreground">{t('market.qa.asked', { name: q.asker })} · <TimeAgo iso={q.createdAt} /></p>
              {q.answer ? <p className="rounded-xl bg-muted px-3 py-2 text-sm"><b>{t('market.qa.seller')}:</b> {q.answer}</p>
                : !isOwner && <p className="text-xs italic text-muted-foreground">{t('market.qa.waiting')}</p>}
              {isOwner && (answering === q.id ? (
                <div className="space-y-2">
                  <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={1000} rows={2} placeholder={t('market.qa.answerPh')} aria-label={t('market.qa.answer')} />
                  <button type="button" disabled={pending || !answer.trim()} onClick={() => save(q.id)} data-save-answer className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">{t('market.qa.answer')}</button>
                </div>
              ) : <button type="button" onClick={() => { setAnswering(q.id); setAnswer(q.answer ?? '') }} data-answer className="text-sm font-semibold text-primary hover:underline">{t('market.qa.answer')}</button>)}
              {(q.mine || isAdmin) && <button type="button" disabled={pending} onClick={() => remove(q.id)} className="ml-3 text-xs text-muted-foreground hover:text-destructive">{q.mine ? t('market.qa.delete') : t('market.qa.hide')}</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
