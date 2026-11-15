import { z } from 'zod'
import { invalidRequest, providerRequest, readPayload, unavailable } from '@/lib/providers'

const input = z.object({ message: z.string().trim().min(1).max(500) })

export async function POST(request: Request) {
  const blocked = providerRequest(request, 'coach')
  if (blocked) return blocked
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return Response.json({ error: 'Set OPENAI_API_KEY to enable coaching replies.' }, { status: 503 })
  const body = await readPayload(request, input)
  if (!body) return invalidRequest()
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_completion_tokens: 240,
        messages: [
          { role: 'system', content: 'You are Arnold, a workout journal assistant. Give concise, general information about logging, exercise routines, or tracking habits. Do not prescribe dietary targets, diagnose symptoms, or claim to have saved data. The app handles saving separately.' },
          { role: 'user', content: body.message },
        ],
      }),
      cache: 'no-store', signal: AbortSignal.timeout(12000), redirect: 'error',
    })
    if (!response.ok) return unavailable()
    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) return unavailable()
    return Response.json({ reply: reply.trim().slice(0, 1500) })
  } catch {
    return unavailable()
  }
}
