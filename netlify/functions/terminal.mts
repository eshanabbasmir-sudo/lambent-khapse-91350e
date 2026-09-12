import type { Config } from '@netlify/functions'
import { exec } from 'node:child_process'
import { timingSafeEqual } from 'node:crypto'

const TIMEOUT_MS = 15000
const MAX_OUTPUT = 200_000

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function checkAuth(req: Request): boolean {
  const secret = process.env.TERMINAL_PASSWORD
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return false
  return safeEqual(token, secret)
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!process.env.TERMINAL_PASSWORD) {
    return Response.json(
      { error: 'Server is not configured. Set the TERMINAL_PASSWORD environment variable in the Netlify site settings.' },
      { status: 500 },
    )
  }

  if (!checkAuth(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { command?: string; cwd?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const command = typeof body.command === 'string' ? body.command : ''
  const cwd = typeof body.cwd === 'string' && body.cwd.trim() ? body.cwd : '/tmp'

  if (!command.trim()) {
    return Response.json({ error: 'No command provided' }, { status: 400 })
  }
  if (command.length > 4000) {
    return Response.json({ error: 'Command too long' }, { status: 400 })
  }

  const result = await new Promise<{ stdout: string; stderr: string; cwd: string; exitCode: number | null }>((resolve) => {
    // Run the command, then print the resulting working directory on a sentinel line
    // so the next request continues from where the shell left off.
    const wrapped = `cd ${JSON.stringify(cwd)} 2>/dev/null; { ${command}\n}; echo "__CWD__$(pwd)__CWD__"`

    exec(
      wrapped,
      { shell: '/bin/bash', timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT, cwd: '/tmp' },
      (error, stdout, stderr) => {
        let nextCwd = cwd
        let cleanStdout = stdout
        const match = stdout.match(/__CWD__([\s\S]*?)__CWD__\n?$/)
        if (match) {
          nextCwd = match[1]
          cleanStdout = stdout.slice(0, match.index)
        }
        resolve({
          stdout: cleanStdout,
          stderr: stderr || (error && !match ? error.message : ''),
          cwd: nextCwd,
          exitCode: error && typeof (error as any).code === 'number' ? (error as any).code : error ? 1 : 0,
        })
      },
    )
  })

  return Response.json(result)
}

export const config: Config = {
  path: '/api/terminal',
}
