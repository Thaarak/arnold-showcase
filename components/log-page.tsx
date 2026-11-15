'use client'

import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Plus, Search, Trash2 } from 'lucide-react'
import { draftSchema, goalSchema, todayTotals, type Draft, type Entry } from '@/lib/entries'
import { type Exercise, routines, searchCatalog } from '@/lib/exercises'
import { requestProvider } from '@/lib/client'
import { saveDraft, updateJournal } from '@/lib/storage'
import { useJournal } from '@/lib/use-journal'

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function entryDetails(entry: Entry) {
  if (entry.kind === 'meal') return `${entry.grams} g · ${entry.calories} kcal · ${entry.protein} g protein`
  return [
    entry.minutes && `${entry.minutes} min`, entry.sets && `${entry.sets} sets`, entry.reps && `${entry.reps} reps`,
    entry.weightKg !== undefined && `${entry.weightKg} kg`,
  ].filter(Boolean).join(' · ')
}

function ManualForm({ category, onSave, busy, initialName }: { category: 'meal' | 'workout'; onSave: (draft: Draft) => Promise<boolean>; busy: boolean; initialName: string }) {
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    const optional = (key: string) => form.get(key) === '' ? undefined : Number(form.get(key))
    const name = form.get('name')
    const value = category === 'meal'
      ? { kind: 'meal', name, grams: Number(form.get('grams')), calories: Number(form.get('calories')),
          protein: optional('protein') ?? 0, carbs: optional('carbs') ?? 0, fat: optional('fat') ?? 0, source: 'Manual' }
      : { kind: 'workout', name, minutes: optional('minutes'), sets: optional('sets'), reps: optional('reps'), weightKg: optional('weight') }
    const result = draftSchema.safeParse(value)
    if (!result.success || (value.kind === 'workout' && !value.minutes && !value.sets && !value.reps)) {
      setError(category === 'meal' ? 'Enter a valid food name, portion and calorie value.' : 'Enter a workout name and at least one of duration, sets, or reps.')
      return
    }
    setError('')
    if (await onSave(result.data)) {
      target.reset()
    }
  }
  return (
    <form className="entry-form" onSubmit={submit}>
      <label>{category === 'meal' ? 'Food or meal' : 'Exercise or workout'}<input defaultValue={initialName} name="name" required maxLength={100} /></label>
      <div className="field-grid">
        {category === 'meal' ? (
          <>
            <label>Portion (g)<input name="grams" type="number" min={1} max={5000} step="any" required /></label>
            <label>Energy (kcal)<input name="calories" type="number" min={0} max={20000} step="any" required /></label>
            <label>Protein (g)<input name="protein" type="number" min={0} max={5000} step="any" /></label>
            <label>Carbs (g)<input name="carbs" type="number" min={0} max={5000} step="any" /></label>
            <label>Fat (g)<input name="fat" type="number" min={0} max={5000} step="any" /></label>
          </>
        ) : (
          <>
            <label>Minutes<input name="minutes" type="number" min={1} max={1440} step="any" /></label>
            <label>Sets<input name="sets" type="number" min={1} max={100} /></label>
            <label>Reps per set<input name="reps" type="number" min={1} max={1000} /></label>
            <label>Weight (kg)<input name="weight" type="number" min={0} max={1000} step="any" /></label>
          </>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button primary" disabled={busy}><Plus size={17} aria-hidden="true" />{category === 'meal' ? 'Save meal' : 'Save workout'}</button>
    </form>
  )
}

function GoalsForm({ goals, busy, onSave }: { goals: { calories: number; protein: number }; busy: boolean; onSave: (drafts: Draft[]) => Promise<boolean> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const drafts = (['calories', 'protein'] as const).map((metric) => goalSchema.parse({ kind: 'goal', metric, value: Number(form.get(metric)) }))
    await onSave(drafts)
  }
  return (
    <form className="entry-form" onSubmit={submit}>
      <div className="field-grid">
        <label>Energy goal (kcal)<input defaultValue={goals.calories} name="calories" type="number" min={1} max={15000} required /></label>
        <label>Protein goal (g)<input defaultValue={goals.protein} name="protein" type="number" min={1} max={1000} step="any" required /></label>
      </div>
      <button className="button primary" disabled={busy}>Save targets</button>
    </form>
  )
}

function ExerciseSearch({ live, onSelect }: { live: boolean; onSelect: (name: string) => void }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Exercise[]>([])
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle')
  const [source, setSource] = useState('')
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query.trim() || state === 'pending') return
    setState('pending')
    setSource('Demo library')
    try {
      if (live && query.trim().length >= 2) {
        const matches = await requestProvider<Exercise[]>('exercises', { query })
        setResult(matches)
        setSource('wger')
      } else setResult(searchCatalog(query))
    } catch {
      setResult(searchCatalog(query))
      setSource('Demo library · wger unavailable')
    } finally {
      setState('done')
    }
  }
  return <div className="panel">
    <div className="panel-heading"><Search size={18} aria-hidden="true" /><h2>Exercise library</h2></div>
    <div className="section-body">
      <form className="search-form" onSubmit={search}>
        <label className="sr-only" htmlFor="exercise-search">Search exercises</label>
        <input id="exercise-search" value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} placeholder="Try “squat” or “cardio”" />
        <button className="button secondary" disabled={!query.trim() || state === 'pending'}>{state === 'pending' ? 'Searching…' : 'Search'}</button>
      </form>
      {state === 'done' && <div className="exercise-results" aria-live="polite">
        <small>{source}</small>
        {result.length ? result.map(({ name, category }, index) => <button key={`${name}-${index}`} type="button" className="exercise-result" onClick={() => onSelect(name)}>
          <span><strong>{name}</strong><small>{category}</small></span><ArrowRight size={16} aria-hidden="true" />
        </button>) : <p>No exercises match that search.</p>}
      </div>}
    </div>
  </div>
}

export function LogPage({ category, live = false }: { category: 'meal' | 'workout'; live?: boolean }) {
  const { journal, setJournal, ready, storageError } = useJournal()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const manual = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState('')
  const entries = journal.entries.filter((entry) => entry.kind === category).slice().reverse()
  const totals = todayTotals(journal.entries)
  const nutrition = category === 'meal'

  async function mutate(write: () => ReturnType<typeof updateJournal>, success: string) {
    if (!ready || lock.current) return false
    lock.current = true
    setBusy(true)
    setStatus('')
    setError('')
    try {
      setJournal(await write())
      setStatus(success)
      return true
    } catch {
      setError('Couldn’t update the journal in this browser. Try again.')
      return false
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const save = (drafts: Draft[], success: string) => mutate(() => saveDraft(crypto.randomUUID(), drafts), success)
  function select(name: string) {
    setSelected(name)
    requestAnimationFrame(() => manual.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus())
  }

  return <>
    <header className="page-heading"><div><h1>{nutrition ? 'Nutrition' : 'Training'}</h1>
      <p>{nutrition ? 'Track meals and see how they add up against your daily goals.' : 'Log completed workouts, find exercises, and build a training history.'}</p></div></header>
    {(error || storageError) && <p className="error" role="alert">{error || storageError}</p>}
    {status && <p className="notice standalone" role="status">{status}</p>}
    <div className="log-grid">
      <section className="panel">
        <div className="panel-heading"><h2>{nutrition ? 'Meal history' : 'Workout history'}</h2></div>
        <div className="section-body">
          {nutrition && <p className="log-totals"><strong>{Math.round(totals.calories)} kcal</strong><span>{Math.round(totals.protein)} g protein today</span></p>}
          {entries.length ? <ul className="entry-list">{entries.map((entry) => <li key={entry.id}>
            <div><strong>{entry.name}</strong><span>{entryDetails(entry)}</span><small>{formatDate(entry.date)}{entry.kind === 'meal' ? ` · ${entry.source}` : ''}</small></div>
            <button type="button" className="icon-button" disabled={!ready || busy} aria-label={`Remove ${entry.name}`}
              onClick={() => void mutate(() => updateJournal((current) => ({ ...current, entries: current.entries.filter(({ id }) => id !== entry.id) })), 'Entry removed.')}><Trash2 size={16} /></button>
          </li>)}</ul> : <p className="empty">{ready ? `No ${nutrition ? 'meals' : 'workouts'} logged yet.` : 'Loading journal…'}</p>}
        </div>
      </section>
      <div className="log-side">
        <section className="panel" ref={manual}>
          <div className="panel-heading"><h2>{nutrition ? 'Add a meal' : 'Log a workout'}</h2></div>
          <ManualForm key={selected} category={category} busy={!ready || busy} initialName={selected}
            onSave={(draft) => save([draft], nutrition ? 'Meal saved.' : 'Workout saved.')} />
        </section>
        {nutrition
          ? <section className="panel"><div className="panel-heading"><h2>Daily targets</h2></div>
              <GoalsForm key={`${journal.goals.calories}-${journal.goals.protein}`} goals={journal.goals} busy={!ready || busy} onSave={(drafts) => save(drafts, 'Targets saved.')} />
            </section>
          : <ExerciseSearch live={live} onSelect={select} />}
      </div>
    </div>
    {!nutrition && <section className="routines">
      <h2>Sample routines</h2>
      <div>{routines.map((routine) => <article className="panel section-body" key={routine.name}>
        <small>{routine.category} · {routine.minutes} min</small><h3>{routine.name}</h3>
        <ul>{routine.exercises.map((name) => <li key={name}>{name}</li>)}</ul>
        <button type="button" className="button secondary" disabled={!ready || busy} onClick={() => void save([
          { kind: 'workout', name: routine.name, minutes: routine.minutes },
        ], 'Workout saved.')}>Log completed session</button>
      </article>)}</div>
    </section>}
  </>
}
