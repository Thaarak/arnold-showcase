'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Dumbbell, Mic, Sparkles, Target, Utensils, Volume2, X } from 'lucide-react'
import Link from 'next/link'
import { Progress } from './progress'
import { draftsSchema, type Draft, type Food } from '@/lib/entries'
import { activityDraft, parseFoodItems, sampleNutrition, type FoodItem } from '@/lib/parse'
import { requestProvider } from '@/lib/client'
import { saveDraft } from '@/lib/storage'
import { useJournal } from '@/lib/use-journal'

type SpeechInput = {
  lang: string
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechInput
  webkitSpeechRecognition?: new () => SpeechInput
}
type Review = { id: string; drafts: Draft[] }
type Reply = { prompt: string; text: string }

const examples = [
  { label: 'Log a meal', text: 'I ate 4 oz salmon and two eggs', Icon: Utensils },
  { label: 'Log training', text: 'I ran for 25 minutes', Icon: Dumbbell },
  { label: 'Set a goal', text: 'Set my protein goal to 150 g', Icon: Target },
]

function draftDetails(draft: Draft) {
  if (draft.kind === 'meal') return {
    title: draft.name, detail: `${draft.grams} g · ${draft.calories} kcal · ${draft.protein} g protein · ${draft.source}`,
  }
  if (draft.kind === 'goal') return { title: `Update ${draft.metric} goal`, detail: `${draft.value} ${draft.metric === 'calories' ? 'kcal' : 'g'} per day` }
  return { title: draft.name, detail: [
    draft.minutes && `${draft.minutes} min`, draft.sets && `${draft.sets} sets`, draft.reps && `${draft.reps} reps`,
    draft.weightKg !== undefined && `${draft.weightKg} kg`,
  ].filter(Boolean).join(' · ') }
}

async function resolveMeal(item: FoodItem, live: boolean) {
  const estimate = sampleNutrition(item)
  if (!live) return estimate
  const grams = item.grams ?? estimate?.grams
  if (!grams) return
  try {
    return await requestProvider<Food>('nutrition', { query: item.query, grams })
  } catch {
    return estimate
  }
}

export function Coach({ live }: { live: boolean }) {
  const { journal, setJournal, ready, storageError } = useJournal()
  const [input, setInput] = useState('')
  const [reply, setReply] = useState<Reply | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [listening, setListening] = useState(false)
  const busy = useRef(false)
  const microphone = useRef<SpeechInput | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const audioUrl = useRef('')
  const alive = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function stopAudio() {
    audio.current?.pause()
    audio.current = null
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    audioUrl.current = ''
    if ('speechSynthesis' in window) speechSynthesis.cancel()
  }

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      microphone.current?.abort()
      stopAudio()
    }
  }, [])

  async function prepare(event: FormEvent) {
    event.preventDefault()
    const message = input.trim()
    if (!message || busy.current || review) return
    busy.current = true
    setWorking(true)
    setError('')
    setNotice('')
    setReply(null)
    try {
      const action = activityDraft(message)
      const startsWithFood = /^(?:i\s+)?(?:ate|had|consumed|eating|log(?:ged)?)\s+/i.test(message)
      const items = action ? [] : parseFoodItems(message)
      const looksLikeFood = startsWithFood || items.some((item) => !!sampleNutrition(item))
      const resolved = looksLikeFood ? await Promise.all(items.map((item) => resolveMeal(item, live))) : []
      const drafts = draftsSchema.safeParse(action ? [action] : resolved.filter((entry) => entry !== undefined))
      if (drafts.success) {
        setReview({ id: crypto.randomUUID(), drafts: drafts.data })
        if (drafts.data.length !== items.length && !action) setNotice('Some foods couldn’t be matched. Review these entries and add any missing items in Nutrition.')
      } else if (looksLikeFood) {
        setNotice('No food match. Try a specific name and portion, or add a meal manually in Nutrition.')
      } else if (live) {
        const result = await requestProvider<{ reply: string }>('coach', { message })
        setReply({ prompt: message, text: result.reply })
      } else {
        const text = /\b(?:suggest|routine|workout plan)\b/i.test(message)
          ? 'Check Training for sample strength and cardio sessions. You can browse movements and log a completed session there.'
          : 'I can prepare a meal, workout, or goal for review. Try “I ran for 25 minutes” or “Set my protein goal to 150 g.”'
        setReply({ prompt: message, text })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t prepare a reply. Try again.')
    } finally {
      busy.current = false
      setWorking(false)
    }
  }

  async function confirm() {
    if (!review || busy.current) return
    busy.current = true
    setWorking(true)
    setError('')
    try {
      setJournal(await saveDraft(review.id, review.drafts))
      setReply({ prompt: input.trim(), text: review.drafts[0].kind === 'goal' ? 'Goal updated.' : `Saved ${review.drafts.length} ${review.drafts.length === 1 ? 'entry' : 'entries'} to your journal.` })
      setInput('')
      setReview(null)
      setNotice('')
    } catch {
      setError('Couldn’t save to this browser. Your draft is still here. Try again.')
    } finally {
      busy.current = false
      setWorking(false)
    }
  }

  function listen() {
    if (listening) {
      microphone.current?.abort()
      setListening(false)
      return
    }
    setError('')
    const browser = window as SpeechWindow
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
    if (!Recognition) {
      setError('Speech recognition is unavailable in this browser. You can type your entry instead.')
      return
    }
    const recognition = new Recognition()
    microphone.current = recognition
    recognition.lang = 'en-US'
    recognition.onresult = (event) => setInput(event.results[0][0].transcript)
    recognition.onerror = () => {
      if (alive.current && microphone.current === recognition) setError('Couldn’t capture speech. Check microphone permissions or type your entry.')
    }
    recognition.onend = () => { if (alive.current) setListening(false) }
    try {
      recognition.start()
      setListening(true)
    } catch {
      setError('Couldn’t start the microphone. Try typing your entry.')
    }
  }

  async function speak(text: string) {
    stopAudio()
    setError('')
    if (live) {
      try {
        const clip = await requestProvider<Blob>('voice', { text: text.slice(0, 1000) }, (response) => response.blob())
        if (!alive.current) return
        audioUrl.current = URL.createObjectURL(clip)
        const player = new Audio(audioUrl.current)
        audio.current = player
        await player.play()
        return
      } catch {
        stopAudio()
      }
    }
    if (!alive.current) return
    const voice = 'speechSynthesis' in window && speechSynthesis.getVoices().find((entry) => entry.localService && entry.lang.startsWith('en'))
    if (voice) {
      const speech = new SpeechSynthesisUtterance(text)
      speech.voice = voice
      speechSynthesis.speak(speech)
    } else {
      setError('Audio playback is unavailable. You can read the reply in the coach.')
    }
  }

  return (
    <>
      <header className="page-heading">
        <div><h1>Fitness coach</h1><p>Log meals and training in your own words. Review the details before they’re saved.</p></div>
        <span className="mode"><span />{live ? 'Local integrations' : 'Demo mode'}</span>
      </header>
      <div className="coach-grid">
        <section className="panel coach-panel" aria-label="Fitness coach">
          <div className="panel-heading"><Sparkles size={18} aria-hidden="true" /><h2>Log with Arnold</h2></div>
          <div className="coach-body">
            <form onSubmit={prepare}>
              <label htmlFor="coach-input">What did you eat or how did you train?</label>
              <textarea id="coach-input" ref={inputRef} maxLength={500} rows={3} value={input}
                disabled={working || !!review} onChange={(event) => setInput(event.target.value)}
                placeholder="I ate 4 oz salmon and two eggs…" />
              <div className="composer-actions">
                <button type="button" className="button secondary" onClick={listen} disabled={working || !!review}
                  aria-pressed={listening}><Mic size={17} aria-hidden="true" />{listening ? 'Stop listening' : 'Use microphone'}</button>
                <button type="submit" className="button primary" disabled={!input.trim() || working || !!review || listening}>
                  {working && !review ? 'Preparing…' : 'Review entry'}<ArrowUp size={17} aria-hidden="true" />
                </button>
              </div>
            </form>
            {!review && <div className="examples" aria-label="Example prompts">
              {examples.map(({ label, text, Icon }) => <button type="button" key={label} disabled={working || listening}
                onClick={() => { setInput(text); setError(''); setReply(null); setNotice(''); inputRef.current?.focus() }}><Icon size={15} aria-hidden="true" />{label}</button>)}
            </div>}
            {review && <div className="review">
              <h3>Review draft</h3>
              {review.drafts.map((draft, index) => {
                const details = draftDetails(draft)
                return <div className="row" key={index}><strong>{details.title}</strong><span>{details.detail}</span></div>
              })}
              <div className="review-buttons">
                <button type="button" className="button secondary" disabled={working} onClick={() => { setReview(null); setNotice(''); setError(''); requestAnimationFrame(() => inputRef.current?.focus()) }}>
                  <X size={16} aria-hidden="true" />Edit prompt
                </button>
                <button type="button" className="button primary" disabled={!ready || working} onClick={() => void confirm()}><Check size={17} aria-hidden="true" />Save to journal</button>
              </div>
            </div>}
            {reply && <div className="reply" role="status">
              <div><small>{reply.prompt}</small><p>{reply.text}</p></div>
              <button type="button" className="icon-button" aria-label="Read reply aloud" onClick={() => void speak(reply.text)}><Volume2 size={19} /></button>
            </div>}
            {notice && <p className="notice" role="status">{notice}{!review && <><br /><Link href="/meals">Open Nutrition</Link></>}</p>}
            {(error || storageError) && <p className="error" role="alert">{error || storageError}</p>}
          </div>
        </section>
        <Progress journal={journal} />
      </div>
      <p className="workspace-note">{live ? 'Your journal stays in this browser. Live requests use the providers configured on this machine.' : 'Your journal stays in this browser. Demo nutrition values are estimates.'}</p>
    </>
  )
}
