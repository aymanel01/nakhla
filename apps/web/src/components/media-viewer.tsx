import type { ComponentType, ReactNode } from 'react'
import { CheckCircle2, Download, ExternalLink, FileText, Play } from 'lucide-react'
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

/**
 * Clean, YouTube-style media viewer used by both the digital library and the
 * student-creations sections. The media sits in a single framed surface with no
 * hover overlay so it stays fully visible and interactive.
 */
export function MediaViewer({ media, title, className }: { media: MediaSource; title?: string; className?: string }) {
  const kind = getMediaKind(media)
  const fileUrl = media.fileUrl || ''
  const fileName = media.fileName || ''

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
      <div className={cn('flex flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 px-6 py-10 shadow-inner', className)}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Play className="h-7 w-7" />
        </div>
        <audio src={fileUrl} controls className="w-full max-w-xl">
          <track kind="captions" />
        </audio>
      </div>
    )
  }

  // PDF and plain-text both render natively in an iframe (the API now sends the
  // correct Content-Type), so they preview inline like a YouTube-style frame.
  if (kind === 'pdf' || kind === 'text') {
    return (
      <div className={cn('overflow-hidden rounded-2xl border bg-white shadow-sm', className)}>
        <iframe src={fileUrl} title={fileName || title || 'document'} className="h-[80vh] w-full border-0" />
      </div>
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
  description,
  thumbnailUrl,
  media,
  completed,
  icon: Icon,
  onOpen,
}: {
  title: string
  badge?: string
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
