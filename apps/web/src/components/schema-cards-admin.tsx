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
import { ImagePlus, Layers, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

export type SchemaFieldKind = "text" | "textarea" | "image" | "video" | "questions";

export interface SchemaField {
  suffix: string;
  label: string;
  kind: SchemaFieldKind;
  placeholder?: string;
}

export interface SchemaSection {
  key: string;
  label: string;
  fields: SchemaField[];
}

export interface CardSchema {
  titleLabel?: string;
  descriptionLabel?: string;
  imageLabel?: string;
  imageAccept?: string;
  videoAccept?: string;
  sections: SchemaSection[];
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

function parseAnchor(content: string): DomainCardContent {
  if (!content.startsWith(CARD_CONTENT_PREFIX)) return { body: content };
  try {
    return JSON.parse(content.slice(CARD_CONTENT_PREFIX.length)) as DomainCardContent;
  } catch {
    return {};
  }
}

export function SchemaCardsAdmin({
  section,
  componentKey,
  title,
  schema,
}: {
  section: AdminSection;
  componentKey: string;
  title: string;
  schema: CardSchema;
}) {
  const allFields = useMemo(
    () => schema.sections.flatMap((part) => part.fields),
    [schema.sections],
  );

  const [posts, setPosts] = useState<AdminSectionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [anchorTitle, setAnchorTitle] = useState("");
  const [anchorDescription, setAnchorDescription] = useState("");
  const [anchorImageFile, setAnchorImageFile] = useState<File | null>(null);
  const [anchorImage, setAnchorImage] = useState<AdminSectionPost | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [media, setMedia] = useState<Record<string, AdminSectionPost | null>>({});
  const [questions, setQuestions] = useState<Record<string, QuizQuestion[]>>({});
  const [activeSection, setActiveSection] = useState(schema.sections[0]?.key || "");
  const [saving, setSaving] = useState(false);

  const anchorImageRef = useRef<HTMLInputElement | null>(null);

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

  const scopedPostsFor = (cardId: number) =>
    posts.filter((post) => post.category?.startsWith(`${componentKey}:${cardId}:`));

  const cardTitleOf = (post: AdminSectionPost) => {
    const anchor = parseAnchor(post.content);
    return anchor.title?.trim() || anchor.body?.trim()?.split(/\r?\n/)[0]?.slice(0, 60) || "بطاقة بدون عنوان";
  };

  const resetEditorState = () => {
    setAnchorTitle("");
    setAnchorDescription("");
    setAnchorImageFile(null);
    setAnchorImage(null);
    setValues({});
    setFiles({});
    setMedia({});
    setQuestions({});
    setActiveSection(schema.sections[0]?.key || "");
    if (anchorImageRef.current) anchorImageRef.current.value = "";
  };

  const startCreate = () => {
    resetEditorState();
    const seededQuestions: Record<string, QuizQuestion[]> = {};
    for (const field of allFields) {
      if (field.kind === "questions") seededQuestions[field.suffix] = [makeQuestion()];
    }
    setQuestions(seededQuestions);
    setEditing("new");
  };

  const startEdit = (post: AdminSectionPost) => {
    resetEditorState();
    const anchor = parseAnchor(post.content);
    setAnchorTitle(anchor.title || "");
    setAnchorDescription(anchor.body || "");
    setAnchorImage(post.fileUrl ? post : null);

    const nextValues: Record<string, string> = {};
    const nextMedia: Record<string, AdminSectionPost | null> = {};
    const nextQuestions: Record<string, QuizQuestion[]> = {};
    for (const field of allFields) {
      const scoped = posts.find(
        (item) => item.category === `${componentKey}:${post.id}:${field.suffix}`,
      );
      if (field.kind === "questions") {
        const parsed = scoped ? parseQuestions(scoped.content) : null;
        nextQuestions[field.suffix] = parsed && parsed.length ? parsed : [makeQuestion()];
      } else if (field.kind === "video") {
        nextValues[field.suffix] = scoped?.fileUrl || "";
        nextMedia[field.suffix] = scoped || null;
      } else if (field.kind === "image") {
        nextMedia[field.suffix] = scoped || null;
      } else {
        nextValues[field.suffix] = scoped?.content || "";
      }
    }
    setValues(nextValues);
    setMedia(nextMedia);
    setQuestions(nextQuestions);
    setEditing(post.id);
  };

  const cancelEdit = () => {
    resetEditorState();
    setEditing(null);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      // 1) anchor (card) post: title + description + lesson image
      let anchorFile: UploadMeta | null = null;
      if (anchorImageFile) anchorFile = await uploadFile(anchorImageFile);
      const anchorData: DomainCardContent = {
        title: anchorTitle.trim(),
        body: anchorDescription.trim(),
      };
      const anchorContent = `${CARD_CONTENT_PREFIX}${JSON.stringify(anchorData)}`;
      const anchorFilePayload = anchorFile
        ? {
            fileUrl: anchorFile.fileUrl,
            fileName: anchorFile.fileName,
            fileType: anchorFile.fileType,
            fileSize: anchorFile.fileSize,
          }
        : {};

      let cardId: number;
      if (editing === "new") {
        const created = await api.post<{ post: AdminSectionPost }>(`/admin/content/${section}`, {
          content: anchorContent,
          category: componentKey,
          ...anchorFilePayload,
        });
        cardId = created.post.id;
      } else {
        cardId = editing as number;
        await api.put(`/admin/content/${cardId}`, { content: anchorContent, ...anchorFilePayload });
      }

      // 2) every scoped field
      for (const field of allFields) {
        const category = `${componentKey}:${cardId}:${field.suffix}`;
        const existing = posts.find((item) => item.category === category);

        if (field.kind === "questions") {
          const serialized = serializeQuestions(questions[field.suffix] || []);
          if (serialized) {
            await api.put(`/admin/content/${section}/upsert`, { category, content: serialized });
          } else if (existing) {
            await api.delete(`/admin/content/${existing.id}`);
          }
          continue;
        }

        if (field.kind === "image") {
          const file = files[field.suffix];
          if (file) {
            const uploaded = await uploadFile(file);
            await api.put(`/admin/content/${section}/upsert`, {
              category,
              content: "",
              fileUrl: uploaded.fileUrl,
              fileName: uploaded.fileName,
              fileType: uploaded.fileType,
              fileSize: uploaded.fileSize,
            });
          }
          continue;
        }

        if (field.kind === "video") {
          const file = files[field.suffix];
          if (file) {
            const uploaded = await uploadFile(file);
            await api.put(`/admin/content/${section}/upsert`, {
              category,
              content: "",
              fileUrl: uploaded.fileUrl,
              fileName: uploaded.fileName,
              fileType: uploaded.fileType,
              fileSize: uploaded.fileSize,
            });
          } else {
            const url = (values[field.suffix] || "").trim();
            if (url) {
              await api.put(`/admin/content/${section}/upsert`, {
                category,
                content: "",
                fileUrl: url,
                fileName: "video",
                fileType: "video/url",
              });
            } else if (existing) {
              await api.delete(`/admin/content/${existing.id}`);
            }
          }
          continue;
        }

        // text / textarea
        const value = (values[field.suffix] || "").trim();
        if (value) {
          await api.put(`/admin/content/${section}/upsert`, { category, content: value });
        } else if (existing) {
          await api.delete(`/admin/content/${existing.id}`);
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
    if (!confirm(`هل تريد حذف بطاقة "${cardTitleOf(post)}" وكل محتواها؟`)) return;
    try {
      await Promise.all(scopedPostsFor(post.id).map((item) => api.delete(`/admin/content/${item.id}`)));
      await api.delete(`/admin/content/${post.id}`);
      await loadPosts();
      if (editing === post.id) cancelEdit();
    } catch (err) {
      console.error("Failed to delete card:", err);
      setError("تعذر حذف البطاقة.");
    }
  };

  const anchorImageUrl = anchorImageFile
    ? URL.createObjectURL(anchorImageFile)
    : anchorImage?.fileUrl || null;

  const renderField = (field: SchemaField) => {
    if (field.kind === "questions") {
      return (
        <div key={field.suffix} className="space-y-2">
          <Label className="font-bold">{field.label}</Label>
          <QuestionEditor
            questions={questions[field.suffix] || [makeQuestion()]}
            onChange={(next) => setQuestions((current) => ({ ...current, [field.suffix]: next }))}
          />
        </div>
      );
    }

    if (field.kind === "image" || field.kind === "video") {
      const existing = media[field.suffix];
      const chosen = files[field.suffix];
      return (
        <div key={field.suffix} className="space-y-2 rounded-2xl border bg-muted/20 p-3">
          <Label className="font-bold">{field.label}</Label>
          {field.kind === "video" && (
            <Input
              value={values[field.suffix] || ""}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.suffix]: event.target.value }))
              }
              placeholder="رابط يوتيوب أو رابط فيديو (أو ارفع ملفاً بالأسفل)"
              dir="ltr"
            />
          )}
          {existing?.fileUrl && !chosen ? (
            <div className="text-xs font-medium text-primary">
              الحالي: {existing.fileName || existing.fileUrl}
            </div>
          ) : null}
          <Input
            type="file"
            accept={
              field.kind === "image"
                ? schema.imageAccept || "image/*"
                : schema.videoAccept || "video/*,.mp4,.webm,.mov"
            }
            onChange={(event) =>
              setFiles((current) => ({ ...current, [field.suffix]: event.target.files?.[0] ?? null }))
            }
          />
          {chosen && <div className="text-xs font-medium text-primary">ملف جديد: {chosen.name}</div>}
        </div>
      );
    }

    if (field.kind === "textarea") {
      return (
        <div key={field.suffix} className="space-y-1">
          <Label className="font-bold">{field.label}</Label>
          <Textarea
            value={values[field.suffix] || ""}
            onChange={(event) =>
              setValues((current) => ({ ...current, [field.suffix]: event.target.value }))
            }
            placeholder={field.placeholder || `اكتب ${field.label}`}
            className="min-h-[100px] leading-8"
          />
        </div>
      );
    }

    return (
      <div key={field.suffix} className="space-y-1">
        <Label className="font-bold">{field.label}</Label>
        <Input
          value={values[field.suffix] || ""}
          onChange={(event) =>
            setValues((current) => ({ ...current, [field.suffix]: event.target.value }))
          }
          placeholder={field.placeholder || `اكتب ${field.label}`}
        />
      </div>
    );
  };

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
              <h3 className="text-lg font-bold">{editing === "new" ? "بطاقة جديدة" : "تعديل البطاقة"}</h3>
              <Button type="button" variant="ghost" onClick={cancelEdit} className="gap-1">
                <X className="h-4 w-4" /> إلغاء
              </Button>
            </div>

            {/* anchor: image + title + description */}
            <div className="rounded-2xl border bg-muted/20 p-3">
              <Label className="mb-2 block font-bold">{schema.imageLabel || "صورة البطاقة"}</Label>
              {anchorImageUrl ? (
                <img
                  src={anchorImageUrl}
                  alt="صورة البطاقة"
                  className="mb-2 max-h-52 w-full rounded-xl border object-contain"
                />
              ) : (
                <div className="mb-2 grid h-28 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4" /> لا توجد صورة بعد
                  </span>
                </div>
              )}
              <Input
                ref={anchorImageRef}
                type="file"
                accept={schema.imageAccept || "image/*"}
                onChange={(event) => setAnchorImageFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-1">
              <Label className="font-bold">{schema.titleLabel || "عنوان الدرس"}</Label>
              <Input
                value={anchorTitle}
                onChange={(event) => setAnchorTitle(event.target.value)}
                placeholder="عنوان البطاقة"
              />
            </div>
            {schema.descriptionLabel && (
              <div className="space-y-1">
                <Label className="font-bold">{schema.descriptionLabel}</Label>
                <Textarea
                  value={anchorDescription}
                  onChange={(event) => setAnchorDescription(event.target.value)}
                  placeholder={schema.descriptionLabel}
                  className="min-h-[80px] leading-8"
                />
              </div>
            )}

            {/* section tabs */}
            <div className="rounded-2xl border border-primary/10 bg-white p-3">
              <Label className="mb-3 block text-base font-semibold">أجزاء البطاقة</Label>
              <div className="mb-4 flex flex-wrap gap-2">
                {schema.sections.map((part) => (
                  <button
                    key={part.key}
                    type="button"
                    onClick={() => setActiveSection(part.key)}
                    className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                      activeSection === part.key
                        ? "border-primary bg-primary text-white"
                        : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                    }`}
                  >
                    {part.label}
                  </button>
                ))}
              </div>
              {schema.sections
                .filter((part) => part.key === activeSection)
                .map((part) => (
                  <div key={part.key} className="space-y-3">
                    {part.fields.map((field) => renderField(field))}
                  </div>
                ))}
            </div>

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
            <p className="mb-3 text-sm text-muted-foreground">لا توجد بطاقات بعد في {title}.</p>
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
                    <img src={post.fileUrl} alt={cardTitleOf(post)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">بدون صورة</div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="line-clamp-2 font-bold text-slate-800">{cardTitleOf(post)}</div>
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
