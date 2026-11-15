import { z } from 'zod'

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
const budgets = new Map<string, { start: number; count: number }>()

export function liveMode() {
  return process.env.ARNOLD_ENABLE_LIVE === 'true' && !process.env.VERCEL
}

export function providerRequest(request: Request, type: string): Response | undefined {
  const url = new URL(request.url)
  const host = request.headers.get('host') ?? url.host
  const isLoopbackHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host)
  const origin = request.headers.get('origin')
  const site = request.headers.get('sec-fetch-site')
  if (!liveMode() || !localHosts.has(url.hostname) || !isLoopbackHost ||
      (origin && origin !== `${url.protocol}//${host}`) ||
      (site && site !== 'same-origin' && site !== 'none')) {
    return Response.json({ error: 'Live integrations are available only from a local Arnold session.' }, { status: 403 })
  }
  const now = Date.now()
  const tracked = budgets.get(type)
  if (!tracked || now - tracked.start >= 60_000) budgets.set(type, { start: now, count: 1 })
  else if (tracked.count >= 24) return Response.json({ error: 'Please wait a minute and try again.' }, { status: 429 })
  else tracked.count++
}

export async function readPayload<T>(request: Request, schema: z.ZodType<T>): Promise<T | undefined> {
  if (!request.headers.get('content-type')?.startsWith('application/json') || !request.body) return
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let json = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) {
        await reader.cancel()
        return
      }
      json += decoder.decode(value, { stream: true })
    }
    const parsed = schema.safeParse(JSON.parse(json + decoder.decode()))
    return parsed.success ? parsed.data : undefined
  } catch {
    return
  } finally {
    reader.releaseLock()
  }
}

export const invalidRequest = () => Response.json({ error: 'Check the request and try again.' }, { status: 400 })
export const unavailable = () => Response.json({ error: 'The provider couldn’t respond. Check your local configuration or try again.' }, { status: 502 })
