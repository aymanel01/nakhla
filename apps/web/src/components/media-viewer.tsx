import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { CheckCircle2, Download, ExternalLink, FileText, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** A media source shared by the digital library (lectures) and student creations sections. */
export interface MediaSource {
  youtubeUrl?: string | null
  fileUrl?: string | null
  fileType?: string | null
  fileName?: string | null
}

export type MediaKind = 'youtube' | 'video' | 'audio' | 'image' | 'pdf' | 'text' | 'office' | 'file' | 'none'

const EXT = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

const TEXT_EXT = new Set(['.txt', '.csv', '.md', '.log', '.json', '.xml', '.srt', '.vtt'])
const OFFICE_EXT = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf'])

export function extractYouTubeId(url?: string | null): string {
  if (!url) return ''
  const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  const match = url.match(regex)
  return match?.[1] || ''
}

export function getYouTubeThumbnail(url?: string | null): string | null {
  const id = extractYouTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

export function getMediaKind(media: MediaSource): MediaKind {
  if (extractYouTubeId(media.youtubeUrl)) return 'youtube'
  if (!media.fileUrl) return 'none'
  const type = media.fileType || ''
  const name = (media.fileName || media.fileUrl || '').toLowerCase()
  const ext = EXT(name)
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('image/')) return 'image'
  if (type === 'application/pdf' || ext === '.pdf') return 'pdf'
  if (type.startsWith('text/') || TEXT_EXT.has(ext)) return 'text'
  if (OFFICE_EXT.has(ext)) return 'office'
  return 'file'
}

/** Best-effort thumbnail for a grid card. */
export function getMediaThumbnail(media: MediaSource, thumbnailUrl?: string | null): string | null {
  if (thumbnailUrl) return thumbnailUrl
  const yt = getYouTubeThumbnail(media.youtubeUrl)
  if (yt) return yt
  if (getMediaKind(media) === 'image') return media.fileUrl ?? null
  return null
}

const AUDIO_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00'
  const total = Math.floor(value)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function AudioPlayerPanel({
  src,
  title,
  cover,
  className,
}: {
  src: string
  title?: string
  cover?: string | null
  className?: string
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = rate
  }, [rate])

  const seek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    const next = Math.min(Math.max(0, value), duration || audio.duration || 0)
    audio.currentTime = next
    setCurrent(next)
  }

  const skip = (delta: number) => {
    seek(current + delta)
  }

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        /* autoplay blocked */
      }
    } else {
      audio.pause()
    }
  }

  return (
    <div
      className={cn(
        'relative mx-auto min-h-[210px] max-w-xl overflow-hidden rounded-xl border shadow-md',
        !cover && 'bg-slate-950',
        className,
      )}
    >
      {cover ? (
        <>
          <img
            src={cover}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-slate-900/25"
            aria-hidden
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-slate-900 to-slate-950" aria-hidden />
      )}

      <div className="relative z-10 flex min-h-[210px] flex-col justify-end gap-3 px-3.5 py-4 sm:px-5 sm:py-4.5" dir="rtl">
        {title ? (
          <p className="text-center text-sm font-bold text-white/90">{title}</p>
        ) : null}

        <div className="flex items-center gap-2 text-white/80" dir="ltr">
          <span className="w-10 text-right text-[11px] tabular-nums">{formatAudioTime(current)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0)}
            step={0.1}
            value={Math.min(current, duration || current)}
            onChange={(event) => seek(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-white"
            aria-label="موضع التشغيل"
          />
          <span className="w-10 text-[11px] tabular-nums">{formatAudioTime(duration)}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => skip(-10)}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full bg-white/10 px-2.5 text-xs font-bold text-white transition hover:bg-white/20"
            aria-label="رجوع 10 ثوان"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            10
          </button>

          <button
            type="button"
            onClick={() => void toggle()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg transition hover:scale-105"
            aria-label={playing ? 'إيقاف' : 'تشغيل'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => skip(10)}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full bg-white/10 px-2.5 text-xs font-bold text-white transition hover:bg-white/20"
            aria-label="تقديم 10 ثوان"
          >
            <RotateCw className="h-3.5 w-3.5" />
            10
          </button>

          <label className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white">
            <span className="hidden sm:inline">السرعة</span>
            <select
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              className="cursor-pointer bg-transparent text-white outline-none"
              aria-label="سرعة التشغيل"
            >
              {AUDIO_SPEEDS.map((speed) => (
                <option key={speed} value={speed} className="text-slate-900">
                  {speed}x
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      >
        <track kind="captions" />
      </audio>
    </div>
  )
}

function isProtectedFileUrl(fileUrl: string) {
  return fileUrl.startsWith('/api/files/')
}

/** Auth-protected files must be fetched with cookies, then shown via blob URL. */
export function AuthenticatedFileFrame({
  fileUrl,
  title,
  className,
  minHeight = '80vh',
}: {
  fileUrl: string
  title?: string
  className?: string
  minHeight?: string
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isProtectedFileUrl(fileUrl)) {
      setBlobUrl(fileUrl)
      return
    }

    let alive = true
    let objectUrl: string | null = null

    fetch(fileUrl, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'الملف غير موجود' : 'تعذر تحميل الملف')
        }
        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        if (alive) {
          setBlobUrl(objectUrl)
          setError('')
        }
      })
      .catch((err) => {
        if (alive) {
          setBlobUrl(null)
          setError(err instanceof Error ? err.message : 'تعذر تحميل الملف')
        }
      })

    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fileUrl])

  if (error) {
    return (
      <div className={cn('flex min-h-[170px] items-center justify-center rounded-2xl border border-dashed bg-muted/30 p-6 text-center', className)}>
        <div>
          <div className="text-sm font-semibold text-destructive">{error}</div>
          <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline">
            فتح الملف في نافذة جديدة
          </a>
        </div>
      </div>
    )
  }

  if (!blobUrl) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-2xl border bg-white text-sm text-muted-foreground', className)}
        style={{ minHeight }}
      >
        جاري تحميل الملف...
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-white shadow-sm', className)}>
      <iframe src={blobUrl} title={title || 'document'} className="w-full border-0" style={{ minHeight }} />
    </div>
  )
}

/**
 * Clean, YouTube-style media viewer used by both the digital library and the
 * student-creations sections. The media sits in a single framed surface with no
 * hover overlay so it stays fully visible and interactive.
 */
export function MediaViewer({
  media,
  title,
  className,
  thumbnailUrl,
}: {
  media: MediaSource
  title?: string
  className?: string
  thumbnailUrl?: string | null
}) {
  const kind = getMediaKind(media)
  const fileUrl = media.fileUrl || ''
  const fileName = media.fileName || ''
  const cover = thumbnailUrl || null

  if (kind === 'none') return null

  if (kind === 'youtube') {
    const videoId = extractYouTubeId(media.youtubeUrl)
    return (
      <MediaFrame className={className}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title || 'video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </MediaFrame>
    )
  }

  if (kind === 'video') {
    return (
      <MediaFrame className={className}>
        <video src={fileUrl} controls controlsList="nodownload" className="h-full w-full bg-black object-contain" />
      </MediaFrame>
    )
  }

  if (kind === 'image') {
    return (
      <MediaFrame className={className} fit>
        <img src={fileUrl} alt={title || fileName} className="max-h-full max-w-full object-contain" />
      </MediaFrame>
    )
  }

  if (kind === 'audio') {
    return (
      <AudioPlayerPanel
        src={fileUrl}
        title={title || fileName || undefined}
        cover={cover}
        className={className}
      />
    )
  }

  if (kind === 'pdf' || kind === 'text') {
    return (
      <AuthenticatedFileFrame
        fileUrl={fileUrl}
        title={fileName || title || 'document'}
        className={className}
      />
    )
  }

  // Office documents (Word/Excel/PowerPoint) can't render natively in the browser
  // and our file endpoint is auth-protected, so an online viewer can't fetch it.
  // Show a clean document panel that opens the file with the OS app.
  const isOffice = kind === 'office'
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FileText className="h-8 w-8" />
      </div>
      <div>
        <p className="font-semibold">{fileName || 'ملف مرفق'}</p>
        <p className="text-sm text-muted-foreground">
          {isOffice ? 'مستند Office — افتحه أو حمّله لعرضه في التطبيق المناسب.' : 'هذا النوع من الملفات يُفتح في نافذة جديدة.'}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild className="gap-2">
          <a href={fileUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            فتح الملف
          </a>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <a href={fileUrl} download={fileName || undefined}>
            <Download className="h-4 w-4" />
            تحميل
          </a>
        </Button>
      </div>
    </div>
  )
}

/** Shared 16:9 surface so video / youtube / image all sit in the same clean frame. */
function MediaFrame({ children, className, fit }: { children: ReactNode; className?: string; fit?: boolean }) {
  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-lg',
        fit && 'flex items-center justify-center bg-slate-950/90',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Shared grid card used by both sections. Clicking the card (or the "view" button)
 * opens the item; the optional download button is shown when a file is attached.
 */
export function MediaCard({
  title,
  badge,
  meta,
  description,
  thumbnailUrl,
  media,
  completed,
  icon: Icon,
  onOpen,
}: {
  title: string
  badge?: string
  meta?: string
  description?: string | null
  thumbnailUrl?: string | null
  media: MediaSource
  completed?: boolean
  icon?: ComponentType<{ className?: string }>
  onOpen: () => void
}) {
  const thumb = getMediaThumbnail(media, thumbnailUrl)
  const kind = getMediaKind(media)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="feature-card-hover group flex flex-col overflow-hidden rounded-[30px] border-0 bg-white/90 text-right shadow-xl shadow-slate-200/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-muted">
        {thumb ? (
          <img src={thumb} alt={title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : kind === 'video' && media.fileUrl ? (
          <video src={media.fileUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : Icon ? (
          <Icon className="h-12 w-12 text-primary/70" />
        ) : (
          <FileText className="h-12 w-12 text-primary/70" />
        )}
        {(kind === 'youtube' || kind === 'video' || kind === 'audio') && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition group-hover:scale-110">
              <Play className="h-6 w-6 translate-x-0.5" />
            </span>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {badge && (
          <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{badge}</span>
        )}
        <h3 className="text-lg font-bold leading-snug">{title}</h3>
        {meta && <p className="text-xs font-semibold text-muted-foreground">{meta}</p>}
        {description && <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>}
        {completed && (
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            مكتملة
          </span>
        )}
      </div>
    </button>
  )
}
