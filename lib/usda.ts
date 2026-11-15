import { nutritionDraft } from './parse'

type UsdaFood = { description: string; foodNutrients?: { nutrientId: number; value?: number }[] }

const words = (text: string) => text.toLowerCase().match(/[a-z]+/g) ?? []
const normalize = (word: string) => word === 'eggs' ? 'egg' : word

export function selectUsdaFood(query: string, foods: UsdaFood[]) {
  const terms = words(query).map(normalize)
  if (!terms.length) return
  return foods
    .filter(({ description }) => {
      if (typeof description !== 'string') return false
      const found = words(description).map(normalize)
      return terms.every((term) => found.includes(term)) &&
        !['oil', 'supplement', 'extract', 'powder'].some((term) => found.includes(term) && !terms.includes(term))
    })
    .sort((first, second) => {
      const score = ({ description }: UsdaFood) => {
        const text = description.toLowerCase()
        const full = query.toLowerCase()
        return (text === full ? -100 : text.startsWith(full) ? -10 : 0) + words(text).length
      }
      return score(first) - score(second)
    })[0]
}

export function readUsdaNutrition(food: UsdaFood, grams: number) {
  const nutrient = (...identifiers: number[]) => {
    for (const id of identifiers) {
      const value = food.foodNutrients?.find((entry) => entry.nutrientId === id)?.value
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
    }
  }
  const calories = nutrient(1008, 2047, 2048)
  const protein = nutrient(1003)
  const carbs = nutrient(1005)
  const fat = nutrient(1004)
  if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) return
  return nutritionDraft(food.description, grams, [calories, protein, carbs, fat], 'USDA')
}
