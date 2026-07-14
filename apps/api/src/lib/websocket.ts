// @ts-expect-error ws module declaration
import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'

export type WSEventType =
  | 'lecture:created'
  | 'lecture:updated'
  | 'lecture:deleted'
  | 'exercise:created'
  | 'exercise:updated'
  | 'exercise:deleted'
  | 'exercise:corrected'
  | 'exercise:submitted'
  | 'exercise:submission-deleted'
  | 'quiz:created'
  | 'quiz:updated'
  | 'quiz:deleted'
  | 'user:updated'
  | 'user:deleted'
  | 'registration:requested'
  | 'registration:reviewed'
  | 'homework:created'
  | 'homework:updated'
  | 'homework:deleted'
  | 'homework:corrected'
  | 'homework:submission-deleted'
  | 'admin-content:deleted'
  | 'admin-content:updated'
  | 'admin-content:created'
  | 'student-creation:deleted'
  | 'student-creation:created'
  | 'resource:updated'
  | 'resource:created'
  | 'chat:message'
  | 'chat:deleted'
  | 'chat:settings'
  | 'group:message'
  | 'group:deleted'
  | 'group:created'
  | 'group:message-deleted'
  | 'call:join'
  | 'call:offer'
  | 'call:answer'
  | 'call:ice'
  | 'call:leave'
  | 'call:end'

export interface WSEvent {
  type: WSEventType
  data?: unknown
}

class WebSocketManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private wss: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clients: Set<any> = new Set()

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.wss.on('connection', (ws: any) => {
      this.clients.add(ws)
      console.log(`📡 WebSocket client connected (${this.clients.size} total)`)

      ws.on('close', () => {
        this.clients.delete(ws)
        console.log(`📡 WebSocket client disconnected (${this.clients.size} total)`)
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ws.on('error', (err: any) => {
        console.error('WebSocket error:', err)
        this.clients.delete(ws)
      })

      ws.on('message', (raw: unknown) => {
        try {
          const payload = JSON.parse((raw as { toString?: () => string })?.toString?.() ?? String(raw)) as WSEvent
          if (typeof payload?.type === 'string' && payload.type.startsWith('call:')) {
            this.broadcast(payload)
          }
        } catch (err) {
          console.warn('Invalid WebSocket client message:', err)
        }
      })

      // Send welcome message
      ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Teaching App' }))
    })

    console.log('📡 WebSocket server initialized on /ws')
  }

  broadcast(event: WSEvent) {
    const message = JSON.stringify(event)
    let sent = 0

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
        sent++
      }
    }

    console.log(`📡 Broadcast ${event.type} to ${sent} clients`)
  }
}

export const wsManager = new WebSocketManager()
