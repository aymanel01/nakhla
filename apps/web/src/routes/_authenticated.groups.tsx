import { createFileRoute, useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ChatSettings, Group, GroupMessage, User } from '@teaching-app/shared'
import { useAuth } from './__root'
import { api, ApiError, getWebSocketUrl } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HomeworkPage } from './_authenticated.homework'
import { SectionBanner, sectionThemeMap, ThemedActionButton } from '@/components/section-banner'
import { Users, MessageCircle, Loader2, Paperclip, ClipboardList, Send, Mic, Square, X, Trash2, Lock, Unlock, Phone, Video } from 'lucide-react'
import { useRealtimeCall } from '@/components/realtime-call'

export const Route = createFileRoute('/_authenticated/groups')({ component: GroupsPage })

type GroupsTab = 'conversation' | 'homework'

type UploadMeta = {
  fileUrl: string
  fileName: string
  fileType: string | null
  fileSize: number | null
}

function getGroupsTabFromHash(hash: string): GroupsTab {
  return hash.replace(/^#/, '') === 'homework' ? 'homework' : 'conversation'
}

function isAudioFile(message: GroupMessage) {
  return Boolean(message.fileType?.startsWith('audio/') || message.fileName?.match(/\.(webm|mp3|wav|ogg|m4a|aac)$/i))
}

function GroupsPage() {
  const { user, isAdmin } = useAuth()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<GroupsTab>(getGroupsTabFromHash(location.hash || ''))
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [settings, setSettings] = useState<ChatSettings>({ usersCanSend: false })
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [updatingSettings, setUpdatingSettings] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [chatFile, setChatFile] = useState<File | null>(null)
  const [recording, setRecording] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null
  const canSend = isAdmin || settings.usersCanSend

  const addMessage = (message: GroupMessage) => {
    setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]))
  }

  const loadGroups = async () => {
    const { groups } = await api.get<{ groups: Group[] }>('/groups')
    setGroups(groups)
    if (!selectedGroupId && groups.length > 0) setSelectedGroupId(groups[0].id)
    if (selectedGroupId && !groups.some((group) => group.id === selectedGroupId)) setSelectedGroupId(groups[0]?.id ?? null)
  }

  const loadGroupDetails = async (groupId: number) => {
    const [messagesResponse, membersResponse] = await Promise.all([
      api.get<{ messages: GroupMessage[] }>(`/groups/${groupId}/messages`),
      api.get<{ members: User[] }>(`/groups/${groupId}/members`),
    ])
    setMessages(messagesResponse.messages)
    setMembers(membersResponse.members)
  }

  useEffect(() => {
    Promise.all([loadGroups(), api.get<{ settings: ChatSettings }>('/messages/settings')])
      .then(([, settingsResponse]) => setSettings(settingsResponse.settings))
      .catch(() => setError('تعذر تحميل المجموعات. حاول مرة أخرى.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setActiveTab(getGroupsTabFromHash(location.hash || ''))
  }, [location.hash])

  useEffect(() => {
    if (!selectedGroupId) {
      setMessages([])
      setMembers([])
      return
    }
    loadGroupDetails(selectedGroupId).catch(() => setError('تعذر تحميل محادثة المجموعة.'))
  }, [selectedGroupId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const ws = new WebSocket(getWebSocketUrl())
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const message = data.data as GroupMessage | undefined
        if (data.type === 'group:message' && message?.groupId === selectedGroupId) addMessage(message)
        if (data.type === 'group:message-deleted' && data.data?.groupId === selectedGroupId) {
          setMessages((prev) => prev.filter((item) => item.id !== data.data.id))
        }
        if (data.type === 'chat:settings') setSettings(data.data as ChatSettings)
      } catch (err) {
        console.warn('Invalid websocket message:', err)
      }
    }
    ws.onerror = (event) => {
      console.warn('WebSocket connection failed. Group messages still update after sending or refreshing.', event)
    }
    return () => ws.close()
  }, [selectedGroupId])

  const handleTabChange = (value: string) => {
    const nextTab = value as GroupsTab
    setActiveTab(nextTab)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', nextTab === 'homework' ? '#homework' : window.location.pathname)
    }
  }

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
          setChatFile(audioFile)
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
    if (!selectedGroupId || (!newContent.trim() && !chatFile) || sending || !canSend) return
    setSending(true)
    setError(null)
    try {
      let uploaded: UploadMeta | null = null
      if (chatFile) {
        if (chatFile.size === 0) {
          setError('الملف فارغ. اختر ملفاً آخر أو أعد تسجيل الصوت.')
          return
        }
        const formData = new FormData()
        formData.append('file', chatFile)
        const response = await api.upload<{ file: UploadMeta }>('/uploads/chat', formData)
        uploaded = response.file
      }
      const response = await api.post<{ message: GroupMessage }>(`/groups/${selectedGroupId}/messages`, { content: newContent.trim(), ...(uploaded || {}) })
      addMessage(response.message)
      setNewContent('')
      setChatFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      console.error('Failed to send group message:', err)
      if (err instanceof ApiError && err.status === 403) {
        setError('المحادثة مغلقة حالياً. المشرف فقط يمكنه الإرسال.')
      } else {
        setError('تعذر إرسال الرسالة. حاول مرة أخرى.')
      }
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (messageId: number) => {
    if (!selectedGroupId || deletingId) return
    setDeletingId(messageId)
    setError(null)
    try {
      await api.delete(`/groups/${selectedGroupId}/messages/${messageId}`)
      setMessages((prev) => prev.filter((message) => message.id !== messageId))
    } catch (err) {
      console.error('Failed to delete group message:', err)
      setError('تعذر حذف الرسالة.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="w-full space-y-4">
      <SectionBanner imageSrc={sectionThemeMap.groups.image} alt="مجموعاتنا" />
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <section className="grid max-w-md gap-2 md:grid-cols-2">
        <ThemedActionButton
          type="button"
          theme="groups"
          active={activeTab === 'conversation'}
          onClick={() => handleTabChange('conversation')}
          className="h-10 w-full items-center justify-center gap-1.5 px-3 text-center text-xs leading-tight"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
          المجموعات
        </ThemedActionButton>
        <ThemedActionButton
          type="button"
          theme="groups"
          active={activeTab === 'homework'}
          onClick={() => handleTabChange('homework')}
          className="h-10 w-full items-center justify-center gap-1.5 px-3 text-center text-xs leading-tight"
        >
          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
          مشاريع المجموعات
        </ThemedActionButton>
      </section>

      {activeTab === 'conversation' ? (
        <div className="mt-6 grid h-app-panel gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <GroupsList groups={groups} selectedGroupId={selectedGroupId} onSelect={setSelectedGroupId} />
          <GroupChat
            selectedGroup={selectedGroup}
            messages={messages}
            members={members}
            currentUserId={user?.id ?? null}
            isAdmin={isAdmin}
            canSend={canSend}
            settings={settings}
            updatingSettings={updatingSettings}
            toggleChat={toggleChat}
            newContent={newContent}
            setNewContent={setNewContent}
            chatFile={chatFile}
            setChatFile={setChatFile}
            fileRef={fileRef}
            endRef={endRef}
            sending={sending}
            recording={recording}
            deletingId={deletingId}
            onSend={handleSend}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onDelete={handleDelete}
          />
        </div>
      ) : (
        <div className="mt-6">
          <HomeworkPage groupId={selectedGroupId} groupName={selectedGroup?.name} />
        </div>
      )}
    </div>
  )
}

function GroupsList({ groups, selectedGroupId, onSelect }: { groups: Group[]; selectedGroupId: number | null; onSelect: (id: number) => void }) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />مجموعاتي</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {groups.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مجموعات متاحة لك الآن.</p> : null}
        {groups.map((group) => (
          <button key={group.id} type="button" onClick={() => onSelect(group.id)} className={`min-h-[52px] w-full rounded-lg border p-2.5 text-right transition ${selectedGroupId === group.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'}`}>
            <div className="flex h-full items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{group.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{group.description || 'بدون وصف'}</div>
              </div>
              <div className="shrink-0 text-[11px] text-muted-foreground">{group.memberCount} عضو</div>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}

function GroupChat(props: {
  selectedGroup: Group | null
  messages: GroupMessage[]
  members: User[]
  currentUserId: number | null
  isAdmin: boolean
  canSend: boolean
  settings: ChatSettings
  updatingSettings: boolean
  toggleChat: () => void
  newContent: string
  setNewContent: (value: string) => void
  chatFile: File | null
  setChatFile: (file: File | null) => void
  fileRef: RefObject<HTMLInputElement | null>
  endRef: RefObject<HTMLDivElement | null>
  sending: boolean
  recording: boolean
  deletingId: number | null
  onSend: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onDelete: (messageId: number) => void
}) {
  const realtimeCall = useRealtimeCall({
    room: `group-chat-${props.selectedGroup?.id ?? 'none'}`,
    userId: props.currentUserId,
    userName: 'عضو المجموعة',
    title: props.selectedGroup ? `مجموعة ${props.selectedGroup.name}` : 'المجموعة',
    isAdmin: props.isAdmin,
  })

  if (!props.selectedGroup) {
    return (
      <Card className="min-h-[640px]">
        <CardHeader><CardTitle>اختر مجموعة</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">اختر مجموعة من القائمة لعرض الأعضاء والمحادثة الخاصة بها.</p></CardContent>
      </Card>
    )
  }

  return (
      <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" />محادثة {props.selectedGroup.name}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void realtimeCall.startCall('audio')} disabled={!props.isAdmin} className="gap-2 rounded-2xl border-emerald-200 bg-white hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900 hover:shadow-lg hover:shadow-emerald-500/20">
              <Phone className="h-4 w-4" /> صوت
            </Button>
            <Button type="button" variant="outline" onClick={() => void realtimeCall.startCall('video')} disabled={!props.isAdmin} className="gap-2 rounded-2xl border-cyan-200 bg-white hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-900 hover:shadow-lg hover:shadow-cyan-500/20">
              <Video className="h-4 w-4" /> فيديو
            </Button>
          </div>
          {props.isAdmin && (
            <Button onClick={props.toggleChat} disabled={props.updatingSettings} variant={props.settings.usersCanSend ? 'destructive' : 'default'} className="gap-2">
              {props.updatingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : props.settings.usersCanSend ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              {props.settings.usersCanSend ? 'إغلاق الإرسال للمستخدمين' : 'فتح الإرسال للمستخدمين'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-h-0 flex-1 flex-col">
            {!props.canSend && (
              <div className="border-b bg-muted/60 p-3 text-sm text-muted-foreground">
                المحادثة مغلقة حالياً. يمكن للمشرف فتح الإرسال للمستخدمين.
              </div>
            )}
            <MessagesList
              messages={props.messages}
              currentUserId={props.currentUserId}
              isAdmin={props.isAdmin}
              deletingId={props.deletingId}
              endRef={props.endRef}
              onDelete={props.onDelete}
            />
            <div className="border-t p-4">
              {props.chatFile && (
                <div className="mb-3 flex items-center justify-between rounded-2xl border bg-muted/50 px-3 py-2 text-sm">
                  <span className="truncate">{props.chatFile.name}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { props.setChatFile(null); if (props.fileRef.current) props.fileRef.current.value = '' }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input ref={props.fileRef} type="file" onChange={(e) => props.setChatFile(e.target.files?.[0] ?? null)} className="hidden" disabled={!props.canSend || props.sending} />
                <Button type="button" variant="outline" size="icon" onClick={() => props.fileRef.current?.click()} disabled={!props.canSend || props.sending} title="إرفاق ملف" className="h-11 w-11 rounded-2xl">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button type="button" variant={props.recording ? 'destructive' : 'outline'} size="icon" onClick={props.recording ? props.onStopRecording : props.onStartRecording} disabled={!props.canSend || props.sending} title="تسجيل صوت" className="h-11 w-11 rounded-2xl">
                  {props.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Input
                  value={props.newContent}
                  onChange={(e) => props.setNewContent(e.target.value)}
                  placeholder={props.canSend ? 'اكتب رسالة للمجموعة أو أرسل ملفاً أو صوتاً' : 'المحادثة مغلقة حالياً'}
                  disabled={!props.canSend || props.sending}
                  className="min-h-11 flex-1 rounded-2xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      props.onSend()
                    }
                  }}
                />
                <Button onClick={props.onSend} disabled={props.sending || !props.canSend || (!props.newContent.trim() && !props.chatFile)} size="icon" className="h-11 w-11 rounded-2xl">
                  {props.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <MembersList members={props.members} />
        </div>
      </CardContent>
      {realtimeCall.modal}
    </Card>
  )
}

function MessagesList(props: {
  messages: GroupMessage[]
  currentUserId: number | null
  isAdmin: boolean
  deletingId: number | null
  endRef: RefObject<HTMLDivElement | null>
  onDelete: (messageId: number) => void
}) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      {props.messages.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد رسائل بعد في هذه المجموعة.</p> : null}
      {props.messages.map((message) => {
        const isMe = message.userId === props.currentUserId
        const canDelete = props.isAdmin || isMe
        const audio = isAudioFile(message)
        return (
          <div key={message.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
            <div className={`group relative max-w-[85%] rounded-2xl p-3 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => props.onDelete(message.id)}
                  disabled={props.deletingId === message.id}
                  className={`absolute -top-3 ${isMe ? '-left-3' : '-right-3'} h-7 w-7 rounded-full border bg-background text-destructive opacity-0 shadow-sm transition group-hover:opacity-100`}
                  title="حذف الرسالة"
                >
                  {props.deletingId === message.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              )}
              {!isMe && <div className="mb-1 text-xs opacity-70">{message.userEmail}</div>}
              {message.content && <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>}
              {message.fileUrl && audio && <audio src={message.fileUrl} controls className="mt-2 max-w-full" />}
              {message.fileUrl && !audio && (
                <a href={message.fileUrl} target="_blank" rel="noreferrer" className={`mt-2 inline-flex items-center gap-2 text-sm ${isMe ? 'text-primary-foreground underline' : 'text-primary'}`}>
                  <Paperclip className="h-4 w-4" />{message.fileName || 'فتح الملف'}
                </a>
              )}
            </div>
            <span className="mt-1 text-xs text-muted-foreground">{new Date(message.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )
      })}
      <div ref={props.endRef} />
    </div>
  )
}

function displayUserName(user: User) {
  return user.fullName || user.email.split('@')[0]
}

function UserAvatar({ user, size = 'h-9 w-9' }: { user: User; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary`}>
      {user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt={displayUserName(user)} className="h-full w-full object-cover" /> : displayUserName(user).slice(0, 1).toUpperCase()}
    </span>
  )
}

function MembersList({ members }: { members: User[] }) {
  return (
    <div className="border-t p-4 xl:border-r xl:border-t-0">
      <h3 className="mb-3 font-semibold">أعضاء المجموعة</h3>
      <div className="space-y-2">
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
            <UserAvatar user={member} />
            <div className="min-w-0">
              <div className="truncate font-medium">{displayUserName(member)}</div>
              <div className="truncate text-xs text-muted-foreground">{member.email}</div>
              <div className="text-xs text-muted-foreground">{member.role === 'admin' ? 'مشرف' : 'مستخدم'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
