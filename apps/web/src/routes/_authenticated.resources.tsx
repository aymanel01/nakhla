import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { StudentCreation, StudentCreationType } from '@teaching-app/shared'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, Download, Image, Loader2, Mic, Palette, PanelsTopLeft } from 'lucide-react'
import { SectionBanner, ThemedActionButton, sectionThemeMap } from '@/components/section-banner'
import { MediaCard, MediaViewer } from '@/components/media-viewer'

export const Route = createFileRoute('/_authenticated/resources')({
  component: StudentCreationsPage,
})

const creationTypes: { type: StudentCreationType; title: string; icon: typeof Palette; description: string }[] = [
  { type: 'بودكاست', title: 'بودكاست', icon: Mic, description: 'إبداعات صوتية من إنجاز التلاميذ.' },
  { type: 'قصص مصورة', title: 'قصص مصورة', icon: PanelsTopLeft, description: 'قصص مرئية ورسومات متسلسلة.' },
  { type: 'قصص قصيرة', title: 'قصص قصيرة', icon: BookOpen, description: 'كتابات قصيرة وأعمال سردية.' },
  { type: 'صورة و تعليق', title: 'صورة و تعليق', icon: Image, description: 'صور مرفقة بتعليقات وأفكار.' },
]

function StudentCreationsPage() {
  const [creations, setCreations] = useState<StudentCreation[]>([])
  const [selectedType, setSelectedType] = useState<StudentCreationType>(creationTypes[0].type)
  const [selectedCreation, setSelectedCreation] = useState<StudentCreation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ creations: StudentCreation[] }>('/student-creations')
      .then(({ creations }) => setCreations(creations))
      .finally(() => setLoading(false))
  }, [])

  const filteredCreations = useMemo(
    () => creations.filter((creation) => creation.type === selectedType),
    [creations, selectedType]
  )

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (selectedCreation) {
    const fileUrl = selectedCreation.fileUrl
    const fileName = selectedCreation.fileName || ''
    return (
      <div className="space-y-4" dir="rtl">
        <SectionBanner imageSrc={sectionThemeMap.resources.image} alt="إبداعات التلاميذ" />
        <Button variant="outline" onClick={() => setSelectedCreation(null)}>العودة للقائمة</Button>
        <Card>
          <CardHeader>
            <CardTitle>{selectedCreation.title}</CardTitle>
            <CardDescription>{selectedCreation.type} • {new Date(selectedCreation.createdAt).toLocaleDateString('ar-MA')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MediaViewer media={selectedCreation} title={selectedCreation.title} />
            {selectedCreation.description && (
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{selectedCreation.description}</p>
            )}
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
    <div className="w-full space-y-4 pb-4" dir="rtl">
      <SectionBanner imageSrc={sectionThemeMap.resources.image} alt="إبداعات التلاميذ" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {creationTypes.map(({ type, title, icon: Icon }) => (
          <ThemedActionButton key={type} type="button" theme="resources" active={selectedType === type} className="w-full justify-start p-4 text-right" onClick={() => setSelectedType(type)}>
            <Icon className="h-5 w-5" />
            {title}
          </ThemedActionButton>
        ))}
      </section>

      {filteredCreations.length === 0 ? (
        <Card className="rounded-[30px] border-dashed bg-white/80 text-center shadow-sm">
          <CardContent className="p-10 text-muted-foreground">لا توجد إبداعات منشورة بعد.</CardContent>
        </Card>
      ) : (
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredCreations.map((creation) => {
            const Icon = creationTypes.find((item) => item.type === creation.type)?.icon
            return (
              <MediaCard
                key={creation.id}
                title={creation.title}
                badge={`${creation.type} • ${new Date(creation.createdAt).toLocaleDateString('ar-MA')}`}
                description={creation.description}
                thumbnailUrl={creation.thumbnailUrl}
                media={creation}
                icon={Icon}
                onOpen={() => setSelectedCreation(creation)}
              />
            )
          })}
        </section>
      )}
    </div>
  )
}
