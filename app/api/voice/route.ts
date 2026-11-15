import { z } from 'zod'
import { invalidRequest, providerRequest, readPayload, unavailable } from '@/lib/providers'

export async function POST(request: Request) {
  const blocked = providerRequest(request, 'voice')
  if (blocked) return blocked
  const key = process.env.ELEVENLABS_API_KEY?.trim()
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim()
  if (!key || !voiceId || !/^[a-zA-Z0-9_-]{8,80}$/.test(voiceId)) {
    return Response.json({ error: 'Configure your ElevenLabs key and a voice you’re authorized to use.' }, { status: 503 })
  }
  const input = await readPayload(request, z.object({ text: z.string().trim().min(1).max(1000) }))
  if (!input) return invalidRequest()
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: input.text, model_id: 'eleven_multilingual_v2' }),
      cache: 'no-store', signal: AbortSignal.timeout(12000), redirect: 'error',
    })
    if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('audio/')) return unavailable()
    return new Response(response.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })
  } catch {
    return unavailable()
  }
}
