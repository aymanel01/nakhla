import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { ChatSettings, Message } from '@teaching-app/shared'
import { useAuth } from './__root'
import { api, ApiError, getWebSocketUrl } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageCircle, Send, Loader2, Paperclip, Lock, Unlock, Mic, Square, X, Trash2, Phone, Video, FileText, Users, Download } from 'lucide-react'
import { useRealtimeCall } from '@/components/realtime-call'
import { getMediaKind } from '@/components/media-viewer'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/chat')({
  component: ChatPage,
})

type UploadMeta = { fileUrl: string; fileName: string; fileType: string | null; fileSize: number | null }

const GROUP_GAP_MS = 5 * 60 * 1000

const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-teal-500',
  'bg-violet-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-fuchsia-500',
  'bg-cyan-600',
]

function avatarColor(key: string) {
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function displayNameFromEmail(email: string) {
  return (email || '').split('@')[0] || 'مستخدم'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`
}

function sameDay(a: string, b: string) {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

function dayLabel(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(dateStr, today.toISOString())) return 'اليوم'
  if (sameDay(dateStr, yesterday.toISOString())) return 'أمس'
  return date.toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })
}

function timeLabel(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })
}

function Avatar({ name, colorKey, className }: { name: string; colorKey: string; className?: string }) {
  return (
    <div
      className={cn('flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full text-xs font-bold text-white shadow-sm', avatarColor(colorKey), className)}
      title={name}
    >
      {initials(name)}
    </div>
  )
}

function isAudioFile(message: Message) {
  return Boolean(message.fileType?.startsWith('audio/') || message.fileName?.match(/\.(webm|mp3|wav|ogg|m4a|aac)$/i))
}

function ChatPage() {
  const { user, isAdmin } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [settings, setSettings] = useState<ChatSettings>({ usersCanSend: false })
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [updatingSettings, setUpdatingSettings] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const canSend = isAdmin || settings.usersCanSend

  const realtimeCall = useRealtimeCall({
    room: 'global-chat',
    userId: user?.id ?? null,
    userName: user?.fullName || user?.email || 'مستخدم',
    title: 'المحادثة العامة',
    isAdmin,
  })

  const addMessage = (message: Message) => {
    setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]))
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    Promise.all([
      api.get<{ messages: Message[] }>('/messages'),
      api.get<{ settings: ChatSettings }>('/messages/settings'),
    ])
      .then(([messagesResponse, settingsResponse]) => {
        setMessages(messagesResponse.messages)
        setSettings(settingsResponse.settings)
      })
      .catch(() => setError('تعذر تحميل المحادثة. حاول مرة أخرى.'))
      .finally(() => setLoading(false))

    const ws = new WebSocket(getWebSocketUrl())
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'chat:message') addMessage(data.data as Message)
        if (data.type === 'chat:deleted') setMessages((prev) => prev.filter((message) => message.id !== data.data?.id))
        if (data.type === 'chat:settings') setSettings(data.data as ChatSettings)
      } catch (err) {
        console.warn('Invalid websocket message:', err)
      }
    }
    ws.onerror = (event) => {
      console.warn('WebSocket connection failed. Messages still update after sending or refreshing.', event)
    }
    return () => ws.close()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-grow the composer like Teams (up to a max height).
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [content])

  const toggleChat = async () => {
    if (updatingSettings || !isAdmin) return
    setUpdatingSettings(true)
    setError(null)
    try {
      const response = await api.patch<{ settings: ChatSettings }>('/messages/settings', {
        usersCanSend: !settings.usersCanSend,
      })
      setSettings(response.settings)
    } catch (err) {
      console.error('Failed to update chat settings:', err)
      setError('تعذر تغيير حالة المحادثة.')
    } finally {
      setUpdatingSettings(false)
    }
  }

  const startRecording = async () => {
    if (!canSend || recording || sending) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('المتصفح لا يدعم تسجيل الصوت.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      streamRef.current = stream
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size > 0) {
          const audioFile = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type || 'audio/webm' })
          setFile(audioFile)
        } else {
          setError('التسجيل الصوتي فارغ. جرّب التسجيل مرة أخرى لمدة أطول.')
        }
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setRecording(false)
      }
      recorder.start(250)
      setRecording(true)
      setError(null)
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('تعذر تشغيل الميكروفون. تحقق من الصلاحيات.')
    }
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  const handleSend = async () => {
    if ((!content.trim() && !file) || sending || !canSend) return
    setSending(true)
    setError(null)
    try {
      let uploaded: UploadMeta | null = null
      if (file) {
        if (file.size === 0) {
          setError('الملف فارغ. اختر ملفاً آخر أو أعد تسجيل الصوت.')
          return
        }
        const formData = new FormData()
        formData.append('file', file)
        const response = await api.upload<{ file: UploadMeta }>('/uploads/chat', formData)
        uploaded = response.file
      }

      const response = await api.post<{ message: Message }>('/messages', {
        content: content.trim(),
        ...(uploaded || {}),
      })
      addMessage(response.message)
      setContent('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      console.error('Failed to send message:', err)
      if (err instanceof ApiError && err.status === 403) {
        setError('المحادثة مغلقة حالياً. المشرف فقط يمكنه الإرسال.')
      } else {
        setError(err instanceof ApiError ? err.message : 'تعذر إرسال الرسالة. حاول مرة أخرى.')
      }
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (messageId: number) => {
    if (deletingId) return
    setDeletingId(messageId)
    setError(null)
    try {
      await api.delete(`/messages/${messageId}`)
      setMessages((prev) => prev.filter((message) => message.id !== messageId))
    } catch (err) {
      console.error('Failed to delete message:', err)
      setError('تعذر حذف الرسالة.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  const renderAttachment = (msg: Message, isMe: boolean) => {
    if (!msg.fileUrl) return null
    const kind = isAudioFile(msg) ? 'audio' : getMediaKind(msg)
    if (kind === 'audio') {
      return <audio src={msg.fileUrl} controls className="mt-2 w-64 max-w-full" />
    }
    if (kind === 'image') {
      return (
        <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl">
          <img src={msg.fileUrl} alt={msg.fileName || 'صورة'} className="max-h-64 w-full max-w-xs object-cover" />
        </a>
      )
    }
    if (kind === 'video') {
      return <video src={msg.fileUrl} controls className="mt-2 max-h-64 w-full max-w-xs rounded-xl bg-black" />
    }
    return (
      <a
        href={msg.fileUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'mt-2 flex items-center gap-3 rounded-xl border p-2.5 transition',
          isMe ? 'border-white/25 bg-white/10 hover:bg-white/20' : 'border-border bg-background/70 hover:bg-muted',
        )}
      >
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', isMe ? 'bg-white/20' : 'bg-primary/10 text-primary')}>
          <FileText className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{msg.fileName || 'ملف مرفق'}</span>
          {msg.fileSize ? <span className="block text-[11px] opacity-70">{formatBytes(msg.fileSize)}</span> : null}
        </span>
        <Download className="h-4 w-4 shrink-0 opacity-70" />
      </a>
    )
  }

  return (
    <div className="flex h-app-panel flex-col" dir="rtl">
      <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border-violet-100 bg-white/95 shadow-xl shadow-violet-200/30">
        {/* Teams-style conversation header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-l from-[#f6f0ff] via-white to-white px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8a58d7] to-[#b284ef] text-white shadow-md">
              <Users className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                المحادثة العامة
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', canSend ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', canSend ? 'bg-emerald-500' : 'bg-slate-400')} />
                  {canSend ? 'مفتوحة' : 'مغلقة'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">{messages.length} رسالة • محادثة جماعية</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => void realtimeCall.startCall('audio')} title="مكالمة صوتية" className="h-10 w-10 rounded-2xl border-[#b48ee8] bg-white text-[#5b2ca3] hover:-translate-y-0.5 hover:border-[#8a58d7] hover:bg-[#f6f0ff] hover:shadow-lg hover:shadow-violet-500/20">
              <Phone className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => void realtimeCall.startCall('video')} title="مكالمة فيديو" className="h-10 w-10 rounded-2xl border-[#b48ee8] bg-white text-[#5b2ca3] hover:-translate-y-0.5 hover:border-[#8a58d7] hover:bg-[#f6f0ff] hover:shadow-lg hover:shadow-violet-500/20">
              <Video className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <Button onClick={toggleChat} disabled={updatingSettings} className="gap-2 rounded-2xl bg-gradient-to-r from-[#8a58d7] via-[#b284ef] to-[#eadcff] text-[#5b2ca3] hover:opacity-95">
                {updatingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : settings.usersCanSend ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                <span className="hidden sm:inline">{settings.usersCanSend ? 'إغلاق للمستخدمين' : 'فتح للمستخدمين'}</span>
              </Button>
            )}
          </div>
        </div>

        {error && <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}

        {/* Messages */}
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(138,88,215,0.05),transparent_60%)] p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-100 text-[#8a58d7]">
                <MessageCircle className="h-8 w-8" />
              </div>
              <p className="font-medium">لا توجد رسائل بعد</p>
              <p className="text-sm">ابدأ المحادثة بإرسال أول رسالة.</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.userId === user?.id
              const canDelete = isAdmin || isMe
              const name = isMe ? user?.fullName || displayNameFromEmail(user?.email || '') : displayNameFromEmail(msg.userEmail)
              const prev = messages[index - 1]
              const newDay = !prev || !sameDay(prev.createdAt, msg.createdAt)
              const startGroup =
                newDay ||
                !prev ||
                prev.userId !== msg.userId ||
                new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS

              return (
                <div key={msg.id}>
                  {newDay && (
                    <div className="my-3 flex items-center justify-center">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm ring-1 ring-black/5">
                        {dayLabel(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={cn('flex items-end gap-2', isMe ? 'flex-row-reverse' : 'flex-row', startGroup ? 'mt-3' : 'mt-0.5')}>
                    {startGroup ? (
                      <Avatar name={name} colorKey={String(msg.userId)} />
                    ) : (
                      <div className="w-9 shrink-0" />
                    )}
                    <div className={cn('flex min-w-0 max-w-[78%] flex-col', isMe ? 'items-end' : 'items-start')}>
                      {startGroup && (
                        <div className={cn('mb-1 flex items-center gap-2 px-1 text-xs', isMe ? 'flex-row-reverse' : 'flex-row')}>
                          <span className="font-semibold text-slate-700">{isMe ? 'أنت' : name}</span>
                          <span className="text-muted-foreground">{timeLabel(msg.createdAt)}</span>
                        </div>
                      )}
                      <div
                        className={cn(
                          'group relative w-fit max-w-full rounded-2xl px-3.5 py-2.5 shadow-sm',
                          isMe
                            ? 'bg-gradient-to-br from-[#8a58d7] to-[#7a4ad0] text-white'
                            : 'bg-white text-slate-800 ring-1 ring-black/5',
                          startGroup && (isMe ? 'rounded-tl-md' : 'rounded-tr-md'),
                        )}
                      >
                        {canDelete && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(msg.id)}
                            disabled={deletingId === msg.id}
                            className={cn(
                              'absolute -top-3 h-7 w-7 rounded-full border bg-background text-destructive opacity-0 shadow-md transition group-hover:opacity-100',
                              isMe ? '-right-3' : '-left-3',
                            )}
                            title="حذف الرسالة"
                          >
                            {deletingId === msg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                        {msg.content && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.content}</p>}
                        {renderAttachment(msg, isMe)}
                        {!startGroup && (
                          <span className={cn('mt-1 block text-[10px] opacity-0 transition group-hover:opacity-60', isMe ? 'text-right text-white' : 'text-left')}>
                            {timeLabel(msg.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Teams-style composer */}
        <div className="border-t bg-white/80 p-3">
          {!canSend && (
            <div className="mb-2 rounded-xl bg-slate-100 px-3 py-2 text-center text-xs text-muted-foreground">
              المحادثة مغلقة حالياً — المشرف فقط يمكنه الإرسال.
            </div>
          )}
          <div
            className={cn(
              'rounded-2xl border bg-white shadow-sm transition focus-within:border-[#b48ee8] focus-within:ring-2 focus-within:ring-[#b48ee8]/40',
              (!canSend || sending) && 'opacity-70',
            )}
          >
            {file && (
              <div className="m-2 flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {file.type.startsWith('audio/') ? <Mic className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{file.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
                </span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={canSend ? 'اكتب رسالتك… (Enter للإرسال، Shift+Enter لسطر جديد)' : 'المحادثة مغلقة حالياً'}
              disabled={sending || !canSend}
              rows={1}
              className="block max-h-40 w-full resize-none bg-transparent px-4 pt-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-1">
                <Input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" disabled={!canSend || sending} />
                <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={!canSend || sending} title="إرفاق ملف" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-[#5b2ca3]">
                  <Paperclip className="h-[18px] w-[18px]" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={recording ? stopRecording : startRecording} disabled={!canSend || sending} title="تسجيل صوت" className={cn('h-9 w-9 rounded-xl', recording ? 'animate-pulse bg-destructive/10 text-destructive' : 'text-muted-foreground hover:text-[#5b2ca3]')}>
                  {recording ? <Square className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
                </Button>
                {recording && <span className="text-xs font-medium text-destructive">جارٍ التسجيل…</span>}
              </div>
              <Button
                onClick={handleSend}
                disabled={sending || !canSend || (!content.trim() && !file)}
                size="icon"
                className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#8a58d7] to-[#7a4ad0] text-white shadow-md hover:opacity-95 disabled:opacity-40"
                title="إرسال"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {realtimeCall.modal}
    </div>
  )
}
