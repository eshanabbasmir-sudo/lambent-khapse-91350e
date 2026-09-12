import type { Config } from '@netlify/functions'
import { timingSafeEqual } from 'node:crypto'

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = process.env.TERMINAL_PASSWORD
  if (!secret) {
    return Response.json(
      { error: 'Server is not configured. Set the TERMINAL_PASSWORD environment variable in the Netlify site settings.' },
      { status: 500 },
    )
  }

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (!password || !safeEqual(password, secret)) {
    return Response.json({ error: 'Invalid password' }, { status: 401 })
  }

  return Response.json({ ok: true })
}

export const config: Config = {
  path: '/api/login',
}
