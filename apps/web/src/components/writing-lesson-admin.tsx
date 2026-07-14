import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminSection, AdminSectionPost, QuizQuestion } from "@teaching-app/shared";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  QuestionEditor,
  parseQuestions,
  serializeQuestions,
} from "@/components/admin-section-board";
import { CheckCircle2, ExternalLink, Loader2, Save } from "lucide-react";

const WRITING_CATEGORIES = {
  title: "writing:lesson:title",
  author: "writing:lesson:author",
  source: "writing:lesson:source",
  modelText: "writing:acquisition:text",
  objective: "writing:objective",
  questions: "writing:questions:acquisition",
  acquisitionPeople: "writing:acquisition:people",
  acquisitionTime: "writing:acquisition:time",
  acquisitionPlace: "writing:acquisition:place",
  acquisitionEvents: "writing:acquisition:events",
  acquisitionDescription: "writing:acquisition:description",
  situation: "writing:situation:context",
  task: "writing:situation:task",
  resourcesTime: "writing:resources:time",
  resourcesPlace: "writing:resources:place",
  resourcesPeople: "writing:resources:people",
  resourcesEvents: "writing:resources:events",
  resourcesDescription: "writing:resources:description",
  file: "writing:file",
} as const;

const ACQUISITION_ELEMENT_FIELDS = [
  { key: "acquisitionPeople", label: "الشخصيات", dot: "bg-[#CDE3F5]", border: "border-r-[#2E6FA8]", placeholder: "عائشةُ (الأمّ)\nالطبيبُ إبراهيم" },
  { key: "acquisitionTime", label: "الزمان", dot: "bg-[#F6E3C5]", border: "border-r-[#C0813B]", placeholder: "ذاتَ صباحٍ\nفي الليالي" },
  { key: "acquisitionPlace", label: "المكان", dot: "bg-[#CDEBD8]", border: "border-r-[#358062]", placeholder: "غرفتُها الصغيرة\nماكينةُ الخياطة" },
  { key: "acquisitionEvents", label: "الأحداث", dot: "bg-[#E6D8F0]", border: "border-r-[#7B4B9B]", placeholder: "جاءَ الطبيبُ لعيادتها\nأُصيبت بداءِ السلّ" },
  { key: "acquisitionDescription", label: "الوصف", dot: "bg-[#FAD9D9]", border: "border-r-[#C96B6B]", placeholder: "رأسُها الذي كساه شعرٌ أبيض\nأفضلُ نساءِ حيّها" },
] as const;

const HIGHLIGHT_HELP =
  "اكتب عبارات كل عنصر سردي في الحقول أدناه (كل سطر = عبارة) — تُبرَز تلقائيًا في النص عند التلاميذ. يمكنك أيضًا لفّ المقاطع يدويًا بوسوم مثل [[per]]…[[/per]].";

type LessonForm = {
  title: string;
  author: string;
  source: string;
  modelText: string;
  objective: string;
  acquisitionPeople: string;
  acquisitionTime: string;
  acquisitionPlace: string;
  acquisitionEvents: string;
  acquisitionDescription: string;
  situation: string;
  task: string;
  resourcesTime: string;
  resourcesPlace: string;
  resourcesPeople: string;
  resourcesEvents: string;
  resourcesDescription: string;
};

const emptyForm: LessonForm = {
  title: "",
  author: "",
  source: "",
  modelText: "",
  objective: "",
  acquisitionPeople: "",
  acquisitionTime: "",
  acquisitionPlace: "",
  acquisitionEvents: "",
  acquisitionDescription: "",
  situation: "",
  task: "",
  resourcesTime: "",
  resourcesPlace: "",
  resourcesEvents: "",
  resourcesPeople: "",
  resourcesDescription: "",
};

function latestPost(posts: AdminSectionPost[], category: string) {
  return [...posts]
    .filter((post) => post.category === category)
    .sort((a, b) => b.id - a.id)[0] ?? null;
}

function linesToText(lines: string[]) {
  return lines.join("\n");
}

function textToLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

async function upsertField(section: AdminSection, category: string, content: string) {
  await api.put(`/admin/content/${section}/upsert`, { category, content });
}

async function upsertFile(
  section: AdminSection,
  category: string,
  file: File,
) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.upload<{
    file: { fileUrl: string; fileName: string; fileType: string | null; fileSize: number | null };
  }>("/uploads/admin", formData);
  await api.put(`/admin/content/${section}/upsert`, {
    category,
    content: "",
    ...response.file,
  });
}

export function WritingLessonAdmin({
  section,
  title,
  defaultQuestions,
  fileAccept,
}: {
  section: AdminSection;
  title: string;
  defaultQuestions: QuizQuestion[];
  fileAccept?: string;
}) {
  const [tab, setTab] = useState<"acquisition" | "application">("acquisition");
  const [posts, setPosts] = useState<AdminSectionPost[]>([]);
  const [form, setForm] = useState<LessonForm>(emptyForm);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const filePost = useMemo(
    () => latestPost(posts, WRITING_CATEGORIES.file),
    [posts],
  );

  const loadPosts = async () => {
    const response = await api.get<{ posts: AdminSectionPost[] }>(`/admin/content/${section}`);
    setPosts(response.posts);
  };

  const hydrate = (nextPosts: AdminSectionPost[]) => {
    const read = (key: keyof typeof WRITING_CATEGORIES) =>
      latestPost(nextPosts, WRITING_CATEGORIES[key])?.content?.trim() || "";
    setForm({
      title: read("title"),
      author: read("author"),
      source: read("source"),
      modelText: read("modelText") || latestPost(nextPosts, "writing")?.content?.trim() || "",
      objective: read("objective"),
      acquisitionPeople: read("acquisitionPeople"),
      acquisitionTime: read("acquisitionTime"),
      acquisitionPlace: read("acquisitionPlace"),
      acquisitionEvents: read("acquisitionEvents"),
      acquisitionDescription: read("acquisitionDescription"),
      situation: read("situation"),
      task: read("task"),
      resourcesTime: read("resourcesTime"),
      resourcesPlace: read("resourcesPlace"),
      resourcesPeople: read("resourcesPeople"),
      resourcesEvents: read("resourcesEvents"),
      resourcesDescription: read("resourcesDescription"),
    });
    const questionPost = latestPost(nextPosts, WRITING_CATEGORIES.questions);
    const parsed = questionPost ? parseQuestions(questionPost.content) : null;
    setQuestions(parsed?.length ? parsed : defaultQuestions);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPosts()
      .then((_) => {})
      .catch((err) => {
        console.error("Failed to load writing lesson:", err);
        setError("تعذر تحميل محتوى الإنتاج الكتابي.");
      })
      .finally(() => setLoading(false));
  }, [section]);

  useEffect(() => {
    if (!loading) hydrate(posts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, loading]);

  const patch = (key: keyof LessonForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      const entries: Array<[keyof typeof WRITING_CATEGORIES, string]> = [
        ["title", form.title.trim()],
        ["author", form.author.trim()],
        ["source", form.source.trim()],
        ["modelText", form.modelText.trim()],
        ["objective", form.objective.trim()],
        ["acquisitionPeople", form.acquisitionPeople.trim()],
        ["acquisitionTime", form.acquisitionTime.trim()],
        ["acquisitionPlace", form.acquisitionPlace.trim()],
        ["acquisitionEvents", form.acquisitionEvents.trim()],
        ["acquisitionDescription", form.acquisitionDescription.trim()],
        ["situation", form.situation.trim()],
        ["task", form.task.trim()],
        ["resourcesTime", form.resourcesTime.trim()],
        ["resourcesPlace", form.resourcesPlace.trim()],
        ["resourcesPeople", form.resourcesPeople.trim()],
        ["resourcesEvents", form.resourcesEvents.trim()],
        ["resourcesDescription", form.resourcesDescription.trim()],
      ];

      for (const [key, value] of entries) {
        if (value) {
          await upsertField(section, WRITING_CATEGORIES[key], value);
        }
      }

      const serialized = serializeQuestions(questions);
      if (serialized) {
        await upsertField(section, WRITING_CATEGORIES.questions, serialized);
      }

      if (file) {
        await upsertFile(section, WRITING_CATEGORIES.file, file);
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      }

      await loadPosts();
      setSavedAt(new Date().toLocaleString("ar-MA"));
    } catch (err) {
      console.error("Failed to save writing lesson:", err);
      setError("تعذر الحفظ. تأكد من الاتصال والصلاحيات.");
    } finally {
      setSaving(false);
    }
  };

  const resourcePreview = {
    time: textToLines(form.resourcesTime),
    place: textToLines(form.resourcesPlace),
    people: textToLines(form.resourcesPeople),
    events: textToLines(form.resourcesEvents),
    description: textToLines(form.resourcesDescription),
  };

  const hasPreviewContent = Boolean(
    form.title ||
      form.modelText ||
      form.situation ||
      form.task ||
      Object.values(resourcePreview).some((items) => items.length > 0) ||
      questions.some((q) => q.question.trim()),
  );

  return (
    <Card className="rounded-[28px] border-emerald-100 bg-white shadow-sm">
      <CardHeader className="border-b bg-emerald-50/60 py-4">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-xl">
          <span>{title}</span>
          <a
            href="/important-content#social-economic"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
          >
            <ExternalLink className="h-4 w-4" />
            معاينة عند التلاميذ
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm leading-7 text-emerald-900">
          عبّئ الحقول أدناه ثم اضغط <b>حفظ الدرس</b>. يظهر المحتوى مباشرة في <b>المحتوى المهم → الإنتاج الكتابي</b> للتلاميذ.
          تصحيح الإنتاج يتم من لوحة «تصحيح الإنتاج» أسفل هذه البطاقة.
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["acquisition", "الاكتساب"],
              ["application", "التطبيق"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                tab === key
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
          </div>
        ) : (
          <>
            {tab === "acquisition" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label className="mb-2 block font-bold">عنوان نص الانطلاق</Label>
                    <Input value={form.title} onChange={(e) => patch("title", e.target.value)} placeholder="عائشة… وفاءٌ حتّى الرمق الأخير" />
                  </div>
                  <div>
                    <Label className="mb-2 block font-bold">الكاتب</Label>
                    <Input value={form.author} onChange={(e) => patch("author", e.target.value)} placeholder="المصطفى سليمي" />
                  </div>
                  <div>
                    <Label className="mb-2 block font-bold">المصدر</Label>
                    <Input value={form.source} onChange={(e) => patch("source", e.target.value)} placeholder="مجلّة الوعي الإسلاميّ…" />
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block font-bold">نص الاكتساب (نصّ الانطلاق)</Label>
                  <Textarea
                    value={form.modelText}
                    onChange={(e) => patch("modelText", e.target.value)}
                    placeholder="الصق النص السردي الكامل هنا…"
                    className="min-h-[220px] font-['Amiri'] text-base leading-8"
                  />
                </div>

                <div>
                  <Label className="mb-1 block font-bold">عناصر السرد في النص (للإبراز)</Label>
                  <p className="mb-3 text-xs leading-6 text-slate-600">{HIGHLIGHT_HELP}</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {ACQUISITION_ELEMENT_FIELDS.map(({ key, label, dot, border, placeholder }) => (
                      <div key={key} className={`rounded-xl border border-slate-200 bg-slate-50/60 p-3 border-r-4 ${border}`}>
                        <Label className="mb-2 flex items-center gap-2 font-bold">
                          <span className={`h-3.5 w-3.5 rounded-full border border-black/10 ${dot}`} />
                          {label}
                        </Label>
                        <Textarea
                          value={form[key]}
                          onChange={(e) => patch(key, e.target.value)}
                          placeholder={`كل سطر = عبارة من النص\n${placeholder}`}
                          className="min-h-[96px] bg-white text-sm leading-7"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block font-bold">الهدف التعليمي</Label>
                  <Textarea
                    value={form.objective}
                    onChange={(e) => patch("objective", e.target.value)}
                    placeholder="أجب عن أسئلة الاكتساب اعتمادًا على نص الانطلاق…"
                    className="min-h-[80px] leading-7"
                  />
                </div>

                <div>
                  <Label className="mb-2 block font-bold">أسئلة الاكتساب</Label>
                  <QuestionEditor questions={questions} onChange={setQuestions} />
                </div>
              </div>
            ) : null}

            {tab === "application" ? (
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block font-bold">الوضعية الواقعية</Label>
                  <Textarea
                    value={form.situation}
                    onChange={(e) => patch("situation", e.target.value)}
                    placeholder="اكتب سياق الوضعية التي يُنتج فيها التلميذ نصّه…"
                    className="min-h-[120px] leading-8"
                  />
                </div>
                <div>
                  <Label className="mb-2 block font-bold">المطلوب من التلميذ</Label>
                  <Textarea
                    value={form.task}
                    onChange={(e) => patch("task", e.target.value)}
                    placeholder="اكتب نصًّا سرديًّا في موضوع التضحية… (12–15 سطرًا)"
                    className="min-h-[90px] leading-8"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {(
                    [
                      ["resourcesTime", "موارد الزمان", "ذات صباحٍ\nفي الليالي"],
                      ["resourcesPlace", "موارد المكان", "غرفتها الصغيرة\nماكينة الخياطة"],
                      ["resourcesPeople", "موارد الشخصيات", "عائشة الأم\nالطبيب إبراهيم"],
                      ["resourcesEvents", "موارد الأحداث", "جاء الطبيبُ لعيادتها\nأُصيبت بداء السلّ"],
                      ["resourcesDescription", "موارد الوصف", "رأسُها الذي كساه شعرٌ أبيض\nأفضلُ نساءِ حيّها"],
                    ] as const
                  ).map(([key, label, placeholder]) => (
                    <div key={key}>
                      <Label className="mb-2 block font-bold">{label}</Label>
                      <Textarea
                        value={form[key]}
                        onChange={(e) => patch(key, e.target.value)}
                        placeholder={`كل سطر = مورد قابل للنقر\n${placeholder}`}
                        className="min-h-[110px] text-sm leading-7"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <Label className="mb-2 block font-bold">إرفاق ملف / صورة / صوت (اختياري)</Label>
                  {filePost?.fileUrl ? (
                    <div className="mb-2 rounded-xl border bg-slate-50 p-3 text-sm">
                      ملف محفوظ:{" "}
                      <a href={filePost.fileUrl} target="_blank" rel="noreferrer" className="font-bold text-emerald-800">
                        {filePost.fileName || "فتح الملف"}
                      </a>
                    </div>
                  ) : null}
                  <Input
                    ref={fileRef}
                    type="file"
                    accept={fileAccept}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button type="button" onClick={saveAll} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ الدرس
              </Button>
              {savedAt ? (
                <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  آخر حفظ: {savedAt}
                </span>
              ) : null}
            </div>

            {hasPreviewContent ? (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 text-sm leading-7 text-emerald-950">
                <div className="mb-2 font-bold">ملخّص ما سيظهر للتلاميذ</div>
                {form.title ? <div><b>العنوان:</b> {form.title}</div> : null}
                {form.modelText ? <div><b>نص الاكتساب:</b> {form.modelText.slice(0, 120)}{form.modelText.length > 120 ? "…" : ""}</div> : null}
                <div><b>أسئلة الاكتساب:</b> {questions.filter((q) => q.question.trim()).length}</div>
                {form.situation ? <div><b>الوضعية:</b> {form.situation.slice(0, 100)}{form.situation.length > 100 ? "…" : ""}</div> : null}
                <div>
                  <b>الموارد:</b>{" "}
                  {linesToText(
                    Object.entries(resourcePreview)
                      .filter(([, items]) => items.length > 0)
                      .map(([key, items]) => `${key} (${items.length})`),
                  ) || "—"}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
