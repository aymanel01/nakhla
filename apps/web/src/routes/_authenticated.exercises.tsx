import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { Exercise, ExerciseSubmission, UnitEvaluationDomain } from '@teaching-app/shared'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle2, FileCheck2, FileText, Loader2, Paperclip, Send } from 'lucide-react'
import { SectionBanner, ThemedActionButton, sectionThemeMap } from '@/components/section-banner'

export const Route = createFileRoute('/_authenticated/exercises')({ component: ExercisesPage })

type UploadMeta = { fileUrl: string | null; fileName: string | null; fileType: string | null; fileSize: number | null }
type ExerciseTab = UnitEvaluationDomain | 'correction'

const tabs: { key: ExerciseTab; label: string; description: string }[] = [
  { key: 'social-economic', label: 'المجال الاجتماعي والاقتصادي', description: 'تقويم المجال الاجتماعي والاقتصادي' },
  { key: 'correction', label: 'تصحيح', description: 'تصحيح الأجوبة الخاصة بك' },
]

const domainLabels: Record<UnitEvaluationDomain, string> = {
  'social-economic': 'المجال الاجتماعي والاقتصادي',
}

function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [mySubmissions, setMySubmissions] = useState<ExerciseSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ExerciseTab>('social-economic')
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [answerFile, setAnswerFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const loadData = async () => {
    const [exercisesRes, submissionsRes] = await Promise.all([
      api.get<{ exercises: Exercise[] }>('/exercises'),
      api.get<{ submissions: ExerciseSubmission[] }>('/exercises/my-submissions').catch(() => ({ submissions: [] })),
    ])
    setExercises(exercisesRes.exercises)
    setMySubmissions(submissionsRes.submissions)
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  const groupedExercises = useMemo(() => {
    return exercises.reduce((acc, exercise) => {
      const key = exercise.domain || 'social-economic'
      if (!acc[key]) acc[key] = []
      acc[key].push(exercise)
      return acc
    }, {} as Record<UnitEvaluationDomain, Exercise[]>)
  }, [exercises])

  const handleSubmit = async () => {
    if (!selectedExercise || submitting || (!answerFile && Object.values(answers).every((answer) => !answer.trim()))) return
    setSubmitting(true)
    try {
      let uploaded: UploadMeta | null = null
      if (answerFile) {
        const fd = new FormData()
        fd.append('file', answerFile)
        uploaded = (await api.upload<{ file: UploadMeta }>('/uploads/submission', fd)).file
      }

      await api.post(`/exercises/${selectedExercise.id}/submit`, {
        answers,
        fileUrl: uploaded?.fileUrl,
        fileName: uploaded?.fileName,
        fileType: uploaded?.fileType,
        fileSize: uploaded?.fileSize,
      })
      setSubmitted(true)
      await loadData()
    } finally {
      setSubmitting(false)
    }
  }

  const openExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise)
    setAnswers({})
    setAnswerFile(null)
    setSubmitted(false)
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (selectedExercise) {
    if (submitted) {
      return (
        <Card className="rounded-[30px] border-emerald-100 bg-white/95 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="mb-4 h-16 w-16 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold">تم إرسال جوابك بنجاح!</h3>
            <p className="text-sm text-muted-foreground">سيظهر التصحيح في زر “تصحيح” عندما يرسله الأستاذ.</p>
            <Button className="mt-4" onClick={() => { setSelectedExercise(null); setAnswers({}); setAnswerFile(null); setSubmitted(false) }}>العودة لتقويم الوحدة</Button>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4" dir="rtl">
        <SectionBanner imageSrc={sectionThemeMap.exercises.image} alt="تقويم الوحدة" />
        <Button variant="outline" onClick={() => { setSelectedExercise(null); setAnswers({}); setAnswerFile(null) }}>العودة للقائمة</Button>
        <Card className="overflow-hidden rounded-[30px] border-emerald-100 bg-white/95 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-emerald-50 via-white to-cyan-50 text-right">
            <CardTitle>{selectedExercise.title}</CardTitle>
            <CardDescription>{selectedExercise.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-5">
            {selectedExercise.fileUrl && (
              <a href={selectedExercise.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">
                <Paperclip className="h-4 w-4" />
                {selectedExercise.fileName || 'فتح ملف التمرين'}
              </a>
            )}

            {selectedExercise.fields.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {selectedExercise.fields.map((field) => (
                  <div key={field.id} className="space-y-2 text-right">
                    <Label htmlFor={field.id}>{field.label}{field.required && <span className="mr-1 text-destructive">*</span>}</Label>
                    {field.type === 'textarea' ? (
                      <Textarea id={field.id} placeholder={field.placeholder} value={answers[field.id] || ''} onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} />
                    ) : (
                      <Input id={field.id} type={field.type} placeholder={field.placeholder} value={answers[field.id] || ''} onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-[24px] border border-dashed border-emerald-300 bg-emerald-50/40 p-5 text-right">
              <Label className="mb-2 block text-base font-extrabold text-emerald-900">رفع الجواب على شكل ملف</Label>
              <Input type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,video/*,audio/*" onChange={(e) => setAnswerFile(e.target.files?.[0] ?? null)} />
              {answerFile ? <p className="mt-2 text-sm font-semibold text-emerald-800">تم اختيار: {answerFile.name}</p> : <p className="mt-2 text-xs text-muted-foreground">يمكنك رفع صورة، PDF، Word، PowerPoint، ZIP أو أي ملف جواب.</p>}
            </div>

            <Button onClick={handleSubmit} disabled={submitting || (!answerFile && Object.values(answers).every((answer) => !answer.trim()))} className="w-full rounded-2xl bg-emerald-700 py-6 text-base hover:bg-emerald-800">
              {submitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}
              إرسال الجواب
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const visibleExercises = activeTab === 'correction' ? [] : (groupedExercises[activeTab] || [])

  return (
    <div className="w-full space-y-5" dir="rtl">
      <SectionBanner imageSrc={sectionThemeMap.exercises.image} alt="تقويم الوحدة" />
      <section className="grid gap-3 md:grid-cols-2">
        {tabs.map((tab) => (
          <ThemedActionButton
            key={tab.key}
            type="button"
            theme="exercises"
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="w-full flex-col items-start justify-center p-5 text-right"
          >
            <div className="w-full text-lg font-extrabold">{tab.label}</div>
            <div className={`mt-1 w-full text-sm ${activeTab === tab.key ? 'text-current/80' : 'text-slate-500'}`}>{tab.description}</div>
          </ThemedActionButton>
        ))}
      </section>

      {activeTab === 'correction' ? (
        <section className="space-y-4">
          {mySubmissions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileCheck2 className="mb-4 h-16 w-16 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">لا يوجد جواب مصحح حالياً</h3>
                <p className="text-muted-foreground">عندما يرسل الأستاذ التصحيح سيظهر هنا.</p>
              </CardContent>
            </Card>
          ) : mySubmissions.map((submission) => (
            <Card key={submission.id} className="platform-hover-card rounded-[26px] border-emerald-100 bg-white/95 shadow-sm">
              <CardContent className="space-y-3 p-5 text-right">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{submission.exerciseTitle || `تمرين #${submission.exerciseId}`}</h3>
                    <p className="text-sm text-muted-foreground">{submission.exerciseDomain ? domainLabels[submission.exerciseDomain] : 'تقويم الوحدة'} • {new Date(submission.submittedAt).toLocaleString('ar-MA')}</p>
                  </div>
                  {submission.fileUrl ? <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800"><Paperclip className="h-4 w-4" />جوابي</a> : null}
                </div>
                {submission.correctionText || submission.correctionFileUrl ? (
                  <div className="rounded-[22px] border border-green-200 bg-green-50 p-4">
                    <div className="mb-2 text-base font-extrabold text-green-800">تصحيح الأستاذ</div>
                    {submission.correctionText ? <p className="whitespace-pre-wrap text-sm leading-7 text-green-900">{submission.correctionText}</p> : null}
                    {submission.correctionFileUrl ? <a href={submission.correctionFileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-green-800"><Paperclip className="h-4 w-4" />{submission.correctionFileName || 'ملف التصحيح'}</a> : null}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">الجواب وصل للأستاذ، التصحيح لم يرسل بعد.</div>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <section className="space-y-4">
          {visibleExercises.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="mb-4 h-16 w-16 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">لا توجد تمارين في {domainLabels[activeTab]}</h3>
                <p className="text-muted-foreground">سيضيف الأستاذ التمارين من التحكم عن بعد.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleExercises.map((exercise) => (
                <Card key={exercise.id} className="platform-hover-card cursor-pointer rounded-[26px] border-emerald-100 transition-all hover:-translate-y-1 hover:shadow-lg" onClick={() => openExercise(exercise)}>
                  <CardHeader className="text-right">
                    <div className="mb-4 flex h-32 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-cyan-50"><FileText className="h-12 w-12 text-emerald-700" /></div>
                    <CardTitle className="text-lg">{exercise.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{exercise.description}</CardDescription>
                    {exercise.fileName && <div className="text-xs font-bold text-emerald-700">{exercise.fileName}</div>}
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
