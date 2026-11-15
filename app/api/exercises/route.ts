import { z } from 'zod'
import { invalidRequest, providerRequest, readPayload, unavailable } from '@/lib/providers'

const catalog = z.object({ results: z.array(z.object({ name: z.string() })) })
const catalogUrl = 'https://wger.de/api/v2/exercise-translation/?format=json&language=2&limit=1000'

export async function POST(request: Request) {
  const blocked = providerRequest(request, 'exercises')
  if (blocked) return blocked
  const input = await readPayload(request, z.object({ query: z.string().trim().min(2).max(80) }))
  if (!input) return invalidRequest()
  try {
    const response = await fetch(catalogUrl, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000), redirect: 'error',
    })
    if (!response.ok) return unavailable()
    const data = catalog.safeParse(await response.json())
    if (!data.success) return unavailable()
    const query = input.query.toLowerCase().split(/\s+/)
    const matched = new Set(data.data.results
      .map(({ name }) => name.trim())
      .filter((name) => name.length <= 100 && query.every((word) => name.toLowerCase().includes(word))))
    return Response.json([...matched].slice(0, 12).map((name) => ({ name, category: 'wger' })))
  } catch {
    return unavailable()
  }
}
