import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { Lecture } from '@teaching-app/shared'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookMarked, BookOpen, CheckCircle2, Download, Loader2, Mic, PlayCircle, Star } from 'lucide-react'
import { SectionBanner, ThemedActionButton, sectionThemeMap } from '@/components/section-banner'
import { MediaCard, MediaViewer } from '@/components/media-viewer'

export const Route = createFileRoute('/_authenticated/lectures')({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search.open
    const open = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : undefined
    return Number.isInteger(open) && open! > 0 ? { open: open! } : {}
  },
  component: LecturesPage,
})

const libraryTypes = [
  { type: 'قصص', title: 'قصص', icon: BookOpen },
  { type: 'بودكاست', title: 'بودكاست', icon: Mic },
  { type: 'لغتي', title: 'لغتي', icon: Star },
  { type: 'بنك الكلمات', title: 'بنك الكلمات', icon: BookMarked },
] as const

type LibraryType = typeof libraryTypes[number]['type']

function getLibraryType(lecture: Lecture): LibraryType {
  const keyPoints = lecture.keyPoints
  if (keyPoints === 'قصص مرقمنة' || keyPoints === 'قصص مصورة') return 'قصص'
  if (keyPoints === 'الدرس المفضل') return 'بنك الكلمات'
  return (libraryTypes.find((item) => item.type === keyPoints)?.type || 'قصص') as LibraryType
}

function LecturesPage() {
  const { open } = Route.useSearch()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null)
  const [selectedType, setSelectedType] = useState<LibraryType>(libraryTypes[0].type)
  const [completedLectureIds, setCompletedLectureIds] = useState<Set<number>>(new Set())

  const loadLectures = async () => {
    const { lectures } = await api.get<{ lectures: Lecture[] }>('/lectures')
    setLectures(lectures)
    const progressResponse = await api.get<{ progress: { itemType: string; itemId: string }[] }>('/progress/me').catch(() => ({ progress: [] }))
    setCompletedLectureIds(new Set(progressResponse.progress.filter((item) => item.itemType === 'lecture').map((item) => Number(item.itemId))))
    if (selectedLecture) {
      const fresh = lectures.find((lecture) => lecture.id === selectedLecture.id)
      setSelectedLecture(fresh ?? null)
    }
  }

  useEffect(() => {
    loadLectures().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open || lectures.length === 0) return
    const lecture = lectures.find((item) => item.id === open)
    if (!lecture) return
    setSelectedLecture(lecture)
    setSelectedType(getLibraryType(lecture))
  }, [open, lectures])

  const filteredLectures = useMemo(() => lectures.filter((lecture) => getLibraryType(lecture) === selectedType), [lectures, selectedType])

  useEffect(() => {
    if (!selectedLecture || completedLectureIds.has(selectedLecture.id)) return
    api.post('/progress/content', { itemType: 'lecture', itemId: String(selectedLecture.id) })
      .then(() => setCompletedLectureIds((prev) => new Set(prev).add(selectedLecture.id)))
      .catch(() => {})
  }, [selectedLecture, completedLectureIds])

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (selectedLecture) {
    const fileUrl = selectedLecture.fileUrl
    const fileName = selectedLecture.fileName || ''
    return (
      <div className="space-y-4">
        <SectionBanner imageSrc={sectionThemeMap.lectures.image} alt="المكتبة الرقمية" />
        <Button variant="outline" onClick={() => setSelectedLecture(null)}>العودة للقائمة</Button>
        <Card>
          <CardHeader>
            <CardTitle>{selectedLecture.title}</CardTitle>
            <CardDescription>{selectedLecture.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MediaViewer media={selectedLecture} title={selectedLecture.title} />

            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
              يتم تسجيل هذا العنصر تلقائياً في تقدم الطلاب
            </div>

            {fileUrl && (
              <div>
                <Button asChild variant="outline" className="gap-2">
                  <a href={fileUrl} download={fileName || undefined}>
                    <Download className="h-4 w-4" />
                    تحميل
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4" dir="rtl">
      <SectionBanner imageSrc={sectionThemeMap.lectures.image} alt="المكتبة الرقمية" />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {libraryTypes.map(({ type, title, icon: Icon }) => (
          <ThemedActionButton key={type} type="button" theme="lectures" active={selectedType === type} className="flex w-full items-center justify-center gap-2 p-4 text-center sm:justify-start sm:text-right" onClick={() => setSelectedType(type)}>
            <Icon className="h-5 w-5 shrink-0" />
            {title}
          </ThemedActionButton>
        ))}
      </section>

      {lectures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <PlayCircle className="mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">لا توجد عناصر حالياً</h3>
            <p className="text-muted-foreground">سيتم إضافة محتوى المكتبة الرقمية قريباً</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-6">
          {filteredLectures.map((lecture) => {
            const Icon = libraryTypes.find((item) => item.type === getLibraryType(lecture))?.icon
            return (
              <MediaCard
                key={lecture.id}
                title={lecture.title}
                badge={getLibraryType(lecture)}
                description={lecture.description}
                thumbnailUrl={lecture.thumbnailUrl}
                media={lecture}
                completed={completedLectureIds.has(lecture.id)}
                icon={Icon}
                onOpen={() => setSelectedLecture(lecture)}
              />
            )
          })}
        </div>
      )}
      {lectures.length > 0 && filteredLectures.length === 0 && (
        <Card className="rounded-[30px] border-dashed bg-white/80 text-center shadow-sm">
          <CardContent className="p-10 text-muted-foreground">لا توجد عناصر في هذا القسم حالياً.</CardContent>
        </Card>
      )}
    </div>
  )
}
