import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { Lecture } from '@teaching-app/shared'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, CheckCircle2, Download, Headphones, Loader2, Mic, PanelsTopLeft, PlayCircle, Star } from 'lucide-react'
import { SectionBanner, ThemedActionButton, sectionThemeMap } from '@/components/section-banner'
import { MediaCard, MediaViewer } from '@/components/media-viewer'

export const Route = createFileRoute('/_authenticated/lectures')({
  component: LecturesPage,
})

const libraryTypes = [
  { type: 'قصص', title: 'قصص', icon: BookOpen },
  { type: 'قصص مرقمنة', title: 'قصص مرقمنة', icon: Headphones },
  { type: 'قصص مصورة', title: 'قصص مصورة', icon: PanelsTopLeft },
  { type: 'بودكاست', title: 'بودكاست', icon: Mic },
  { type: 'لغتي', title: 'لغتي', icon: Star },
  { type: 'الدرس المفضل', title: 'الدرس المفضل', icon: Star },
] as const

type LibraryType = typeof libraryTypes[number]['type']

function getLibraryType(lecture: Lecture): LibraryType {
  return (libraryTypes.find((item) => item.type === lecture.keyPoints)?.type || 'قصص') as LibraryType
}

function LecturesPage() {
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
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {libraryTypes.map(({ type, title, icon: Icon }) => (
          <ThemedActionButton key={type} type="button" theme="lectures" active={selectedType === type} className="w-full justify-start p-4 text-right" onClick={() => setSelectedType(type)}>
            <Icon className="h-5 w-5" />
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
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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
