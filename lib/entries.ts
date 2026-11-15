import { z } from 'zod'

const quantity = (min: number, max: number) => z.number().finite().min(min).max(max)
const name = z.string().trim().min(1).max(100)

export const foodSchema = z.object({
  kind: z.literal('meal'), name, grams: quantity(1, 5000), calories: quantity(0, 20000),
  protein: quantity(0, 5000), carbs: quantity(0, 5000), fat: quantity(0, 5000),
  source: z.enum(['Demo estimate', 'USDA', 'Manual']),
})
export const workoutSchema = z.object({
  kind: z.literal('workout'), name, minutes: quantity(1, 1440).optional(),
  sets: quantity(1, 100).int().optional(), reps: quantity(1, 1000).int().optional(),
  weightKg: quantity(0, 1000).optional(),
})
export const goalSchema = z.object({
  kind: z.literal('goal'), metric: z.enum(['calories', 'protein']), value: quantity(1, 15000),
}).refine(({ metric, value }) => metric !== 'protein' || value <= 1000)

export const draftSchema = z.union([foodSchema, workoutSchema, goalSchema])
export const draftsSchema = z.array(draftSchema).min(1).max(8)
export type Food = z.infer<typeof foodSchema>
export type Workout = z.infer<typeof workoutSchema>
export type Draft = z.infer<typeof draftSchema>
export type Goals = { calories: number; protein: number }
export type Entry = (Food | Workout) & { id: string; date: string }
export type Journal = { entries: Entry[]; goals: Goals; saved: string[] }

export const initialJournal: Journal = { entries: [], goals: { calories: 2400, protein: 140 }, saved: [] }

export function applyDraft(journal: Journal, batchId: string, input: Draft[], now: string): Journal {
  if (journal.saved.includes(batchId)) return journal
  const drafts = draftsSchema.parse(input)
  const goals = { ...journal.goals }
  const entries = [...journal.entries]
  drafts.forEach((draft, index) => {
    if (draft.kind === 'goal') goals[draft.metric] = draft.value
    else entries.push({ ...draft, id: `${batchId}-${index}`, date: now })
  })
  return { entries, goals, saved: [...journal.saved, batchId] }
}

export function todayTotals(entries: Entry[], day = new Date()) {
  return entries.reduce((total, entry) => {
    if (new Date(entry.date).toDateString() !== day.toDateString()) return total
    if (entry.kind === 'workout') return { ...total, workouts: total.workouts + 1 }
    return { ...total, calories: total.calories + entry.calories, protein: total.protein + entry.protein }
  }, { calories: 0, protein: 0, workouts: 0 })
}
