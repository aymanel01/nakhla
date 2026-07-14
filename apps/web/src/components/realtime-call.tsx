import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Hand, Maximize2, Mic, MicOff, Minimize2, Phone, PhoneOff, ScreenShare, Users, Video, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getWebSocketUrl } from '@/lib/api'

type CallMode = 'audio' | 'video'
type SignalType = 'call:join' | 'call:offer' | 'call:answer' | 'call:ice' | 'call:leave' | 'call:end' | 'call:mute' | 'call:unmute' | 'call:hand' | 'call:grant'

type SignalMessage = {
  type: SignalType
  room: string
  clientId: string
  targetClientId?: string | null
  fromUserId?: number | null
  fromName?: string
  mode?: CallMode
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

interface RealtimeCallOptions {
  room: string
  userId?: number | null
  userName?: string | null
  title: string
  isAdmin?: boolean
}

interface RemoteParticipant {
  clientId: string
  name: string
  stream: MediaStream | null
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

function makeClientId() {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useRealtimeCall({ room, userId, userName, title, isAdmin = false }: RealtimeCallOptions) {
  const clientIdRef = useRef(makeClientId())
  const wsRef = useRef<WebSocket | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const namesRef = useRef<Map<string, string>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const callModeRef = useRef<CallMode | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const [callMode, setCallModeState] = useState<CallMode | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const [status, setStatus] = useState('جاهز للمكالمة')
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([])
  const [mutedByAdmin, setMutedByAdmin] = useState(false)
  const [adminMutedClients, setAdminMutedClients] = useState<Set<string>>(new Set())
  const [screenSharing, setScreenSharing] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [handRequests, setHandRequests] = useState<{ clientId: string; name: string }[]>([])
  const [minimized, setMinimized] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null)
  const [callPos, setCallPos] = useState<{ x: number; y: number } | null>(null)
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null)

  const setCallMode = (mode: CallMode | null) => {
    callModeRef.current = mode
    setCallModeState(mode)
  }

  const refreshParticipants = () => {
    setRemoteParticipants((prev) => {
      const streamsById = new Map(prev.map((item) => [item.clientId, item.stream]))
      return Array.from(namesRef.current.entries()).map(([clientId, name]) => ({
        clientId,
        name,
        stream: streamsById.get(clientId) ?? null,
      }))
    })
  }


  const waitForSocket = () => new Promise<void>((resolve, reject) => {
    const ws = wsRef.current
    if (!ws) return reject(new Error('socket-missing'))
    if (ws.readyState === WebSocket.OPEN) return resolve()
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) return reject(new Error('socket-closed'))
    const timer = window.setTimeout(() => reject(new Error('socket-timeout')), 3500)
    ws.addEventListener('open', () => {
      window.clearTimeout(timer)
      resolve()
    }, { once: true })
  })

  const sendSignal = (message: Omit<SignalMessage, 'room' | 'clientId' | 'fromUserId' | 'fromName'>) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      ...message,
      room,
      clientId: clientIdRef.current,
      fromUserId: userId ?? null,
      fromName: userName || 'مستخدم',
    }))
  }

  const updateRemoteStream = (clientId: string, stream: MediaStream | null) => {
    setRemoteParticipants((prev) => {
      const exists = prev.some((item) => item.clientId === clientId)
      const next = exists
        ? prev.map((item) => item.clientId === clientId ? { ...item, stream } : item)
        : [...prev, { clientId, name: namesRef.current.get(clientId) || 'مشارك', stream }]
      return next
    })
  }

  const closePeer = (clientId: string) => {
    peersRef.current.get(clientId)?.close()
    peersRef.current.delete(clientId)
    namesRef.current.delete(clientId)
    setRemoteParticipants((prev) => prev.filter((item) => item.clientId !== clientId))
  }

  const stopStreams = () => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenStreamRef.current = null
    setScreenSharing(false)
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    setLocalStream(null)
    if (localVideoRef.current) localVideoRef.current.srcObject = null
  }

  const resetCall = (notify = true) => {
    if (notify && callModeRef.current) sendSignal({ type: 'call:leave', mode: callModeRef.current })
    peersRef.current.forEach((peer) => peer.close())
    peersRef.current.clear()
    namesRef.current.clear()
    stopStreams()
    setRemoteParticipants([])
    setCallMode(null)
    setStatus('جاهز للمكالمة')
    setMinimized(false)
    setCallPos(null)
    setDeviceNotice(null)
    setCallError(null)
    setHandRaised(false)
  }

  const attachLocalTracks = (pc: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      if (!pc.getSenders().some((sender) => sender.track === track)) pc.addTrack(track, stream)
    })
  }

  const ensurePeer = (clientId: string, name = 'مشارك') => {
    const existing = peersRef.current.get(clientId)
    if (existing) return existing

    namesRef.current.set(clientId, name)
    refreshParticipants()
    const pc = new RTCPeerConnection(rtcConfig)

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'call:ice',
          targetClientId: clientId,
          candidate: event.candidate.toJSON(),
          mode: callModeRef.current || 'audio',
        })
      }
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0]
      if (!stream) return
      updateRemoteStream(clientId, stream)
      setStatus('المكالمة الجماعية متصلة')
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('المكالمة الجماعية متصلة')
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        if (pc.connectionState !== 'closed') setStatus('بعض المشاركين انقطع اتصالهم')
      }
    }

    const stream = localStreamRef.current
    if (stream) {
      attachLocalTracks(pc, stream)
    } else {
      // Listen-only participant (no mic/camera): still negotiate to RECEIVE media.
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' })
        if (callModeRef.current === 'video') pc.addTransceiver('video', { direction: 'recvonly' })
      } catch (err) {
        console.warn('Failed to add recvonly transceiver:', err)
      }
    }
    peersRef.current.set(clientId, pc)
    return pc
  }

  const deviceNoticeMessage = (error: unknown, mode: CallMode) => {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        return 'تم رفض إذن الكاميرا/الميكروفون — أنت في وضع الاستماع فقط. فعّل الإذن من أيقونة القفل في شريط العنوان ثم أعد المحاولة.'
      }
      if (error.name === 'NotReadableError' || error.name === 'AbortError') {
        return 'الكاميرا أو الميكروفون مستعملة من تطبيق آخر — أنت في وضع الاستماع فقط. أغلق التطبيق الآخر ثم أعد المحاولة.'
      }
    }
    return mode === 'video'
      ? 'لا توجد كاميرا أو ميكروفون — انضممت في وضع الاستماع فقط.'
      : 'لا يوجد ميكروفون — انضممت في وضع الاستماع فقط.'
  }

  const prepareLocalStream = async (mode: CallMode): Promise<MediaStream | null> => {
    setDeviceNotice(null)
    const clearLocal = () => {
      localStreamRef.current = null
      setLocalStream(null)
      setMicEnabled(false)
      if (localVideoRef.current) localVideoRef.current.srcObject = null
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      clearLocal()
      setDeviceNotice('هذا المتصفح أو الاتصال (HTTP) لا يدعم الكاميرا والميكروفون — أنت في وضع الاستماع فقط.')
      return null
    }

    // Teams-style graceful fallback: video → audio-only → listen-only, so a
    // missing camera or microphone never blocks you from joining the room.
    const attempts: MediaStreamConstraints[] = mode === 'video'
      ? [{ audio: true, video: true }, { audio: true, video: false }]
      : [{ audio: true, video: false }]

    let stream: MediaStream | null = null
    let lastError: unknown = null
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
        break
      } catch (error) {
        lastError = error
      }
    }

    if (!stream) {
      clearLocal()
      setDeviceNotice(deviceNoticeMessage(lastError, mode))
      return null
    }

    if (mode === 'video' && stream.getVideoTracks().length === 0) {
      setDeviceNotice('لا توجد كاميرا متاحة — انضممت بالصوت فقط.')
    }

    const hasAudio = stream.getAudioTracks().length > 0
    if (!isAdmin && hasAudio) {
      stream.getAudioTracks().forEach((track) => { track.enabled = false })
      setMutedByAdmin(true)
    }
    setMicEnabled(hasAudio && isAdmin)
    localStreamRef.current = stream
    setLocalStream(stream)
    if (localVideoRef.current) localVideoRef.current.srcObject = stream
    return stream
  }

  const toggleMic = () => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? []
    if (tracks.length === 0) return
    const next = !micEnabled
    tracks.forEach((track) => { track.enabled = next })
    setMicEnabled(next)
  }

  const beginDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Don't start dragging when pressing a header control (minimize/end/share).
    if ((e.target as HTMLElement).closest('button')) return
    const panel = e.currentTarget.closest('[data-call-panel]') as HTMLElement | null
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    dragOffsetRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  const onDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragOffsetRef.current) return
    const x = Math.min(Math.max(8, e.clientX - dragOffsetRef.current.dx), window.innerWidth - 80)
    const y = Math.min(Math.max(8, e.clientY - dragOffsetRef.current.dy), window.innerHeight - 60)
    setCallPos({ x, y })
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragOffsetRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  const createOfferFor = async (targetClientId: string, name: string, mode: CallMode) => {
    const pc = ensurePeer(targetClientId, name)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    sendSignal({ type: 'call:offer', targetClientId, mode, sdp: offer })
  }

  const setLocalAudioEnabled = (enabled: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = enabled })
    setMutedByAdmin(!enabled)
    setMicEnabled(enabled)
  }

  const raiseHand = () => {
    if (isAdmin || !callModeRef.current || handRaised) return
    setHandRaised(true)
    sendSignal({ type: 'call:hand', mode: callModeRef.current })
    setStatus('تم إرسال طلب رفع اليد للمشرف')
  }

  const grantMic = (targetClientId: string) => {
    if (!isAdmin) return
    sendSignal({ type: 'call:grant', targetClientId, mode: callModeRef.current || 'audio' })
    setAdminMutedClients((prev) => {
      const next = new Set(prev)
      next.delete(targetClientId)
      return next
    })
    setHandRequests((prev) => prev.filter((item) => item.clientId !== targetClientId))
  }

  const toggleParticipantMute = (targetClientId: string) => {
    if (!isAdmin) return
    const nextMuted = !adminMutedClients.has(targetClientId)
    setAdminMutedClients((prev) => {
      const next = new Set(prev)
      if (nextMuted) next.add(targetClientId)
      else next.delete(targetClientId)
      return next
    })
    sendSignal({ type: nextMuted ? 'call:mute' : 'call:unmute', targetClientId, mode: callModeRef.current || 'audio' })
  }


  const replaceOutgoingVideoTrack = async (track: MediaStreamTrack | null, stream: MediaStream) => {
    peersRef.current.forEach((peer) => {
      const sender = peer.getSenders().find((item) => item.track?.kind === 'video')
      if (sender) {
        void sender.replaceTrack(track)
      } else if (track) {
        peer.addTrack(track, stream)
      }
    })
  }

  const startScreenShare = async () => {
    if (!isAdmin || callModeRef.current !== 'video') return
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setCallError('المتصفح لا يدعم مشاركة الشاشة.')
      return
    }
    try {
      setCallError(null)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const screenTrack = displayStream.getVideoTracks()[0]
      if (!screenTrack) throw new Error('screen-track-missing')
      const currentStream = localStreamRef.current
      const audioTracks = currentStream?.getAudioTracks() ?? []
      currentStream?.getVideoTracks().forEach((track) => track.stop())
      const mixedStream = new MediaStream([...audioTracks, screenTrack])
      screenStreamRef.current = displayStream
      localStreamRef.current = mixedStream
      setLocalStream(mixedStream)
      if (localVideoRef.current) localVideoRef.current.srcObject = mixedStream
      await replaceOutgoingVideoTrack(screenTrack, mixedStream)
      screenTrack.onended = () => { void stopScreenShare() }
      setScreenSharing(true)
      setStatus('المشرف يشارك الشاشة الآن')
    } catch (error) {
      console.error('Failed to share screen:', error)
      setCallError('تعذر تشغيل مشاركة الشاشة. تحقق من صلاحيات المتصفح.')
    }
  }

  const stopScreenShare = async () => {
    if (!isAdmin || callModeRef.current !== 'video') return
    try {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
      const currentStream = localStreamRef.current
      const audioTracks = currentStream?.getAudioTracks() ?? []
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      const cameraTrack = cameraStream.getVideoTracks()[0]
      if (!cameraTrack) throw new Error('camera-track-missing')
      currentStream?.getVideoTracks().forEach((track) => track.stop())
      const mixedStream = new MediaStream([...audioTracks, cameraTrack])
      localStreamRef.current = mixedStream
      setLocalStream(mixedStream)
      if (localVideoRef.current) localVideoRef.current.srcObject = mixedStream
      await replaceOutgoingVideoTrack(cameraTrack, mixedStream)
      setScreenSharing(false)
      setStatus('تم إيقاف مشاركة الشاشة والرجوع إلى الكاميرا')
    } catch (error) {
      console.error('Failed to stop screen share:', error)
      setScreenSharing(false)
      setCallError('توقفت مشاركة الشاشة، لكن تعذر الرجوع إلى الكاميرا تلقائياً.')
    }
  }

  const startCall = async (mode: CallMode) => {
    try {
      setCallError(null)
      setMinimized(false)
      setCallMode(mode)
      setStatus('جاري دخول غرفة المكالمة...')
      // Device problems no longer abort the call — prepareLocalStream falls back to
      // listen-only and surfaces a non-blocking notice instead of throwing.
      if (!localStreamRef.current) await prepareLocalStream(mode)
      await waitForSocket()
      sendSignal({ type: 'call:join', mode })
      setStatus(isAdmin ? 'أنت فتحت غرفة المكالمة الجماعية.' : 'دخلت للمكالمة الجماعية — يمكنك الاستماع، والمشرف يفتح لك الميكروفون عند رفع اليد.')
    } catch (error) {
      console.error('Failed to start realtime call:', error)
      setCallError('تعذر الاتصال بخدمة المكالمات. تأكد أن الخادم يعمل ثم أعد المحاولة.')
      setStatus('تعذر الاتصال')
    }
  }

  useEffect(() => {
    const ws = new WebSocket(getWebSocketUrl())
    wsRef.current = ws

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data) as SignalMessage
        if (!message.type?.startsWith('call:') || message.room !== room || message.clientId === clientIdRef.current) return
        if (message.targetClientId && message.targetClientId !== clientIdRef.current) return

        const senderName = message.fromName || 'مشارك'
        const currentMode = callModeRef.current

        if (message.type === 'call:join') {
          if (!currentMode || !localStreamRef.current) return
          namesRef.current.set(message.clientId, senderName)
          refreshParticipants()
          await createOfferFor(message.clientId, senderName, currentMode)
          return
        }

        if (message.type === 'call:offer' && message.sdp && message.mode) {
          const mode = currentMode || message.mode
          // Only acquire devices if we haven't joined yet. Listen-only members
          // (no mic/camera) keep receiving without re-prompting on every offer.
          if (!callModeRef.current) {
            setCallMode(mode)
            await prepareLocalStream(mode)
          }
          const pc = ensurePeer(message.clientId, senderName)
          await pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendSignal({ type: 'call:answer', targetClientId: message.clientId, mode, sdp: answer })
          setStatus('تم الانضمام إلى المكالمة الجماعية')
          return
        }

        if (message.type === 'call:answer' && message.sdp) {
          const pc = peersRef.current.get(message.clientId)
          if (pc && pc.signalingState !== 'stable') await pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
          setStatus('المكالمة الجماعية متصلة')
          return
        }

        if (message.type === 'call:ice' && message.candidate) {
          const pc = peersRef.current.get(message.clientId)
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(message.candidate))
          return
        }

        if (message.type === 'call:mute') {
          setLocalAudioEnabled(false)
          setStatus('قام المشرف بكتم الميكروفون ديالك')
          return
        }

        if (message.type === 'call:unmute' || message.type === 'call:grant') {
          setLocalAudioEnabled(true)
          setHandRaised(false)
          setStatus(message.type === 'call:grant' ? 'قبل المشرف طلبك وفتح لك الميكروفون' : 'قام المشرف بإعادة فتح الميكروفون ديالك')
          return
        }

        if (message.type === 'call:hand') {
          if (isAdmin) {
            setHandRequests((prev) => prev.some((item) => item.clientId === message.clientId) ? prev : [...prev, { clientId: message.clientId, name: senderName }])
            setStatus(`${senderName} رفع اليد وبغا يهدر`)
          }
          return
        }

        if (message.type === 'call:leave' || message.type === 'call:end') {
          closePeer(message.clientId)
        }
      } catch (error) {
        console.warn('Invalid call signal:', error)
      }
    }

    ws.onerror = () => setCallError('تعذر الاتصال بخدمة المكالمات. تأكد أن السيرفر شغال.')
    return () => {
      resetCall(false)
      ws.close()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream
  }, [localStream, callMode])

  const participantCount = remoteParticipants.length + (callMode ? 1 : 0)
  const hasLocalAudio = (localStream?.getAudioTracks().length ?? 0) > 0
  const showMicToggle = hasLocalAudio && (isAdmin || !mutedByAdmin)

  // Floating, draggable, non-blocking call panel (Teams-style): the chat stays
  // fully usable underneath — no full-screen backdrop, can be minimized.
  const modal = callMode ? (
    <div
      data-call-panel
      dir="rtl"
      className="fixed z-[60] w-[min(94vw,420px)] overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-2xl"
      style={callPos ? { left: callPos.x, top: callPos.y, right: 'auto', bottom: 'auto' } : { left: 16, top: 96 }}
    >
      <div
        onPointerDown={beginDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        className="flex cursor-move touch-none select-none items-center justify-between gap-2 bg-gradient-to-l from-emerald-700 via-teal-700 to-cyan-700 px-3 py-2 text-white"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-black">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">{callMode === 'video' ? `غرفة فيديو · ${title}` : `غرفة صوت · ${title}`}</span>
          </div>
          <div className="truncate text-[11px] text-white/80">{status} · المشاركون: {participantCount}{mutedByAdmin ? ' · مكتوم' : ''}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isAdmin && callMode === 'video' && !minimized ? (
            <button type="button" onClick={() => { void (screenSharing ? stopScreenShare() : startScreenShare()) }} title={screenSharing ? 'إيقاف مشاركة الشاشة' : 'مشاركة الشاشة'} className={cn('rounded-full p-2 transition hover:bg-white/25', screenSharing ? 'bg-white/35' : 'bg-white/15')}>
              <ScreenShare className="h-4 w-4" />
            </button>
          ) : null}
          <button type="button" onClick={() => setMinimized((value) => !value)} title={minimized ? 'تكبير' : 'تصغير'} className="rounded-full bg-white/15 p-2 transition hover:bg-white/25">
            {minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => resetCall(true)} title="إنهاء المكالمة" className="rounded-full bg-rose-500/90 p-2 transition hover:bg-rose-600">
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!minimized ? (
        <div className="space-y-3 p-3 text-center">
          {callError ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <span>{callError}</span>
              <Button type="button" size="sm" onClick={() => { void startCall(callMode) }} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">إعادة المحاولة</Button>
            </div>
          ) : null}
          {deviceNotice ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <span>{deviceNotice}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => { localStreamRef.current = null; void startCall(callMode) }} className="rounded-xl border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
                إعادة المحاولة بالكاميرا/الميكروفون
              </Button>
            </div>
          ) : null}

          {isAdmin && handRequests.length > 0 ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-2.5 text-right text-xs text-amber-950">
              <div className="mb-1.5 font-black">طلبات رفع اليد</div>
              <div className="flex flex-wrap gap-1.5">
                {handRequests.map((request) => (
                  <button key={request.clientId} type="button" onClick={() => grantMic(request.clientId)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-bold shadow-sm hover:bg-amber-100">
                    <Hand className="h-3.5 w-3.5" /> {request.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {callMode === 'video' ? (
            <div className="grid max-h-[44vh] grid-cols-2 gap-2 overflow-y-auto">
              <div className="relative col-span-2 overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
                <video ref={localVideoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
                <span className="absolute bottom-1.5 right-2 rounded bg-black/50 px-1.5 text-[11px] font-bold text-white">أنت</span>
              </div>
              {remoteParticipants.map((participant) => (
                <div key={participant.clientId} className="relative overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
                  {participant.stream ? <RemoteVideo stream={participant.stream} /> : <div className="flex aspect-video items-center justify-center text-white/70"><Video className="h-6 w-6" /></div>}
                  <span className="absolute bottom-1.5 right-2 max-w-[80%] truncate rounded bg-black/50 px-1.5 text-[11px] font-bold text-white">{participant.name}</span>
                  {isAdmin ? (
                    <button type="button" onClick={() => toggleParticipantMute(participant.clientId)} className="absolute left-1.5 top-1.5 rounded-full bg-black/50 p-1 text-white hover:bg-black/70" title={adminMutedClients.has(participant.clientId) ? 'فتح الميكروفون' : 'كتم الميكروفون'}>
                      {adminMutedClients.has(participant.clientId) ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid max-h-[40vh] grid-cols-2 gap-2 overflow-y-auto">
              <div className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-cyan-50 text-emerald-900">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white"><Mic className="h-4 w-4" /></div>
                <p className="text-xs font-black">أنت</p>
              </div>
              {remoteParticipants.map((participant) => (
                <div key={participant.clientId} className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-br from-slate-100 to-emerald-50 text-slate-900">
                  {participant.stream ? <RemoteAudio stream={participant.stream} /> : null}
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white"><Phone className="h-4 w-4" /></div>
                  <p className="max-w-full truncate px-1 text-xs font-black">{participant.name}</p>
                  {isAdmin ? (
                    <button type="button" onClick={() => toggleParticipantMute(participant.clientId)} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-900 hover:bg-emerald-50">
                      {adminMutedClients.has(participant.clientId) ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                      {adminMutedClients.has(participant.clientId) ? 'فتح' : 'كتم'}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 border-t pt-3">
            {showMicToggle ? (
              <Button type="button" variant="outline" onClick={toggleMic} className={cn('gap-1.5 rounded-2xl', micEnabled ? '' : 'border-rose-300 bg-rose-50 text-rose-700')}>
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                {micEnabled ? 'كتم الميكروفون' : 'فتح الميكروفون'}
              </Button>
            ) : null}
            {!isAdmin ? (
              <Button type="button" variant="outline" onClick={raiseHand} disabled={handRaised} className="gap-1.5 rounded-2xl border-amber-300 bg-amber-50 font-bold text-amber-900 hover:bg-amber-100">
                <Hand className="h-4 w-4" /> {handRaised ? 'تم رفع اليد' : 'رفع اليد'}
              </Button>
            ) : null}
            <Button type="button" onClick={() => resetCall(true)} className="gap-1.5 rounded-2xl bg-rose-600 px-5 hover:bg-rose-700">
              <PhoneOff className="h-4 w-4" /> إنهاء
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  ) : null

  return { startCall, modal, active: Boolean(callMode) }
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline className="aspect-video w-full object-cover" />
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay />
}
