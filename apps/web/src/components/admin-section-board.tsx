import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminSection,
  AdminSectionPost,
  QuizQuestion,
} from "@teaching-app/shared";
import { parseDomainCardContent, getDomainCardDisplayBody } from "@teaching-app/shared";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileUp,
  HelpCircle,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";

export type AdminBoardFieldKind = "text" | "textarea" | "file" | "questions";

export interface AdminBoardCategory {
  value: string;
  label: string;
  /** Optional explicit widget kind. When omitted it is inferred from the label/value. */
  kind?: AdminBoardFieldKind;
}

export interface AdminBoardCategoryGroup {
  key: string;
  label: string;
  categoryValues: string[];
}

export type DefaultQuestionsByCategory = Record<string, QuizQuestion[]>;

type UploadPayload = {
  fileUrl: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
};

type UpsertPayload = {
  category: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string | null;
  fileSize?: number | null;
};

const QUESTIONS_PREFIX = "__DOMAIN_QUESTIONS__:";

function isQuestionCategory(category?: AdminBoardCategory | null) {
  return Boolean(
    category &&
      (/سؤال|أسئلة|questions/i.test(category.label) ||
        /questions/i.test(category.value)),
  );
}

/** Single, deterministic place that decides which widget a category renders. */
function categoryKind(category: AdminBoardCategory): AdminBoardFieldKind {
  if (category.kind) return category.kind;
  if (isQuestionCategory(category)) return "questions";

  const value = category.value.toLowerCase();
  const label = category.label.toLowerCase();
  const isTextAboutVideo =
    /video-title|video-description/.test(value) ||
    /عنوان الفيديو|وصف الفيديو/.test(category.label);
  const isFile =
    !isTextAboutVideo &&
    (/(:|^)(file|audio|video|image|upload)$/.test(value) ||
      /رفع|ملف|mp3|audio|صورة|image/i.test(category.label) ||
      (/فيديو|video/i.test(category.label) &&
        !/عنوان|وصف|description|title/i.test(label)));
  if (isFile) return "file";

  if (
    /glossary|objective|resources|links|application:questions|analysis|lexicon|rule|intro|summary|context|task|concept|types|examples|reminder|questions-title|text/i.test(
      category.value,
    )
  ) {
    return "textarea";
  }
  return "text";
}

export function makeQuestion(type: QuizQuestion["type"] = "multiple-choice"): QuizQuestion {
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    type,
    question: "",
    options: ["", "", "", ""],
    feedbacks: ["", "", "", ""],
    correctAnswer: 0,
    matchPairs: [
      { left: "", right: "" },
      { left: "", right: "" },
      { left: "", right: "" },
    ],
    modelAnswer: "",
    objective: "",
    level: "",
  };
}

function normalizeQuestion(question: QuizQuestion, index: number): QuizQuestion {
  const type = question.type || "multiple-choice";
  const options = Array.from(
    { length: 4 },
    (_, optionIndex) => question.options?.[optionIndex] || "",
  );
  const feedbacks = Array.from(
    { length: 4 },
    (_, optionIndex) => question.feedbacks?.[optionIndex] || "",
  );
  const matchPairs = (question.matchPairs?.length
    ? question.matchPairs
    : [
        { left: options[0] || "", right: options[1] || "" },
        { left: options[2] || "", right: options[3] || "" },
      ]
  ).map((pair) => ({ left: pair.left || "", right: pair.right || "" }));

  return {
    id: question.id || `q-${index + 1}`,
    type,
    question: question.question || "",
    options,
    feedbacks,
    correctAnswer: Math.min(Math.max(Number(question.correctAnswer) || 0, 0), 3),
    matchPairs,
    modelAnswer: question.modelAnswer || "",
    objective: question.objective || "",
    level: question.level || "",
  };
}

export function serializeQuestions(questions: QuizQuestion[]) {
  const cleaned = questions
    .map((question, index) => normalizeQuestion(question, index))
    .filter((question) => {
      if (!question.question.trim()) return false;
      if (question.type === "match") {
        return Boolean(
          question.matchPairs?.some((pair) => pair.left.trim() && pair.right.trim()),
        );
      }
      if (question.type === "communicative") return true;
      return question.options.some((option) => option.trim());
    });

  return cleaned.length ? `${QUESTIONS_PREFIX}${JSON.stringify(cleaned)}` : "";
}

export function parseQuestions(content: string): QuizQuestion[] | null {
  if (!content.startsWith(QUESTIONS_PREFIX)) return null;
  try {
    const questions = JSON.parse(
      content.slice(QUESTIONS_PREFIX.length),
    ) as QuizQuestion[];
    if (!Array.isArray(questions)) return null;
    return questions.map((question, index) => normalizeQuestion(question, index));
  } catch {
    return null;
  }
}

export function QuestionEditor({
  questions,
  onChange,
}: {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
}) {
  const updateQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    onChange(
      questions.map((question, currentIndex) =>
        currentIndex === index
          ? normalizeQuestion({ ...question, ...patch }, index)
          : question,
      ),
    );
  };

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    value: string,
  ) => {
    onChange(
      questions.map((question, currentIndex) => {
        if (currentIndex !== questionIndex) return question;
        return normalizeQuestion(
          {
            ...question,
            options: question.options.map((option, currentOptionIndex) =>
              currentOptionIndex === optionIndex ? value : option,
            ),
          },
          questionIndex,
        );
      }),
    );
  };

  const updateFeedback = (
    questionIndex: number,
    optionIndex: number,
    value: string,
  ) => {
    onChange(
      questions.map((question, currentIndex) => {
        if (currentIndex !== questionIndex) return question;
        const feedbacks = Array.from(
          { length: 4 },
          (_, index) => question.feedbacks?.[index] || "",
        );
        feedbacks[optionIndex] = value;
        return normalizeQuestion({ ...question, feedbacks }, questionIndex);
      }),
    );
  };

  const updatePair = (
    questionIndex: number,
    pairIndex: number,
    field: "left" | "right",
    value: string,
  ) => {
    onChange(
      questions.map((question, currentIndex) => {
        if (currentIndex !== questionIndex) return question;
        const pairs = [...(question.matchPairs || [])];
        pairs[pairIndex] = {
          ...(pairs[pairIndex] || { left: "", right: "" }),
          [field]: value,
        };
        return normalizeQuestion({ ...question, matchPairs: pairs }, questionIndex);
      }),
    );
  };

  const addPair = (questionIndex: number) => {
    onChange(
      questions.map((question, currentIndex) =>
        currentIndex === questionIndex
          ? normalizeQuestion(
              {
                ...question,
                matchPairs: [...(question.matchPairs || []), { left: "", right: "" }],
              },
              questionIndex,
            )
          : question,
      ),
    );
  };

  const removePair = (questionIndex: number, pairIndex: number) => {
    onChange(
      questions.map((question, currentIndex) =>
        currentIndex === questionIndex
          ? normalizeQuestion(
              {
                ...question,
                matchPairs: (question.matchPairs || []).filter(
                  (_, index) => index !== pairIndex,
                ),
              },
              questionIndex,
            )
          : question,
      ),
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-primary/10 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <HelpCircle className="h-4 w-4" /> أسئلة بنفس تفاعل ملف القراءة
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...questions, makeQuestion()])}
        >
          <Plus className="h-4 w-4" /> إضافة سؤال
        </Button>
      </div>

      <div className="space-y-4">
        {questions.map((question, questionIndex) => {
          const q = normalizeQuestion(question, questionIndex);
          const type = q.type || "multiple-choice";
          return (
            <div key={q.id} className="rounded-2xl border bg-white p-3 shadow-sm">
              <div className="mb-3 grid gap-2 md:grid-cols-[120px_1fr_160px_140px]">
                <Label className="self-center font-bold text-primary">
                  السؤال {questionIndex + 1}
                </Label>
                <Textarea
                  value={q.question}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { question: event.target.value })
                  }
                  placeholder="اكتب نص السؤال"
                  className="min-h-[54px] leading-7"
                />
                <select
                  className="h-10 rounded-md border bg-background px-2 text-sm"
                  value={type}
                  onChange={(event) =>
                    updateQuestion(questionIndex, {
                      type: event.target.value as QuizQuestion["type"],
                    })
                  }
                >
                  <option value="multiple-choice">اختيار من متعدد</option>
                  <option value="match">صِلْ بسهم</option>
                  <option value="fill-blank">ملء الفراغ</option>
                  <option value="communicative">وضعية تواصلية</option>
                </select>
                <Input
                  value={q.level || ""}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { level: event.target.value })
                  }
                  placeholder="المستوى: مباشر..."
                  className="h-10 text-sm"
                />
              </div>

              <Textarea
                value={q.objective || ""}
                onChange={(event) =>
                  updateQuestion(questionIndex, { objective: event.target.value })
                }
                placeholder="الهدف التعليمي لهذا السؤال (اختياري)"
                className="mb-3 min-h-[44px] text-sm"
              />

              {type === "match" ? (
                <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <div className="flex items-center justify-between gap-2 text-sm font-bold text-emerald-800">
                    <span>أزواج صِلْ بسهم: اليسار ↔ اليمين</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addPair(questionIndex)}
                    >
                      <Plus className="h-4 w-4" /> زوج جديد
                    </Button>
                  </div>
                  {(q.matchPairs || []).map((pair, pairIndex) => (
                    <div key={pairIndex} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <Input
                        value={pair.left}
                        onChange={(event) =>
                          updatePair(questionIndex, pairIndex, "left", event.target.value)
                        }
                        placeholder="العنصر الأول"
                      />
                      <Input
                        value={pair.right}
                        onChange={(event) =>
                          updatePair(questionIndex, pairIndex, "right", event.target.value)
                        }
                        placeholder="العنصر المطابق"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={(q.matchPairs || []).length <= 1}
                        onClick={() => removePair(questionIndex, pairIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : type === "communicative" ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                  <Label className="mb-2 block font-bold text-amber-800">
                    الإجابة المقترحة / النموذج
                  </Label>
                  <Textarea
                    value={q.modelAnswer || ""}
                    onChange={(event) =>
                      updateQuestion(questionIndex, { modelAnswer: event.target.value })
                    }
                    placeholder="أدخل الإجابة المقترحة التي ستظهر للتلميذ"
                    className="min-h-[90px] leading-7"
                  />
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border bg-white">
                  <table className="w-full min-w-[1050px] border-collapse text-right text-xs">
                    <thead className="bg-primary/10 text-primary">
                      <tr>
                        <th className="border-b px-2 py-2 font-bold">#</th>
                        <th className="border-b px-2 py-2 font-bold">الجواب / الاختيار</th>
                        <th className="border-b px-2 py-2 font-bold">
                          تعليق عند اختيار هذا الجواب
                        </th>
                        {type === "multiple-choice" ? (
                          <th className="border-b px-2 py-2 font-bold">الصحيح</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {q.options.map((option, optionIndex) => (
                        <tr key={optionIndex}>
                          <td className="border-b px-2 py-2 font-bold text-primary">
                            {optionIndex + 1}
                          </td>
                          <td className="border-b px-2 py-2">
                            <Input
                              value={option}
                              onChange={(event) =>
                                updateOption(questionIndex, optionIndex, event.target.value)
                              }
                              placeholder={
                                type === "fill-blank"
                                  ? `كلمة اختيار ${optionIndex + 1}`
                                  : `جواب ${optionIndex + 1}`
                              }
                              className="h-9 text-xs"
                            />
                          </td>
                          <td className="border-b px-2 py-2">
                            <Input
                              value={q.feedbacks?.[optionIndex] || ""}
                              onChange={(event) =>
                                updateFeedback(questionIndex, optionIndex, event.target.value)
                              }
                              placeholder="شرح صحيح/غلط مثل الملف"
                              className="h-9 text-xs"
                            />
                          </td>
                          {type === "multiple-choice" ? (
                            <td className="border-b px-2 py-2 text-center">
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={q.correctAnswer === optionIndex}
                                onChange={() =>
                                  updateQuestion(questionIndex, {
                                    correctAnswer: optionIndex,
                                  })
                                }
                              />
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {type === "fill-blank" ? (
                    <div className="border-t bg-emerald-50/60 p-3 text-sm">
                      <Label className="mb-2 block font-bold text-emerald-800">
                        الكلمة الصحيحة للفراغ
                      </Label>
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={q.correctAnswer}
                        onChange={(event) =>
                          updateQuestion(questionIndex, {
                            correctAnswer: Number(event.target.value),
                          })
                        }
                      >
                        {q.options.map((option, optionIndex) => (
                          <option key={optionIndex} value={optionIndex}>
                            {option || `اختيار ${optionIndex + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={questions.length <= 1}
                  onClick={() =>
                    onChange(questions.filter((_, index) => index !== questionIndex))
                  }
                >
                  <Trash2 className="h-4 w-4" /> حذف السؤال
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilePreview({ post }: { post: AdminSectionPost }) {
  if (!post.fileUrl) return null;

  const fileType = post.fileType || "";
  const fileName = post.fileName || "فتح الملف";

  return (
    <div className="mt-3 space-y-2">
      {fileType.startsWith("image/") && (
        <img
          src={post.fileUrl}
          alt={fileName}
          className="max-h-64 w-full rounded-2xl border object-contain"
        />
      )}
      {fileType.startsWith("audio/") && (
        <audio src={post.fileUrl} controls className="w-full" />
      )}
      {fileType.startsWith("video/") && (
        <video
          src={post.fileUrl}
          controls
          className="max-h-72 w-full rounded-2xl border bg-black"
        />
      )}
      {(fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) && (
        <iframe
          src={post.fileUrl}
          title={fileName}
          className="h-72 w-full rounded-2xl border bg-white"
        />
      )}
      {!fileType.startsWith("image/") &&
        !fileType.startsWith("audio/") &&
        !fileType.startsWith("video/") &&
        fileType !== "application/pdf" &&
        !fileName.toLowerCase().endsWith(".pdf") && (
          <div className="rounded-2xl border bg-muted/40 p-3 text-sm text-muted-foreground">
            تم رفع الملف وسيظهر رابطه أسفله. بعض ملفات Word/PowerPoint لا يمكن عرضها داخل
            المتصفح مباشرة.
          </div>
        )}
      <a
        href={post.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-sm text-primary"
      >
        <Paperclip className="h-4 w-4" />
        {fileName}
      </a>
    </div>
  );
}

async function uploadFile(nextFile: File): Promise<UploadPayload> {
  const formData = new FormData();
  formData.append("file", nextFile);
  const response = await api.upload<{ file: UploadPayload }>("/uploads/admin", formData);
  return response.file;
}

/**
 * A single self-contained field card. It owns its draft state, shows the current
 * saved value, and saves/clears ONLY itself via the per-category upsert endpoint.
 * It is remounted (via `key`) whenever its backing post changes, so it always
 * re-seeds from fresh data after a save.
 */
function FieldCard({
  section,
  category,
  kind,
  currentPost,
  fileAccept,
  defaultQuestions,
  onChanged,
}: {
  section: AdminSection;
  category: AdminBoardCategory;
  kind: AdminBoardFieldKind;
  currentPost: AdminSectionPost | null;
  fileAccept?: string;
  defaultQuestions: QuizQuestion[];
  onChanged: () => Promise<void> | void;
}) {
  const [text, setText] = useState(
    kind === "text" || kind === "textarea" ? currentPost?.content || "" : "",
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => {
    if (kind !== "questions") return [];
    const parsed = currentPost ? parseQuestions(currentPost.content) : null;
    return parsed && parsed.length ? parsed : defaultQuestions;
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(kind === "questions" ? !currentPost : true);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const saved = Boolean(currentPost);

  const upsert = (payload: UpsertPayload) =>
    api.put(`/admin/content/${section}/upsert`, payload);

  const handleSave = async () => {
    setError(null);
    try {
      if (kind === "file") {
        if (!file) {
          setError("اختر ملفاً أولاً");
          return;
        }
        setSaving(true);
        const uploaded = await uploadFile(file);
        await upsert({ category: category.value, content: "", ...uploaded });
      } else if (kind === "questions") {
        const serialized = serializeQuestions(questions);
        if (!serialized) {
          setError("أضف سؤالاً مكتملاً واحداً على الأقل");
          return;
        }
        setSaving(true);
        await upsert({ category: category.value, content: serialized });
      } else {
        if (!text.trim()) {
          setError("اكتب محتوى أولاً (أو استعمل زر المسح)");
          return;
        }
        setSaving(true);
        await upsert({ category: category.value, content: text.trim() });
      }
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await onChanged();
    } catch (err) {
      console.error("Failed to save field:", err);
      setError("تعذر الحفظ. تأكد من الاتصال والصلاحيات.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setError(null);
    if (currentPost) {
      if (!confirm(`مسح محتوى "${category.label}"؟`)) return;
      setSaving(true);
      try {
        await api.delete(`/admin/content/${currentPost.id}`);
        await onChanged();
      } catch (err) {
        console.error("Failed to clear field:", err);
        setError("تعذر المسح.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setText("");
    setQuestions(defaultQuestions);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const statusBadge = saved ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> محفوظ
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
      غير محفوظ
    </span>
  );

  const actionButtons = (
    <div className="flex shrink-0 items-center gap-2">
      <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="gap-1">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        حفظ
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClear}
        disabled={saving || (!saved && !text.trim() && !file)}
        className="gap-1 text-destructive"
      >
        <Trash2 className="h-4 w-4" /> مسح
      </Button>
    </div>
  );

  return (
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      {kind === "text" ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[150px] flex-1 items-center gap-2">
            <Label className="mb-0 w-32 shrink-0 font-bold text-slate-700">
              {category.label}
            </Label>
            <Input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`اكتب ${category.label} هنا`}
            />
          </div>
          {statusBadge}
          {actionButtons}
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {kind === "questions" ? (
                <button
                  type="button"
                  onClick={() => setOpen((value) => !value)}
                  className="inline-flex items-center gap-1 font-bold text-slate-700"
                >
                  {open ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {category.label}
                </button>
              ) : (
                <Label className="mb-0 font-bold text-slate-700">{category.label}</Label>
              )}
              {statusBadge}
            </div>
            {actionButtons}
          </div>

          {kind === "textarea" && (
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`اكتب ${category.label} هنا`}
              className="min-h-[120px] leading-8"
            />
          )}

          {kind === "file" && (
            <div className="space-y-2">
              {currentPost?.fileUrl ? (
                <FilePreview post={currentPost} />
              ) : (
                <p className="text-xs text-muted-foreground">لا يوجد ملف محفوظ بعد.</p>
              )}
              <Input
                ref={fileRef}
                type="file"
                accept={fileAccept}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {file && (
                <div className="text-xs font-medium text-primary">
                  ملف جديد: {file.name} — اضغط حفظ للاستبدال
                </div>
              )}
            </div>
          )}

          {kind === "questions" &&
            (open ? (
              <QuestionEditor questions={questions} onChange={setQuestions} />
            ) : (
              <p className="text-xs text-muted-foreground">
                {saved
                  ? "الأسئلة محفوظة — افتح المحرر للتعديل."
                  : "لم تُحفظ أسئلة بعد — افتح المحرر للإضافة."}
              </p>
            ))}
        </>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Keyed board: a per-field editor where each category is one canonical value.
 * Used by the domain components (فهم المقروء، فهم المسموع …).
 */
function KeyedBoard({
  section,
  title,
  categories,
  categoryPrefix,
  contentLabel,
  contentPlaceholder,
  fileAccept,
  hideMainContentField,
  defaultQuestionsByCategory,
  categoryGroups,
}: {
  section: AdminSection;
  title: string;
  categories: AdminBoardCategory[];
  categoryPrefix?: string;
  contentLabel: string;
  contentPlaceholder: string;
  fileAccept?: string;
  hideMainContentField: boolean;
  defaultQuestionsByCategory: DefaultQuestionsByCategory;
  categoryGroups: AdminBoardCategoryGroup[];
}) {
  const [posts, setPosts] = useState<AdminSectionPost[]>([]);
  const [customCategories, setCustomCategories] = useState<AdminBoardCategory[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>(
    categoryGroups[0]?.key || "all",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = async () => {
    const { posts } = await api.get<{ posts: AdminSectionPost[] }>(
      `/admin/content/${section}`,
    );
    setPosts(posts);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPosts()
      .catch((err) => {
        console.error("Failed to load admin section:", err);
        setError("تعذر تحميل هذا القسم. حاول مرة أخرى.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const fieldCategories = useMemo(() => {
    const map = new Map<string, AdminBoardCategory>();
    [...categories, ...customCategories].forEach((category) =>
      map.set(category.value, category),
    );
    return Array.from(map.values());
  }, [categories, customCategories]);

  // Surface dynamically-added listening question sections that exist in the data
  // but are not part of the static config.
  useEffect(() => {
    const known = new Set(fieldCategories.map((category) => category.value));
    const discovered = posts
      .map((post) => post.category || "")
      .filter(
        (category) =>
          /^listening:questions:\d+$/.test(category) && !known.has(category),
      )
      .map((category) => ({
        value: category,
        label: `أسئلة ${category.split(":").pop() || ""}`,
      }));
    if (discovered.length > 0) {
      setCustomCategories((current) => {
        const currentKeys = new Set(current.map((category) => category.value));
        const next = discovered.filter((category) => !currentKeys.has(category.value));
        return next.length ? [...current, ...next] : current;
      });
    }
  }, [posts, fieldCategories]);

  const addListeningQuestionSection = () => {
    const numbers = fieldCategories
      .map((category) => category.value.match(/^listening:questions:(\d+)$/)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number);
    const nextNumber = (numbers.length ? Math.max(...numbers) : 0) + 1;
    const value = `listening:questions:${nextNumber}`;
    setCustomCategories((current) =>
      current.some((category) => category.value === value)
        ? current
        : [...current, { value, label: `أسئلة ${nextNumber}` }],
    );
  };

  const activeGroupValues =
    categoryGroups.length && activeGroup !== "all"
      ? new Set(
          categoryGroups.find((group) => group.key === activeGroup)?.categoryValues ||
            [],
        )
      : null;

  const visibleCategories = activeGroupValues
    ? fieldCategories.filter(
        (category) =>
          activeGroupValues.has(category.value) ||
          /^listening:questions:\d+$/.test(category.value),
      )
    : fieldCategories;

  const postByCategory = (value: string) =>
    posts
      .filter((post) => post.category === value)
      .sort((a, b) => b.id - a.id)[0] || null;

  const getDefaultQuestions = (value: string) =>
    defaultQuestionsByCategory[value]?.length
      ? defaultQuestionsByCategory[value].map((question, index) =>
          normalizeQuestion(question, index),
        )
      : [makeQuestion()];

  const mainCategory: AdminBoardCategory | null =
    !hideMainContentField && categoryPrefix
      ? { value: categoryPrefix, label: contentLabel, kind: "textarea" }
      : null;
  const mainPost = mainCategory ? postByCategory(mainCategory.value) : null;

  const hasListeningQuestions = fieldCategories.some((category) =>
    /^listening:questions:\d+$/.test(category.value),
  );

  return (
    <Card className="rounded-[28px] border-primary/10 bg-white shadow-sm">
      <CardHeader className="border-b bg-primary/5 py-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <FileUp className="h-5 w-5" />
          {title}
        </CardTitle>
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
        ) : (
          <>
            {mainCategory && (
              <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/50 p-3 shadow-sm">
                <FieldCard
                  key={`${mainCategory.value}:${mainPost?.id ?? "new"}`}
                  section={section}
                  category={mainCategory}
                  kind="textarea"
                  currentPost={mainPost}
                  fileAccept={fileAccept}
                  defaultQuestions={[makeQuestion()]}
                  onChanged={loadPosts}
                />
                {!mainPost && (
                  <p className="mt-2 px-1 text-xs text-emerald-700">{contentPlaceholder}</p>
                )}
              </div>
            )}

            {categoryGroups.length > 0 && (
              <div className="rounded-2xl border border-primary/10 bg-white p-3">
                <Label className="mb-3 block text-base font-semibold">
                  اختر الجزء الذي تريد تعميره
                </Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveGroup("all")}
                    className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                      activeGroup === "all"
                        ? "border-primary bg-primary text-white"
                        : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                    }`}
                  >
                    الكل
                  </button>
                  {categoryGroups.map((group) => (
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
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-base font-semibold">عناصر هذا المكون</Label>
                {hasListeningQuestions && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addListeningQuestionSection}
                  >
                    <Plus className="h-4 w-4" /> إضافة قسم أسئلة
                  </Button>
                )}
              </div>

              {visibleCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد عناصر في هذا الجزء.</p>
              ) : (
                visibleCategories.map((category) => {
                  const kind = categoryKind(category);
                  const post = postByCategory(category.value);
                  return (
                    <FieldCard
                      key={`${category.value}:${post?.id ?? "new"}`}
                      section={section}
                      category={category}
                      kind={kind}
                      currentPost={post}
                      fileAccept={fileAccept}
                      defaultQuestions={getDefaultQuestions(category.value)}
                      onChanged={loadPosts}
                    />
                  );
                })
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Feed board: free-form timeline of posts (no categories). Used by the
 * accounts / tracking / students sections where multiple posts are expected.
 */
function FeedBoard({
  section,
  title,
  contentLabel,
  contentPlaceholder,
  fileAccept,
}: {
  section: AdminSection;
  title: string;
  contentLabel: string;
  contentPlaceholder: string;
  fileAccept?: string;
}) {
  const [posts, setPosts] = useState<AdminSectionPost[]>([]);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadPosts = async () => {
    const { posts } = await api.get<{ posts: AdminSectionPost[] }>(
      `/admin/content/${section}`,
    );
    setPosts(posts);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPosts()
      .catch((err) => {
        console.error("Failed to load admin section:", err);
        setError("تعذر تحميل هذا القسم. حاول مرة أخرى.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const handleSubmit = async () => {
    if ((!content.trim() && !file) || sending) return;
    setSending(true);
    setError(null);
    try {
      let uploaded: UploadPayload | null = null;
      if (file) uploaded = await uploadFile(file);
      await api.post(`/admin/content/${section}`, {
        content: content.trim(),
        category: null,
        ...(uploaded || {}),
      });
      setContent("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadPosts();
    } catch (err) {
      console.error("Failed to publish admin content:", err);
      setError("تعذر نشر المحتوى. تأكد من الاتصال والصلاحيات.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل تريد حذف هذا المحتوى؟")) return;
    try {
      await api.delete(`/admin/content/${id}`);
      await loadPosts();
    } catch (err) {
      console.error("Failed to delete admin content:", err);
      setError("تعذر حذف المحتوى.");
    }
  };

  return (
    <Card className="rounded-[28px] border-primary/10 bg-white shadow-sm">
      <CardHeader className="border-b bg-primary/5 py-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <FileUp className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2 rounded-2xl border border-primary/10 bg-muted/20 p-4">
          <Label className="block font-semibold">{contentLabel}</Label>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={contentPlaceholder}
            className="min-h-[120px] leading-8"
          />
          <Label className="mt-2 block">إرفاق ملف / صورة / صوت</Label>
          <Input
            ref={fileRef}
            type="file"
            accept={fileAccept}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {file && <div className="text-xs font-medium text-primary">{file.name}</div>}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={sending || (!content.trim() && !file)}
              className="gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              نشر المحتوى
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-primary/10 bg-muted/10 p-4">
          <div className="text-base font-semibold">المحتوى المنشور داخل {title}</div>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد محتوى مرفوع بعد.</p>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {post.userEmail} • {new Date(post.createdAt).toLocaleString("ar-MA")}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(post.id)}
                    className="gap-1"
                  >
                    <Trash2 className="h-4 w-4" /> حذف
                  </Button>
                </div>
                {post.content ? (
                  (() => {
                    const card = parseDomainCardContent(post.content);
                    if (card) {
                      return (
                        <div className="space-y-1 text-sm leading-7">
                          {card.title ? (
                            <p>
                              <b>العنوان:</b> {card.title}
                            </p>
                          ) : null}
                          {card.author ? (
                            <p>
                              <b>الكاتب:</b> {card.author}
                            </p>
                          ) : null}
                          {card.source ? (
                            <p>
                              <b>المصدر:</b> {card.source}
                            </p>
                          ) : null}
                          {card.body ? (
                            <p className="whitespace-pre-wrap">{card.body}</p>
                          ) : null}
                        </div>
                      );
                    }
                    const display = getDomainCardDisplayBody(post.content);
                    return display ? (
                      <p className="whitespace-pre-wrap text-sm leading-7">{display}</p>
                    ) : null;
                  })()
                ) : null}
                <FilePreview post={post} />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminSectionBoard({
  section,
  title,
  categories = [],
  categoryPrefix,
  contentLabel = "نص أو ملاحظة",
  contentPlaceholder = "اكتب محتوى أو ارفع ملفاً",
  fileAccept,
  hideMainContentField = false,
  defaultQuestionsByCategory = {},
  categoryGroups = [],
}: {
  section: AdminSection | AdminSection[];
  title: string;
  categories?: AdminBoardCategory[];
  categoryPrefix?: string;
  contentLabel?: string;
  contentPlaceholder?: string;
  fileAccept?: string;
  hideMainContentField?: boolean;
  defaultQuestionsByCategory?: DefaultQuestionsByCategory;
  categoryGroups?: AdminBoardCategoryGroup[];
}) {
  const primarySection = Array.isArray(section) ? section[0] : section;

  // Keyed mode (per-field cards) when categories are provided; otherwise a
  // free-form feed for the accounts / tracking / students sections.
  if (categories.length > 0) {
    return (
      <KeyedBoard
        section={primarySection}
        title={title}
        categories={categories}
        categoryPrefix={categoryPrefix}
        contentLabel={contentLabel}
        contentPlaceholder={contentPlaceholder}
        fileAccept={fileAccept}
        hideMainContentField={hideMainContentField}
        defaultQuestionsByCategory={defaultQuestionsByCategory}
        categoryGroups={categoryGroups}
      />
    );
  }

  return (
    <FeedBoard
      section={primarySection}
      title={title}
      contentLabel={contentLabel}
      contentPlaceholder={contentPlaceholder}
      fileAccept={fileAccept}
    />
  );
}
