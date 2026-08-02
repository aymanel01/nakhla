import type { CSSProperties } from 'react'
import type {
  PlatformHelperConfig,
  PlatformHelperCorner,
  PlatformHelperPosition,
  PlatformHelperSectionConfig,
} from '@teaching-app/shared'
import { platformHelperTips } from '@/lib/platform-helper-tips'

export const HELPER_PAGE_OPTIONS: { path: string; label: string }[] = [
  { path: '/home', label: 'الرئيسية' },
  { path: '/important-content', label: 'المجالات' },
  { path: '/exercises', label: 'تقويم الوحدة' },
  { path: '/groups', label: 'المجموعات' },
  { path: '/resources', label: 'إبداعات التلاميذ' },
  { path: '/lectures', label: 'المكتبة الرقمية' },
  { path: '/chat', label: 'المحادثة' },
  { path: '/quizzes', label: 'أبواب القصر' },
  { path: '/admin', label: 'لوحة التحكم' },
  { path: '__default__', label: 'باقي الصفحات (افتراضي)' },
]

export const HELPER_CORNER_OPTIONS: { value: PlatformHelperCorner; label: string }[] = [
  { value: 'bottom-left', label: 'أسفل اليسار' },
  { value: 'bottom-right', label: 'أسفل اليمين' },
  { value: 'top-left', label: 'أعلى اليسار' },
  { value: 'top-right', label: 'أعلى اليمين' },
]

export function buildDefaultPlatformHelperConfig(): PlatformHelperConfig {
  const sections: Record<string, PlatformHelperSectionConfig> = {}
  for (const [path, section] of Object.entries(platformHelperTips)) {
    sections[path] = { greeting: section.greeting, tips: [...section.tips] }
  }
  sections.__default__ = {
    greeting: 'مرحبًا! أنا مرشد نخلة، هنا لمساعدتك.',
    tips: [
      'استخدم شريط الأقسام في الأعلى للانتقال بين صفحات المنصة.',
      'اضغط على «فيديو توضيحي» إن وُجد لشرح الصفحة الحالية.',
      'إذا احتجت مساعدة، ارجع للرئيسية واختر القسم المناسب.',
    ],
  }

  return {
    enabled: true,
    position: {
      corner: 'bottom-left',
      offsetX: 12,
      offsetY: 12,
      bubbleLift: 42,
    },
    sections,
  }
}

export function parsePlatformHelperConfig(raw: string | null | undefined): PlatformHelperConfig | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as PlatformHelperConfig
    if (!parsed || typeof parsed !== 'object') return null
    return mergePlatformHelperConfig(parsed)
  } catch {
    return null
  }
}

export function mergePlatformHelperConfig(partial: Partial<PlatformHelperConfig>): PlatformHelperConfig {
  const defaults = buildDefaultPlatformHelperConfig()
  return {
    enabled: partial.enabled ?? defaults.enabled,
    position: {
      corner: partial.position?.corner ?? defaults.position.corner,
      offsetX: Number.isFinite(partial.position?.offsetX) ? partial.position!.offsetX : defaults.position.offsetX,
      offsetY: Number.isFinite(partial.position?.offsetY) ? partial.position!.offsetY : defaults.position.offsetY,
      bubbleLift: Number.isFinite(partial.position?.bubbleLift) ? partial.position!.bubbleLift : defaults.position.bubbleLift,
    },
    sections: {
      ...defaults.sections,
      ...(partial.sections || {}),
    },
  }
}

export function resolveHelperSection(
  pathname: string,
  config: PlatformHelperConfig | null,
): PlatformHelperSectionConfig {
  const fallback = getPlatformHelperSection(pathname)
  if (!config) return fallback

  const exact = config.sections[pathname]
  if (exact?.greeting && exact.tips?.length) return exact

  const prefix = Object.keys(config.sections).find(
    (path) => path !== '__default__' && path !== '/' && pathname.startsWith(`${path}/`),
  )
  if (prefix && config.sections[prefix]?.tips?.length) return config.sections[prefix]

  if (config.sections.__default__?.tips?.length) return config.sections.__default__

  return fallback
}

function getPlatformHelperSection(pathname: string): PlatformHelperSectionConfig {
  const exact = platformHelperTips[pathname]
  if (exact) return exact

  const prefix = Object.keys(platformHelperTips).find(
    (path) => path !== '/' && pathname.startsWith(`${path}/`),
  )
  if (prefix) return platformHelperTips[prefix]!

  return platformHelperTips['/home']
    ? { greeting: 'مرحبًا!', tips: ['استكشف المنصة من شريط الأقسام.'] }
    : { greeting: 'مرحبًا!', tips: ['مرحبًا بك في منصة نخلة.'] }
}

export function getHelperPositionStyle(position: PlatformHelperPosition): CSSProperties {
  const style: CSSProperties = {
    position: 'fixed',
    zIndex: 75,
  }

  if (position.corner.includes('bottom')) {
    style.bottom = `${position.offsetY}px`
  } else {
    style.top = `${position.offsetY}px`
  }

  if (position.corner.includes('left')) {
    style.left = `${position.offsetX}px`
  } else {
    style.right = `${position.offsetX}px`
  }

  return style
}

export function isHelperMirrored(corner: PlatformHelperCorner) {
  return corner === 'bottom-right' || corner === 'top-right'
}

export function serializePlatformHelperConfig(config: PlatformHelperConfig) {
  return JSON.stringify(config)
}
