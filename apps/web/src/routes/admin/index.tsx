import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useState, useEffect, type ReactNode } from 'react'
import { useAuth } from '../__root'
import type { Lecture, Exercise, ExerciseSubmission, Quiz, User, Group, ExerciseField, QuizQuestion, Homework, HomeworkSubmission, QuizDifficulty, StudentCreation, StudentCreationType, UnitEvaluationDomain, StudentFullProgress, AdminSectionPost } from '@teaching-app/shared'
import { api } from '@/lib/api'
import { AdminSectionBoard, makeQuestion } from '@/components/admin-section-board'
import { DomainCardsAdmin, type DomainCardConfig } from '@/components/domain-cards-admin'
import { SchemaCardsAdmin, type CardSchema } from '@/components/schema-cards-admin'
import { WritingLessonAdmin } from '@/components/writing-lesson-admin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PlayCircle, FileText, Users, Plus, Pencil, Trash2, Loader2, ClipboardList, Eye, BarChart3, ChevronLeft, Shield, UserPlus, Upload, Paperclip, Palette, BookOpenCheck, Mic, Image, PanelsTopLeft, Search, Download, GraduationCap, CheckCircle2, XCircle } from 'lucide-react'

export const Route = createFileRoute('/admin/')({
  component: AdminPage,
})

type UploadMeta = { fileUrl: string | null; fileName: string | null; fileType: string | null; fileSize: number | null }

const defaultExerciseFieldsJson = JSON.stringify([
  { id: 'answer', type: 'textarea', label: 'الإجابة', placeholder: 'اكتب إجابتك هنا', required: true },
], null, 2)

function AdminField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="admin-field">
      <Label className="admin-field-label">{label}</Label>
      <div className="admin-field-control">{children}</div>
    </div>
  )
}

function AdminPage() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()

  useEffect(() => {
    document.body.classList.add('admin-route-active')
    return () => document.body.classList.remove('admin-route-active')
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  if (!isAdmin) {
    return <Navigate to="/" />
  }

  const sections = [
    { value: 'groups', label: 'المجموعات', icon: Users, description: 'إنشاء المجموعات وإضافة الأعضاء' },
    { value: 'tutorials', label: 'فيديوهات الشرح', icon: PlayCircle, description: 'التحكم في أزرار الفيديو التوضيحي داخل الأقسام' },
    { value: 'domains', label: 'المجالات', icon: BookOpenCheck, description: 'إضافة محتوى للمجالات' },
    { value: 'creations', label: 'إبداعات التلاميذ', icon: Palette, description: 'بودكاست، قصص مصورة، قصص قصيرة، وصورة و تعليق' },
    { value: 'lectures', label: 'المكتبة الرقمية', icon: PlayCircle, description: 'قصص، قصص مرقمنة، قصص مصورة، بودكاست، لغتي، والدرس المفضل' },
    { value: 'exercises', label: 'تقويم الوحدة', icon: FileText, description: 'إدارة تقويم الوحدة والحقول' },
    { value: 'homework', label: 'مشاريع المجموعات', icon: ClipboardList, description: 'مشاريع المجموعات والتسليمات' },
    { value: 'mapQuiz', label: 'أبواب القصر', icon: ChevronLeft, description: 'أسئلة الأبواب وأسئلة المسار' },
    { value: 'progress', label: 'تقدم الطلاب', icon: BarChart3, description: 'ترتيب التقدم والتوقف' },
    { value: 'registrations', label: 'طلبات التسجيل', icon: CheckCircle2, description: 'الموافقة على طلبات إنشاء الحسابات أو رفضها' },
    { value: 'users', label: 'المستخدمين', icon: UserPlus, description: 'إدارة المستخدمين والصلاحيات' },
  ]

  return (
    <Tabs defaultValue="groups" className="admin-compact-shell w-full" dir="rtl">
      <div className="space-y-6">
        <div className="admin-third-sticky sticky z-50 glass-panel overflow-hidden rounded-none border border-white/70 bg-white/95 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="hidden">
            <div className="flex items-center gap-3 text-right">
              <div className="rounded-2xl bg-white/10 p-3 text-white ring-1 ring-white/20">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">التحكم عن بعد</h1>
                
              </div>
            </div>
          </div>

          <div className="p-1">
            <TabsList className="platform-main-nav flex h-auto w-full flex-nowrap justify-center gap-1 overflow-x-auto rounded-none bg-white/95 p-1">
              {sections.map((section) => {
                const Icon = section.icon
                return (
                  <TabsTrigger
                    key={section.value}
                    value={section.value}
                    title={section.description}
                    className="group flex h-auto shrink-0 items-center gap-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-right text-[11px] font-bold text-slate-700 shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900 data-[state=active]:border-emerald-200 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-900 data-[state=active]:shadow-sm"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-md border border-black/5 bg-white/80 text-current transition-all duration-200 group-data-[state=active]:bg-white">
                      <Icon className="h-3 w-3" />
                    </span>
                    <span>{section.label}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>
        </div>

        <main className="min-w-0">
          <TabsContent value="groups" className="mt-0">
            <GroupsAdmin />
          </TabsContent>
          <TabsContent value="tutorials" className="mt-0">
            <SectionTutorialVideosAdmin />
          </TabsContent>
          <TabsContent value="domains" className="mt-0">
            <DomainsAdmin />
          </TabsContent>
          <TabsContent value="creations" className="mt-0">
            <StudentCreationsAdmin />
          </TabsContent>
          <TabsContent value="lectures" className="mt-0">
            <LecturesAdmin />
          </TabsContent>
          <TabsContent value="exercises" className="mt-0">
            <ExercisesAdmin />
          </TabsContent>
          <TabsContent value="homework" className="mt-0">
            <HomeworkAdmin />
          </TabsContent>
          <TabsContent value="mapQuiz" className="mt-0">
            <MapQuizAdmin />
          </TabsContent>
          <TabsContent value="progress" className="mt-0">
            <StudentProgressAdmin />
          </TabsContent>
          <TabsContent value="registrations" className="mt-0">
            <RegistrationsAdmin />
          </TabsContent>
          <TabsContent value="users" className="mt-0">
            <UsersAdmin />
          </TabsContent>
        </main>
      </div>
    </Tabs>
  )
}


const manfalutiQuestionDefaults: Record<string, QuizQuestion[]> = {
  "reading:questions:analysis": [
    { id: "f-1", type: "multiple-choice", level: "مباشر", objective: "أن يحدّد المتعلّم مكان الحدث وزمانه.", question: "أين وقفت المرأة، وفي أي مناسبة؟", options: ["في متجر ملابس صباح يوم عطلة", "في حانوت تماثيل بباريس ليلة عيد", "في حديقة عامة يوم عيد", "في المدرسة وقت الدرس"], feedbacks: ["ليس متجر ملابس؛ اقرأ الجملة الأولى.", "حددت المكان والزمان بدقة.", "المكان ليس حديقة.", "ليس المكان مدرسة."], correctAnswer: 1 },
    { id: "f-2", type: "multiple-choice", level: "مباشر", objective: "أن يستخرج المتعلّم معلومة صريحة.", question: "بمن كانت المرأة تفكر وهي تنظر إلى التمثال؟", options: ["بزوجها الغائب", "بولدها الصغير الذي ينتظرها", "بصاحب الحانوت", "بالجنديين"], feedbacks: ["النص لم يذكر زوجاً.", "صحيح، كانت تفكر في ولدها.", "صاحب الحانوت ليس موضوع تفكيرها.", "الجنديان ظهرا لاحقاً."], correctAnswer: 1 },
    { id: "f-3", type: "multiple-choice", level: "مباشر", objective: "أن يربط بين السبب والنتيجة.", question: "لماذا لم تستطع المرأة شراء التمثال؟", options: ["لأن الحانوت كان مغلقا", "لأن التمثال بيع لشخص آخر", "لأن ثمنه كان غاليا ولا تملك ما يكفي", "لأنها غيرت رأيها"], feedbacks: ["الحانوت كان مفتوحاً.", "لم يبع لأحد.", "صحيح، لم تكن تملك ثمنه.", "لم تغير رأيها."], correctAnswer: 2 },
    { id: "f-4", type: "multiple-choice", level: "مباشر", objective: "أن يتعرّف العقدة.", question: "ماذا فعلت المرأة لتحصل على التمثال؟", options: ["اقترضت المال", "سرقت التمثال خفية ثم رجعت", "وعدت بدفع الثمن لاحقا", "طلبت هدية"], feedbacks: ["لم يرد اقتراض.", "صحيح: سرقته خفية.", "لم تعد بالدفع.", "لم تطلب هدية."], correctAnswer: 1 },
    { id: "f-5", type: "multiple-choice", level: "مباشر", objective: "أن يحدد حل القصة.", question: "كيف تصرف صاحب الحانوت في النهاية؟", options: ["أصر على معاقبتها", "طلب ثمن التمثال مضاعفا", "تراجع وادعى أنه لا يبيع هذا النوع", "أخذ الطفل معه"], feedbacks: ["على العكس تراجع.", "لم يطلب الثمن.", "صحيح، رحمها وتراجع.", "لم يأخذ الطفل."], correctAnswer: 2 },
    { id: "f-6", type: "multiple-choice", level: "مباشر", objective: "أن يستخرج تفصيلاً وصفياً.", question: "مم صنع التمثال الذي أعجب المرأة؟", options: ["من الذهب", "من المرمر", "من الخشب", "من الحديد"], feedbacks: ["ليس ذهباً.", "صحيح: من المرمر.", "ليس خشباً.", "ليس حديداً."], correctAnswer: 1 },
    { id: "f-7", type: "match", level: "استنتاجي", objective: "أن يستنتج دافع كل شخصية.", question: "صِلْ كل شخصية بدافعها كما يُفهم من النص.", options: ["", "", "", ""], correctAnswer: 0, matchPairs: [{ left: "المرأة", right: "عاطفة الأمومة ورغبة الإسعاد" }, { left: "الطفل", right: "حب الأم والبر بها" }, { left: "صاحب الحانوت", right: "الرحمة والتسامح" }] },
    { id: "f-8", type: "fill-blank", level: "ضمني", objective: "أن يدرك المعنى الضمني.", question: "أكمل: بكاء الطفل على أمه لا على التمثال يكشف أنه يقدم ____ على متاعه.", options: ["أمه", "لعبته", "نفسه", "التمثال"], feedbacks: ["صحيح، يقدم أمه.", "بل بكى على أمه.", "لم يبك خوفاً على نفسه.", "لم يقدم التمثال."], correctAnswer: 0 },
    { id: "f-9", type: "multiple-choice", level: "استنتاجي", objective: "أن يميز ما يخالف النص.", question: "إحدى العبارات الآتية يخالفها النص، انقر عليها:", options: ["دفعت المرأة إلى السرقة عاطفتها نحو ولدها", "كان صاحب الحانوت قاسيا لم يرحم المرأة", "تأثر صاحب الحانوت بصرخة الطفل", "انصرف الجنديان في النهاية"], feedbacks: ["هذه العبارة يدعمها النص.", "أحسنت، هذه العبارة خطأ.", "هذه العبارة صحيحة.", "هذه العبارة صحيحة."], correctAnswer: 1 },
    { id: "f-10", type: "communicative", level: "إبداعي", objective: "أن ينتج خطاباً ملائماً.", question: "تخيّل أنك مكان صاحب الحانوت؛ ماذا تقول للمرأة وأنت تتركها تذهب بسلام؟", options: ["", "", "", ""], correctAnswer: 0, modelAnswer: "اذهبي بسلام يا سيدتي، وخذي التمثال هدية لولدك؛ فما كان لي أن أحزن طفلاً بريئاً في ليلة عيد." },
  ],
  "reading:questions:vocabulary": [
    { id: "m-1", type: "match", level: "معجم", objective: "أن يثري رصيده بالمرادفات.", question: "صِلْ كل كلمة بمرادفها.", options: ["", "", "", ""], correctAnswer: 0, matchPairs: [{ left: "الرأفة", right: "الرحمة" }, { left: "الفاقة", right: "الفقر" }, { left: "الإيثار", right: "التضحية" }] },
    { id: "m-2", type: "multiple-choice", level: "ضدّ", question: "ما ضد كلمة القسوة؟", options: ["الغِلظة", "الرحمة", "الشدة", "الخوف"], feedbacks: ["قريبة من القسوة.", "صحيح.", "من معاني القسوة.", "ليس ضدها."], correctAnswer: 1 },
    { id: "m-3", type: "fill-blank", level: "تركيب", question: "أكمل: دفعت ____ المرأة إلى مد يدها.", options: ["الفاقة", "الغِبطة", "الرفاهية", "القسوة"], feedbacks: ["صحيح.", "لا تناسب السياق.", "نقيض حالها.", "ليست السبب هنا."], correctAnswer: 0 },
    { id: "m-4", type: "multiple-choice", level: "اشتقاق", question: "ما المصدر المشتق من الفعل رحم؟", options: ["راحم", "رحمة", "رحيم", "مرحوم"], feedbacks: ["اسم فاعل.", "صحيح.", "صفة مشبهة.", "اسم مفعول."], correctAnswer: 1 },
  ],
  "reading:questions:grammar": [
    { id: "g-1", type: "multiple-choice", level: "تطبيق", question: "في عبارة بكاءً شديدًا، ما النعت؟", options: ["بكاءً", "شديدًا", "في", "لا يوجد نعت"], feedbacks: ["منعوت.", "صحيح.", "ليست نعتاً.", "بل فيها نعت."], correctAnswer: 1 },
    { id: "g-2", type: "multiple-choice", level: "تطبيق", question: "في جملة صرخ الولد، حدد الفعل.", options: ["الولد", "صرخ", "الجملة", "لا فعل فيها"], feedbacks: ["فاعل.", "صحيح.", "ليست فعلاً.", "يوجد فعل."], correctAnswer: 1 },
    { id: "g-3", type: "multiple-choice", level: "تطبيق", question: "ما نوع الحال في: صرخ الولد قائلاً؟", options: ["حال جملة", "لا حال", "حال مفرد منصوب", "نعت"], feedbacks: ["ليست جملة.", "بل فيها حال.", "صحيح.", "ليست نعتاً."], correctAnswer: 2 },
  ],
  "listening:questions:analysis": [
    { id: "lf-1", type: "multiple-choice", question: "أين وقعت أحداث النص المسموع؟", options: ["في حانوت تماثيل بباريس", "في الملعب", "في السوق الأسبوعي", "في المدرسة"], feedbacks: ["صحيح.", "خطأ.", "خطأ.", "خطأ."], correctAnswer: 0 },
    { id: "lf-2", type: "multiple-choice", question: "ما الحدث الذي غير موقف صاحب الحانوت؟", options: ["دخول زبون جديد", "صرخة الطفل وحبه لأمه", "اختفاء التمثال", "قدوم العيد"], feedbacks: ["خطأ.", "صحيح.", "خطأ.", "خطأ."], correctAnswer: 1 },
    { id: "lf-3", type: "match", question: "صِلْ كل شخصية بموقفها.", options: ["", "", "", ""], correctAnswer: 0, matchPairs: [{ left: "الأم", right: "إسعاد الطفل" }, { left: "الطفل", right: "الدفاع عن أمه" }, { left: "صاحب الحانوت", right: "العفو والرحمة" }] },
    { id: "lf-4", type: "communicative", question: "اكتب جملة توجهها للطفل بعد سماع القصة.", options: ["", "", "", ""], correctAnswer: 0, modelAnswer: "أحسنت حبك لأمك وبرك بها، فالأم أغلى من كل لعبة." },
  ],
  "listening:questions:vocabulary": [
    { id: "lm-1", type: "multiple-choice", question: "ما معنى المرمر؟", options: ["حجر أبيض كريم ينحت منه", "خشب قديم", "لون أحمر", "قماش"], feedbacks: ["صحيح.", "خطأ.", "خطأ.", "خطأ."], correctAnswer: 0 },
    { id: "lm-2", type: "fill-blank", question: "أكمل: رجعت ____ أي عادت من حيث أتت.", options: ["أدراجها", "خوفها", "حانوتها", "سرورها"], feedbacks: ["صحيح.", "خطأ.", "خطأ.", "خطأ."], correctAnswer: 0 },
  ],
  "listening:questions:grammar": [
    { id: "lg-1", type: "multiple-choice", question: "ما نوع الجملة: وقفت امرأة بائسة؟", options: ["جملة فعلية", "جملة اسمية", "شبه جملة", "نداء"], feedbacks: ["صحيح.", "خطأ.", "خطأ.", "خطأ."], correctAnswer: 0 },
    { id: "lg-2", type: "multiple-choice", question: "كلمة بائسة في عبارة امرأة بائسة هي:", options: ["فعل", "نعت", "حال", "مفعول به"], feedbacks: ["خطأ.", "صحيح.", "خطأ.", "خطأ."], correctAnswer: 1 },
  ],
  "writing:questions:acquisition": [
    { id: "w-f1", type: "multiple-choice", level: "مباشر", objective: "أن يلتقط المتعلّم معلومة صريحة من النص.", question: "مَن جاء لعيادةِ الأمِّ المريضة؟", options: ["الطبيبُ إبراهيم", "أحدُ أبنائِها", "جارٌ من الحيّ"], feedbacks: ["صحيح. مطلعُ النصّ: «جاءَ الطبيبُ إبراهيمُ لعيادةِ أمِّها المريضة».", "عُدْ إلى الجملةِ الأولى من النصّ.", "هل ذُكِرَ جارٌ في زيارةِ العيادة؟"], correctAnswer: 0 },
    { id: "w-f2", type: "multiple-choice", level: "مباشر", objective: "أن يحدّد المتعلّم معطًى صريحًا (المرض).", question: "بأيِّ داءٍ أُصيبت عائشة؟", options: ["داءِ السلِّ", "داءِ القلبِ", "لم تُصَبْ بأيِّ مرض"], feedbacks: ["صحيح. «أُصيبت المسكينةُ عائشةُ بداءِ السلِّ».", "راجِعْ موضعَ ذكرِ المرضِ في الفقرةِ الأولى.", "النصُّ يَذكُرُ مرضًا بعينِه."], correctAnswer: 0 },
    { id: "w-f3", type: "multiple-choice", level: "استنتاجي", objective: "أن يستنتج المتعلّم سبب المرض من قرائن النص.", question: "ما السببُ الذي أدّى إلى مرضِ عائشة؟", options: ["الجُهدُ المتواصلُ في الخياطةِ وسهرُ الليالي", "العدوى من زبوناتِها", "تقدُّمُها في السنِّ فحسب"], feedbacks: ["صحيح. «نتيجةَ الجهدِ المتّصلِ الذي كانت تبذلُه... وكم سهِرت الليالي».", "هل يَربطُ النصُّ مرضَها بعدوى؟", "ركّزْ على «الجهدِ المتّصل» و«سهرِ الليالي»."], correctAnswer: 0 },
    { id: "w-f4", type: "multiple-choice", level: "ضمني", objective: "أن يؤوّل المتعلّم دلالة خاتمة النص.", question: "ماذا نَستنتجُ من قولِه: «كانت أفضلَ نساءِ حيِّها وأكثرَهنَّ تحمُّلًا لنوائبِ الدهر»؟", options: ["عُمقَ تضحيتِها وصبرِها ومكانتَها في قلوبِ أهلِ حيِّها", "أنّها كانت أغنى نساءِ الحيّ", "أنّها كانت تكرهُ عملَها"], feedbacks: ["صحيح. العبارةُ ثناءٌ على صبرِها وتضحيتِها.", "هل تتحدّثُ العبارةُ عن المالِ؟", "الثناءُ على تحمُّلِها يُناقِضُ الكراهية."], correctAnswer: 0 },
    { id: "w-a1", type: "match", level: "مباشر", objective: "أن يربط المتعلّم كل عنصر سردي بمثاله من النص.", question: "صِلْ كلَّ عنصرٍ سرديٍّ بما يُمثّلُه في نصِّ الانطلاق:", options: ["", "", "", ""], correctAnswer: 0, matchPairs: [{ left: "الشخصيّة المحوريّة", right: "عائشةُ (الأمّ)" }, { left: "الزمان", right: "ذاتَ صباحٍ" }, { left: "المكان", right: "غرفتُها الصغيرة" }, { left: "حدثٌ من الأحداث", right: "أُصيبت بداءِ السلّ" }] },
    { id: "w-a2", type: "multiple-choice", level: "استنتاجي", objective: "أن يحدّد المتعلّم ضمير السرد في النص.", question: "بأيِّ ضميرٍ سُرِدت أحداثُ النصّ؟", options: ["ضميرُ الغائبِ (سَهِرت، وجدوها، كانت...)", "ضميرُ المتكلّمِ (أنا)", "ضميرُ المخاطَبِ (أنتَ)"], feedbacks: ["صحيح. السارِدُ يَحكي بضميرِ الغائبِ.", "هل يَحكي السارِدُ عن نفسِه؟", "هل يُخاطِبُ النصُّ قارئًا بـ«أنتَ»؟"], correctAnswer: 0 },
    { id: "w-a3", type: "multiple-choice", level: "ضمني", objective: "أن يُدرك المتعلّم وظيفة الوصف داخل السرد.", question: "ما وظيفةُ الوصفِ في عباراتٍ مثل: «غرفتِها الصغيرة»، «رأسِها الذي كساه شعرٌ أبيض»؟", options: ["يَرسمُ صورةَ الشخصيّةِ والمكانِ ويُعمّقُ التأثيرَ", "حَشوٌ لا فائدةَ منه يُمكنُ حذفُه", "يَسردُ الأحداثَ المتتابعةَ"], feedbacks: ["صحيح. الوصفُ يُخدِمُ السردَ ويُثيرُ التعاطف.", "جرّبْ حذفَ هذه الصورِ: هل يَفقِدُ النصُّ تأثيرَه؟", "تحريكُ الأحداثِ وظيفةُ الأفعالِ السرديّة."], correctAnswer: 0 },
    { id: "w-a4", type: "multiple-choice", level: "استنتاجي", objective: "أن يُحدّد المتعلّم موقع مقطع في بنية النص.", question: "«وعندما فتحوا بابَ غرفتِها ذاتَ صباحٍ وجدوها...» يمثّلُ في بنيةِ النصّ:", options: ["النهايةَ (الوضعيّةَ النهائيّة)", "البدايةَ (الوضعيّةَ الأولى)", "العقدةَ (تأزُّمَ الأحداث)"], feedbacks: ["صحيح. هذا المقطعُ يُغلِقُ النصَّ بمصيرِ الشخصيّة.", "البدايةُ تُقدّمُ الشخصيّةَ قبلَ المشكلة.", "العقدةُ هي لحظةُ التأزُّمِ لا الختام."], correctAnswer: 0 },
  ],
}


const tutorialVideoCategories = [
  { value: 'tutorial:home', label: 'فيديو الرئيسية' },
  { value: 'tutorial:features', label: 'فيديو مميزات المنصة' },
  { value: 'tutorial:important-content', label: 'فيديو المجالات' },
  { value: 'tutorial:groups', label: 'فيديو المجموعات' },
  { value: 'tutorial:resources', label: 'فيديو إبداعات التلاميذ' },
  { value: 'tutorial:lectures', label: 'فيديو المكتبة الرقمية' },
  { value: 'tutorial:exercises', label: 'فيديو تقويم الوحدة' },
  { value: 'tutorial:chat', label: 'فيديو المحادثة' },
  { value: 'tutorial:quizzes', label: 'فيديو أبواب القصر' },
]

function SectionTutorialVideosAdmin() {
  const [selectedCategory, setSelectedCategory] = useState(tutorialVideoCategories[0].value)
  const [posts, setPosts] = useState<AdminSectionPost[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedInfo = tutorialVideoCategories.find((item) => item.value === selectedCategory) || tutorialVideoCategories[0]
  const currentVideo = posts.find((post) => post.category === selectedCategory && (post.fileUrl || post.content)) || null
  const currentVideoUrl = currentVideo?.fileUrl || currentVideo?.content || ''

  const loadVideo = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<{ posts: AdminSectionPost[] }>(
        `/admin/content/social-economic?category=${encodeURIComponent(selectedCategory)}`,
      )
      setPosts(response.posts)
    } catch (err) {
      console.error('Failed to load tutorial video:', err)
      setError('تعذر تحميل فيديو هذا القسم.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setFile(null)
    loadVideo()
  }, [selectedCategory])

  const uploadFile = async (nextFile: File): Promise<UploadMeta> => {
    const formData = new FormData()
    formData.append('file', nextFile)
    const response = await api.upload<{ file: UploadMeta }>('/uploads/admin', formData)
    return response.file
  }

  const saveVideo = async () => {
    if (!file || saving) return
    setSaving(true)
    setError(null)
    try {
      const uploaded = await uploadFile(file)
      const payload = {
        content: '',
        category: selectedCategory,
        ...uploaded,
      }
      if (currentVideo) {
        await api.put(`/admin/content/${currentVideo.id}`, payload)
      } else {
        await api.post('/admin/content/social-economic', payload)
      }
      setFile(null)
      await loadVideo()
    } catch (err) {
      console.error('Failed to save tutorial video:', err)
      setError('تعذر حفظ الفيديو. جرّب مرة أخرى.')
    } finally {
      setSaving(false)
    }
  }

  const deleteVideo = async () => {
    if (!currentVideo || !confirm(`هل تريد حذف ${selectedInfo.label}؟`)) return
    setSaving(true)
    setError(null)
    try {
      await api.delete(`/admin/content/${currentVideo.id}`)
      setFile(null)
      await loadVideo()
    } catch (err) {
      console.error('Failed to delete tutorial video:', err)
      setError('تعذر حذف الفيديو.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-[28px] border-emerald-100 bg-white/95 shadow-sm">
      <CardHeader className="border-b bg-emerald-50/70 pb-3 text-right">
        <CardTitle className="text-emerald-950">فيديوهات الشرح</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-[220px_1fr_auto_auto] md:items-end">
          <div className="space-y-2">
            <Label className="font-bold text-emerald-900">القسم</Label>
            <select
              className="h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm font-bold text-emerald-950 shadow-sm outline-none focus:border-emerald-400"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              {tutorialVideoCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="font-bold text-emerald-900">إرفاق ملف / صورة / صوت</Label>
            <Input
              type="file"
              accept="video/*,image/*,audio/*,.mp4,.webm,.mov,.mp3,.wav,.m4a,.ogg"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="h-11"
            />
          </div>

          <Button type="button" onClick={saveVideo} disabled={!file || saving} className="h-11 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            تعديل / حفظ
          </Button>
          <Button type="button" variant="destructive" onClick={deleteVideo} disabled={!currentVideo || saving} className="h-11 gap-2">
            <Trash2 className="h-4 w-4" /> حذف
          </Button>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-emerald-700" /></div>
        ) : currentVideoUrl ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
            <div className="mb-2 text-sm font-black text-emerald-950">الفيديو الحالي: {selectedInfo.label}</div>
            {currentVideo?.fileType?.startsWith('video/') ? (
              <video src={currentVideoUrl} controls className="max-h-64 w-full rounded-xl bg-black" />
            ) : currentVideo?.fileType?.startsWith('audio/') ? (
              <audio src={currentVideoUrl} controls className="w-full" />
            ) : currentVideo?.fileType?.startsWith('image/') ? (
              <img src={currentVideoUrl} alt={selectedInfo.label} className="max-h-64 w-full rounded-xl object-contain" />
            ) : (
              <a href={currentVideoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800">
                <Paperclip className="h-4 w-4" /> فتح الملف الحالي
              </a>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-3 text-sm font-semibold text-emerald-800">
            مازال ما كاين حتى ملف مرفوع لهذا القسم.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

const domainBoards = [
  {
    key: 'reading',
    title: 'فهم المقروء',
    contentLabel: 'نص فهم المقروء — اكتب النص الكامل هنا',
    contentPlaceholder: 'هنا كتب النص الكامل ديال فهم المقروء. مثال: فقرة 1... فقرة 2... تقدر تكتب النص كامل بسطر أو فقرات. الكلمات اللي بغيتي شرحها زيدها في خانة شروحات الكلمات تحت بصيغة: كلمة: الشرح',
    fileAccept: 'image/*,audio/*,.mp3,.wav,.m4a,.ogg,.pdf,.doc,.docx,.ppt,.pptx,.zip',
    categories: [
      { value: 'reading:title', label: 'عنوان البطاقة / النص' },
      { value: 'reading:author', label: 'الكاتب' },
      { value: 'reading:source', label: 'المصدر' },
      { value: 'reading:objective', label: 'الهدف التعليمي' },
      { value: 'reading:glossary', label: 'شروحات الكلمات (كلمة: شرح)' },
      { value: 'reading:questions:analysis', label: 'أسئلة الفهم والتحليل' },
      { value: 'reading:questions:vocabulary', label: 'أسئلة المفردات / المعجم' },
      { value: 'reading:questions:grammar', label: 'أسئلة قواعد اللغة' },
      { value: 'reading:questions:tarkib', label: 'أسئلة التركيب' },
      { value: 'reading:image', label: 'صورة النص' },
      { value: 'reading:audio', label: 'صوت النص المقروء mp3' },
    ],
  },
  {
    key: 'listening',
    title: 'فهم المسموع',
    contentLabel: 'ملخص النص السماعي',
    contentPlaceholder: 'اكتب فقط ملخص النص السماعي الذي يظهر تحت شريط الصوت. لا تكتب نصاً طويلاً هنا.',
    fileAccept: 'image/*,audio/*,.mp3,.wav,.m4a,.ogg,.pdf,.doc,.docx,.ppt,.pptx,.zip',
    categories: [
      { value: 'listening:title', label: 'عنوان النص السماعي' },
      { value: 'listening:author', label: 'الكاتب/ة' },
      { value: 'listening:source', label: 'المصدر' },
      { value: 'listening:date', label: 'تاريخ النشر' },
      { value: 'listening:class', label: 'الصف' },
      { value: 'listening:axis', label: 'المحور' },
      { value: 'listening:assignment-count', label: 'عدد التعيينات' },
      { value: 'listening:questions:1', label: 'أسئلة 1' },
      { value: 'listening:questions:2', label: 'أسئلة 2' },
      { value: 'listening:questions:3', label: 'أسئلة 3' },
      { value: 'listening:questions:4', label: 'أسئلة 4' },
      { value: 'listening:questions:5', label: 'أسئلة 5' },
      { value: 'listening:image', label: 'صورة فهم المسموع' },
      { value: 'listening:audio', label: 'ملف الصوت mp3' },
    ],
  },
  {
    key: 'language',
    title: 'الظاهرة اللغوية',
    contentLabel: 'محتوى الظاهرة اللغوية',
    contentPlaceholder: 'يعمر هذا المكون من الخانات المنظمة حسب الأزرار.',
    fileAccept: 'image/*,video/*,.mp4,.webm,.mov,.pdf,.doc,.docx',
    hideMainContentField: true,
    categories: [
      { value: 'language:image', label: 'صورة بطاقة الدرس' },
      { value: 'language:tab:1:label', label: 'اسم الزر الأول' },
      { value: 'language:tab:1:intro', label: 'تقديم الزر الأول' },
      { value: 'language:tab:1:video-title', label: 'الزر الأول: عنوان الفيديو' },
      { value: 'language:tab:1:video-description', label: 'الزر الأول: وصف الفيديو' },
      { value: 'language:tab:1:video', label: 'فيديو الزر الأول' },
      { value: 'language:tab:1:questions', label: 'تطبيقات الزر الأول' },
      { value: 'language:tab:2:label', label: 'اسم الزر الثاني' },
      { value: 'language:tab:2:intro', label: 'تقديم الزر الثاني' },
      { value: 'language:tab:2:video-title', label: 'الزر الثاني: عنوان الفيديو' },
      { value: 'language:tab:2:video-description', label: 'الزر الثاني: وصف الفيديو' },
      { value: 'language:tab:2:video', label: 'فيديو الزر الثاني' },
      { value: 'language:tab:2:questions', label: 'تطبيقات الزر الثاني' },
      { value: 'language:tab:khulasa:intro', label: 'خلاصة وتمييز: تقديم' },
      { value: 'language:tab:khulasa:concept', label: 'خلاصة وتمييز: المفهوم والأركان' },
      { value: 'language:tab:khulasa:types', label: 'خلاصة وتمييز: الأنواع' },
      { value: 'language:tab:khulasa:examples', label: 'خلاصة وتمييز: أمثلة' },
      { value: 'language:tab:khulasa:questions-title', label: 'خلاصة وتمييز: عنوان تطبيق التمييز' },
      { value: 'language:tab:khulasa:questions', label: 'خلاصة وتمييز: تطبيقات التمييز' },
      { value: 'language:tab:tawdif:intro', label: 'التوظيف التعبيري: تقديم' },
      { value: 'language:tab:tawdif:reminder', label: 'التوظيف التعبيري: تذكير قبل التوظيف' },
      { value: 'language:tab:tawdif:image', label: 'التوظيف التعبيري: صورة التطبيق' },
      { value: 'language:tab:tawdif:questions', label: 'التوظيف التعبيري: التطبيقات' },
    ],
    categoryGroups: [
      { key: 'language-card', label: 'بطاقة الدرس', categoryValues: ['language:image'] },
      { key: 'language-tab-1', label: 'الزر الأول', categoryValues: ['language:tab:1:label', 'language:tab:1:intro', 'language:tab:1:video-title', 'language:tab:1:video-description', 'language:tab:1:video', 'language:tab:1:questions'] },
      { key: 'language-tab-2', label: 'الزر الثاني', categoryValues: ['language:tab:2:label', 'language:tab:2:intro', 'language:tab:2:video-title', 'language:tab:2:video-description', 'language:tab:2:video', 'language:tab:2:questions'] },
      { key: 'language-summary', label: 'خلاصة وتمييز', categoryValues: ['language:tab:khulasa:intro', 'language:tab:khulasa:concept', 'language:tab:khulasa:types', 'language:tab:khulasa:examples', 'language:tab:khulasa:questions-title', 'language:tab:khulasa:questions'] },
      { key: 'language-expression', label: 'التوظيف التعبيري', categoryValues: ['language:tab:tawdif:intro', 'language:tab:tawdif:reminder', 'language:tab:tawdif:image', 'language:tab:tawdif:questions'] },
    ],
  },
  {
    key: 'writing',
    title: 'الإنتاج الكتابي',
    contentLabel: 'نص الانطلاق أو نص الاكتساب',
    contentPlaceholder: 'اكتب النص الذي سيظهر في قالب الإنتاج الكتابي. باقي الخانات كتعمّر القالب بشكل ديناميكي.',
    fileAccept: 'image/*,audio/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.zip',
      categories: [
        { value: 'writing:lesson:title', label: 'عنوان نص الانطلاق' },
        { value: 'writing:lesson:author', label: 'الكاتب' },
        { value: 'writing:lesson:source', label: 'المصدر' },
        { value: 'writing:acquisition:text', label: 'الاكتساب: نص الانطلاق (وسوم الإبراز: [[per]]…[[/per]])' },
        { value: 'writing:acquisition:people', label: 'الاكتساب: الشخصيات (كل سطر عبارة)' },
        { value: 'writing:acquisition:time', label: 'الاكتساب: الزمان (كل سطر عبارة)' },
        { value: 'writing:acquisition:place', label: 'الاكتساب: المكان (كل سطر عبارة)' },
        { value: 'writing:acquisition:events', label: 'الاكتساب: الأحداث (كل سطر عبارة)' },
        { value: 'writing:acquisition:description', label: 'الاكتساب: الوصف (كل سطر عبارة)' },
        { value: 'writing:questions:acquisition', label: 'أسئلة الاكتساب' },
        { value: 'writing:situation:context', label: 'التطبيق: الوضعية الواقعية' },
        { value: 'writing:situation:task', label: 'التطبيق: المطلوب' },
        { value: 'writing:resources:time', label: 'موارد الزمان (كل سطر مورد)' },
        { value: 'writing:resources:place', label: 'موارد المكان (كل سطر مورد)' },
        { value: 'writing:resources:people', label: 'موارد الشخصيات (كل سطر مورد)' },
        { value: 'writing:resources:events', label: 'موارد الأحداث (كل سطر مورد)' },
        { value: 'writing:resources:description', label: 'موارد الوصف (كل سطر مورد)' },
        { value: 'writing:objective', label: 'الهدف التعليمي' },
        { value: 'writing:file', label: 'إرفاق ملف / صورة / صوت' },
      ],
    categoryGroups: [
      { key: 'writing-acquisition', label: 'الاكتساب', categoryValues: ['writing:lesson:title', 'writing:lesson:author', 'writing:lesson:source', 'writing:acquisition:text', 'writing:acquisition:people', 'writing:acquisition:time', 'writing:acquisition:place', 'writing:acquisition:events', 'writing:acquisition:description', 'writing:questions:acquisition', 'writing:objective'] },
      { key: 'writing-application', label: 'التطبيق', categoryValues: ['writing:situation:context', 'writing:situation:task', 'writing:resources:time', 'writing:resources:place', 'writing:resources:people', 'writing:resources:events', 'writing:resources:description'] },
      { key: 'writing-correction', label: 'تصحيح', categoryValues: ['writing:file'] },
    ],
  },
]

const domainSections = [
  { section: 'social-economic', title: 'المجال الاجتماعي والاقتصادي' },
] as const

// Components managed as self-contained cards (list → click → edit). Components
// not listed here keep the field-based AdminSectionBoard editor.
const cardComponentConfigs: Record<string, DomainCardConfig> = {
  reading: {
    hasGlossary: true,
    hasAudio: true,
    imageAccept: 'image/*',
    bodyLabel: 'نص فهم المقروء — اكتب النص الكامل هنا',
    questionGroups: [
      { key: 'analysis', label: 'الفهم والتحليل' },
      { key: 'vocabulary', label: 'المفردات / المعجم' },
      { key: 'grammar', label: 'قواعد اللغة' },
      { key: 'tarkib', label: 'التركيب' },
    ],
  },
  listening: {
    hasGlossary: false,
    hasAudio: true,
    imageAccept: 'image/*',
    bodyLabel: 'ملخص النص السماعي',
    questionGroups: [
      { key: '1', label: 'أسئلة 1' },
      { key: '2', label: 'أسئلة 2' },
      { key: '3', label: 'أسئلة 3' },
      { key: '4', label: 'أسئلة 4' },
      { key: '5', label: 'أسئلة 5' },
    ],
  },
}

// Rich, multi-section card (الظاهرة اللغوية): anchor image/title + tab sections,
// each field saved scoped to the card id (matching the student renderer).
const languageCardSchema: CardSchema = {
  titleLabel: 'عنوان الدرس',
  descriptionLabel: 'تقديم عام تحت العنوان (اختياري)',
  imageLabel: 'صورة بطاقة الدرس',
  imageAccept: 'image/*',
  videoAccept: 'video/*,.mp4,.webm,.mov',
  sections: [
    {
      key: 'tab1',
      label: 'الزر الأول',
      fields: [
        { suffix: 'tab:1:label', label: 'اسم الزر الأول', kind: 'text' },
        { suffix: 'tab:1:intro', label: 'تقديم الزر الأول', kind: 'textarea' },
        { suffix: 'tab:1:video-title', label: 'عنوان الفيديو', kind: 'text' },
        { suffix: 'tab:1:video-description', label: 'وصف الفيديو', kind: 'textarea' },
        { suffix: 'tab:1:video', label: 'فيديو الزر الأول', kind: 'video' },
        { suffix: 'tab:1:questions', label: 'تطبيقات الزر الأول', kind: 'questions' },
      ],
    },
    {
      key: 'tab2',
      label: 'الزر الثاني',
      fields: [
        { suffix: 'tab:2:label', label: 'اسم الزر الثاني', kind: 'text' },
        { suffix: 'tab:2:intro', label: 'تقديم الزر الثاني', kind: 'textarea' },
        { suffix: 'tab:2:video-title', label: 'عنوان الفيديو', kind: 'text' },
        { suffix: 'tab:2:video-description', label: 'وصف الفيديو', kind: 'textarea' },
        { suffix: 'tab:2:video', label: 'فيديو الزر الثاني', kind: 'video' },
        { suffix: 'tab:2:questions', label: 'تطبيقات الزر الثاني', kind: 'questions' },
      ],
    },
    {
      key: 'khulasa',
      label: 'خلاصة وتمييز',
      fields: [
        { suffix: 'tab:khulasa:intro', label: 'تقديم', kind: 'textarea' },
        { suffix: 'tab:khulasa:concept', label: 'المفهوم والأركان', kind: 'textarea' },
        { suffix: 'tab:khulasa:types', label: 'الأنواع', kind: 'textarea' },
        { suffix: 'tab:khulasa:examples', label: 'أمثلة', kind: 'textarea' },
        { suffix: 'tab:khulasa:questions-title', label: 'عنوان تطبيق التمييز', kind: 'text' },
        { suffix: 'tab:khulasa:questions', label: 'تطبيقات التمييز', kind: 'questions' },
      ],
    },
    {
      key: 'tawdif',
      label: 'التوظيف التعبيري',
      fields: [
        { suffix: 'tab:tawdif:intro', label: 'تقديم', kind: 'textarea' },
        { suffix: 'tab:tawdif:reminder', label: 'تذكير قبل التوظيف', kind: 'textarea' },
        { suffix: 'tab:tawdif:image', label: 'صورة التطبيق', kind: 'image' },
        { suffix: 'tab:tawdif:questions', label: 'التطبيقات', kind: 'questions' },
      ],
    },
  ],
}

function DomainIntroVideoAdmin() {
  const section = 'social-economic'
  const category = 'intro-video'
  const [current, setCurrent] = useState<AdminSectionPost | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<{ posts: AdminSectionPost[] }>(`/admin/content/${section}?category=${encodeURIComponent(category)}`)
      setCurrent(response.posts.find((post) => post.fileUrl) || null)
    } catch (err) {
      console.error('Failed to load intro video:', err)
      setError('تعذر تحميل الفيديو التعريفي.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    if (!file || saving) return
    setSaving(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const uploaded = (await api.upload<{ file: UploadMeta }>('/uploads/admin', fd)).file
      await api.put(`/admin/content/${section}/upsert`, { category, content: 'intro-video', ...uploaded })
      setFile(null)
      await load()
      alert('تم حفظ الفيديو التعريفي بنجاح')
    } catch (err) {
      console.error('Failed to save intro video:', err)
      setError(err instanceof Error ? err.message : 'تعذر حفظ الفيديو. جرّب مرة أخرى.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!current || !confirm('هل تريد حذف الفيديو التعريفي؟')) return
    setSaving(true)
    setError(null)
    try {
      await api.delete(`/admin/content/${current.id}`)
      setFile(null)
      await load()
    } catch (err) {
      console.error('Failed to delete intro video:', err)
      setError('تعذر حذف الفيديو.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-[26px] border-blue-100 bg-white/95 shadow-sm">
      <CardHeader className="border-b bg-blue-50/70 pb-3 text-right">
        <CardTitle className="text-blue-950">الفيديو التعريفي للمجالات (يبدأ تلقائياً عند الدخول)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">يظهر هذا الفيديو تلقائياً لكل من يدخل قسم «المجالات» ويبدأ التشغيل مباشرة، مع إمكانية تخطّيه.</p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div className="space-y-2">
            <Label className="font-bold text-blue-900">رفع فيديو تعريفي</Label>
            <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-11" />
            {file && <div className="text-xs font-medium text-primary">{file.name}</div>}
          </div>
          <Button type="button" onClick={save} disabled={!file || saving} className="h-11 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} حفظ
          </Button>
          <Button type="button" variant="destructive" onClick={remove} disabled={!current || saving} className="h-11 gap-2">
            <Trash2 className="h-4 w-4" /> حذف
          </Button>
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-blue-700" /></div>
        ) : current?.fileUrl ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3">
            <div className="mb-2 text-sm font-black text-blue-950">الفيديو الحالي</div>
            <video src={current.fileUrl} controls className="max-h-64 w-full rounded-xl bg-black" />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-3 text-sm font-semibold text-blue-800">
            لا يوجد فيديو تعريفي بعد — ارفع واحداً ليبدأ تلقائياً عند دخول القسم.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function DomainsAdmin() {
  const selectedDomain = domainSections[0]
  const [selectedBoardKey, setSelectedBoardKey] = useState(domainBoards[0].key)
  const selectedBoard = domainBoards.find((board) => board.key === selectedBoardKey) ?? domainBoards[0]
  const cardConfig = cardComponentConfigs[selectedBoard.key]

  return (
    <div className="space-y-4">
      <DomainIntroVideoAdmin />
      <Card className="rounded-[26px] border-primary/10 bg-white/95 shadow-sm">
        <CardHeader className="text-right">
          <CardTitle className="text-xl">المجالات</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminField label="اختيار المكون">
            <select
              className="h-10 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
              value={selectedBoardKey}
              onChange={(e) => setSelectedBoardKey(e.target.value)}
            >
              {domainBoards.map((board) => (
                <option key={board.key} value={board.key}>{board.title}</option>
              ))}
            </select>
          </AdminField>
        </CardContent>
      </Card>

      {selectedBoard.key === 'language' ? (
        <SchemaCardsAdmin
          key={`${selectedDomain.section}-${selectedBoard.key}`}
          section={selectedDomain.section}
          componentKey={selectedBoard.key}
          title={selectedBoard.title}
          schema={languageCardSchema}
        />
      ) : cardConfig ? (
        <DomainCardsAdmin
          key={`${selectedDomain.section}-${selectedBoard.key}`}
          section={selectedDomain.section}
          componentKey={selectedBoard.key}
          title={selectedBoard.title}
          config={cardConfig}
        />
      ) : selectedBoard.key === 'writing' ? (
        <WritingLessonAdmin
          key={`${selectedDomain.section}-${selectedBoard.key}`}
          section={selectedDomain.section}
          title={selectedBoard.title}
          defaultQuestions={manfalutiQuestionDefaults['writing:questions:acquisition'] || [makeQuestion()]}
          fileAccept={selectedBoard.fileAccept}
        />
      ) : (
        <AdminSectionBoard
          key={`${selectedDomain.section}-${selectedBoard.key}`}
          section={selectedDomain.section}
          title={selectedBoard.title}
          categories={selectedBoard.categories}
          categoryPrefix={selectedBoard.key}
          contentLabel={selectedBoard.contentLabel}
          contentPlaceholder={selectedBoard.contentPlaceholder}
          fileAccept={selectedBoard.fileAccept}
          hideMainContentField={Boolean(selectedBoard.hideMainContentField)}
          defaultQuestionsByCategory={manfalutiQuestionDefaults}
          categoryGroups={(selectedBoard as any).categoryGroups}
        />
      )}
      {selectedBoard.key === 'reading' ? <ReadingTarkibCorrectionsAdmin /> : null}
      {selectedBoard.key === 'writing' ? <WritingProductionCorrectionsAdmin /> : null}
    </div>
  )
}


function WritingProductionCorrectionsAdmin() {
  const [open, setOpen] = useState(false)
  const [submissions, setSubmissions] = useState<{ id: string; student: string; answer: string; correction?: string; submittedAt: string }[]>([])
  const [corrections, setCorrections] = useState<Record<string, string>>({})

  const load = () => {
    if (typeof window === 'undefined') return
    try {
      const list = JSON.parse(window.localStorage.getItem('nakhla-writing-production-submissions') || '[]') as { id: string; student: string; answer: string; correction?: string; submittedAt: string }[]
      setSubmissions(list)
      setCorrections(Object.fromEntries(list.map((item) => [item.id, item.correction || ''])))
    } catch {
      setSubmissions([])
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const save = (item: { id: string; student: string; answer: string; correction?: string; submittedAt: string }) => {
    if (typeof window === 'undefined') return
    const correction = corrections[item.id] || ''
    const next = submissions.map((submission) => submission.id === item.id ? { ...submission, correction } : submission)
    window.localStorage.setItem('nakhla-writing-production-submissions', JSON.stringify(next))
    const current = JSON.parse(window.localStorage.getItem('nakhla-writing-production-current-user') || '{}') as { id?: string }
    if (current.id === item.id) {
      window.localStorage.setItem('nakhla-writing-production-current-user', JSON.stringify({ ...item, correction }))
    }
    setSubmissions(next)
    alert('تم إرسال تصحيح الإنتاج لهذا التلميذ')
  }

  return (
    <Card className="rounded-[26px] border-emerald-100 bg-white/95 shadow-sm">
      <CardHeader className="text-right">
        <CardTitle className="flex items-center justify-between gap-3">
          <span>تصحيح الإنتاج الكتابي</span>
          <Button type="button" variant={open ? 'default' : 'outline'} onClick={() => setOpen((value) => !value)}>
            تصحيح الإنتاج
          </Button>
        </CardTitle>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-3">
          {submissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              مازال ما وصل حتى إنتاج كتابي.
            </div>
          ) : submissions.map((item) => (
            <div key={item.id} className="rounded-2xl border bg-white p-4 text-right shadow-sm">
              <div className="mb-2 text-sm font-bold text-emerald-800">{item.student || 'تلميذ(ة)'} • {new Date(item.submittedAt).toLocaleString('ar-MA')}</div>
              <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm leading-7 text-slate-700 whitespace-pre-wrap">{item.answer}</div>
              <Textarea
                value={corrections[item.id] || ''}
                onChange={(event) => setCorrections((current) => ({ ...current, [item.id]: event.target.value }))}
                placeholder="اكتب التصحيح هنا..."
                className="min-h-[90px] leading-7"
              />
              <Button type="button" onClick={() => save(item)} className="mt-3">إرسال التصحيح</Button>
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  )
}


function ReadingTarkibCorrectionsAdmin() {
  const [open, setOpen] = useState(false)
  const [submissions, setSubmissions] = useState<{ id: string; title: string; answer: string; correction?: string; submittedAt: string }[]>([])
  const [corrections, setCorrections] = useState<Record<string, string>>({})

  const load = () => {
    if (typeof window === 'undefined') return
    try {
      const list = JSON.parse(window.localStorage.getItem('nakhla-reading-tarkib-submissions') || '[]') as { id: string; title: string; answer: string; correction?: string; submittedAt: string }[]
      setSubmissions(list)
      setCorrections(Object.fromEntries(list.map((item) => [item.id, item.correction || ''])))
    } catch {
      setSubmissions([])
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const save = (item: { id: string; title: string; answer: string; correction?: string; submittedAt: string }) => {
    if (typeof window === 'undefined') return
    const correction = corrections[item.id] || ''
    const next = submissions.map((submission) => submission.id === item.id ? { ...submission, correction } : submission)
    window.localStorage.setItem('nakhla-reading-tarkib-submissions', JSON.stringify(next))
    const stored = JSON.parse(window.localStorage.getItem(item.id) || '{}') as Record<string, unknown>
    window.localStorage.setItem(item.id, JSON.stringify({ ...stored, correction }))
    setSubmissions(next)
    alert('تم إرسال التصحيح لهذا التلميذ')
  }

  return (
    <Card className="rounded-[26px] border-emerald-100 bg-white/95 shadow-sm">
      <CardHeader className="text-right">
        <CardTitle className="flex items-center justify-between gap-3">
          <span>تصحيح تركيب فهم المقروء</span>
          <Button type="button" variant={open ? 'default' : 'outline'} onClick={() => setOpen((value) => !value)}>
            تصحيح تركيب
          </Button>
        </CardTitle>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-3">
          {submissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              مازال ما وصل حتى جواب تركيب.
            </div>
          ) : submissions.map((item) => (
            <div key={item.id} className="rounded-2xl border bg-white p-4 text-right shadow-sm">
              <div className="mb-2 text-sm font-bold text-emerald-800">{item.title || 'فهم المقروء'} • {new Date(item.submittedAt).toLocaleString('ar-MA')}</div>
              <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm leading-7 text-slate-700">{item.answer}</div>
              <Textarea
                value={corrections[item.id] || ''}
                onChange={(event) => setCorrections((current) => ({ ...current, [item.id]: event.target.value }))}
                placeholder="اكتب التصحيح هنا..."
                className="min-h-[90px] leading-7"
              />
              <Button type="button" onClick={() => save(item)} className="mt-3">إرسال التصحيح</Button>
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  )
}

const creationTypes: { type: StudentCreationType; label: string; icon: typeof Palette }[] = [
  { type: 'بودكاست', label: 'بودكاست', icon: Mic },
  { type: 'قصص مصورة', label: 'قصص مصورة', icon: PanelsTopLeft },
  { type: 'قصص قصيرة', label: 'قصص قصيرة', icon: BookOpenCheck },
  { type: 'صورة و تعليق', label: 'صورة و تعليق', icon: Image },
]

function StudentCreationsAdmin() {
  const [creations, setCreations] = useState<StudentCreation[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [thumb, setThumb] = useState<File | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [existingThumb, setExistingThumb] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', type: 'بودكاست' as StudentCreationType, description: '' })

  const loadCreations = () => {
    api.get<{ creations: StudentCreation[] }>('/student-creations')
      .then(({ creations }) => setCreations(creations))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCreations()
  }, [])

  const resetForm = () => {
    setForm({ title: '', type: 'بودكاست', description: '' })
    setFile(null)
    setThumb(null)
    setEditingId(null)
    setExistingThumb(null)
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || (!editingId && !form.description.trim() && !file) || creating) return
    setCreating(true)
    try {
      const uploadOne = async (f: File) => {
        const fd = new FormData()
        fd.append('file', f)
        return (await api.upload<{ file: UploadMeta }>('/uploads/admin', fd)).file
      }
      const uploaded = file ? await uploadOne(file) : null
      const uploadedThumb = thumb ? await uploadOne(thumb) : null

      const payload = {
        title: form.title.trim(),
        type: form.type,
        description: form.description.trim(),
        ...(uploaded ? { fileUrl: uploaded.fileUrl, fileName: uploaded.fileName, fileType: uploaded.fileType, fileSize: uploaded.fileSize } : {}),
        ...(uploadedThumb ? { thumbnailUrl: uploadedThumb.fileUrl } : {}),
      }

      if (editingId) {
        await api.put(`/student-creations/${editingId}`, payload)
      } else {
        await api.post('/student-creations', payload)
      }
      resetForm()
      loadCreations()
      alert(editingId ? 'تم تعديل الإبداع بنجاح' : 'تم نشر إبداع التلميذ بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حفظ الإبداع')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (creation: StudentCreation) => {
    setEditingId(creation.id)
    setForm({ title: creation.title, type: creation.type, description: creation.description || '' })
    setFile(null)
    setThumb(null)
    setExistingThumb(creation.thumbnailUrl || null)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('هل تريد حذف هذا الإبداع؟')) return
    try {
      await api.delete(`/student-creations/${id}`)
      if (editingId === id) resetForm()
      loadCreations()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حذف الإبداع')
    }
  }

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />{editingId ? 'تعديل إبداع التلميذ' : 'إضافة إبداع للتلاميذ'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminField label="العنوان">
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </AdminField>
            <AdminField label="نوع الإبداع">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as StudentCreationType }))}>
                {creationTypes.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
              </select>
            </AdminField>
            <AdminField label="رفع ملف (أي نوع)">
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <div className="mt-1 text-xs font-medium text-primary">{file.name}</div>}
            </AdminField>
            <AdminField label="الصورة المصغّرة (تظهر على البطاقة)">
              {existingThumb && !thumb && (
                <img src={existingThumb} alt="الصورة المصغّرة الحالية" className="mb-2 h-20 w-32 rounded-lg border object-cover" />
              )}
              <Input type="file" accept="image/*" onChange={(e) => setThumb(e.target.files?.[0] ?? null)} />
              {thumb && <div className="mt-1 text-xs font-medium text-primary">{thumb.name}</div>}
            </AdminField>
          </div>
          <AdminField label="الوصف أو التعليق">
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="min-h-[120px]" />
          </AdminField>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={creating || !form.title.trim() || (!editingId && !form.description.trim() && !file)}>
              {creating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
              {editingId ? 'حفظ التعديلات' : 'نشر الإبداع'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm} disabled={creating}>إلغاء التعديل</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إدارة إبداعات التلاميذ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {creations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد إبداعات منشورة</p>
          ) : creations.map((creation) => {
            const typeInfo = creationTypes.find((item) => item.type === creation.type) || creationTypes[0]
            const Icon = typeInfo.icon
            return (
              <div key={creation.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                <div className="flex min-w-0 items-start gap-3 text-right">
                  {creation.thumbnailUrl && (
                    <img src={creation.thumbnailUrl} alt={creation.title} className="h-16 w-24 shrink-0 rounded-lg border object-cover" />
                  )}
                  <div className="min-w-0">
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"><Icon className="h-3 w-3" />{creation.type}</div>
                    <h4 className="font-medium">{creation.title}</h4>
                    {creation.description && <p className="text-sm text-muted-foreground line-clamp-2">{creation.description}</p>}
                    {creation.fileUrl && (
                      <a href={creation.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-xs text-primary">
                        <Paperclip className="h-3 w-3" />{creation.fileName || 'فتح الملف'}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => startEdit(creation)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(creation.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function GroupsAdmin() {
  const [groups, setGroups] = useState<Group[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [newGroupGrade, setNewGroupGrade] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([])
  const [memberToAdd, setMemberToAdd] = useState('')

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null

  const fetchGroups = async (preferredGroupId?: number | null) => {
    const { groups } = await api.get<{ groups: Group[] }>('/groups')
    setGroups(groups)
    const nextSelectedId = preferredGroupId ?? selectedGroupId

    if (nextSelectedId && groups.some((group) => group.id === nextSelectedId)) {
      setSelectedGroupId(nextSelectedId)
    } else {
      setSelectedGroupId(groups[0]?.id ?? null)
    }
  }

  const fetchMembers = async (groupId: number) => {
    const { members } = await api.get<{ members: User[] }>(`/groups/${groupId}/members`)
    setMembers(members)
  }

  useEffect(() => {
    Promise.all([
      fetchGroups(),
      api.get<{ users: User[] }>('/groups/users').then(({ users }) => setAllUsers(users)),
    ]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedGroupId) {
      setMembers([])
      return
    }
    fetchMembers(selectedGroupId)
  }, [selectedGroupId])

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || creating) return
    setCreating(true)
    try {
      const { group } = await api.post<{ group: Group }>('/groups', {
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        grade: newGroupGrade.trim(),
        memberIds: selectedMemberIds,
      })
      setNewGroupName('')
      setNewGroupDescription('')
      setNewGroupGrade('')
      setStudentSearch('')
      setSelectedMemberIds([])
      await fetchGroups(group.id)
      alert('تم إنشاء المجموعة بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر إنشاء المجموعة')
    } finally {
      setCreating(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedGroupId || !memberToAdd || addingMember) return
    setAddingMember(true)
    try {
      await api.post(`/groups/${selectedGroupId}/members`, { userId: Number(memberToAdd) })
      setMemberToAdd('')
      await fetchMembers(selectedGroupId)
      await fetchGroups(selectedGroupId)
      alert('تمت إضافة العضو بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر إضافة العضو')
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (memberId: number) => {
    if (!selectedGroupId || !confirm('هل تريد إزالة هذا العضو من المجموعة؟')) return
    try {
      await api.delete(`/groups/${selectedGroupId}/members/${memberId}`)
      await fetchMembers(selectedGroupId)
      await fetchGroups(selectedGroupId)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر إزالة العضو')
    }
  }

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('هل تريد حذف هذه المجموعة نهائياً؟')) return
    try {
      await api.delete(`/groups/${groupId}`)
      const nextGroupId = groups.find((group) => group.id !== groupId)?.id ?? null
      await fetchGroups(nextGroupId)
      if (selectedGroupId === groupId) {
        setMembers([])
      }
      alert('تم حذف المجموعة بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حذف المجموعة')
    }
  }

  const students = allUsers.filter((candidate) => candidate.role !== 'admin')
  const displayUserName = (candidate: User) => candidate.fullName || candidate.email.split('@')[0]
  const userAvatar = (candidate: User) => candidate.profilePhotoUrl ? (
    <img src={candidate.profilePhotoUrl} alt={displayUserName(candidate)} className="h-full w-full rounded-full object-cover" />
  ) : avatarText(displayUserName(candidate))
  const filteredStudents = students.filter((candidate) => `${displayUserName(candidate)} ${candidate.email}`.toLowerCase().includes(studentSearch.trim().toLowerCase()))
  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every((candidate) => selectedMemberIds.includes(candidate.id))

  const toggleAllFilteredStudents = (checked: boolean) => {
    setSelectedMemberIds((prev) => {
      const ids = new Set(prev)
      for (const student of filteredStudents) {
        if (checked) ids.add(student.id)
        else ids.delete(student.id)
      }
      return Array.from(ids)
    })
  }

  const avatarText = (value: string) => value.trim().slice(0, 1).toUpperCase() || 'U'

  const downloadGroupCard = async (group: Group) => {
    const { members: groupMembers } = await api.get<{ members: User[] }>(`/groups/${group.id}/members`).catch(() => ({ members: selectedGroupId === group.id ? members : [] }))
    const escapeHtml = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;')

    const membersHtml = groupMembers.length
      ? groupMembers.map((member, index) => `
        <li>
          <span class="num">${index + 1}</span>
          <span class="avatar">${member.profilePhotoUrl ? `<img src="${escapeHtml(member.profilePhotoUrl)}" alt="${escapeHtml(member.fullName || member.email)}"/>` : escapeHtml((member.fullName || member.email).slice(0,1).toUpperCase())}</span>
          <span>${escapeHtml(member.fullName || member.email)}</span>
          <small>${member.role === 'admin' ? 'مشرف' : 'تلميذ'}</small>
        </li>`).join('')
      : '<li><span>لا يوجد أعضاء</span></li>'

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>بطاقة المجموعة - ${escapeHtml(group.name)}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:Arial,Tahoma,sans-serif;background:#eef2ff;padding:32px;color:#0f172a}
    .card{max-width:820px;margin:auto;background:#fff;border-radius:30px;border:3px solid #1e293b;padding:34px;box-shadow:0 24px 70px rgba(15,23,42,.18)}
    .top{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:22px}
    .logo{width:76px;height:76px;border-radius:24px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:800;box-shadow:0 12px 30px rgba(37,99,235,.25)}
    h1{margin:0;font-size:34px;line-height:1.4}.subtitle{margin-top:6px;color:#64748b;font-size:15px}.badge{display:inline-block;background:#0f172a;color:white;border-radius:999px;padding:9px 18px;margin-top:12px;font-weight:700}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}.row{background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:16px;min-height:64px}.label{display:block;font-weight:800;color:#334155;margin-bottom:7px}.value{line-height:1.8;color:#0f172a}.members{margin:12px 0 0;padding:0;list-style:none;display:grid;gap:10px}.members li{display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;background:#fff}.num{width:28px;height:28px;border-radius:50%;background:#dbeafe;color:#1d4ed8;display:inline-flex;align-items:center;justify-content:center;font-weight:800}.avatar{width:34px;height:34px;border-radius:50%;background:#fef3c7;color:#92400e;display:inline-flex;align-items:center;justify-content:center;font-weight:800;overflow:hidden}.avatar img{width:100%;height:100%;object-fit:cover}small{margin-right:auto;color:#64748b;background:#f1f5f9;border-radius:999px;padding:4px 10px}.footer{margin-top:26px;text-align:center;color:#64748b;font-size:13px}.actions{max-width:820px;margin:18px auto 0;text-align:center}.actions button{border:0;border-radius:999px;background:#0f172a;color:white;padding:12px 22px;font-weight:800;cursor:pointer}
    @media print{body{background:white;padding:0}.card{box-shadow:none;border-radius:18px;margin:0;max-width:none;min-height:100vh}.actions{display:none}.grid{grid-template-columns:1fr 1fr}}
    @media (max-width:700px){.grid{grid-template-columns:1fr}.top{align-items:flex-start}.logo{width:58px;height:58px;font-size:26px}h1{font-size:27px}}
  </style>
</head>
<body>
  <div class="card">
    <div class="top">
      <div>
        <h1>بطاقة المجموعة</h1>
        <div class="subtitle">بطاقة تعريفية خاصة بالمجموعة وأعضائها</div>
        <div class="badge">${escapeHtml(group.name)}</div>
      </div>
      <div class="logo">م</div>
    </div>
    <div class="grid">
      <div class="row"><span class="label">اسم المجموعة</span><div class="value">${escapeHtml(group.name)}</div></div>
      <div class="row"><span class="label">القسم الدراسي</span><div class="value">${escapeHtml(group.grade || 'غير محدد')}</div></div>
      <div class="row"><span class="label">عدد الأعضاء</span><div class="value">${groupMembers.length || group.memberCount}</div></div>
      <div class="row"><span class="label">تاريخ التحميل</span><div class="value">${new Date().toLocaleDateString('ar-MA')}</div></div>
    </div>
    <div class="row"><span class="label">وصف المجموعة</span><div class="value">${escapeHtml(group.description || 'بدون وصف')}</div></div>
    <div class="row" style="margin-top:14px"><span class="label">الأعضاء</span><ul class="members">${membersHtml}</ul></div>
    <div class="footer">يمكن حفظ هذه البطاقة PDF من نافذة الطباعة باختيار Save as PDF / Enregistrer au format PDF.</div>
  </div>
  <div class="actions"><button onclick="window.print()">تحميل / حفظ PDF</button></div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body>
</html>`
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }

  const availableUsers = allUsers.filter(
    (candidate) => !members.some((member) => member.id === candidate.id)
  )

  if (loading) {
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />إنشاء مجموعة جديدة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>اسم المجموعة</Label>
              <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="مثال: مجموعة القراءة" />
            </div>
            <div className="space-y-2">
              <Label>القسم الدراسي</Label>
              <Input value={newGroupGrade} onChange={(e) => setNewGroupGrade(e.target.value)} placeholder="مثال: الأولى إعدادي / 2APIC" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <Label>جميع التلاميذ</Label>
              <div className="rounded-md border p-3">
                <label className="mb-3 flex items-center gap-2 rounded-xl bg-muted/50 p-2 text-sm font-medium">
                  <input type="checkbox" checked={allFilteredSelected} onChange={(e) => toggleAllFilteredStudents(e.target.checked)} />
                  <span>تحديد جميع التلاميذ الظاهرين</span>
                </label>
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا يوجد تلاميذ مطابقون للبحث.</p>
                  ) : filteredStudents.map((candidate) => (
                    <label key={candidate.id} className="flex items-center gap-2 rounded-xl p-2 text-sm hover:bg-muted/60">
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(candidate.id)}
                        onChange={(e) => {
                          setSelectedMemberIds((prev) =>
                            e.target.checked
                              ? [...prev, candidate.id]
                              : prev.filter((id) => id !== candidate.id)
                          )
                        }}
                      />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">{userAvatar(candidate)}</span>
                      <span className="min-w-0 truncate">{displayUserName(candidate)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>بحث عن تلميذ(ة)</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pr-9" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="اكتب البريد..." />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>وصف المجموعة</Label>
            <Textarea value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} placeholder="وصف قصير للمجموعة" />
          </div>
          <Button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            إنشاء المجموعة
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />المجموعات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد مجموعات بعد.</p>
            ) : groups.map((group) => (
              <div
                key={group.id}
                className={`flex items-center gap-2 rounded-lg border p-2 transition ${selectedGroupId === group.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedGroupId(group.id)}
                  className="min-w-0 flex-1 p-2 text-right"
                >
                  <div className="font-semibold">{group.name}</div>
                  <div className="text-xs text-muted-foreground">{group.description || 'بدون وصف'}</div>
                  <div className="mt-1 text-xs text-muted-foreground">القسم: {group.grade || 'غير محدد'}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{group.memberCount} عضو</div>
                </button>
                <Button variant="outline" size="icon" onClick={() => downloadGroupCard(group)} title="تحميل بطاقة المجموعة PDF">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="icon" onClick={() => handleDeleteGroup(group.id)} title="حذف المجموعة">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />{selectedGroup ? `أعضاء ${selectedGroup.name}` : 'اختر مجموعة'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedGroup ? (
              <p className="text-sm text-muted-foreground">اختر مجموعة لعرض الأعضاء.</p>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <select
                    value={memberToAdd}
                    onChange={(e) => setMemberToAdd(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">اختر مستخدماً</option>
                    {availableUsers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{displayUserName(candidate)} - {candidate.email}</option>
                    ))}
                  </select>
                  <Button onClick={handleAddMember} disabled={!memberToAdd || addingMember}>
                    {addingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    إضافة عضو
                  </Button>
                </div>

                <div className="space-y-2">
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا يوجد أعضاء في هذه المجموعة.</p>
                  ) : members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">{userAvatar(member)}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{displayUserName(member)}</div>
                          <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground"><GraduationCap className="h-3 w-3" />{member.role === 'admin' ? 'مشرف' : 'تلميذ'}</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


const digitalLibraryTypes = ['قصص', 'قصص مرقمنة', 'قصص مصورة', 'بودكاست', 'لغتي', 'الدرس المفضل'] as const

type DigitalLibraryType = typeof digitalLibraryTypes[number]

function getDigitalLibraryType(lecture: Lecture): DigitalLibraryType {
  return (digitalLibraryTypes.find((type) => type === lecture.keyPoints) || 'قصص') as DigitalLibraryType
}

function LecturesAdmin() {
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Lecture | null>(null)
  const [activeType, setActiveType] = useState<DigitalLibraryType>('قصص')
  const [form, setForm] = useState({ title: '', description: '', youtubeUrl: '', keyPoints: 'قصص' as DigitalLibraryType, order: 0 })
  const [createForm, setCreateForm] = useState({ title: '', description: '', youtubeUrl: '', keyPoints: 'قصص' as DigitalLibraryType, order: 0 })
  const [lectureFile, setLectureFile] = useState<File | null>(null)
  const [lectureThumb, setLectureThumb] = useState<File | null>(null)
  const [editThumb, setEditThumb] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchLectures = () => {
    api
      .get<{ lectures: Lecture[] }>('/lectures')
      .then(({ lectures }) => setLectures(lectures))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLectures()
  }, [])

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.description.trim() || (!createForm.youtubeUrl.trim() && !lectureFile) || creating) return
    setCreating(true)
    try {
      let uploaded: UploadMeta | null = null
      if (lectureFile) {
        const fd = new FormData()
        fd.append('file', lectureFile)
        uploaded = (await api.upload<{ file: UploadMeta }>('/uploads/admin', fd)).file
      }
      let thumb: UploadMeta | null = null
      if (lectureThumb) {
        const fd = new FormData()
        fd.append('file', lectureThumb)
        thumb = (await api.upload<{ file: UploadMeta }>('/uploads/admin', fd)).file
      }

      await api.post('/lectures', {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        youtubeUrl: createForm.youtubeUrl.trim() || undefined,
        keyPoints: activeType,
        order: createForm.order,
        fileUrl: uploaded?.fileUrl,
        fileName: uploaded?.fileName,
        fileType: uploaded?.fileType,
        fileSize: uploaded?.fileSize,
        thumbnailUrl: thumb?.fileUrl,
      })
      setCreateForm({ title: '', description: '', youtubeUrl: '', keyPoints: activeType, order: 0 })
      setLectureFile(null)
      setLectureThumb(null)
      fetchLectures()
      alert(`تم حفظ عنصر ${activeType} بنجاح`)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حفظ عنصر المكتبة')
    } finally {
      setCreating(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        let thumbnailUrl: string | null | undefined
        if (editThumb) {
          const fd = new FormData()
          fd.append('file', editThumb)
          thumbnailUrl = (await api.upload<{ file: UploadMeta }>('/uploads/admin', fd)).file.fileUrl
        }
        await api.put(`/lectures/${editing.id}`, { ...form, ...(thumbnailUrl ? { thumbnailUrl } : {}) })
      }
      setDialogOpen(false)
      setEditing(null)
      setEditThumb(null)
      setForm({ title: '', description: '', youtubeUrl: '', keyPoints: 'قصص', order: 0 })
      fetchLectures()
      alert('تم تعديل عنصر المكتبة بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر تعديل عنصر المكتبة')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر من المكتبة الرقمية؟')) return
    try {
      await api.delete(`/lectures/${id}`)
      fetchLectures()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حذف عنصر المكتبة')
    }
  }

  const openEdit = (lecture: Lecture) => {
    setEditing(lecture)
    setEditThumb(null)
    setForm({
      title: lecture.title,
      description: lecture.description,
      youtubeUrl: lecture.youtubeUrl,
      keyPoints: getDigitalLibraryType(lecture),
      order: lecture.order,
    })
    setDialogOpen(true)
  }

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
  }

  const activeLectures = lectures.filter((lecture) => getDigitalLibraryType(lecture) === activeType)

  return (
    <div className="space-y-6">
      <Card className="rounded-[32px] border-primary/10 bg-white/90 shadow-lg">
        <CardHeader className="text-right">
          <CardTitle>المكتبة الرقمية</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {digitalLibraryTypes.map((type) => (
            <Button
              key={type}
              type="button"
              variant={activeType === type ? 'default' : 'outline'}
              className="h-auto justify-between rounded-2xl p-5 text-right"
              onClick={() => {
                setActiveType(type)
                setCreateForm({ title: '', description: '', youtubeUrl: '', keyPoints: type, order: 0 })
                setLectureFile(null)
                setLectureThumb(null)
              }}
            >
              <span>{type}</span>
              <PlayCircle className="h-5 w-5" />
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إضافة عنصر في: {activeType}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminField label={`عنوان ${activeType}`}>
              <Input value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value, keyPoints: activeType }))} />
            </AdminField>
            <AdminField label="الترتيب">
              <Input type="number" value={createForm.order} onChange={(e) => setCreateForm((f) => ({ ...f, order: Number(e.target.value) || 0, keyPoints: activeType }))} />
            </AdminField>
            <AdminField label="رابط يوتيوب">
              <Input value={createForm.youtubeUrl} onChange={(e) => setCreateForm((f) => ({ ...f, youtubeUrl: e.target.value, keyPoints: activeType }))} placeholder="اختياري إذا رفعت فيديو أو ملف" />
            </AdminField>
            <AdminField label={`رفع ملف ${activeType}`}>
              <Input type="file" onChange={(e) => setLectureFile(e.target.files?.[0] ?? null)} />
              {lectureFile && <div className="mt-1 text-xs font-medium text-primary">{lectureFile.name}</div>}
            </AdminField>
            <AdminField label="الصورة المصغّرة (تظهر على البطاقة)">
              <Input type="file" accept="image/*" onChange={(e) => setLectureThumb(e.target.files?.[0] ?? null)} />
              {lectureThumb && <div className="mt-1 text-xs font-medium text-primary">{lectureThumb.name}</div>}
            </AdminField>
          </div>
          <AdminField label="الوصف / المحتوى">
            <Textarea value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value, keyPoints: activeType }))} className="min-h-[100px]" />
          </AdminField>
          <div className="rounded-2xl border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            النوع المختار حالياً: <span className="font-semibold text-primary">{activeType}</span>
          </div>
          <Button onClick={handleCreate} disabled={creating || !createForm.title.trim() || !createForm.description.trim() || (!createForm.youtubeUrl.trim() && !lectureFile)}>
            {creating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
            حفظ داخل {activeType}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إدارة {activeType}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeLectures.map((lecture) => (
              <div key={lecture.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                <div className="flex min-w-0 items-start gap-3">
                  {lecture.thumbnailUrl && (
                    <img src={lecture.thumbnailUrl} alt={lecture.title} className="h-16 w-24 shrink-0 rounded-lg border object-cover" />
                  )}
                  <div className="min-w-0">
                  <div className="mb-1 inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{getDigitalLibraryType(lecture)}</div>
                  <h4 className="font-medium">{lecture.title}</h4>
                  <p className="text-sm text-muted-foreground">{lecture.description}</p>
                  {lecture.fileName && (
                    <a href={lecture.fileUrl || '#'} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-xs text-primary">
                      <Paperclip className="h-3 w-3" />{lecture.fileName}
                    </a>
                  )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => openEdit(lecture)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(lecture.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {activeLectures.length === 0 && (
              <p className="text-center text-muted-foreground py-8">لا توجد عناصر في {activeType} بعد.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل عنصر المكتبة</DialogTitle>
            <DialogDescription>عدّل بيانات عنصر المكتبة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">الوصف</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtubeUrl">رابط YouTube</Label>
              <Input id="youtubeUrl" value={form.youtubeUrl} onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyPoints">نوع المكتبة</Label>
              <select id="keyPoints" value={form.keyPoints} onChange={(e) => setForm((f) => ({ ...f, keyPoints: e.target.value as DigitalLibraryType }))} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {digitalLibraryTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="order">الترتيب</Label>
              <Input id="order" type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number.parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editThumb">الصورة المصغّرة (اختياري — تستبدل الحالية)</Label>
              {editing?.thumbnailUrl && !editThumb && (
                <img src={editing.thumbnailUrl} alt={editing.title} className="h-20 w-32 rounded-lg border object-cover" />
              )}
              <Input id="editThumb" type="file" accept="image/*" onChange={(e) => setEditThumb(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ExercisesAdmin() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [submissions, setSubmissions] = useState<ExerciseSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [form, setForm] = useState({ title: '', description: '', fields: [] as ExerciseField[], lectureId: null as number | null, domain: 'social-economic' as UnitEvaluationDomain, order: 0 })
  const [createForm, setCreateForm] = useState({ title: '', description: '', lectureId: '', domain: 'social-economic' as UnitEvaluationDomain, order: 0, fieldsJson: defaultExerciseFieldsJson })
  const [exerciseFile, setExerciseFile] = useState<File | null>(null)
  const [correctionText, setCorrectionText] = useState<Record<number, string>>({})
  const [correctionFiles, setCorrectionFiles] = useState<Record<number, File | null>>({})
  const [savingCorrectionId, setSavingCorrectionId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [exerciseAdminMode, setExerciseAdminMode] = useState<'create' | 'corrections'>('create')

  const fetchData = () => {
    Promise.all([
      api.get<{ exercises: Exercise[] }>('/exercises'),
      api.get<{ lectures: Lecture[] }>('/lectures'),
      api.get<{ submissions: ExerciseSubmission[] }>('/exercises/submissions/all').catch(() => ({ submissions: [] })),
    ])
      .then(([exercisesRes, lecturesRes, submissionsRes]) => {
        setExercises(exercisesRes.exercises)
        setLectures(lecturesRes.lectures)
        setSubmissions(submissionsRes.submissions)
        setCorrectionText((prev) => ({
          ...submissionsRes.submissions.reduce<Record<number, string>>((acc, submission) => {
            acc[submission.id] = prev[submission.id] ?? submission.correctionText ?? ''
            return acc
          }, {}),
        }))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.description.trim() || creating) return
    setCreating(true)
    try {
      const fields = JSON.parse(createForm.fieldsJson) as ExerciseField[]
      let uploaded: UploadMeta | null = null
      if (exerciseFile) {
        const fd = new FormData()
        fd.append('file', exerciseFile)
        uploaded = (await api.upload<{ file: UploadMeta }>('/uploads/admin', fd)).file
      }

      await api.post('/exercises', {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        lectureId: createForm.lectureId ? Number(createForm.lectureId) : null,
        domain: createForm.domain,
        order: createForm.order,
        fields,
        fileUrl: uploaded?.fileUrl,
        fileName: uploaded?.fileName,
        fileType: uploaded?.fileType,
        fileSize: uploaded?.fileSize,
      })
      setCreateForm({ title: '', description: '', lectureId: '', domain: 'social-economic', order: 0, fieldsJson: defaultExerciseFieldsJson })
      setExerciseFile(null)
      fetchData()
      alert('تم حفظ التقويم بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حفظ التقويم. تأكدي من JSON ديال الحقول.')
    } finally {
      setCreating(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/exercises/${editing.id}`, form)
      }
      setDialogOpen(false)
      setEditing(null)
      setForm({ title: '', description: '', fields: [], lectureId: null, domain: 'social-economic', order: 0 })
      fetchData()
      alert('تم تعديل التقويم بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر تعديل التقويم')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا التقويم؟')) return
    try {
      await api.delete(`/exercises/${id}`)
      fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حذف التقويم')
    }
  }


  const handleDeleteSubmission = async (submission: ExerciseSubmission) => {
    if (!confirm(`هل تريد حذف جواب ${submission.userFullName || submission.userEmail || 'هذا المستخدم'}؟`)) return
    try {
      await api.delete(`/exercises/submissions/${submission.id}`)
      setCorrectionText((prev) => {
        const next = { ...prev }
        delete next[submission.id]
        return next
      })
      setCorrectionFiles((prev) => {
        const next = { ...prev }
        delete next[submission.id]
        return next
      })
      fetchData()
      alert('تم حذف جواب التلميذ')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حذف الجواب')
    }
  }

  const saveCorrection = async (submission: ExerciseSubmission) => {
    setSavingCorrectionId(submission.id)
    try {
      let uploaded: UploadMeta | null = null
      const file = correctionFiles[submission.id]
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        uploaded = (await api.upload<{ file: UploadMeta }>('/uploads/admin', fd)).file
      }
      await api.put(`/exercises/submissions/${submission.id}/correction`, {
        correctionText: correctionText[submission.id] || '',
        correctionFileUrl: uploaded?.fileUrl ?? submission.correctionFileUrl ?? null,
        correctionFileName: uploaded?.fileName ?? submission.correctionFileName ?? null,
        correctionFileType: uploaded?.fileType ?? submission.correctionFileType ?? null,
        correctionFileSize: uploaded?.fileSize ?? submission.correctionFileSize ?? null,
      })
      setCorrectionFiles((prev) => ({ ...prev, [submission.id]: null }))
      fetchData()
      alert('تم إرسال التصحيح لهذا التلميذ')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر إرسال التصحيح')
    } finally {
      setSavingCorrectionId(null)
    }
  }

  const addField = () => {
    setForm((f) => ({
      ...f,
      fields: [...f.fields, { id: crypto.randomUUID(), type: 'text', label: '', required: false }],
    }))
  }

  const updateField = (index: number, updates: Partial<ExerciseField>) => {
    setForm((f) => ({
      ...f,
      fields: f.fields.map((field, i) => (i === index ? { ...field, ...updates } : field)),
    }))
  }

  const removeField = (index: number) => {
    setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== index) }))
  }

  const openEdit = (exercise: Exercise) => {
    setEditing(exercise)
    setForm({
      title: exercise.title,
      description: exercise.description,
      fields: exercise.fields,
      lectureId: exercise.lectureId,
      domain: exercise.domain || 'social-economic',
      order: exercise.order,
    })
    setDialogOpen(true)
  }

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-3 rounded-[28px] border bg-white/90 p-3 shadow-sm">
        <Button
          type="button"
          variant={exerciseAdminMode === 'create' ? 'default' : 'outline'}
          className="rounded-2xl px-6"
          onClick={() => setExerciseAdminMode('create')}
        >
          إضافة تقويم
        </Button>
        <Button
          type="button"
          variant={exerciseAdminMode === 'corrections' ? 'default' : 'outline'}
          className="rounded-2xl px-6"
          onClick={() => setExerciseAdminMode('corrections')}
        >
          تصحيح
          {submissions.length > 0 ? <span className="mr-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{submissions.length}</span> : null}
        </Button>
      </div>

      {exerciseAdminMode === 'create' ? (
        <>
      <Card>
        <CardHeader>
          <CardTitle>إضافة تقويم</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminField label="العنوان">
              <Input value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} />
            </AdminField>
            <AdminField label="الترتيب">
              <Input type="number" value={createForm.order} onChange={(e) => setCreateForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))} />
            </AdminField>
            <AdminField label="المجال">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={createForm.domain} onChange={(e) => setCreateForm((f) => ({ ...f, domain: e.target.value as UnitEvaluationDomain }))}>
                <option value="social-economic">المجال الاجتماعي والاقتصادي</option>
              </select>
            </AdminField>
            <AdminField label="الدرس">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={createForm.lectureId} onChange={(e) => setCreateForm((f) => ({ ...f, lectureId: e.target.value }))}>
                <option value="">تقويم عام</option>
                {lectures.map((lecture) => <option key={lecture.id} value={lecture.id}>{lecture.title}</option>)}
              </select>
            </AdminField>
            <AdminField label="رفع ملف أو فيديو للتمرين">
              <Input type="file" accept="video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*" onChange={(e) => setExerciseFile(e.target.files?.[0] ?? null)} />
            </AdminField>
          </div>
          <AdminField label="الوصف">
            <Textarea value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} className="min-h-[100px]" />
          </AdminField>
          <Button onClick={handleCreate} disabled={creating || !createForm.title.trim() || !createForm.description.trim()}>
            {creating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
            حفظ التقويم
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إدارة تقويم الوحدة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {exercises.map((exercise) => (
              <div key={exercise.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <h4 className="font-medium">{exercise.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {exercise.description} • المجال الاجتماعي والاقتصادي • {exercise.fields.length} حقول
                  </p>
                  {exercise.fileName && (
                    <a href={exercise.fileUrl || '#'} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-xs text-primary">
                      <Paperclip className="h-3 w-3" />{exercise.fileName}
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => openEdit(exercise)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(exercise.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {exercises.length === 0 && <p className="text-center text-muted-foreground py-8">لا يوجد تقويم وحدة</p>}
          </div>
        </CardContent>
      </Card>

        </>
      ) : null}

      {exerciseAdminMode === 'corrections' ? (
      <Card className="rounded-[30px] border-emerald-100">
        <CardHeader>
          <CardTitle>أجوبة التلاميذ وتصحيحها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {submissions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">لا توجد أجوبة مرسلة حالياً.</p>
          ) : submissions.map((submission) => (
            <div key={submission.id} className="space-y-4 rounded-[24px] border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-right">
                  <h4 className="font-extrabold text-slate-900">{submission.userFullName || submission.userEmail || `User #${submission.userId}`}</h4>
                  <p className="text-sm text-muted-foreground">{submission.exerciseTitle || `تمرين #${submission.exerciseId}`} • المجال الاجتماعي والاقتصادي</p>
                  <p className="text-xs text-muted-foreground">تاريخ الإرسال: {new Date(submission.submittedAt).toLocaleString('ar-MA')}</p>
                </div>
                {submission.fileUrl ? (
                  <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                    <Paperclip className="h-4 w-4" />
                    {submission.fileName || 'ملف جواب التلميذ'}
                  </a>
                ) : null}
              </div>

              {Object.keys(submission.answers || {}).length > 0 ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-right text-sm leading-7 text-slate-700">
                  {Object.entries(submission.answers).map(([key, value]) => <div key={key}><span className="font-bold">{key}:</span> {value}</div>)}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-[1fr_260px_auto] md:items-end">
                <div className="space-y-2">
                  <Label>تصحيح الأستاذ لهذا المستخدم</Label>
                  <Textarea value={correctionText[submission.id] || ''} onChange={(e) => setCorrectionText((prev) => ({ ...prev, [submission.id]: e.target.value }))} placeholder="اكتب التصحيح أو الملاحظة الخاصة بهذا التلميذ" />
                </div>
                <div className="space-y-2">
                  <Label>ملف التصحيح</Label>
                  <Input type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,video/*,audio/*" onChange={(e) => setCorrectionFiles((prev) => ({ ...prev, [submission.id]: e.target.files?.[0] ?? null }))} />
                  {submission.correctionFileName ? <a href={submission.correctionFileUrl || '#'} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary">التصحيح الحالي: {submission.correctionFileName}</a> : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => saveCorrection(submission)} disabled={savingCorrectionId === submission.id} className="rounded-2xl bg-emerald-700 hover:bg-emerald-800">
                    {savingCorrectionId === submission.id ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}
                    تصحيح
                  </Button>
                  <Button variant="destructive" onClick={() => handleDeleteSubmission(submission)} className="rounded-2xl">
                    <Trash2 className="ml-2 h-4 w-4" />
                    حذف الجواب
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل التقويم</DialogTitle>
            <DialogDescription>عدّل بيانات التقويم والحقول</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">الوصف</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exercise-domain">المجال</Label>
              <select id="exercise-domain" className="w-full h-10 rounded-md border px-3" value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value as UnitEvaluationDomain }))}>
                <option value="social-economic">المجال الاجتماعي والاقتصادي</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lectureId">المكتبة الرقمية المرتبطة</Label>
              <select id="lectureId" className="w-full h-10 rounded-md border px-3" value={form.lectureId || ''} onChange={(e) => setForm((f) => ({ ...f, lectureId: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">بدون عنصر</option>
                {lectures.map((lecture) => <option key={lecture.id} value={lecture.id}>{lecture.title}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exercise-order">الترتيب</Label>
              <Input id="exercise-order" type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number.parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>الحقول</Label>
                <Button type="button" variant="outline" size="sm" onClick={addField}>
                  <Plus className="ml-1 h-3 w-3" />
                  إضافة حقل
                </Button>
              </div>
              {form.fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end p-3 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input placeholder="عنوان الحقل" value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} />
                  </div>
                  <select className="h-10 rounded-md border px-3" value={field.type} onChange={(e) => updateField(index, { type: e.target.value as ExerciseField['type'] })}>
                    <option value="text">نص</option>
                    <option value="number">رقم</option>
                    <option value="textarea">نص طويل</option>
                  </select>
                  <Button type="button" variant="destructive" size="icon" onClick={() => removeField(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuizzesAdmin() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Quiz | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    questions: [] as QuizQuestion[],
    difficulty: 'medium' as QuizDifficulty,
    lectureId: null as number | null,
  })
  const [saving, setSaving] = useState(false)

  const difficultyLabels: Record<QuizDifficulty, string> = {
    easy: 'سهل',
    medium: 'متوسط',
    hard: 'صعب',
  }

  const fetchData = () => {
    Promise.all([
      api.get<{ quizzes: Quiz[] }>('/quizzes'),
      api.get<{ lectures: Lecture[] }>('/lectures'),
    ])
      .then(([quizzesRes, lecturesRes]) => {
        setQuizzes(quizzesRes.quizzes)
        setLectures(lecturesRes.lectures)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/quizzes/${editing.id}`, form)
      } else {
        await api.post('/quizzes', form)
      }
      setDialogOpen(false)
      setEditing(null)
      setForm({ title: '', description: '', questions: [], difficulty: 'medium', lectureId: null })
      fetchData()
      alert(editing ? 'تم تعديل الباب بنجاح' : 'تم حفظ الباب بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حفظ الباب')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الباب؟')) return
    try {
      await api.delete(`/quizzes/${id}`)
      fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حذف الباب')
    }
  }

  const addQuestion = () => {
    setForm((f) => ({
      ...f,
      questions: [
        ...f.questions,
        { id: crypto.randomUUID(), question: '', options: ['', ''], correctAnswer: 0 },
      ],
    }))
  }

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === index ? { ...q, ...updates } : q)),
    }))
  }

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) } : q
      ),
    }))
  }

  const addOption = (qIndex: number) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) =>
        i === qIndex && q.options.length < 6 ? { ...q, options: [...q.options, ''] } : q
      ),
    }))
  }

  const removeOption = (qIndex: number, oIndex: number) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => {
        if (i !== qIndex || q.options.length <= 2) return q
        const newOptions = q.options.filter((_, j) => j !== oIndex)
        // Adjust correct answer if needed
        let newCorrectAnswer = q.correctAnswer
        if (oIndex < q.correctAnswer) newCorrectAnswer--
        else if (oIndex === q.correctAnswer) newCorrectAnswer = 0
        return { ...q, options: newOptions, correctAnswer: newCorrectAnswer }
      }),
    }))
  }

  const removeQuestion = (index: number) => {
    setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }))
  }

  const openEdit = (quiz: Quiz) => {
    setEditing(quiz)
    setForm({
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions,
      difficulty: quiz.difficulty,
      lectureId: quiz.lectureId,
    })
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', description: '', questions: [], difficulty: 'medium', lectureId: null })
    setDialogOpen(true)
  }

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>إدارة أبواب القصر</CardTitle>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة باب
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'تعديل الباب' : 'إضافة باب جديد'}</DialogTitle>
              <DialogDescription>أدخل بيانات الباب والأسئلة</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="quiz-title">العنوان</Label>
                <Input
                  id="quiz-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiz-description">الوصف</Label>
                <Textarea
                  id="quiz-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quiz-difficulty">مستوى الصعوبة</Label>
                  <select
                    id="quiz-difficulty"
                    className="w-full h-10 rounded-md border px-3"
                    value={form.difficulty}
                    onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as QuizDifficulty }))}
                  >
                    <option value="easy">سهل</option>
                    <option value="medium">متوسط</option>
                    <option value="hard">صعب</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiz-lectureId">المكتبة الرقمية المرتبطة</Label>
                  <select
                    id="quiz-lectureId"
                    className="w-full h-10 rounded-md border px-3"
                    value={form.lectureId || ''}
                    onChange={(e) => setForm((f) => ({ ...f, lectureId: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">بدون عنصر</option>
                    {lectures.map((lecture) => (
                      <option key={lecture.id} value={lecture.id}>
                        {lecture.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>الأسئلة</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="ml-1 h-3 w-3" />
                    إضافة سؤال
                  </Button>
                </div>
                {form.questions.map((q, qIndex) => (
                  <div key={q.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>السؤال {qIndex + 1}</Label>
                      <Button type="button" variant="destructive" size="sm" onClick={() => removeQuestion(qIndex)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      placeholder="نص السؤال"
                      value={q.question}
                      onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                    />
                    <div className="space-y-2">
                      {q.options.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={q.correctAnswer === oIndex}
                            onChange={() => updateQuestion(qIndex, { correctAnswer: oIndex })}
                            className="h-4 w-4 accent-primary"
                          />
                          <Input
                            placeholder={`الخيار ${oIndex + 1}`}
                            value={option}
                            onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                            className="flex-1"
                          />
                          {q.options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                              onClick={() => removeOption(qIndex, oIndex)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">حدد الإجابة الصحيحة بالنقر على الدائرة</p>
                      {q.options.length < 6 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => addOption(qIndex)}>
                          <Plus className="ml-1 h-3 w-3" />
                          إضافة خيار
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {editing ? 'حفظ التعديلات' : 'إضافة'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">{quiz.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {quiz.description} • {quiz.questions.length} أسئلة • {difficultyLabels[quiz.difficulty]}
                  {quiz.lectureTitle && ` • ${quiz.lectureTitle}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => openEdit(quiz)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="icon" onClick={() => handleDelete(quiz.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {quizzes.length === 0 && (
            <p className="text-center text-muted-foreground py-8">لا توجد أبواب</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RegistrationsAdmin() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)

  const fetchUsers = () => {
    setLoading(true)
    api
      .get<{ users: User[] }>('/admin/users')
      .then(({ users }) => setUsers(users))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const pending = users.filter((user) => user.status === 'pending')

  const review = async (userId: number, status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !confirm('هل تريد رفض طلب تسجيل هذا المستخدم؟')) return
    setProcessingId(userId)
    try {
      await api.patch(`/admin/users/${userId}/status`, { status })
      await fetchUsers()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر تحديث الطلب')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          طلبات التسجيل
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{pending.length}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد طلبات تسجيل قيد المراجعة</p>
        ) : (
          <div className="space-y-4">
            {pending.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                    {(user.fullName || user.email).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-medium">{user.fullName || user.email}</h4>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-bold text-amber-700">قيد المراجعة</span>
                      {' • '}
                      {user.emailVerified ? (
                        <span className="font-bold text-emerald-700">البريد مُفعّل</span>
                      ) : (
                        <span className="font-bold text-red-700">البريد غير مُفعّل</span>
                      )}
                      {' • '}
                      {new Date(user.createdAt).toLocaleDateString('ar')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => review(user.id, 'approved')}
                    disabled={processingId === user.id}
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {processingId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    قبول
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => review(user.id, 'rejected')}
                    disabled={processingId === user.id}
                    className="gap-1"
                  >
                    <XCircle className="h-4 w-4" />
                    رفض
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const { user: currentUser } = useAuth()

  const fetchUsers = () => {
    api
      .get<{ users: User[] }>('/admin/users')
      .then(({ users }) => setUsers(users))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Pending sign-ups live in the "طلبات التسجيل" tab; only show reviewed accounts here.
  const visibleUsers = users.filter((user) => user.status !== 'pending')

  const toggleRole = async (userId: number, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    await api.patch(`/admin/users/${userId}/role`, { role: newRole })
    fetchUsers()
  }

  const handleDelete = async (userId: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return
    await api.delete(`/admin/users/${userId}`)
    fetchUsers()
  }

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>إدارة المستخدمين</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visibleUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt={user.fullName || user.email} className="h-full w-full object-cover" /> : (user.fullName || user.email).slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                <h4 className="font-medium">{user.fullName || user.email}</h4>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <p className="text-sm text-muted-foreground">
                  {user.role === 'admin' ? 'مسؤول' : 'مستخدم'}
                  {user.status === 'rejected' && <span className="text-destructive"> • مرفوض</span>} •{' '}
                  {new Date(user.createdAt).toLocaleDateString('ar')}
                </p>
                </div>
              </div>
              {user.id !== currentUser?.id && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleRole(user.id, user.role)}>
                    {user.role === 'admin' ? 'إزالة الصلاحيات' : 'ترقية لمسؤول'}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(user.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function HomeworkAdmin() {
  const [homeworkList, setHomeworkList] = useState<Homework[]>([])
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submissionsDialogOpen, setSubmissionsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Homework | null>(null)
  const [viewingSubmissions, setViewingSubmissions] = useState<Homework | null>(null)
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([])
  const [form, setForm] = useState({ title: '', description: '', lectureId: null as number | null, groupId: null as number | null, dueDate: '', solution: '' })
  const [createForm, setCreateForm] = useState({ title: '', description: '', lectureId: '', groupId: '', dueDate: '' })
  const [homeworkFile, setHomeworkFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [homeworkAdminMode, setHomeworkAdminMode] = useState<'create' | 'corrections'>('create')
  const [allSubmissions, setAllSubmissions] = useState<HomeworkSubmission[]>([])
  const [correctionText, setCorrectionText] = useState<Record<number, string>>({})
  const [correctionFiles, setCorrectionFiles] = useState<Record<number, File | null>>({})
  const [savingCorrectionId, setSavingCorrectionId] = useState<number | null>(null)

  const fetchData = () => {
    Promise.all([
      api.get<{ homework: Homework[] }>('/homework'),
      api.get<{ lectures: Lecture[] }>('/lectures'),
      api.get<{ groups: Group[] }>('/groups'),
      api.get<{ submissions: HomeworkSubmission[] }>('/homework/submissions/all').catch(() => ({ submissions: [] })),
    ])
      .then(([homeworkRes, lecturesRes, groupsRes, submissionsRes]) => {
        setHomeworkList(homeworkRes.homework)
        setLectures(lecturesRes.lectures)
        setGroups(groupsRes.groups)
        setAllSubmissions(submissionsRes.submissions)
        setCorrectionText(
          submissionsRes.submissions.reduce<Record<number, string>>((acc, submission) => {
            acc[submission.id] = submission.correctionText ?? ''
            return acc
          }, {}),
        )
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.description.trim() || !createForm.groupId || creating) return
    setCreating(true)
    try {
      let uploaded: UploadMeta | null = null
      if (homeworkFile) {
        const fd = new FormData()
        fd.append('file', homeworkFile)
        uploaded = (await api.upload<{ file: UploadMeta }>('/uploads/admin', fd)).file
      }

      await api.post('/homework', {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        lectureId: createForm.lectureId ? Number(createForm.lectureId) : null,
        groupId: Number(createForm.groupId),
        dueDate: createForm.dueDate || null,
        fileUrl: uploaded?.fileUrl,
        fileName: uploaded?.fileName,
        fileType: uploaded?.fileType,
        fileSize: uploaded?.fileSize,
      })
      setCreateForm({ title: '', description: '', lectureId: '', groupId: '', dueDate: '' })
      setHomeworkFile(null)
      fetchData()
      alert('تم حفظ المشروع داخل المجموعة بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حفظ المشروع')
    } finally {
      setCreating(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        description: form.description,
        lectureId: form.lectureId,
        groupId: form.groupId,
        dueDate: form.dueDate || null,
        solution: form.solution || null,
      }
      if (editing) {
        await api.put(`/homework/${editing.id}`, payload)
      }
      setDialogOpen(false)
      setEditing(null)
      setForm({ title: '', description: '', lectureId: null, groupId: null, dueDate: '', solution: '' })
      fetchData()
      alert('تم تعديل المشروع بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر تعديل المشروع')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟')) return
    try {
      await api.delete(`/homework/${id}`)
      fetchData()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حذف المشروع')
    }
  }

  const openEdit = (hw: Homework) => {
    setEditing(hw)
    setForm({
      title: hw.title,
      description: hw.description,
      lectureId: hw.lectureId,
      groupId: hw.groupId,
      dueDate: hw.dueDate ? hw.dueDate.split('T')[0] : '',
      solution: hw.solution || '',
    })
    setDialogOpen(true)
  }

  const viewSubmissions = async (hw: Homework) => {
    setViewingSubmissions(hw)
    const { submissions } = await api.get<{ submissions: HomeworkSubmission[] }>(`/homework/${hw.id}/all-submissions`)
    setSubmissions(submissions)
    setSubmissionsDialogOpen(true)
  }

  const saveCorrection = async (submission: HomeworkSubmission) => {
    setSavingCorrectionId(submission.id)
    try {
      let uploaded: UploadMeta | null = null
      const file = correctionFiles[submission.id]
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        uploaded = (await api.upload<{ file: UploadMeta }>('/uploads/admin', fd)).file
      }
      await api.put(`/homework/submissions/${submission.id}/correction`, {
        correctionText: correctionText[submission.id] || '',
        correctionFileUrl: uploaded?.fileUrl ?? submission.correctionFileUrl ?? null,
        correctionFileName: uploaded?.fileName ?? submission.correctionFileName ?? null,
        correctionFileType: uploaded?.fileType ?? submission.correctionFileType ?? null,
        correctionFileSize: uploaded?.fileSize ?? submission.correctionFileSize ?? null,
      })
      setCorrectionFiles((prev) => ({ ...prev, [submission.id]: null }))
      fetchData()
      alert('تم إرسال التصحيح لهذا التلميذ')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر إرسال التصحيح')
    } finally {
      setSavingCorrectionId(null)
    }
  }

  const deleteSubmission = async (submission: HomeworkSubmission) => {
    if (!confirm('هل تريد حذف تسليم هذا التلميذ؟')) return
    try {
      await api.delete(`/homework/submissions/${submission.id}`)
      fetchData()
      alert('تم حذف تسليم التلميذ')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حذف التسليم')
    }
  }

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-3 rounded-[28px] border bg-white/90 p-3 shadow-sm">
        <Button
          type="button"
          variant={homeworkAdminMode === 'create' ? 'default' : 'outline'}
          className="rounded-2xl px-6"
          onClick={() => setHomeworkAdminMode('create')}
        >
          إضافة مشروع
        </Button>
        <Button
          type="button"
          variant={homeworkAdminMode === 'corrections' ? 'default' : 'outline'}
          className="rounded-2xl px-6"
          onClick={() => setHomeworkAdminMode('corrections')}
        >
          تصحيح
          {allSubmissions.length > 0 ? <span className="mr-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{allSubmissions.length}</span> : null}
        </Button>
      </div>

      {homeworkAdminMode === 'create' ? (
        <>
      <Card>
        <CardHeader>
          <CardTitle>إضافة مشروع</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminField label="العنوان">
              <Input value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} />
            </AdminField>
            <AdminField label="المجموعة">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={createForm.groupId} onChange={(e) => setCreateForm((f) => ({ ...f, groupId: e.target.value }))}>
                <option value="">اختر المجموعة…</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </AdminField>
            <AdminField label="تاريخ التسليم">
              <Input type="datetime-local" value={createForm.dueDate} onChange={(e) => setCreateForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </AdminField>
            <AdminField label="الدرس المرتبط (اختياري)">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={createForm.lectureId} onChange={(e) => setCreateForm((f) => ({ ...f, lectureId: e.target.value }))}>
                <option value="">بدون عنصر</option>
                {lectures.map((lecture) => <option key={lecture.id} value={lecture.id}>{lecture.title}</option>)}
              </select>
            </AdminField>
            <AdminField label="رفع ملف أو فيديو">
              <Input type="file" accept="video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*" onChange={(e) => setHomeworkFile(e.target.files?.[0] ?? null)} />
            </AdminField>
          </div>
          <AdminField label="الوصف">
            <Textarea value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} className="min-h-[100px]" />
          </AdminField>
          <Button onClick={handleCreate} disabled={creating || !createForm.title.trim() || !createForm.description.trim() || !createForm.groupId}>
            {creating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
            حفظ المشروع
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إدارة مشاريع المجموعات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {homeworkList.map((hw) => {
              const lecture = lectures.find((l) => l.id === hw.lectureId)
              const group = groups.find((g) => g.id === hw.groupId)
              return (
                <div key={hw.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <h4 className="font-medium">{hw.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {hw.description}
                      {group && ` • مجموعة: ${group.name}`}
                      {lecture && ` • ${lecture.title}`}
                      {hw.dueDate && ` • تسليم: ${new Date(hw.dueDate).toLocaleDateString('ar')}`}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      {hw.solution && <span className="text-xs text-green-600">✓ يوجد حل</span>}
                      {hw.fileName && (
                        <a href={hw.fileUrl || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs text-primary">
                          <Paperclip className="h-3 w-3" />{hw.fileName}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => viewSubmissions(hw)} title="عرض التسليمات">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => openEdit(hw)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(hw.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {homeworkList.length === 0 && (
              <p className="text-center text-muted-foreground py-8">لا توجد مشروعات</p>
            )}
          </div>
        </CardContent>
      </Card>
        </>
      ) : null}

      {homeworkAdminMode === 'corrections' ? (
        <Card className="rounded-[30px] border-emerald-100">
          <CardHeader>
            <CardTitle>أجوبة التلاميذ وتصحيحها</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {allSubmissions.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">لا توجد أجوبة مرسلة حالياً.</p>
            ) : allSubmissions.map((submission) => (
              <div key={submission.id} className="space-y-4 rounded-[24px] border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-right">
                    <h4 className="font-extrabold text-slate-900">{submission.userFullName || submission.userEmail || `User #${submission.userId}`}</h4>
                    <p className="text-sm text-muted-foreground">{submission.homeworkTitle || `مشروع #${submission.homeworkId}`}{submission.groupName ? ` • ${submission.groupName}` : ''}</p>
                    <p className="text-xs text-muted-foreground">تاريخ الإرسال: {new Date(submission.submittedAt).toLocaleString('ar-MA')}</p>
                  </div>
                  {submission.fileUrl ? (
                    <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                      <Paperclip className="h-4 w-4" />
                      {submission.fileName || 'ملف جواب التلميذ'}
                    </a>
                  ) : null}
                </div>

                {submission.content ? (
                  <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-right text-sm leading-7 text-slate-700">{submission.content}</div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-[1fr_260px_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>تصحيح الأستاذ لهذا المستخدم</Label>
                    <Textarea value={correctionText[submission.id] || ''} onChange={(e) => setCorrectionText((prev) => ({ ...prev, [submission.id]: e.target.value }))} placeholder="اكتب التصحيح أو الملاحظة الخاصة بهذا التلميذ" />
                  </div>
                  <div className="space-y-2">
                    <Label>ملف التصحيح</Label>
                    <Input type="file" onChange={(e) => setCorrectionFiles((prev) => ({ ...prev, [submission.id]: e.target.files?.[0] ?? null }))} />
                    {submission.correctionFileName ? <a href={submission.correctionFileUrl || '#'} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary">التصحيح الحالي: {submission.correctionFileName}</a> : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => saveCorrection(submission)} disabled={savingCorrectionId === submission.id} className="rounded-2xl bg-emerald-700 hover:bg-emerald-800">
                      {savingCorrectionId === submission.id ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}
                      تصحيح
                    </Button>
                    <Button variant="destructive" onClick={() => deleteSubmission(submission)} className="rounded-2xl">
                      <Trash2 className="ml-2 h-4 w-4" />
                      حذف الجواب
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل المشروع</DialogTitle>
            <DialogDescription>عدّل بيانات المشروع</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hw-title">العنوان</Label>
              <Input id="hw-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-description">الوصف</Label>
              <Textarea id="hw-description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-groupId">المجموعة</Label>
              <select id="hw-groupId" className="w-full h-10 rounded-md border px-3" value={form.groupId || ''} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">بدون مجموعة</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-lectureId">المكتبة الرقمية المرتبطة</Label>
              <select id="hw-lectureId" className="w-full h-10 rounded-md border px-3" value={form.lectureId || ''} onChange={(e) => setForm((f) => ({ ...f, lectureId: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">بدون عنصر</option>
                {lectures.map((lecture) => (
                  <option key={lecture.id} value={lecture.id}>{lecture.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-dueDate">تاريخ التسليم</Label>
              <Input id="hw-dueDate" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-solution">الحل (اختياري)</Label>
              <Textarea id="hw-solution" value={form.solution} onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))} placeholder="أضف الحل بعد انتهاء موعد التسليم..." className="min-h-[100px]" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submissionsDialogOpen} onOpenChange={setSubmissionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تسليمات: {viewingSubmissions?.title}</DialogTitle>
            <DialogDescription>{submissions.length} تسليم</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {submissions.map((sub) => (
              <div key={sub.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">{sub.userEmail}</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(sub.submittedAt).toLocaleString('ar')}
                  </span>
                </div>
                {sub.content && <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">{sub.content}</p>}
                {sub.fileUrl && (
                  <a href={sub.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-primary">
                    <Paperclip className="h-4 w-4" />{sub.fileName || 'فتح الوثيقة'}
                  </a>
                )}
              </div>
            ))}
            {submissions.length === 0 && (
              <p className="text-center text-muted-foreground py-8">لا توجد تسليمات</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MapQuizAdmin() {
  type StageType = 'main' | 'bonus'
  type StageConfig = {
    stageType: StageType
    stageNumber: number
    title: string
    image: string | null
    questions: QuizQuestion[]
  }

  const defaultQuestion = (): QuizQuestion => ({
    id: crypto.randomUUID(),
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
  })

  const [configs, setConfigs] = useState<StageConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<StageType>('main')
  const [selectedNumber, setSelectedNumber] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<StageConfig>({
    stageType: 'main',
    stageNumber: 1,
    title: 'الباب 1',
    image: '',
    questions: [defaultQuestion(), defaultQuestion(), defaultQuestion(), defaultQuestion()],
  })

  const totalStages = 5

  const loadConfigs = () => {
    api.get<{ stages: StageConfig[] }>('/quizzes/admin/stage-config')
      .then((res) => setConfigs(res.stages))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  useEffect(() => {
    const found = configs.find((item) => item.stageType === selectedType && item.stageNumber === selectedNumber)
    setForm(found ?? {
      stageType: selectedType,
      stageNumber: selectedNumber,
      title: selectedType === 'main' ? `الباب ${selectedNumber}` : `سؤال المسار ${selectedNumber}`,
      image: '',
      questions: selectedType === 'main'
        ? [defaultQuestion(), defaultQuestion(), defaultQuestion(), defaultQuestion()]
        : [defaultQuestion()],
    })
  }, [configs, selectedType, selectedNumber])

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, qIndex) => qIndex === index ? { ...question, ...updates } : question),
    }))
  }

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, questionIndex) => (
        questionIndex === qIndex
          ? { ...question, options: question.options.map((option, optionIndex) => optionIndex === oIndex ? value : option) }
          : question
      )),
    }))
  }

  const addQuestion = () => {
    setForm((prev) => {
      const limit = selectedType === 'main' ? 4 : 1
      if (prev.questions.length >= limit) return prev
      return { ...prev, questions: [...prev.questions, defaultQuestion()] }
    })
  }

  const removeQuestion = (index: number) => {
    setForm((prev) => {
      const minimum = selectedType === 'main' ? 4 : 1
      if (prev.questions.length <= minimum) return prev
      return { ...prev, questions: prev.questions.filter((_, qIndex) => qIndex !== index) }
    })
  }

  const saveConfig = async () => {
    const requiredQuestions = selectedType === 'main' ? 4 : 1
    const cleanedQuestions = form.questions.slice(0, requiredQuestions).map((question, index) => ({
      ...question,
      id: question.id || crypto.randomUUID(),
      question: question.question.trim(),
      options: question.options.slice(0, 4).map((option) => option.trim()),
      correctAnswer: Math.max(0, Math.min(question.correctAnswer || 0, 3)),
    }))

    const isComplete = cleanedQuestions.length === requiredQuestions && cleanedQuestions.every((question) =>
      question.question.length > 0 && question.options.length === 4 && question.options.every((option) => option.length > 0)
    )

    if (!isComplete) {
      alert(selectedType === 'main' ? 'كل باب خاصو 4 أسئلة، وكل سؤال خاصو 4 اختيارات وجواب صحيح.' : 'سؤال المسار خاصو سؤال واحد، 4 اختيارات، وجواب صحيح.')
      return
    }

    setSaving(true)
    try {
      await api.put(`/quizzes/admin/stage-config/${selectedType}/${selectedNumber}`, {
        title: form.title,
        image: form.image,
        questions: cleanedQuestions,
      })
      loadConfigs()
      alert('تم حفظ إعدادات المرحلة بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حفظ إعدادات المرحلة')
    } finally {
      setSaving(false)
    }
  }

  const resetConfig = async () => {
    if (!confirm('هل تريد حذف إعدادات هذه المرحلة والعودة للوضع الافتراضي؟')) return
    setSaving(true)
    try {
      await api.delete(`/quizzes/admin/stage-config/${selectedType}/${selectedNumber}`)
      loadConfigs()
      alert('تم حذف إعدادات الباب بنجاح')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حذف إعدادات الباب')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>إدارة أبواب القصر وأسئلة المسار</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>نوع المرحلة</Label>
            <select className="w-full h-10 rounded-md border px-3" value={selectedType} onChange={(e) => { setSelectedType(e.target.value as StageType); setSelectedNumber(1) }}>
              <option value="main">أبواب القصر</option>
              <option value="bonus">أسئلة المسار</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>رقم المرحلة</Label>
            <select className="w-full h-10 rounded-md border px-3" value={selectedNumber} onChange={(e) => setSelectedNumber(Number(e.target.value))}>
              {Array.from({ length: totalStages }, (_, index) => index + 1).map((stageNumber) => (
                <option key={stageNumber} value={stageNumber}>{selectedType === 'main' ? `الباب ${stageNumber}` : `سؤال المسار ${stageNumber}`}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>صورة المرحلة</Label>
            <Input value={form.image || ''} onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))} placeholder="/quiz-map/map-1.jpeg أو رابط صورة" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>عنوان المرحلة</Label>
          <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">الأسئلة الخاصة بهذه المرحلة</h3>
            <p className="text-sm text-muted-foreground">أبواب القصر فيها دائماً 4 أسئلة، وأسئلة المسار فيها سؤال مكافأة واحد مع جواب صحيح.</p>
          </div>
          <Button type="button" variant="outline" onClick={addQuestion} disabled={form.questions.length >= (selectedType === 'main' ? 4 : 1)}>
            <Plus className="ml-2 h-4 w-4" />
            إضافة سؤال
          </Button>
        </div>

        <div className="space-y-2">
          {form.questions.map((question, qIndex) => (
            <div key={question.id || qIndex} className="quiz-question-compact rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label>السؤال {qIndex + 1}</Label>
                <Button type="button" variant="destructive" size="sm" onClick={() => removeQuestion(qIndex)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input value={question.question} onChange={(e) => updateQuestion(qIndex, { question: e.target.value })} placeholder="نص السؤال" />
              <div className="rounded-2xl border border-primary/10 bg-primary/5 p-3 text-sm text-muted-foreground">
                اختَر الدائرة بجانب الجواب الصحيح، وهذا الجواب سيظهر للطلاب في نهاية المرحلة.
              </div>
              <div className="question-options-grid grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2 rounded-xl border bg-muted/20 p-2">
                    <input type="radio" name={`stage-correct-${qIndex}`} checked={question.correctAnswer === oIndex} onChange={() => updateQuestion(qIndex, { correctAnswer: oIndex })} className="h-4 w-4 accent-primary" />
                    <span className="w-16 text-[11px] font-semibold text-primary">{question.correctAnswer === oIndex ? 'صحيح' : `اختيار ${oIndex + 1}`}</span>
                    <Input value={option} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)} placeholder={`الخيار ${oIndex + 1}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveConfig} disabled={saving}>
            {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            حفظ المرحلة
          </Button>
          <Button type="button" variant="outline" onClick={resetConfig} disabled={saving}>
            حذف إعداد هذه المرحلة
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function metricPercent(completed: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.round((completed / total) * 100))
}

function ProgressPill({ label, completed, total }: { label: string; completed: number; total: number }) {
  const percent = metricPercent(completed, total)
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{completed}/{total}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 text-left text-xs text-muted-foreground">{percent}%</div>
    </div>
  )
}

function ProgressDetailBox({ title, completed, remaining }: { title: string; completed: string[]; remaining: string[] }) {
  const shortCompleted = completed.slice(0, 5)
  const shortRemaining = remaining.slice(0, 5)

  return (
    <div className="rounded-2xl border bg-white p-3 text-right shadow-sm">
      <div className="mb-2 text-sm font-extrabold text-slate-900">{title}</div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-xl border border-green-100 bg-green-50 p-2">
          <div className="mb-1 text-xs font-bold text-green-800">كمل</div>
          {shortCompleted.length ? (
            <div className="flex flex-wrap gap-1">
              {shortCompleted.map((item) => <span key={item} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-green-800">{item}</span>)}
              {completed.length > shortCompleted.length ? <span className="text-[11px] text-green-800">+{completed.length - shortCompleted.length}</span> : null}
            </div>
          ) : <div className="text-[11px] text-green-700">مازال ما كمل والو هنا</div>}
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-2">
          <div className="mb-1 text-xs font-bold text-amber-800">باقي</div>
          {shortRemaining.length ? (
            <div className="flex flex-wrap gap-1">
              {shortRemaining.map((item) => <span key={item} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-amber-800">{item}</span>)}
              {remaining.length > shortRemaining.length ? <span className="text-[11px] text-amber-800">+{remaining.length - shortRemaining.length}</span> : null}
            </div>
          ) : <div className="text-[11px] text-amber-700">كمل كلشي فهاد القسم</div>}
        </div>
      </div>
    </div>
  )
}

function StudentProgressAdmin() {
  const [students, setStudents] = useState<StudentFullProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<{ students: StudentFullProgress[] }>('/progress/admin/students')
      .then(({ students }) => setStudents(students))
      .catch((error) => {
        console.error('Failed to load full student progress:', error)
        setStudents([])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>تقدم الطلاب في المنصة كاملة</CardTitle>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا يوجد طلاب مسجلين</p>
        ) : (
          <div className="space-y-4">
            {students.map((student) => (
              <div key={student.id} className="rounded-3xl border bg-muted/30 p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-semibold">{student.email}</h3>
                    <p className="text-xs text-muted-foreground">
                      آخر نشاط: {student.lastActivity ? new Date(student.lastActivity).toLocaleString('ar-MA') : 'لم يبدأ بعد'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-2 text-sm shadow-sm">
                    متوسط أبواب القصر: <span className="font-bold text-primary">{student.averageScore}%</span> • المحاولات: {student.totalAttempts}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <ProgressPill label="أبواب القصر" completed={student.palace.completed} total={student.palace.total} />
                  <ProgressPill label="المجالات" completed={student.domains.completed} total={student.domains.total} />
                  <ProgressPill label="المكتبة الرقمية" completed={student.lectures.completed} total={student.lectures.total} />
                  <ProgressPill label="تقويم الوحدة" completed={student.exercises.completed} total={student.exercises.total} />
                  <ProgressPill label="مشاريع المجموعات" completed={student.homework.completed} total={student.homework.total} />
                </div>

                {student.details ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <ProgressDetailBox title="أبواب القصر" completed={student.details.palace.completed} remaining={student.details.palace.remaining} />
                    <ProgressDetailBox title="المجالات" completed={student.details.domains.completed} remaining={student.details.domains.remaining} />
                    <ProgressDetailBox title="المكتبة الرقمية" completed={student.details.lectures.completed} remaining={student.details.lectures.remaining} />
                    <ProgressDetailBox title="تقويم الوحدة" completed={student.details.exercises.completed} remaining={student.details.exercises.remaining} />
                    <ProgressDetailBox title="مشاريع المجموعات" completed={student.details.homework.completed} remaining={student.details.homework.remaining} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
