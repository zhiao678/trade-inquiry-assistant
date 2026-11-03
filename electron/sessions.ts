import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ChatMessage } from './runtime'

export type Session = { id: string; title: string; createdAt: string; updatedAt: string; messages: ChatMessage[] }

const WELCOME_MESSAGE = '你好，我是贸询智答。把客户询盘、商品和目标市场发给我，我会帮你提取关键信息、核验市场机会，并整理下一步跟进问题。'
const DEFAULT_TITLE = '新对话'

const sessionsDir = () => path.join(app.getPath('userData'), 'sessions')
const sessionFile = (id: string) => path.join(sessionsDir(), `${id}.json`)

async function ensureSessionsDir() {
  await fs.mkdir(sessionsDir(), { recursive: true })
}

export async function listSessions(): Promise<Session[]> {
  await ensureSessionsDir()
  const names = (await fs.readdir(sessionsDir())).filter((name) => name.endsWith('.json'))
  const sessions: Session[] = []
  for (const name of names) {
    try { sessions.push(JSON.parse(await fs.readFile(path.join(sessionsDir(), name), 'utf8')) as Session) } catch { /* ignore corrupt session */ }
  }
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadSession(id: string): Promise<Session | null> {
  if (!/^[\w-]+$/.test(id)) return null
  try {
    return JSON.parse(await fs.readFile(sessionFile(id), 'utf8')) as Session
  } catch {
    return null
  }
}

export async function saveSession(session: Session): Promise<Session> {
  await ensureSessionsDir()
  const firstUser = session.messages.find((message) => message.role === 'user')
  const next: Session = {
    ...session,
    title: session.title !== DEFAULT_TITLE ? session.title : firstUser?.content.slice(0, 24) || DEFAULT_TITLE,
    updatedAt: new Date().toISOString()
  }
  await fs.writeFile(sessionFile(next.id), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export async function createSession(): Promise<Session> {
  const now = new Date().toISOString()
  return saveSession({
    id: randomUUID(),
    title: DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [{ role: 'assistant', content: WELCOME_MESSAGE }]
  })
}
