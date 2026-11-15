import { draftSchema, type Draft, type Food } from './entries'

type Nutrients = [calories: number, protein: number, carbs: number, fat: number]

const foods: { name: string; aliases: string[]; per100g: Nutrients; portion: number }[] = [
  { name: 'Salmon', aliases: ['salmon', 'salmon fillet'], per100g: [208, 22, 0, 12], portion: 150 },
  { name: 'Whole egg', aliases: ['egg', 'eggs', 'whole egg', 'whole eggs'], per100g: [155, 13, 1.1, 11], portion: 50 },
  { name: 'Greek yogurt', aliases: ['greek yogurt', 'yogurt'], per100g: [97, 9, 4, 5], portion: 170 },
  { name: 'Chicken breast', aliases: ['chicken breast', 'chicken'], per100g: [165, 31, 0, 3.6], portion: 150 },
  { name: 'Rice', aliases: ['rice', 'white rice'], per100g: [130, 2.7, 28, 0.3], portion: 158 },
  { name: 'Brown rice', aliases: ['brown rice'], per100g: [123, 2.7, 26, 1], portion: 158 },
  { name: 'Broccoli', aliases: ['broccoli'], per100g: [35, 2.4, 7.2, 0.4], portion: 90 },
  { name: 'Banana', aliases: ['banana', 'bananas'], per100g: [89, 1.1, 23, 0.3], portion: 118 },
  { name: 'Apple', aliases: ['apple', 'apples'], per100g: [52, 0.3, 14, 0.2], portion: 182 },
  { name: 'Oatmeal', aliases: ['oatmeal', 'oats'], per100g: [71, 2.5, 12, 1.5], portion: 235 },
]
const numberWords: Record<string, string> = {
  a: '1', an: '1', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
}
const round = (value: number) => Math.round(value * 10) / 10
export type FoodItem = { query: string; grams?: number; count: number }

export function parseFoodItems(input: string): FoodItem[] {
  const content = input.toLowerCase().replace(/^(?:i\s+)?(?:ate|had|consumed|log(?:ged)?|eating)\s+/i, '')
    .replace(/\s+for (?:breakfast|lunch|dinner|a snack)[.!]?$/i, '')
    .replace(/[.!?]+$/, '')
  return content.split(/\s*,\s*|\s+and\s+|\s*;\s*/).slice(0, 8).flatMap((part) => {
    const text = part.trim().replace(/^([a-z]+)\s+/i, (match, word: string) => numberWords[word] ? `${numberWords[word]} ` : match)
    const measured = text.match(/^(\d+(?:\.\d+)?)\s*(grams?|g|kilograms?|kg|ounces?|oz)\b\s*(?:of\s+)?(.+)$/)
    const trailing = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(grams?|g|kilograms?|kg|ounces?|oz)$/)
    const amount = measured?.[1] ?? trailing?.[2]
    const unit = measured?.[2] ?? trailing?.[3]
    const count = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/)
    const query = (measured?.[3] ?? trailing?.[1] ?? count?.[2] ?? text)
      .replace(/^(?:grilled|cooked|fresh|plain|raw|baked|steamed)\s+/, '').trim()
    if (!/^[a-z][a-z '-]{1,70}$/.test(query) || /^(?:my\s+)?(?:a |some )?(?:food|meal|lunch|dinner|breakfast|snack)$/.test(query)) return []
    const grams = amount && unit ? round(Number(amount) * (/^k/.test(unit) ? 1000 : /^(?:o|ounce)/.test(unit) ? 28.3495 : 1)) : undefined
    const servings = grams === undefined ? Number(count?.[1] ?? 1) : 1
    if (servings <= 0 || servings > 30 || (grams !== undefined && (grams < 1 || grams > 5000))) return []
    return [{ query, grams, count: servings }]
  })
}

export function nutritionDraft(name: string, grams: number, base: Nutrients, source: Food['source']): Food {
  return {
    kind: 'meal', name, grams, calories: Math.round(base[0] * grams / 100),
    protein: round(base[1] * grams / 100), carbs: round(base[2] * grams / 100),
    fat: round(base[3] * grams / 100), source,
  }
}

export function sampleNutrition(item: FoodItem): Food | undefined {
  const match = foods.find(({ aliases }) => aliases.includes(item.query))
  return match && nutritionDraft(match.name, item.grams ?? round(match.portion * item.count), match.per100g, 'Demo estimate')
}

const motions: [name: string, pattern: RegExp][] = [
  ['Running', /\b(?:ran|running|run|jogged|jogging|jog)\b/i], ['Walking', /\b(?:walked|walking|walk)\b/i],
  ['Cycling', /\b(?:cycled|cycling|cycle|biked|biking|bike)\b/i], ['Swimming', /\b(?:swam|swim|swimming)\b/i],
  ['Bench press', /\bbench(?: press(?:ed)?)?\b/i], ['Squat', /\bsquat(?:s|ted)?\b/i],
  ['Push-up', /\bpush[- ]?ups?\b/i], ['Deadlift', /\bdeadlift(?:s|ed)?\b/i],
  ['Pull-up', /\bpull[- ]?ups?\b/i], ['Workout', /\b(?:workout|trained|exercised|training)\b/i],
]

export function activityDraft(input: string): Draft | undefined {
  const goal = input.match(/\b(\d+(?:\.\d+)?)\s*(?:(?:g|grams?)\s*)?(calories?|kcal|protein)\b/i)
  const reverseGoal = input.match(/\b(calories?|kcal|protein)\b.*?\b(\d+(?:\.\d+)?)/i)
  if (/\b(?:goal|target|aim)\b/i.test(input) && (goal || reverseGoal)) {
    const metric = goal?.[2] ?? reverseGoal?.[1] ?? ''
    const value = Number(goal?.[1] ?? reverseGoal?.[2])
    const checked = draftSchema.safeParse({ kind: 'goal', metric: /protein/i.test(metric) ? 'protein' : 'calories', value })
    return checked.success ? checked.data : undefined
  }
  const name = motions.find(([, pattern]) => pattern.test(input))?.[0]
  if (!name) return
  const number = (pattern: RegExp) => {
    const value = input.match(pattern)?.[1]
    return value === undefined ? undefined : Number(value)
  }
  const minutes = number(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b/i)
  const compact = input.match(/\b(\d+)\s*[x×]\s*(\d+)\b/i)
  const sets = number(/(\d+)\s*sets?\b/i) ?? (compact ? Number(compact[1]) : undefined)
  const reps = number(/(\d+)\s*reps?\b/i) ?? (compact ? Number(compact[2]) : undefined)
  const kilos = number(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)\b/i)
  const pounds = number(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/i)
  if (!minutes && !sets && !reps) return
  const checked = draftSchema.safeParse({ kind: 'workout', name, minutes, sets, reps, weightKg: kilos ?? (pounds === undefined ? undefined : round(pounds * 0.453592)) })
  return checked.success ? checked.data : undefined
}
