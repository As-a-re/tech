'use client'

import { useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { submitQuizAction } from '@/server/actions/library'

type Q = { question: string; options: string[]; answer: number; explain: string | null }

/** One question at a time with big answer buttons; stars at the end. */
export function KidsQuiz({ id, questions, best }: { id: string; questions: Q[]; best: { stars: number } | null }) {
  const { t } = useI18n()
  const [i, setI] = useState(-1)
  const [picked, setPicked] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<{ score: number; total: number; stars: number } | null>(null)
  const [pending, start] = useTransition()
  if (i === -1) return (
    <div className="space-y-3 text-center">
      {best && <p className="font-bold">{t('kids.quiz.best', { stars: best.stars })}</p>}
      <button type="button" onClick={() => setI(0)} className="rounded-full bg-amber-400 px-8 py-4 text-xl font-black text-black shadow-md hover:bg-amber-300" data-quiz-start>{t('kids.quiz.start')}</button>
    </div>
  )
  if (result) return (
    <div className="space-y-4 text-center" data-quiz-result>
      <p className="text-5xl">{'⭐'.repeat(result.stars) || '🙂'}</p>
      <p className="text-2xl font-black">{t('kids.quiz.result', { score: result.score, total: result.total })}</p>
      <p className="text-lg">{t(`kids.quiz.stars${result.stars}` as MessageKey)}</p>
      <button type="button" onClick={() => { setI(0); setAnswers([]); setPicked(null); setResult(null) }} className="rounded-full border-2 px-6 py-3 font-black">{t('kids.quiz.again')}</button>
    </div>
  )
  const q = questions[i]
  const checked = picked !== null && answers.length === i + 1
  return (
    <div className="space-y-4" data-quiz-question={i + 1}>
      <p className="text-sm font-bold text-muted-foreground">{t('kids.quiz.question', { n: i + 1, total: questions.length })}</p>
      <p className="text-2xl font-black leading-snug">{q.question}</p>
      <div className="grid gap-3">
        {q.options.map((o, k) => (
          <button key={k} type="button" disabled={checked} onClick={() => setPicked(k)}
            className={cn('rounded-2xl border-4 px-4 py-4 text-left text-lg font-bold transition',
              checked && k === q.answer ? 'border-green-500 bg-green-500/15' : checked && k === picked ? 'border-red-500 bg-red-500/10' : picked === k ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50')}>
            {o}
          </button>
        ))}
      </div>
      {checked && <p className={cn('text-lg font-bold', picked === q.answer ? 'text-green-600' : 'text-red-600')}>{picked === q.answer ? t('kids.quiz.right') : t('kids.quiz.wrong', { answer: q.options[q.answer] })}{q.explain && <span className="mt-1 block text-base font-normal text-foreground">{q.explain}</span>}</p>}
      {!checked ? (
        <button type="button" disabled={picked === null} onClick={() => setAnswers((a) => [...a, picked!])} className="w-full rounded-full bg-primary py-4 text-lg font-black text-primary-foreground disabled:opacity-40">{t('kids.quiz.check')}</button>
      ) : i < questions.length - 1 ? (
        <button type="button" onClick={() => { setI(i + 1); setPicked(null) }} className="w-full rounded-full bg-primary py-4 text-lg font-black text-primary-foreground">{t('kids.quiz.next')}</button>
      ) : (
        <button type="button" disabled={pending} onClick={() => start(async () => { const r = await submitQuizAction(id, answers); if (r) setResult(r) })} className="w-full rounded-full bg-amber-400 py-4 text-lg font-black text-black">{t('kids.quiz.finish')}</button>
      )}
    </div>
  )
}
