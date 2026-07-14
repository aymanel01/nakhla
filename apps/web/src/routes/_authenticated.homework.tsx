import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { Homework, HomeworkSubmission } from '@teaching-app/shared'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ClipboardList, CheckCircle2, Loader2, Paperclip, Users, X } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/homework')({ component: HomeworkPage })

type UploadMeta = { fileUrl: string; fileName: string; fileType: string | null; fileSize: number | null }

export function HomeworkPage({ groupId, groupName }: { groupId?: number | null; groupName?: string | null } = {}) {
  const [homeworkList, setHomeworkList] = useState<Homework[]>([])
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null)
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submissionFile, setSubmissionFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const loadHomework = async () => {
    const endpoint = groupId ? `/homework?groupId=${groupId}` : '/homework'
    const { homework } = await api.get<{ homework: Homework[] }>(endpoint)
    setHomeworkList(homework)
    if (selectedHomework) {
      const fresh = homework.find((hw) => hw.id === selectedHomework.id)
      setSelectedHomework(fresh ?? null)
    }
  }

  useEffect(() => {
    loadHomework().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  const selectHomework = async (homework: Homework) => {
    setSelectedHomework(homework)
    setContent('')
    setSubmissionFile(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
    try {
      const { submissions } = await api.get<{ submissions: HomeworkSubmission[] }>(`/homework/${homework.id}/submissions`)
      setSubmissions(submissions)
    } catch {
      setSubmissions([])
    }
  }

  const handleSubmit = async () => {
    if (!selectedHomework || (!content.trim() && !submissionFile) || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      let uploaded: UploadMeta | null = null
      if (submissionFile) {
        if (submissionFile.size === 0) {
          setError('الملف فارغ. اختر ملفاً آخر.')
          return
        }
        const formData = new FormData()
        formData.append('file', submissionFile)
        const response = await api.upload<{ file: UploadMeta }>('/uploads/submission', formData)
        uploaded = response.file
      }

      await api.post(`/homework/${selectedHomework.id}/submit`, { content: content.trim(), ...(uploaded || {}) })
      setContent('')
      setSubmissionFile(null)
      if (fileRef.current) fileRef.current.value = ''
      const { submissions } = await api.get<{ submissions: HomeworkSubmission[] }>(`/homework/${selectedHomework.id}/submissions`)
      setSubmissions(submissions)
      alert('تم تسليم المشروع بنجاح')
    } catch (err) {
      console.error('Failed to submit homework:', err)
      setError('تعذر إرسال التسليم. حاول مرة أخرى.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (selectedHomework) {
    const isPastDue = selectedHomework.dueDate && new Date(selectedHomework.dueDate) < new Date()
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setSelectedHomework(null)}>العودة للمشاريع</Button>
        <Card>
          <CardHeader>
            <CardTitle>{selectedHomework.title}</CardTitle>
            <CardDescription>{selectedHomework.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {selectedHomework.groupName && <span className="rounded-full bg-muted px-3 py-1">مجموعة: {selectedHomework.groupName}</span>}
              {selectedHomework.dueDate && <span className={`rounded-full px-3 py-1 ${isPastDue ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>تسليم: {new Date(selectedHomework.dueDate).toLocaleString('ar-MA')}</span>}
            </div>

            {selectedHomework.fileUrl && (
              <a href={selectedHomework.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary">
                <Paperclip className="h-4 w-4" />{selectedHomework.fileName || 'فتح الملف'}
              </a>
            )}

            {selectedHomework.solution && isPastDue && (
              <div className="rounded-lg bg-green-50 p-4">
                <h3 className="mb-2 font-semibold text-green-900">الحل</h3>
                <p className="whitespace-pre-wrap text-green-800">{selectedHomework.solution}</p>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="font-semibold">تسليم المشروع</h3>
              {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              <Textarea placeholder="اكتب تسليمك هنا..." value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[150px]" />
              {submissionFile && (
                <div className="flex items-center justify-between rounded-2xl border bg-muted/50 px-3 py-2 text-sm">
                  <span className="truncate">{submissionFile.name}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setSubmissionFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input ref={fileRef} type="file" onChange={(e) => setSubmissionFile(e.target.files?.[0] ?? null)} className="hidden" />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                  <Paperclip className="h-4 w-4" />إرفاق وثيقة
                </Button>
                <Button onClick={handleSubmit} disabled={(!content.trim() && !submissionFile) || submitting} className="flex-1">
                  {submitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}
                  إرسال التسليم
                </Button>
              </div>
            </div>

            {submissions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">تسليماتك السابقة</h3>
                {submissions.map((submission) => (
                  <div key={submission.id} className="rounded-lg border p-4">
                    <div className="mb-2 text-xs text-muted-foreground">{new Date(submission.submittedAt).toLocaleString('ar-MA')}</div>
                    {submission.content && <p className="whitespace-pre-wrap text-sm">{submission.content}</p>}
                    {submission.fileUrl && (
                      <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-primary">
                        <Paperclip className="h-4 w-4" />{submission.fileName || 'فتح الوثيقة'}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const groupedHomework = homeworkList.reduce((acc, homework) => {
    const key = homework.groupName || 'بدون مجموعة'
    if (!acc[key]) acc[key] = []
    acc[key].push(homework)
    return acc
  }, {} as Record<string, Homework[]>)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">مشاريع المجموعات</h1>
        <p className="text-muted-foreground">
          {groupId ? `مشاريع مجموعة ${groupName || ''}` : 'كل مجموعة عندها مشاريعها الخاصة بلا اختلاط.'}
        </p>
      </div>

      {homeworkList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">لا توجد مشاريع حالياً</h3>
            <p className="text-muted-foreground">{groupId ? 'لا توجد مشاريع لهذه المجموعة بعد.' : 'سيتم إضافة مشاريع المجموعات قريباً'}</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedHomework).map(([group, items]) => (
          <section key={group} className="space-y-4">
            {!groupId && <h2 className="flex items-center gap-2 border-b pb-2 text-lg font-semibold"><Users className="h-5 w-5" />{group}</h2>}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((homework) => {
                const isPastDue = homework.dueDate && new Date(homework.dueDate) < new Date()
                return (
                  <Card key={homework.id} className="platform-hover-card cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg" onClick={() => selectHomework(homework)}>
                    <CardHeader>
                      <div className="mb-4 flex h-32 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5"><ClipboardList className="h-12 w-12 text-primary" /></div>
                      <CardTitle className="text-lg">{homework.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{homework.description}</CardDescription>
                      {homework.fileName && <div className="text-xs text-primary">{homework.fileName}</div>}
                      {homework.dueDate && <div className={`mt-2 text-xs ${isPastDue ? 'text-destructive' : 'text-muted-foreground'}`}>تسليم: {new Date(homework.dueDate).toLocaleDateString('ar')}{isPastDue && ' (انتهى)'}</div>}
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
