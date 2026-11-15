import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POST as ask } from '../app/api/coach/route'
import { POST as search } from '../app/api/exercises/route'
import { POST as lookup } from '../app/api/nutrition/route'
import { POST as speak } from '../app/api/voice/route'

function request(path: string, body: object, origin = 'http://127.0.0.1:3000') {
  return new Request(`http://127.0.0.1:3000/api/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  })
}

test('paid integrations are off in demo mode and hosted Vercel builds', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected external request') })
  process.env.ARNOLD_ENABLE_LIVE = 'false'
  assert.equal((await ask(request('coach', { message: 'hello' }))).status, 403)
  assert.equal((await lookup(request('nutrition', { query: 'salmon', grams: 200 }))).status, 403)
  assert.equal((await speak(request('voice', { text: 'hello' }))).status, 403)
  process.env.ARNOLD_ENABLE_LIVE = 'true'
  process.env.VERCEL = '1'
  assert.equal((await search(request('exercises', { query: 'squat' }))).status, 403)
  delete process.env.VERCEL
})

test('provider routes process bounded requests and return safe responses', async (t) => {
  process.env.ARNOLD_ENABLE_LIVE = 'true'
  process.env.OPENAI_API_KEY = 'test-only'
  process.env.USDA_API_KEY = 'test-only'
  process.env.ELEVENLABS_API_KEY = 'test-only'
  process.env.ELEVENLABS_VOICE_ID = 'test_voice_123'
  t.after(() => { for (const env of ['ARNOLD_ENABLE_LIVE', 'OPENAI_API_KEY', 'USDA_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID']) delete process.env[env] })
  t.mock.method(globalThis, 'fetch', async (value: URL | string) => {
    const url = new URL(value)
    if (url.hostname === 'api.openai.com') return Response.json({ choices: [{ message: { content: 'A coaching reply.' } }] })
    if (url.hostname === 'api.nal.usda.gov') return Response.json({ foods: [{ description: 'Fish oil, salmon' }, { description: 'Salmon, cooked', foodNutrients: [
      { nutrientId: 1008, value: 200 }, { nutrientId: 1003, value: 20 },
      { nutrientId: 1005, value: 0 }, { nutrientId: 1004, value: 12 },
    ] }] })
    if (url.hostname === 'wger.de') return Response.json({ results: [{ name: 'Squat' }, { name: 'Bench press' }] })
    if (url.hostname === 'api.elevenlabs.io') return new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'audio/mpeg' } })
    throw new Error('Unexpected host')
  })
  assert.equal((await ask(request('coach', { message: 'hello' }, 'http://example.com'))).status, 403)
  assert.equal((await ask(request('coach', { message: 'x'.repeat(3000) }))).status, 400)
  assert.deepEqual(await (await ask(request('coach', { message: 'hello' }))).json(), { reply: 'A coaching reply.' })
  const normalized = new Request('http://localhost:3000/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
    body: JSON.stringify({ message: 'localhost alias' }),
  })
  assert.equal((await ask(normalized)).status, 200)
  const food = await (await lookup(request('nutrition', { query: 'salmon', grams: 200 }))).json()
  assert.equal(food.name, 'Salmon, cooked')
  assert.equal(food.calories, 400)
  assert.equal(JSON.stringify(food).includes('test-only'), false)
  assert.deepEqual(await (await search(request('exercises', { query: 'squat' }))).json(), [{ name: 'Squat', category: 'wger' }])
  const audio = await speak(request('voice', { text: 'hello' }))
  assert.equal(audio.headers.get('Content-Type'), 'audio/mpeg')
  assert.deepEqual(new Uint8Array(await audio.arrayBuffer()), new Uint8Array([1, 2]))
})
