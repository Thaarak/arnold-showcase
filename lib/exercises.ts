export type Exercise = { name: string; category: string }

const catalog: Exercise[] = [
  { name: 'Barbell squat', category: 'Legs' },
  { name: 'Romanian deadlift', category: 'Legs' },
  { name: 'Reverse lunge', category: 'Legs' },
  { name: 'Bench press', category: 'Chest' },
  { name: 'Push-up', category: 'Chest' },
  { name: 'Pull-up', category: 'Back' },
  { name: 'Dumbbell row', category: 'Back' },
  { name: 'Overhead press', category: 'Shoulders' },
  { name: 'Plank', category: 'Core' },
  { name: 'Running', category: 'Cardio' },
  { name: 'Walking', category: 'Cardio' },
  { name: 'Cycling', category: 'Cardio' },
]

export const routines = [
  { name: 'Lower body', category: 'Strength', exercises: ['Barbell squat', 'Romanian deadlift', 'Reverse lunge'], minutes: 35 },
  { name: 'Upper body', category: 'Strength', exercises: ['Bench press', 'Dumbbell row', 'Overhead press'], minutes: 30 },
  { name: 'Cardio session', category: 'Cardio', exercises: ['Brisk walk', 'Easy run', 'Cool-down walk'], minutes: 25 },
]

export function searchCatalog(query: string) {
  const words = query.trim().toLowerCase().split(/\s+/)
  return catalog.filter(({ name, category }) => words.every((word) => `${name} ${category}`.toLowerCase().includes(word)))
}
