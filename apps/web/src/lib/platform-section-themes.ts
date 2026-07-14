export type PlatformSectionKey =
  | 'groups'
  | 'chat'
  | 'exercises'
  | 'quizzes'
  | 'important-content'
  | 'resources'
  | 'lectures'

export interface PlatformSectionTheme {
  key: PlatformSectionKey
  path: `/${string}`
  title: string
  image: string
  border: string
  shadow: string
  accent: string
  from: string
  via: string
  gradientTo: string
  softBg: string
  buttonGradient: string
  buttonOutline: string
  buttonRing: string
  bannerImage: string
}

export const platformSectionThemes: PlatformSectionTheme[] = [
  {
    key: 'groups',
    path: '/groups',
    title: 'مجموعتنا',
    image: '/section-images/card-groups.jpg',
    bannerImage: '/section-images/groups-banner.jpg',
    border: 'border-red-300',
    shadow: 'shadow-red-200/60',
    accent: '#b91c1c',
    from: '#b91c1c',
    via: '#ef4444',
    gradientTo: '#fecaca',
    softBg: 'linear-gradient(180deg, rgba(185,28,28,0.10) 0%, rgba(255,255,255,0.97) 28%)',
    buttonGradient:
      'bg-gradient-to-r from-[#b91c1c] via-[#ef4444] to-[#fecaca] text-[#7f1d1d] shadow-[0_14px_30px_rgba(185,28,28,0.22)]',
    buttonOutline: 'border-[#fca5a5] bg-white text-[#991b1b] hover:bg-[#fef2f2]',
    buttonRing: 'focus-visible:ring-[#ef4444]',
  },
  {
    key: 'chat',
    path: '/chat',
    title: 'المحادثة',
    image: '/section-images/card-chat.jpg',
    bannerImage: '/section-images/chat-banner.jpg',
    border: 'border-violet-300',
    shadow: 'shadow-violet-200/60',
    accent: '#7c3aed',
    from: '#7c3aed',
    via: '#a78bfa',
    gradientTo: '#ddd6fe',
    softBg: 'linear-gradient(180deg, rgba(124,58,237,0.10) 0%, rgba(255,255,255,0.97) 28%)',
    buttonGradient:
      'bg-gradient-to-r from-[#7c3aed] via-[#a78bfa] to-[#ddd6fe] text-[#4c1d95] shadow-[0_14px_30px_rgba(124,58,237,0.22)]',
    buttonOutline: 'border-[#c4b5fd] bg-white text-[#5b21b6] hover:bg-[#f5f3ff]',
    buttonRing: 'focus-visible:ring-[#a78bfa]',
  },
  {
    key: 'exercises',
    path: '/exercises',
    title: 'تقويم الوحدة',
    image: '/section-images/card-exercises.jpg',
    bannerImage: '/section-images/evaluation-banner.jpg',
    border: 'border-green-300',
    shadow: 'shadow-green-200/60',
    accent: '#16a34a',
    from: '#16a34a',
    via: '#4ade80',
    gradientTo: '#bbf7d0',
    softBg: 'linear-gradient(180deg, rgba(22,163,74,0.10) 0%, rgba(255,255,255,0.97) 28%)',
    buttonGradient:
      'bg-gradient-to-r from-[#16a34a] via-[#4ade80] to-[#bbf7d0] text-[#14532d] shadow-[0_14px_30px_rgba(22,163,74,0.22)]',
    buttonOutline: 'border-[#86efac] bg-white text-[#166534] hover:bg-[#f0fdf4]',
    buttonRing: 'focus-visible:ring-[#4ade80]',
  },
  {
    key: 'quizzes',
    path: '/quizzes',
    title: 'أبواب القصر',
    image: '/section-images/card-quiz.jpg',
    bannerImage: '/section-images/quiz-banner.jpg',
    border: 'border-orange-300',
    shadow: 'shadow-orange-200/60',
    accent: '#ea580c',
    from: '#ea580c',
    via: '#fb923c',
    gradientTo: '#fed7aa',
    softBg: 'linear-gradient(180deg, rgba(234,88,12,0.10) 0%, rgba(255,255,255,0.97) 28%)',
    buttonGradient:
      'bg-gradient-to-r from-[#ea580c] via-[#fb923c] to-[#fed7aa] text-[#9a3412] shadow-[0_14px_30px_rgba(234,88,12,0.22)]',
    buttonOutline: 'border-[#fdba74] bg-white text-[#9a3412] hover:bg-[#fff7ed]',
    buttonRing: 'focus-visible:ring-[#fb923c]',
  },
  {
    key: 'important-content',
    path: '/important-content',
    title: 'المجال الاجتماعي والاقتصادي',
    image: '/section-images/card-social-economic.jpg',
    bannerImage: '/section-images/social-economic-banner.jpg',
    border: 'border-blue-300',
    shadow: 'shadow-blue-200/60',
    accent: '#2563eb',
    from: '#2563eb',
    via: '#60a5fa',
    gradientTo: '#bfdbfe',
    softBg: 'linear-gradient(180deg, rgba(37,99,235,0.10) 0%, rgba(255,255,255,0.97) 28%)',
    buttonGradient:
      'bg-gradient-to-r from-[#2563eb] via-[#60a5fa] to-[#bfdbfe] text-[#1e3a8a] shadow-[0_14px_30px_rgba(37,99,235,0.22)]',
    buttonOutline: 'border-[#93c5fd] bg-white text-[#1d4ed8] hover:bg-[#eff6ff]',
    buttonRing: 'focus-visible:ring-[#60a5fa]',
  },
  {
    key: 'resources',
    path: '/resources',
    title: 'إبداعاتنا',
    image: '/section-images/card-creativity.jpg',
    bannerImage: '/section-images/creativity-banner.jpg',
    border: 'border-amber-300',
    shadow: 'shadow-amber-200/60',
    accent: '#d97706',
    from: '#d97706',
    via: '#fbbf24',
    gradientTo: '#fde68a',
    softBg: 'linear-gradient(180deg, rgba(217,119,6,0.10) 0%, rgba(255,255,255,0.97) 28%)',
    buttonGradient:
      'bg-gradient-to-r from-[#d97706] via-[#fbbf24] to-[#fde68a] text-[#78350f] shadow-[0_14px_30px_rgba(217,119,6,0.22)]',
    buttonOutline: 'border-[#fcd34d] bg-white text-[#92400e] hover:bg-[#fffbeb]',
    buttonRing: 'focus-visible:ring-[#fbbf24]',
  },
  {
    key: 'lectures',
    path: '/lectures',
    title: 'المكتبة الرقمية',
    image: '/section-images/card-library.jpg',
    bannerImage: '/section-images/library-banner.jpg',
    border: 'border-pink-300',
    shadow: 'shadow-pink-200/60',
    accent: '#db2777',
    from: '#db2777',
    via: '#f472b6',
    gradientTo: '#fbcfe8',
    softBg: 'linear-gradient(180deg, rgba(219,39,119,0.10) 0%, rgba(255,255,255,0.97) 28%)',
    buttonGradient:
      'bg-gradient-to-r from-[#db2777] via-[#f472b6] to-[#fbcfe8] text-[#831843] shadow-[0_14px_30px_rgba(219,39,119,0.20)]',
    buttonOutline: 'border-[#f9a8d4] bg-white text-[#9d174d] hover:bg-[#fdf2f8]',
    buttonRing: 'focus-visible:ring-[#f472b6]',
  },
]

const themeByPath = new Map(platformSectionThemes.map((theme) => [theme.path, theme]))
const themeByKey = new Map(platformSectionThemes.map((theme) => [theme.key, theme]))

export function getSectionThemeByPath(pathname: string): PlatformSectionTheme | null {
  if (themeByPath.has(pathname)) return themeByPath.get(pathname)!
  for (const theme of platformSectionThemes) {
    if (pathname.startsWith(`${theme.path}/`)) return theme
  }
  return null
}

export function getSectionThemeByKey(key: PlatformSectionKey): PlatformSectionTheme {
  return themeByKey.get(key)!
}
