import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminSection, AdminSectionPost, QuizQuestion, DomainCardContent } from "@teaching-app/shared";
import { CARD_CONTENT_PREFIX } from "@teaching-app/shared";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  QuestionEditor,
  makeQuestion,
  parseQuestions,
  serializeQuestions,
} from "@/components/admin-section-board";
import {
  ImagePlus,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

export interface DomainCardQuestionGroup {
  key: string;
  label: string;
}

export interface DomainCardConfig {
  hasGlossary?: boolean;
  hasAudio?: boolean;
  imageAccept?: string;
  audioAccept?: string;
  questionGroups?: DomainCardQuestionGroup[];
  bodyLabel?: string;
}

type UploadMeta = {
  fileUrl: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
};

async function uploadFile(file: File): Promise<UploadMeta> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.upload<{ file: UploadMeta }>("/uploads/admin", formData);
  return response.file;
}

function parseCard(content: string): DomainCardContent {
  if (!content.startsWith(CARD_CONTENT_PREFIX)) {
    // Legacy plain-text main post: treat the whole content as the body.
    return { body: content };
  }
  try {
    return JSON.parse(content.slice(CARD_CONTENT_PREFIX.length)) as DomainCardContent;
  } catch {
    return {};
  }
}

interface CardForm {
  title: string;
  author: string;
  source: string;
  body: string;
  glossary: string;
  audioUrl: string;
}

const emptyForm: CardForm = {
  title: "",
  author: "",
  source: "",
  body: "",
  glossary: "",
  audioUrl: "",
};

export function DomainCardsAdmin({
  section,
  componentKey,
  title,
  config,
}: {
  section: AdminSection;
  componentKey: string;
  title: string;
  config: DomainCardConfig;
}) {
  const questionGroups = useMemo(() => config.questionGroups ?? [], [config.questionGroups]);

  const [posts, setPosts] = useState<AdminSectionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // null = list view, "new" = creating, number = editing that card id
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState<AdminSectionPost | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [questionsByGroup, setQuestionsByGroup] = useState<Record<string, QuizQuestion[]>>({});
  const [activeGroup, setActiveGroup] = useState<string>(questionGroups[0]?.key || "");
  const [saving, setSaving] = useState(false);

  const imageRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLInputElement | null>(null);

  const loadPosts = async () => {
    const response = await api.get<{ posts: AdminSectionPost[] }>(`/admin/content/${section}`);
    setPosts(response.posts);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPosts()
      .catch((err) => {
        console.error("Failed to load cards:", err);
        setError("تعذر تحميل البطاقات. حاول مرة أخرى.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, componentKey]);

  const cards = useMemo(
    () => posts.filter((post) => post.category === componentKey).sort((a, b) => b.id - a.id),
    [posts, componentKey],
  );

  const questionPostsFor = (cardId: number) =>
    posts.filter((post) => post.category?.startsWith(`${componentKey}:${cardId}:questions:`));

  const cardTitle = (post: AdminSectionPost) => {
    const card = parseCard(post.content);
    return card.title?.trim() || card.body?.trim()?.split(/\r?\n/)[0]?.slice(0, 60) || "بطاقة بدون عنوان";
  };

  const seedQuestions = () =>
    questionGroups.reduce<Record<string, QuizQuestion[]>>((acc, group) => {
      acc[group.key] = [makeQuestion()];
      return acc;
    }, {});

  const startCreate = () => {
    setForm(emptyForm);
    setImageFile(null);
    setExistingImage(null);
    setAudioFile(null);
    setQuestionsByGroup(seedQuestions());
    setActiveGroup(questionGroups[0]?.key || "");
    setEditing("new");
  };

  const startEdit = (post: AdminSectionPost) => {
    const isJsonCard = post.content.startsWith(CARD_CONTENT_PREFIX);
    const card = parseCard(post.content);
    // For legacy cards (plain text), seed from the old component-wide fields so
    // the editor isn't blank during migration to the self-contained card model.
    const shared = (suffix: string) =>
      isJsonCard
        ? ""
        : posts.find((item) => item.category === `${componentKey}:${suffix}`)?.content?.trim() || "";
    setForm({
      title: card.title || shared("title"),
      author: card.author || shared("author"),
      source: card.source || shared("source"),
      body: card.body || "",
      glossary: card.glossary || shared("glossary"),
      audioUrl: card.audioUrl || "",
    });
    setImageFile(null);
    setExistingImage(post.fileUrl ? post : null);
    setAudioFile(null);
    const groups: Record<string, QuizQuestion[]> = {};
    for (const group of questionGroups) {
      const qPost = posts.find(
        (item) => item.category === `${componentKey}:${post.id}:questions:${group.key}`,
      );
      const parsed = qPost ? parseQuestions(qPost.content) : null;
      groups[group.key] = parsed && parsed.length ? parsed : [makeQuestion()];
    }
    setQuestionsByGroup(groups);
    setActiveGroup(questionGroups[0]?.key || "");
    setEditing(post.id);
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setExistingImage(null);
    setAudioFile(null);
    setQuestionsByGroup({});
    if (imageRef.current) imageRef.current.value = "";
    if (audioRef.current) audioRef.current.value = "";
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      // 1) image + audio uploads
      let imageMeta: UploadMeta | null = null;
      if (imageFile) imageMeta = await uploadFile(imageFile);
      let audioUrl = form.audioUrl;
      if (config.hasAudio && audioFile) {
        const uploadedAudio = await uploadFile(audioFile);
        audioUrl = uploadedAudio.fileUrl;
      }

      // 2) build the self-contained card payload
      const cardData: DomainCardContent = {
        title: form.title.trim(),
        author: form.author.trim(),
        source: form.source.trim(),
        body: form.body.trim(),
        ...(config.hasGlossary ? { glossary: form.glossary.trim() } : {}),
        ...(config.hasAudio ? { audioUrl: audioUrl.trim() } : {}),
      };
      const content = `${CARD_CONTENT_PREFIX}${JSON.stringify(cardData)}`;

      const filePayload = imageMeta
        ? {
            fileUrl: imageMeta.fileUrl,
            fileName: imageMeta.fileName,
            fileType: imageMeta.fileType,
            fileSize: imageMeta.fileSize,
          }
        : {};

      // 3) create or update the card post
      let cardId: number;
      if (editing === "new") {
        const created = await api.post<{ post: AdminSectionPost }>(
          `/admin/content/${section}`,
          { content, category: componentKey, ...filePayload },
        );
        cardId = created.post.id;
      } else {
        cardId = editing as number;
        await api.put(`/admin/content/${cardId}`, { content, ...filePayload });
      }

      // 4) save each question group (upsert), or delete emptied ones
      for (const group of questionGroups) {
        const category = `${componentKey}:${cardId}:questions:${group.key}`;
        const serialized = serializeQuestions(questionsByGroup[group.key] || []);
        if (serialized) {
          await api.put(`/admin/content/${section}/upsert`, { category, content: serialized });
        } else {
          const existing = posts.find((item) => item.category === category);
          if (existing) await api.delete(`/admin/content/${existing.id}`);
        }
      }

      await loadPosts();
      cancelEdit();
    } catch (err) {
      console.error("Failed to save card:", err);
      setError("تعذر حفظ البطاقة. تأكد من الاتصال والصلاحيات.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post: AdminSectionPost) => {
    if (!confirm(`هل تريد حذف بطاقة "${cardTitle(post)}" وكل أسئلتها؟`)) return;
    try {
      await Promise.all(
        questionPostsFor(post.id).map((item) => api.delete(`/admin/content/${item.id}`)),
      );
      await api.delete(`/admin/content/${post.id}`);
      await loadPosts();
      if (editing === post.id) cancelEdit();
    } catch (err) {
      console.error("Failed to delete card:", err);
      setError("تعذر حذف البطاقة.");
    }
  };

  const imagePreviewUrl = imageFile ? URL.createObjectURL(imageFile) : existingImage?.fileUrl || null;

  return (
    <Card className="rounded-[28px] border-primary/10 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-primary/5 py-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Layers className="h-5 w-5" />
          بطاقات {title}
        </CardTitle>
        {editing === null && (
          <Button type="button" onClick={startCreate} className="gap-2">
            <Plus className="h-4 w-4" /> بطاقة جديدة
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : editing !== null ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {editing === "new" ? "بطاقة جديدة" : "تعديل البطاقة"}
              </h3>
              <Button type="button" variant="ghost" onClick={cancelEdit} className="gap-1">
                <X className="h-4 w-4" /> إلغاء
              </Button>
            </div>

            {/* image */}
            <div className="rounded-2xl border bg-muted/20 p-3">
              <Label className="mb-2 block font-bold">صورة البطاقة</Label>
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt="صورة البطاقة"
                  className="mb-2 max-h-52 w-full rounded-xl border object-contain"
                />
              ) : (
                <div className="mb-2 grid h-32 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4" /> لا توجد صورة بعد
                  </span>
                </div>
              )}
              <Input
                ref={imageRef}
                type="file"
                accept={config.imageAccept || "image/*"}
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </div>

            {/* text fields */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="font-bold">العنوان</Label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
                  placeholder="عنوان البطاقة"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold">الكاتب</Label>
                <Input
                  value={form.author}
                  onChange={(event) => setForm((f) => ({ ...f, author: event.target.value }))}
                  placeholder="اسم الكاتب"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold">المصدر</Label>
                <Input
                  value={form.source}
                  onChange={(event) => setForm((f) => ({ ...f, source: event.target.value }))}
                  placeholder="المصدر"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-bold">{config.bodyLabel || "النص الكامل"}</Label>
              <Textarea
                value={form.body}
                onChange={(event) => setForm((f) => ({ ...f, body: event.target.value }))}
                placeholder="اكتب نص البطاقة هنا"
                className="min-h-[160px] leading-8"
              />
            </div>

            {config.hasGlossary && (
              <div className="space-y-1">
                <Label className="font-bold">شروحات الكلمات (كلمة: الشرح — كل سطر كلمة)</Label>
                <Textarea
                  value={form.glossary}
                  onChange={(event) => setForm((f) => ({ ...f, glossary: event.target.value }))}
                  placeholder={"مثال:\nالفاقة: الفقر\nالرأفة: الرحمة"}
                  className="min-h-[90px] leading-8"
                />
              </div>
            )}

            {config.hasAudio && (
              <div className="rounded-2xl border bg-muted/20 p-3">
                <Label className="mb-2 block font-bold">ملف الصوت (mp3) — اختياري</Label>
                {form.audioUrl && !audioFile && (
                  <audio src={form.audioUrl} controls className="mb-2 w-full" />
                )}
                <Input
                  ref={audioRef}
                  type="file"
                  accept={config.audioAccept || "audio/*,.mp3,.wav,.m4a,.ogg"}
                  onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
                />
                {audioFile && (
                  <div className="mt-2 text-xs font-medium text-primary">
                    صوت جديد: {audioFile.name}
                  </div>
                )}
              </div>
            )}

            {/* questions */}
            {questionGroups.length > 0 && (
              <div className="rounded-2xl border border-primary/10 bg-white p-3">
                <Label className="mb-3 block text-base font-semibold">أسئلة البطاقة</Label>
                <div className="mb-3 flex flex-wrap gap-2">
                  {questionGroups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setActiveGroup(group.key)}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                        activeGroup === group.key
                          ? "border-primary bg-primary text-white"
                          : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                      }`}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
                {questionGroups
                  .filter((group) => group.key === activeGroup)
                  .map((group) => (
                    <QuestionEditor
                      key={group.key}
                      questions={questionsByGroup[group.key] || [makeQuestion()]}
                      onChange={(questions) =>
                        setQuestionsByGroup((current) => ({ ...current, [group.key]: questions }))
                      }
                    />
                  ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelEdit}>
                إلغاء
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ البطاقة
              </Button>
            </div>
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-primary/20 bg-muted/20 p-8 text-center">
            <p className="mb-3 text-sm text-muted-foreground">
              لا توجد بطاقات بعد في {title}.
            </p>
            <Button type="button" onClick={startCreate} className="gap-2">
              <Plus className="h-4 w-4" /> إنشاء أول بطاقة
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((post) => (
              <div key={post.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="aspect-[16/9] w-full overflow-hidden bg-muted/40">
                  {post.fileUrl ? (
                    <img src={post.fileUrl} alt={cardTitle(post)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">
                      بدون صورة
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="line-clamp-2 font-bold text-slate-800">{cardTitle(post)}</div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(post)}
                      className="flex-1 gap-1"
                    >
                      <Pencil className="h-4 w-4" /> تعديل
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(post)}
                      className="gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
