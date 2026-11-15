import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activityDraft, parseFoodItems, sampleNutrition } from '../lib/parse'
import { applyDraft, initialJournal, todayTotals, type Food } from '../lib/entries'
import { readUsdaNutrition, selectUsdaFood } from '../lib/usda'
import { searchCatalog } from '../lib/exercises'

test('one segment per food and correct ounces and egg counts', () => {
  const items = parseFoodItems('I ate 4 oz salmon and two eggs for dinner.')
  assert.deepEqual(items, [
    { query: 'salmon', grams: 113.4, count: 1 },
    { query: 'eggs', grams: undefined, count: 2 },
  ])
  assert.deepEqual(items.map((item) => [sampleNutrition(item)?.name, sampleNutrition(item)?.grams]),
    [['Salmon', 113.4], ['Whole egg', 100]])
  assert.equal(parseFoodItems('I had six eggs').length, 1)
  assert.deepEqual(parseFoodItems('I had lunch.'), [])
})

test('USDA matching excludes fish oil and requires each query term', () => {
  const fish = { description: 'Salmon, Atlantic, cooked', foodNutrients: [
    { nutrientId: 2047, value: 200 }, { nutrientId: 1003, value: 20 },
    { nutrientId: 1005, value: 0 }, { nutrientId: 1004, value: 11 },
  ] }
  assert.equal(selectUsdaFood('salmon', [{ description: 'Fish oil, salmon' }, fish]), fish)
  assert.equal(selectUsdaFood('chicken breast', [{ description: 'Chicken patty' }]), undefined)
  assert.equal(readUsdaNutrition(fish, 120)?.calories, 240)
  assert.equal(readUsdaNutrition({ description: 'Missing macros' }, 100), undefined)
})

test('parse cardio, strength and goals, without saving anything', () => {
  assert.deepEqual(activityDraft('I ran for 25 minutes'), {
    kind: 'workout', name: 'Running', minutes: 25, sets: undefined, reps: undefined, weightKg: undefined,
  })
  assert.deepEqual(activityDraft('I did bench press 3x8 at 135 lbs'), {
    kind: 'workout', name: 'Bench press', minutes: undefined, sets: 3, reps: 8, weightKg: 61.2,
  })
  assert.deepEqual(activityDraft('Set my protein goal to 150 g'), { kind: 'goal', metric: 'protein', value: 150 })
  assert.equal(activityDraft('Set my protein goal to 9000 g'), undefined)
})

test('replaying a saved draft is a no-op, while a later entry is independent', () => {
  const draft = sampleNutrition(parseFoodItems('I ate 4 oz salmon')[0]) as Food
  const now = new Date()
  const first = applyDraft(initialJournal, 'batch-1', [draft], now.toISOString())
  assert.equal(applyDraft(first, 'batch-1', [draft], now.toISOString()), first)
  const second = applyDraft(first, 'batch-2', [draft, { kind: 'goal', metric: 'protein', value: 150 }], now.toISOString())
  assert.equal(second.entries.length, 2)
  assert.equal(second.goals.protein, 150)
  assert.equal(todayTotals(second.entries, now).calories, draft.calories * 2)
  assert.equal(todayTotals(second.entries, new Date(2020, 0, 1)).calories, 0)
  assert.equal(initialJournal.entries.length, 0)
  assert.deepEqual(searchCatalog('legs').map(({ name }) => name), ['Barbell squat', 'Romanian deadlift', 'Reverse lunge'])
})
