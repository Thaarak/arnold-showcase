import { z } from 'zod'
import { invalidRequest, providerRequest, readPayload, unavailable } from '@/lib/providers'
import { foodSchema } from '@/lib/entries'
import { readUsdaNutrition, selectUsdaFood } from '@/lib/usda'

const input = z.object({ query: z.string().trim().regex(/^[a-zA-Z][a-zA-Z '-]{1,70}$/), grams: z.number().min(1).max(5000) })

export async function POST(request: Request) {
  const blocked = providerRequest(request, 'nutrition')
  if (blocked) return blocked
  const config = process.env.USDA_API_KEY?.trim()
  if (!config) return Response.json({ error: 'Set USDA_API_KEY to enable live food lookup.' }, { status: 503 })
  const body = await readPayload(request, input)
  if (!body) return invalidRequest()
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.search = new URLSearchParams({ query: body.query, dataType: 'Foundation,SR Legacy', pageSize: '15', api_key: config }).toString()
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000), redirect: 'error' })
    if (!response.ok) return unavailable()
    const data = await response.json()
    const food = selectUsdaFood(body.query, Array.isArray(data.foods) ? data.foods : [])
    const result = food && foodSchema.safeParse(readUsdaNutrition(food, body.grams))
    if (!result || !result.success) return Response.json({ error: 'No reliable nutrition match. Try a more specific name or add a manual entry.' }, { status: 404 })
    return Response.json(result.data)
  } catch {
    return unavailable()
  }
}
