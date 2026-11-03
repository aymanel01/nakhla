import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from '@tanstack/react-router'
import { ChevronLeft, X } from 'lucide-react'
import type { PlatformHelperConfig } from '@teaching-app/shared'
import { PLATFORM_HELPER_CONFIG_CATEGORY } from '@teaching-app/shared'
import { api } from '@/lib/api'
import {
  getHelperPositionStyle,
  mergePlatformHelperConfig,
  parsePlatformHelperConfig,
  resolveHelperSection,
} from '@/lib/platform-helper-config'
import { playCardClickSound } from '@/lib/ui-sound'
import helperImage from '@/assets/nakhla-helper.png'

const FALLBACK_HELPER_IMAGE = '/branding/nakhla-helper.png'
const STORAGE_KEY = 'nakhla-helper-collapsed'

interface PlatformHelperProps {
  accent?: string
}

export function PlatformHelper({ accent = '#0f766e' }: PlatformHelperProps) {
  const location = useLocation()
  const [config, setConfig] = useState<PlatformHelperConfig | null>(null)
  const section = useMemo(
    () => resolveHelperSection(location.pathname, config),
    [location.pathname, config],
  )

  const [open, setOpen] = useState(true)
  const [tipIndex, setTipIndex] = useState(0)
  const [imageSrc, setImageSrc] = useState(helperImage)
  const [mounted, setMounted] = useState(false)
  const [peekOnly, setPeekOnly] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let alive = true
    api
      .get<{ posts: { category: string | null; content: string }[] }>(
        `/admin/content/social-economic?category=${encodeURIComponent(PLATFORM_HELPER_CONFIG_CATEGORY)}`,
      )
      .then(({ posts }) => {
        if (!alive) return
        const post = posts.find((item) => item.category === PLATFORM_HELPER_CONFIG_CATEGORY && item.content)
        const parsed = parsePlatformHelperConfig(post?.content)
        setConfig(parsed ? mergePlatformHelperConfig(parsed) : null)
      })
      .catch(() => {
        if (alive) setConfig(null)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setTipIndex(0)
    if (!peekOnly) setOpen(true)
  }, [location.pathname, peekOnly])

  if (!mounted) return null
  if (config && !config.enabled) return null

  const position = config?.position ?? {
    corner: 'bottom-left' as const,
    offsetX: 12,
    offsetY: 12,
    bubbleLift: 42,
  }
  const anchorLeft = position.corner.includes('left')
  const positionStyle = {
    ...getHelperPositionStyle(position),
    ...(location.pathname === '/quizzes' ? { zIndex: 92 } : {}),
  }
  const characterPointsLeft = anchorLeft

  const tip = section.tips[tipIndex] ?? section.tips[0]
  const hasMultipleTips = section.tips.length > 1

  const collapse = () => {
    playCardClickSound()
    setPeekOnly(true)
    setOpen(false)
    window.localStorage.setItem(STORAGE_KEY, '1')
  }

  const expand = () => {
    playCardClickSound()
    setPeekOnly(false)
    setOpen(true)
    window.localStorage.removeItem(STORAGE_KEY)
  }

  const showNextTip = () => {
    playCardClickSound()
    setTipIndex((prev) => (prev + 1) % section.tips.length)
  }

  const characterButton = (
    <button
      type="button"
      onClick={() => {
        if (peekOnly) expand()
        else setOpen((prev) => !prev)
      }}
      className="platform-helper-character pointer-events-auto relative flex h-[190px] w-[110px] shrink-0 items-end justify-center sm:h-[215px] sm:w-[125px]"
      aria-label={open && !peekOnly ? 'طي نصيحة المرشد' : 'فتح مرشد نخلة'}
    >
      <span className="platform-helper-float pointer-events-none flex items-end justify-center">
        <img
          src={imageSrc}
          alt="مرشد نخلة"
          width={339}
          height={581}
          onError={() => {
            if (imageSrc !== FALLBACK_HELPER_IMAGE) setImageSrc(FALLBACK_HELPER_IMAGE)
          }}
          className={`platform-helper-image block h-[168px] w-[98px] max-w-none object-contain object-bottom sm:h-[190px] sm:w-[110px] ${characterPointsLeft ? 'scale-x-[-1]' : ''}`}
          draggable={false}
        />
      </span>
      {peekOnly ? (
        <span
          className="pointer-events-none absolute top-0 left-1/2 flex -translate-x-1/2 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white shadow-md"
          style={{ backgroundColor: accent }}
        >
          مساعدة
        </span>
      ) : null}
    </button>
  )

  const speechBubble =
    open && !peekOnly ? (
      <div
        className={`platform-helper-bubble pointer-events-auto relative min-w-0 flex-1 rounded-[22px] border bg-white p-3 text-slate-900 shadow-[0_16px_40px_rgba(15,23,42,0.18)] platform-helper-bubble-in ${anchorLeft ? 'mr-1 sm:mr-2' : 'ml-1 sm:ml-2'}`}
        style={{
          borderColor: `${accent}33`,
          marginBottom: `${position.bubbleLift}px`,
        }}
        dir="rtl"
      >
        <span
          className={`platform-helper-bubble-tail pointer-events-none absolute bottom-[2.1rem] h-4 w-4 rotate-45 border-b bg-white sm:bottom-[2.35rem] ${anchorLeft ? '-right-2 border-r border-l-0' : '-left-2 border-l'}`}
          style={{ borderColor: `${accent}33` }}
          aria-hidden
        />

        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 text-right">
            <div className="text-[11px] font-bold" style={{ color: accent }}>
              مرشد نخلة
            </div>
            <div className="text-sm font-extrabold leading-6 text-slate-900">
              {section.greeting}
            </div>
          </div>
          <button
            type="button"
            onClick={collapse}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="إخفاء المرشد"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-right text-[13px] leading-6 text-slate-800">{tip}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          {hasMultipleTips ? (
            <button
              type="button"
              onClick={showNextTip}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition hover:bg-slate-100"
              style={{ color: accent }}
            >
              نصيحة أخرى
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span />
          )}
          <span className="text-[10px] font-bold text-slate-400">
            {tipIndex + 1} / {section.tips.length}
          </span>
        </div>
      </div>
    ) : null

  return createPortal(
    <div
      className="platform-helper pointer-events-none flex max-w-[min(420px,calc(100vw-20px))] items-end gap-0"
      style={positionStyle}
      dir="ltr"
      aria-live="polite"
    >
      {anchorLeft ? (
        <>
          {speechBubble}
          {characterButton}
        </>
      ) : (
        <>
          {characterButton}
          {speechBubble}
        </>
      )}
    </div>,
    document.body,
  )
}
