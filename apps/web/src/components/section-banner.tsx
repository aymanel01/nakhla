import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { getSectionThemeByKey, type PlatformSectionKey } from '@/lib/platform-section-themes'

export type SectionThemeKey = PlatformSectionKey

export const sectionThemeMap = Object.fromEntries(
  (['groups', 'chat', 'exercises', 'quizzes', 'important-content', 'resources', 'lectures'] as const).map(
    (key) => {
      const theme = getSectionThemeByKey(key)
      return [
        key,
        {
          image: theme.bannerImage,
          buttonGradient: theme.buttonGradient,
          buttonOutline: theme.buttonOutline,
          buttonRing: theme.buttonRing,
        },
      ]
    },
  ),
) as Record<
  SectionThemeKey,
  { image: string; buttonGradient: string; buttonOutline: string; buttonRing: string }
>

export function SectionBanner({ imageSrc: _imageSrc, alt: _alt, className: _className }: { imageSrc: string; alt: string; className?: string }) {
  return null
}

export function ThemedActionButton({
  active,
  theme,
  className,
  children,
  ...props
}: {
  active: boolean
  theme: SectionThemeKey
  className?: string
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const palette = sectionThemeMap[theme]
  return (
    <button
      {...props}
      className={cn(
        'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[16px] border px-3 py-2 text-xs font-extrabold transition duration-300 hover:-translate-y-0.5',
        palette.buttonRing,
        active ? palette.buttonGradient : palette.buttonOutline,
        className,
      )}
    >
      {children}
    </button>
  )
}
