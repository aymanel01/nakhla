import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Ear,
  HeartHandshake,
  Landmark,
  Languages,
  Pause,
  PenSquare,
  Play,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminSectionPost, QuizQuestion, DomainCardContent } from "@teaching-app/shared";
import { parseDomainCardContent, getDomainCardDisplayBody } from "@teaching-app/shared";
import { api, getWebSocketUrl } from "@/lib/api";
import { ThemedActionButton } from "@/components/section-banner";

export const Route = createFileRoute("/_authenticated/important-content")({
  component: ImportantContentPage,
});

type ComponentKey = "reading" | "listening" | "language" | "writing";

interface DomainComponent {
  key: ComponentKey;
  title: string;
  icon: typeof BookOpenCheck;
}

interface DomainSection {
  id: string;
  title: string;
  accent: string;
  icon: typeof HeartHandshake;
  components: DomainComponent[];
}

const domains: DomainSection[] = [
  {
    id: "social-economic",
    title: "المجال الاجتماعي والاقتصادي",
    accent: "from-blue-800/20 via-teal-500/15 to-cyan-500/20",
    icon: Landmark,
    components: [
      { key: "reading", title: "فهم المقروء", icon: BookOpenCheck },
      { key: "listening", title: "فهم المسموع", icon: Ear },
      { key: "language", title: "الظاهرة اللغوية", icon: Languages },
      { key: "writing", title: "الإنتاج الكتابي", icon: PenSquare },
    ],
  },
];

const QUESTIONS_PREFIX = "__DOMAIN_QUESTIONS__:";

const defaultDomainId = domains[0]?.id || "social-economic";
const defaultComponentKey: ComponentKey = "reading";
const componentKeys: ComponentKey[] = ["reading", "listening", "language", "writing"];

function getHashId() {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace("#", "");
}

function parseRouteHash(rawHash: string) {
  const normalized = rawHash.replace(/^#/, "");
  const [domainId, componentPart] = normalized.split("--");
  const domain =
    domains.find((item) => item.id === domainId)?.id ||
    domains.find((item) => item.id === normalized)?.id ||
    defaultDomainId;
  const component = componentKeys.includes(componentPart as ComponentKey)
    ? (componentPart as ComponentKey)
    : null;
  return { domain, component };
}

function ImportantContentPage() {
  const location = useLocation();
  const routeHash = (location.hash || getHashId()).replace(/^#/, "");
  const initialRoute = parseRouteHash(routeHash);
  const [selectedId, setSelectedId] = useState(initialRoute.domain);
  const [selectedComponent, setSelectedComponent] =
    useState<ComponentKey | null>(initialRoute.component || defaultComponentKey);
  const [domainPosts, setDomainPosts] = useState<
    Record<string, AdminSectionPost[]>
  >({});
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const { domain, component } = parseRouteHash(location.hash || getHashId());
    setSelectedId(domain);
    setSelectedComponent(component || defaultComponentKey);
  }, [location.hash]);

  useEffect(() => {
    const syncHash = () => {
      const { domain, component } = parseRouteHash(getHashId());
      setSelectedId(domain);
      setSelectedComponent(component || defaultComponentKey);
    };
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    api
      .get<{ progress: { itemType: string; itemId: string }[] }>("/progress/me")
      .then(({ progress }) =>
        setCompletedItems(
          new Set(
            progress
              .filter((item) => item.itemType === "domain_component")
              .map((item) => item.itemId),
          ),
        ),
      )
      .catch(() => setCompletedItems(new Set()));
  }, []);

  useEffect(() => {
    const loadDomainPosts = () => {
      Promise.all(
        domains.map((domain) =>
          api
            .get<{ posts: AdminSectionPost[] }>(`/admin/content/${domain.id}`)
            .then(({ posts }) => [domain.id, posts] as const)
            .catch(() => [domain.id, []] as const),
        ),
      ).then((entries) => setDomainPosts(Object.fromEntries(entries)));
    };

    loadDomainPosts();

    const ws = new WebSocket(getWebSocketUrl());
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string };
        if (
          payload.type === "admin-content:created" ||
          payload.type === "admin-content:updated" ||
          payload.type === "admin-content:deleted"
        ) {
          loadDomainPosts();
        }
      } catch {
        // ignore malformed websocket payloads
      }
    };

    return () => ws.close();
  }, []);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedId) ?? null,
    [selectedId],
  );

  useEffect(() => {
    if (!selectedDomain || !selectedComponent) return;
    const itemId = `${selectedDomain.id}:${selectedComponent}`;
    if (completedItems.has(itemId)) return;
    api
      .post("/progress/content", { itemType: "domain_component", itemId })
      .then(() => setCompletedItems((prev) => new Set(prev).add(itemId)))
      .catch(() => {});
  }, [selectedDomain, selectedComponent, completedItems]);

  const currentDomain = selectedDomain ?? domains[0];

  return (
    <div className="flex w-full flex-col gap-4 pb-2" dir="rtl">
      <DomainContent
        domain={currentDomain}
        posts={domainPosts[currentDomain.id] || []}
        selectedComponent={selectedComponent}
        setSelectedComponent={setSelectedComponent}
      />
    </div>
  );
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

function parseQuestions(content: string): QuizQuestion[] | null {
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

// Self-contained card payload stored in a single main post (category === prefix).
function parseCardContent(content: string): DomainCardContent | null {
  return parseDomainCardContent(content);
}

function findLatestPost(posts: AdminSectionPost[], categories: string[]) {
  return [...posts]
    .filter((post) => post.category && categories.includes(post.category))
    .sort((a, b) => b.id - a.id)[0] ?? null;
}

function stripWritingHighlightTags(text: string) {
  return text.replace(/\[\[\/?(?:per|zm|mk|hd|ws|people|time|place|events|description)\]\]/g, "");
}

function applyWritingElementHighlights(
  text: string,
  elements: { per: string[]; zm: string[]; mk: string[]; hd: string[]; ws: string[] },
) {
  let result = text;
  const tagOrder: Array<["per" | "zm" | "mk" | "hd" | "ws", string[]]> = [
    ["per", elements.per],
    ["zm", elements.zm],
    ["mk", elements.mk],
    ["hd", elements.hd],
    ["ws", elements.ws],
  ];
  for (const [tag, phrases] of tagOrder) {
    for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
      const trimmed = phrase.trim();
      if (!trimmed || trimmed.length < 2) continue;
      if (result.includes(`[[${tag}]]${trimmed}[[/${tag}]]`)) continue;
      result = result.replace(new RegExp(escapeRegex(trimmed), "g"), `[[${tag}]]${trimmed}[[/${tag}]]`);
    }
  }
  return result;
}

function resolveWritingLesson(posts: AdminSectionPost[]) {
  const mainPost = findLatestPost(posts, ["writing"]);
  const card = mainPost ? parseDomainCardContent(mainPost.content) : null;
  const legacyBody = mainPost ? getDomainCardDisplayBody(mainPost.content) : "";
  const meta = card ? null : legacyBody ? parseEntryMeta(legacyBody) : null;

  const title =
    getPlainContent(posts, "writing:lesson:title") ||
    card?.title?.trim() ||
    meta?.title ||
    "";
  const author =
    getPlainContent(posts, "writing:lesson:author") ||
    card?.author?.trim() ||
    meta?.author ||
    "";
  const source =
    getPlainContent(posts, "writing:lesson:source") ||
    card?.source?.trim() ||
    meta?.source ||
    "";
  const rawModelText =
    getPlainContent(posts, "writing:acquisition:text") ||
    getPlainContent(posts, "writing:acquisition:intro") ||
    card?.body?.trim() ||
    meta?.body ||
    legacyBody ||
    "";
  const acquisitionElements = {
    per: getWritingList(getPlainContent(posts, "writing:acquisition:people")),
    zm: getWritingList(getPlainContent(posts, "writing:acquisition:time")),
    mk: getWritingList(getPlainContent(posts, "writing:acquisition:place")),
    hd: getWritingList(getPlainContent(posts, "writing:acquisition:events")),
    ws: getWritingList(getPlainContent(posts, "writing:acquisition:description")),
  };
  const modelText = applyWritingElementHighlights(rawModelText, acquisitionElements);
  const situation =
    getPlainContent(posts, "writing:situation:context") ||
    getPlainContent(posts, "writing:application:text");
  const task =
    getPlainContent(posts, "writing:situation:task") ||
    getPlainContent(posts, "writing:application:questions");
  const objective = getPlainContent(posts, "writing:objective");
  const filePost = getPrimaryMediaPost(posts, ["writing:file"]);
  const legacyResources = parseDetailedItems(getPlainContent(posts, "writing:resources"));
  const legacyLinks = parseLinkItems(getPlainContent(posts, "writing:links"));
  const legacyResourceLabels = [
    ...legacyResources.map((item) => item.title),
    ...legacyLinks.map((item) => item.label),
  ].filter(Boolean);

  const resources = {
    time: getWritingList(getPlainContent(posts, "writing:resources:time")),
    place: getWritingList(getPlainContent(posts, "writing:resources:place")),
    people: getWritingList(getPlainContent(posts, "writing:resources:people")),
    events: getWritingList(getPlainContent(posts, "writing:resources:events")),
    description: getWritingList(
      getPlainContent(posts, "writing:resources:description"),
      legacyResourceLabels,
    ),
  };

  const writingQuestionGroups = findQuestionGroups(posts, [
    { key: "writing:questions:acquisition", label: "أسئلة الاكتساب" },
  ]);

  const hasWritingContent = Boolean(
    title ||
      author ||
      source ||
      rawModelText ||
      modelText ||
      situation ||
      task ||
      objective ||
      filePost?.fileUrl ||
      writingQuestionGroups.length > 0 ||
      Object.values(acquisitionElements).some((items) => items.length > 0) ||
      Object.values(resources).some((items) => items.length > 0),
  );

  return {
    title,
    author,
    source,
    modelText,
    rawModelText,
    acquisitionElements,
    situation,
    task,
    objective,
    filePost,
    resources,
    writingQuestionGroups,
    hasWritingContent,
  };
}

interface QuestionGroup {
  key: string;
  label: string;
  icon?: string;
  lead?: string;
  questions: QuizQuestion[];
}

function findQuestionGroups(
  posts: AdminSectionPost[],
  groups: { key: string; label: string; icon?: string; lead?: string }[],
): QuestionGroup[] {
  const result = groups
    .map((group) => {
      const post = [...posts]
        .reverse()
        .find(
          (item) => item.category === group.key && parseQuestions(item.content),
        );
      return post
        ? { ...group, questions: parseQuestions(post.content) || [] }
        : null;
    })
    .filter((group): group is QuestionGroup =>
      Boolean(group && group.questions.length > 0),
    );

  if (result.length > 0) return result;

  const legacyPost = [...posts]
    .reverse()
    .find(
      (item) =>
        item.category?.includes(":questions") && parseQuestions(item.content),
    );
  const legacyQuestions = legacyPost
    ? parseQuestions(legacyPost.content)
    : null;
  return legacyQuestions?.length
    ? [{ key: "legacy", label: "الفهم والتحليل", questions: legacyQuestions }]
    : [];
}


function findQuestionGroupsByPrefix(
  posts: AdminSectionPost[],
  prefix: string,
  labelFor: (category: string, index: number) => string,
): QuestionGroup[] {
  const seen = new Set<string>();
  const latest = [...posts]
    .reverse()
    .filter((post) => post.category?.startsWith(prefix) && parseQuestions(post.content))
    .filter((post) => {
      if (!post.category || seen.has(post.category)) return false;
      seen.add(post.category);
      return true;
    })
    .reverse();

  return latest
    .map((post, index) => ({
      key: post.category || `${prefix}${index + 1}`,
      label: labelFor(post.category || "", index),
      questions: parseQuestions(post.content) || [],
    }))
    .filter((group) => group.questions.length > 0);
}

function flattenGroupsAsNumbers(groups: QuestionGroup[]): QuestionGroup[] {
  let counter = 0;
  return groups.flatMap((group) =>
    group.questions.map((question, index) => {
      counter += 1;
      return {
        key: `${group.key}:${question.id || index}`,
        label: `${counter}`,
        questions: [question],
      };
    }),
  );
}

function getPrimaryMediaPost(posts: AdminSectionPost[], categories: string[]) {
  const reversed = [...posts].reverse();
  return (
    reversed.find(
      (post) => post.fileUrl && categories.includes(post.category || ""),
    ) ?? null
  );
}

function getPlainContent(posts: AdminSectionPost[], category: string) {
  const raw = findLatestPost(posts, [category])?.content?.trim() || "";
  return getDomainCardDisplayBody(raw);
}

function getGenericContent(posts: AdminSectionPost[], prefix: ComponentKey) {
  const raw = findLatestPost(posts, [prefix])?.content?.trim() || "";
  return getDomainCardDisplayBody(raw);
}

function firstUsefulLine(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || ""
  );
}

function parseEntryMeta(content: string) {
  const meta: { title?: string; author?: string; source?: string; body: string } = { body: content.trim() };
  const bodyLines: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:العنوان|عنوان|title)\s*[:：-]\s*(.+)$/i);
    const author = trimmed.match(/^(?:الكاتب|الكاتبة|المؤلف|author)\s*[:：-]\s*(.+)$/i);
    const source = trimmed.match(/^(?:المصدر|source)\s*[:：-]\s*(.+)$/i);
    if (match) meta.title = match[1].trim();
    else if (author) meta.author = author[1].trim();
    else if (source) meta.source = source[1].trim();
    else bodyLines.push(line);
  }
  meta.body = bodyLines.join("\n").trim();
  return meta;
}

function isPublishableCardPost(post: AdminSectionPost, prefix: ComponentKey): boolean {
  if (post.category !== prefix) return false;

  const card = parseCardContent(post.content);
  if (card) {
    return Boolean(
      post.fileUrl ||
        card.title?.trim() ||
        card.body?.trim() ||
        card.glossary?.trim() ||
        card.audioUrl?.trim() ||
        card.author?.trim() ||
        card.source?.trim(),
    );
  }

  const trimmed = post.content.trim();
  if (!trimmed && !post.fileUrl) return false;

  const meta = parseEntryMeta(trimmed);
  const titleCandidate = meta.title || firstUsefulLine(trimmed);
  const textToCheck = trimmed.replace(/\s/g, "");
  const totalChars = textToCheck.length;

  if (totalChars < 50) return false;

  const uniqueChars = new Set(textToCheck).size;
  const diversityRatio = uniqueChars / Math.max(totalChars, 1);
  const titleText = (titleCandidate || "").replace(/\s/g, "");
  const titleDiversity =
    titleText.length > 0 ? new Set(titleText).size / titleText.length : 0;

  if (diversityRatio < 0.35 && totalChars < 150) return false;
  if (titleDiversity < 0.3 && diversityRatio < 0.35) return false;
  if (titleText.length > 0 && titleText.length < 20 && titleDiversity < 0.4) {
    return false;
  }

  return true;
}

function buildContentEntries(
  posts: AdminSectionPost[],
  prefix: ComponentKey,
  fallbackTitle: string,
): ContentEntry[] {
  const sharedTitle = getPlainContent(posts, `${prefix}:title`) || getPlainContent(posts, `${prefix}:lesson:title`);
  const sharedAuthor = getPlainContent(posts, `${prefix}:author`) || getPlainContent(posts, `${prefix}:lesson:author`);
  const sharedSource = getPlainContent(posts, `${prefix}:source`) || getPlainContent(posts, `${prefix}:lesson:source`);
  const imagePosts = posts
    .filter(
      (post) =>
        post.fileUrl &&
        (post.category === `${prefix}:image` ||
          post.category === `${prefix}:file`),
    )
    .sort((a, b) => b.id - a.id);
  const mainPosts = posts
    .filter((post) => isPublishableCardPost(post, prefix))
    .sort((a, b) => b.id - a.id);

  if (mainPosts.length === 0) {
    return [];
  }

  return mainPosts.map((post, index) => {
    // New self-contained card (JSON). Falls back to the legacy meta-in-text format.
    const card = parseCardContent(post.content);
    const meta = card ? null : parseEntryMeta(post.content);
    const body =
      card != null
        ? card.body?.trim() || ""
        : meta?.body ?? getDomainCardDisplayBody(post.content);
    return {
      id: post.id,
      title:
        card?.title ||
        meta?.title ||
        sharedTitle ||
        firstUsefulLine(body || post.content).slice(0, 70) ||
        fallbackTitle,
      author: card?.author || meta?.author || sharedAuthor || "",
      source: card?.source || meta?.source || sharedSource || "",
      content: body,
      glossary: card?.glossary || "",
      audioUrl: card?.audioUrl || "",
      // A card carries its own image; legacy entries fall back to index-matched image posts.
      imagePost: post.fileUrl
        ? post
        : imagePosts[Math.min(index, Math.max(imagePosts.length - 1, 0))] ||
          imagePosts[imagePosts.length - 1] ||
          null,
    };
  });
}

// Per-card question groups: prefer `${prefix}:${cardId}:questions:${key}`, then
// fall back to the component-wide `${prefix}:questions:${key}` (legacy/shared).
function findCardQuestionGroups(
  posts: AdminSectionPost[],
  prefix: ComponentKey,
  cardId: number | null | undefined,
  groups: { key: string; label: string; icon?: string; lead?: string }[],
): QuestionGroup[] {
  if (cardId) {
    const scoped = findQuestionGroups(
      posts,
      groups.map((group) => ({
        key: `${prefix}:${cardId}:questions:${group.key}`,
        label: group.label,
      })),
    );
    if (scoped.length > 0) return scoped;
  }
  return findQuestionGroups(
    posts,
    groups.map((group) => ({ key: `${prefix}:questions:${group.key}`, label: group.label })),
  );
}


interface GlossaryItem {
  term: string;
  explanation: string;
}

interface DetailedItem {
  title: string;
  description: string;
}

interface LinkItem {
  label: string;
  url: string;
  description: string;
}

interface ContentEntry {
  id: number;
  title: string;
  author: string;
  source: string;
  content: string;
  imagePost: AdminSectionPost | null;
  glossary?: string;
  audioUrl?: string;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseGlossary(content: string): GlossaryItem[] {
  if (!content.trim()) return [];
  const normalized = content.replace(/\s+(?=[^\s:：=\-–]{2,30}\s*[:：=\-–])/g, "\n");

  return normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)\s*(?:[:：=\-–])\s*(.+)$/);
      if (!match) return null;
      return { term: match[1].trim(), explanation: match[2].trim() };
    })
    .filter((item): item is GlossaryItem =>
      Boolean(item && item.term && item.explanation),
    );
}

function parseDetailedItems(content: string): DetailedItem[] {
  if (!content.trim()) return [];
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const doubleColon = line.split("::");
      if (doubleColon.length >= 2) {
        return {
          title: doubleColon[0].trim(),
          description: doubleColon.slice(1).join("::").trim(),
        };
      }
      const colon = line.split(":");
      if (colon.length >= 2) {
        return {
          title: colon[0].trim(),
          description: colon.slice(1).join(":").trim(),
        };
      }
      const dash = line.split("-");
      if (dash.length >= 2) {
        return {
          title: dash[0].trim(),
          description: dash.slice(1).join("-").trim(),
        };
      }
      return { title: line.trim(), description: "" };
    });
}

function parseLinkItems(content: string): LinkItem[] {
  if (!content.trim()) return [];
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "", url = "", description = ""] = line
        .split("|")
        .map((item) => item.trim());
      if (!url) {
        return { label: label || "رابط", url: label, description };
      }
      return { label: label || url, url, description };
    })
    .filter((item) => item.url);
}

function parsePlainLines(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function renderTextWithGlossary(text: string, glossary: GlossaryItem[]) {
  if (!glossary.length) {
    return <div className="whitespace-pre-line">{text}</div>;
  }

  const terms = [...glossary].sort((a, b) => b.term.length - a.term.length);
  const regex = new RegExp(
    `(${terms.map((item) => escapeRegex(item.term)).join("|")})`,
    "gi",
  );
  const parts = text.split(regex);

  return (
    <div className="whitespace-pre-line">
      {parts.map((part, index) => {
        const cleanPart = part.replace(/[،؛:؟!.,()\[\]{}«»"']/g, "").trim();
        const match = terms.find(
          (item) => item.term.toLowerCase() === cleanPart.toLowerCase(),
        );
        if (!match) return <span key={`${part}-${index}`}>{part}</span>;
        return (
          <GlossaryTerm
            key={`${part}-${index}`}
            term={part}
            explanation={match.explanation}
          />
        );
      })}
    </div>
  );
}

function GlossaryTerm({
  term,
  explanation,
}: {
  term: string;
  explanation: string;
}) {
  const [open, setOpen] = useState(false);
  const termRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (termRef.current && !termRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    // Delay attaching listeners to prevent the opening click from immediately closing
    const timeoutId = window.setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 50);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        ref={termRef}
        type="button"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onMouseEnter={() => setOpen(true)}
        className={`mx-0.5 inline cursor-pointer rounded-[3px] border-b-2 border-dotted border-[#40916C] px-0.5 font-bold text-[#2D6A4F] transition hover:bg-[#D8F0E2] focus:outline-none focus:ring-2 focus:ring-[#95D5B2] ${open ? "bg-[#D8F0E2]" : ""}`}
      >
        {term}
      </button>
      {open ? (
        <span className="absolute right-0 top-full z-30 mt-2 w-max max-w-[min(290px,calc(100vw-2rem))] rounded-[14px] bg-[#16352A] px-4 py-3 text-[0.95rem] leading-7 text-white shadow-[0_18px_40px_-10px_rgba(0,0,0,.4)] sm:bottom-full sm:top-auto sm:mb-2 sm:mt-0">
          <span className="mb-1 block font-['Cairo'] text-[1.05rem] font-extrabold text-[#95D5B2]">{term}</span>
          {explanation}
          <span className="absolute right-6 top-[-7px] border-x-[7px] border-b-[7px] border-x-transparent border-b-[#16352A] sm:bottom-[-7px] sm:top-auto sm:border-b-0 sm:border-t-[7px] sm:border-t-[#16352A]" />
        </span>
      ) : null}
    </span>
  );
}

function GlossaryPanel({
  items,
  label = "المعجم والرصيد اللغويّ",
  variant = "amber",
}: {
  items: GlossaryItem[];
  label?: string;
  variant?: "amber" | "green";
}) {
  if (items.length === 0) return null;
  if (variant === "green") {
    return (
      <div className="mb-4 space-y-3 text-right">
        <h4 className="flex items-center justify-end gap-2 font-['Cairo'] text-[1.18rem] font-extrabold text-[#16352A]">
          {label}
          <span className="h-[22px] w-1.5 rounded bg-[#C0813B]" />
        </h4>
        <p className="font-['Cairo'] text-sm text-[#5C6B63]">
          الكلمات نفسها التي وردت في النص، مجموعة للمراجعة والتثبيت. انقر على الكلمات الملوّنة في النص لتظهر معانيها.
        </p>
        <div className="grid gap-2.5">
          {items.map((item) => (
            <div
              key={item.term}
              className="grid grid-cols-1 items-start gap-2 rounded-[14px] border border-[#E8E1D4] bg-[#FCF9F2] px-4 py-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-3.5"
            >
              <span className="whitespace-nowrap rounded-full bg-[#D8F0E2] px-3 py-1 font-['Cairo'] text-[1.08rem] font-extrabold text-[#2D6A4F]">
                {item.term}
              </span>
              <span className="text-[0.96rem] leading-7 text-[#33453d]">{item.explanation}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-[24px] border border-amber-200 bg-amber-50/60 p-5">
      <div className="mb-4 text-right">
        <div className="text-base font-bold text-amber-800">{label}</div>
        <div className="text-xs text-amber-700/80">
          اضغط على الكلمة المظللة ليظهر شرحها مباشرة.
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.term}
            className="rounded-2xl border border-amber-200 bg-white p-4 text-right shadow-sm"
          >
            <div className="text-sm font-bold text-amber-800">{item.term}</div>
            <div className="mt-1 text-sm leading-7 text-slate-700">
              {item.explanation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderMedia(post: AdminSectionPost | null, className?: string) {
  if (!post?.fileUrl) {
    return (
      <div
        className={`flex min-h-[170px] items-center justify-center rounded-[22px] border-2 border-dashed border-primary/20 bg-muted/30 ${className || ""}`}
      >
        <div className="text-center text-muted-foreground">
          <div className="mb-2 text-sm font-medium">لا توجد صورة بعد</div>
          <div className="text-xs">ستظهر الصورة التي يضيفها المشرف هنا</div>
        </div>
      </div>
    );
  }

  const fileType = post.fileType || "";
  const fileName = post.fileName || "ملف مرفق";

  if (fileType.startsWith("image/")) {
    return (
      <img
        src={post.fileUrl}
        alt={fileName}
        className={`h-full min-h-[170px] w-full rounded-[22px] border bg-white object-cover ${className || ""}`}
      />
    );
  }

  if (fileType.startsWith("video/")) {
    return (
      <div
        className={`platform-video-frame overflow-hidden rounded-[22px] border bg-black ${className || ""}`}
      >
        <video
          src={post.fileUrl}
          controls
          className="aspect-video w-full bg-black object-contain"
        />
      </div>
    );
  }

  if (
    fileType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf")
  ) {
    return (
      <iframe
        src={post.fileUrl}
        title={fileName}
        className={`min-h-[170px] w-full rounded-[22px] border bg-white ${className || ""}`}
      />
    );
  }

  return (
    <div
      className={`flex min-h-[170px] items-center justify-center rounded-[22px] border bg-white p-6 text-center ${className || ""}`}
    >
      <div>
        <div className="text-sm font-semibold text-primary">ملف مرفق</div>
        <a
          href={post.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          {fileName}
        </a>
      </div>
    </div>
  );
}

function SpotifyAudioPlayer({
  audioUrl,
  title,
  imageUrl,
  onPlayState,
  onTimeChange,
  onDurationChange,
}: {
  audioUrl: string | null;
  title: string;
  imageUrl?: string | null;
  onPlayState?: (playing: boolean) => void;
  onTimeChange?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const onPlayStateRef = useRef(onPlayState);
  const onTimeChangeRef = useRef(onTimeChange);
  const onDurationChangeRef = useRef(onDurationChange);

  useEffect(() => {
    onPlayStateRef.current = onPlayState;
    onTimeChangeRef.current = onTimeChange;
    onDurationChangeRef.current = onDurationChange;
  }, [onPlayState, onTimeChange, onDurationChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => {
      setPlaying(true);
      onPlayStateRef.current?.(true);
    };
    const onPause = () => {
      setPlaying(false);
      onPlayStateRef.current?.(false);
    };
    const onEnded = () => {
      setPlaying(false);
      onPlayStateRef.current?.(false);
    };
    const onLoadedMetadata = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(dur);
      onDurationChangeRef.current?.(dur);
    };
    const onTimeUpdate = () => {
      const time = audio.currentTime || 0;
      setCurrentTime(time);
      onTimeChangeRef.current?.(time);
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [audioUrl]);

  const changeSpeed = (value: number) => {
    setSpeed(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    await audio.play().catch(() => undefined);
  };

  const seekBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(
      Math.max(audio.currentTime + seconds, 0),
      duration || audio.currentTime + seconds,
    );
    setCurrentTime(audio.currentTime);
  };

  const onRangeChange = (value: string) => {
    const audio = audioRef.current;
    const next = Number(value);
    setCurrentTime(next);
    if (audio) audio.currentTime = next;
  };

  const formatTime = (value: number) => {
    const total = Math.max(0, Math.floor(value));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  return (
    <div className="rounded-[22px] bg-slate-950 px-4 py-3 text-white shadow-xl" dir="ltr">
      {audioUrl ? (
        <audio
          ref={audioRef}
          src={audioUrl}
          className="hidden"
          preload="metadata"
        />
      ) : null}
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-800">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
              صورة
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-[11px] text-blue-300">
            فهم المسموع
          </div>
          <div className="truncate text-sm font-bold">
            {title || "النص المسموع"}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400" dir="ltr">
            <span className="min-w-[2.5rem] tabular-nums">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0)}
              step={1}
              value={Math.min(currentTime, duration || currentTime)}
              onChange={(e) => onRangeChange(e.target.value)}
              className="h-1 flex-1 cursor-pointer accent-blue-600"
              disabled={!audioUrl}
            />
            <span className="min-w-[2.5rem] tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => seekBy(-10)}
            disabled={!audioUrl}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            -10s
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!audioUrl}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-slate-950 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 translate-x-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => seekBy(10)}
            disabled={!audioUrl}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +10s
          </button>
        </div>
        <div className="flex items-center gap-1">
          {[1, 1.5, 2].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => changeSpeed(item)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${speed === item ? "bg-blue-600 text-slate-950" : "bg-slate-800 text-white hover:bg-slate-700"}`}
            >
              x{item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


function levelBadgeClass(level: string, nakhla: boolean) {
  if (!nakhla) return "rounded-full bg-[#1d4f8a] px-2 py-0.5 text-[10px] text-white";
  if (level.includes("مباشر")) return "rounded-full bg-[#40916C] px-2 py-0.5 text-[10px] font-extrabold text-white";
  if (level.includes("استنتاج")) return "rounded-full bg-[#C0813B] px-2 py-0.5 text-[10px] font-extrabold text-white";
  if (level.includes("ضمني")) return "rounded-full bg-[#7C6BAE] px-2 py-0.5 text-[10px] font-extrabold text-white";
  if (level.includes("إبداع")) return "rounded-full bg-[#C96B8E] px-2 py-0.5 text-[10px] font-extrabold text-white";
  return "rounded-full bg-[#40916C] px-2 py-0.5 text-[10px] font-extrabold text-white";
}

function QuestionStage({
  groups,
  numbered = false,
  sequential = false,
  variant = "default",
  glossaryPanel,
  onProgress,
}: {
  groups: QuestionGroup[];
  numbered?: boolean;
  sequential?: boolean;
  variant?: "default" | "nakhla";
  glossaryPanel?: ReactNode;
  onProgress?: (progress: { correct: number; total: number }) => void;
}) {
  const [activeGroup, setActiveGroup] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [matchState, setMatchState] = useState<Record<string, { selected: number | null; matched: number[]; wrong?: string }>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [modelVisible, setModelVisible] = useState<Record<string, boolean>>({});
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  useEffect(() => {
    setActiveGroup(0);
    setActiveQuestionIndex(0);
    setAnswers({});
    setMatchState({});
    setTextAnswers({});
    setModelVisible({});
  }, [groups]);

  useEffect(() => {
    setActiveQuestionIndex(0);
  }, [activeGroup]);

  useEffect(() => {
    if (!onProgress) return;
    let correct = 0;
    let total = 0;
    for (const group of groups) {
      const questions = group.questions.map((question, index) => normalizeQuestion(question, index));
      for (const [questionIndex, question] of questions.entries()) {
        const questionKey = `${group.key}:${question.id || questionIndex}`;
        const type = question.type || "multiple-choice";
        total += 1;
        if (type === "match") {
          const pairState = matchState[questionKey] || { matched: [] };
          const matchPairs = question.matchPairs || [];
          if (matchPairs.length > 0 && pairState.matched.length >= matchPairs.length) correct += 1;
        } else if (type === "communicative") {
          if ((textAnswers[questionKey] || "").trim().length > 10) correct += 1;
        } else {
          const selected = answers[questionKey];
          if (selected !== undefined && selected === question.correctAnswer) correct += 1;
        }
      }
    }
    onProgress({ correct, total });
  }, [answers, matchState, textAnswers, groups, onProgress]);

  if (groups.length === 0) return null;

  const active = groups[Math.min(activeGroup, groups.length - 1)];
  const questions = active.questions.map((question, index) => normalizeQuestion(question, index));
  const totalQuestions = groups.reduce((sum, group) => sum + group.questions.length, 0);
  const safeQuestionIndex = Math.min(activeQuestionIndex, Math.max(questions.length - 1, 0));
  const visibleQuestions = sequential ? [questions[safeQuestionIndex]].filter(Boolean) : questions;
  const globalQuestionIndex = groups
    .slice(0, activeGroup)
    .reduce((sum, group) => sum + group.questions.length, 0) + safeQuestionIndex;

  const goPrevQuestion = () => {
    if (safeQuestionIndex > 0) {
      setActiveQuestionIndex((value) => Math.max(0, value - 1));
      return;
    }
    if (activeGroup > 0) {
      const prevGroupIndex = activeGroup - 1;
      const prevQuestions = groups[prevGroupIndex]?.questions.length || 1;
      setActiveGroup(prevGroupIndex);
      setActiveQuestionIndex(Math.max(0, prevQuestions - 1));
    }
  };

  const goNextQuestion = () => {
    if (safeQuestionIndex < questions.length - 1) {
      setActiveQuestionIndex((value) => Math.min(questions.length - 1, value + 1));
      return;
    }
    if (activeGroup < groups.length - 1) {
      setActiveGroup((value) => Math.min(groups.length - 1, value + 1));
      setActiveQuestionIndex(0);
    }
  };

  const chooseMatchLeft = (questionKey: string, leftIndex: number) => {
    setMatchState((current) => ({
      ...current,
      [questionKey]: {
        selected: leftIndex,
        matched: current[questionKey]?.matched || [],
      },
    }));
  };

  const chooseMatchRight = (questionKey: string, rightIndex: number) => {
    setMatchState((current) => {
      const previous = current[questionKey] || { selected: null, matched: [] };
      if (previous.selected === null) return current;
      if (previous.selected === rightIndex) {
        return {
          ...current,
          [questionKey]: {
            selected: null,
            matched: Array.from(new Set([...previous.matched, rightIndex])),
          },
        };
      }
      return {
        ...current,
        [questionKey]: {
          ...previous,
          selected: null,
          wrong: `${previous.selected}:${rightIndex}:${Date.now()}`,
        },
      };
    });
    window.setTimeout(() => {
      setMatchState((current) => ({
        ...current,
        [questionKey]: {
          ...(current[questionKey] || { selected: null, matched: [] }),
          wrong: undefined,
        },
      }));
    }, 750);
  };

  const typeLabel = (type?: string) =>
    type === "match"
      ? "صِلْ بسهم"
      : type === "fill-blank"
        ? "ملء الفراغ"
        : type === "communicative"
          ? "وضعية تواصلية"
          : "اختيار من متعدد";

  const nakhla = variant === "nakhla";
  const showVocabularyPanel =
    nakhla &&
    glossaryPanel &&
    (active.key.includes("vocabulary") || active.label.includes("معجم"));

  return (
    <div className={`rounded-[20px] ${nakhla ? "border border-[#E8E1D4] bg-white shadow-[0_10px_30px_-12px_rgba(22,53,42,.22)]" : "border border-[#e8e1d4] bg-white shadow-sm"}`}>
      <div className={`${numbered ? "flex justify-start gap-2 overflow-x-auto bg-white p-3 [-webkit-overflow-scrolling:touch]" : nakhla ? "grid grid-cols-2 gap-1 bg-[#EEF4EC] p-[7px] sm:flex sm:gap-1" : "flex gap-1 bg-[#eaf2ff] p-2"}`}>
        {groups.map((group, index) => (
          <button
            key={group.key}
            type="button"
            onClick={() => { setActiveGroup(index); setActiveQuestionIndex(0); }}
            className={`${
              numbered
                ? "grid h-10 w-10 flex-none place-items-center rounded-full px-0 py-0"
                : nakhla
                  ? "flex flex-col items-center gap-0.5 rounded-[13px] border-0 px-1 py-2 sm:flex-1 sm:py-[11px]"
                  : "flex-1 rounded-[13px] px-3 py-3"
            } text-center font-['Cairo'] text-sm font-extrabold transition ${
              activeGroup === index
                ? numbered
                  ? "bg-[#123c69] text-white shadow-sm"
                  : nakhla
                    ? "bg-white text-[#2D6A4F] shadow-[0_4px_12px_-4px_rgba(22,53,42,.25)]"
                    : "bg-white text-[#123c69] shadow-sm"
                : numbered
                  ? "bg-[#eaf2ff] text-[#123c69] hover:bg-[#123c69] hover:text-white"
                  : nakhla
                    ? "bg-transparent text-[#5C6B63] hover:text-[#2D6A4F]"
                    : "text-[#475569] hover:bg-white/60 hover:text-[#123c69]"
            }`}
          >
            {nakhla && group.icon ? <span className="text-base leading-none sm:text-[1.15rem]">{group.icon}</span> : null}
            <span className={nakhla ? "text-[0.78rem] sm:text-[0.92rem]" : ""}>{group.label}</span>
          </button>
        ))}
      </div>

      <div className={nakhla ? "min-h-[320px] px-4 pb-6 pt-4 sm:min-h-[420px] sm:px-[26px] sm:pb-[30px] sm:pt-6" : "p-3"}>
        {!numbered ? (
          <div className="mb-5 text-right">
            <h4 className={`flex items-center justify-end gap-2 font-['Cairo'] text-xl font-extrabold ${nakhla ? "text-[#16352A]" : "text-[#0b2447]"}`}>
              {active.label}
              <span className="h-6 w-1.5 rounded-full bg-[#c0813b]" />
            </h4>
            {nakhla && active.lead ? (
              <p className="mt-1.5 font-['Cairo'] text-sm leading-7 text-[#5C6B63]">{active.lead}</p>
            ) : null}
          </div>
        ) : null}

        {showVocabularyPanel ? glossaryPanel : null}

        {sequential ? (
          <div className={`mb-5 rounded-[18px] border p-3 text-right ${nakhla ? "border-[#95D5B2] bg-[#EEF4EC]" : "border-[#93b7e7] bg-[#eaf2ff]"}`}>
            <div className="mb-2 flex items-center gap-3">
              <span className={`font-['Cairo'] text-base font-extrabold ${nakhla ? "text-[#16352A]" : "text-[#0b2447]"}`}>السؤال {globalQuestionIndex + 1} من {totalQuestions}</span>
              <span className={`h-2 flex-1 overflow-hidden rounded-full ${nakhla ? "bg-[#D8F0E2]" : "bg-[#bfd7ff]"}`}><i className={`block h-full ${nakhla ? "bg-[#2D6A4F]" : "bg-[#123c69]"}`} style={{ width: `${((globalQuestionIndex + 1) / Math.max(totalQuestions, 1)) * 100}%` }} /></span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={goPrevQuestion}
                disabled={globalQuestionIndex <= 0}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2 font-['Cairo'] text-sm font-bold disabled:opacity-50 ${nakhla ? "border-[#95D5B2] text-[#2D6A4F] hover:bg-[#EEF4EC]" : "border-[#d5ddd7] text-[#123c69] hover:bg-slate-50"}`}
              >
                <ArrowRight className="h-4 w-4" />
                رجوع
              </button>
              <div className={`hidden truncate text-center text-sm font-bold sm:block ${nakhla ? "text-[#2D6A4F]" : "text-[#123c69]"}`}>{active.label}</div>
              <button
                type="button"
                onClick={goNextQuestion}
                disabled={globalQuestionIndex >= totalQuestions - 1}
                className={`min-h-10 rounded-xl px-4 py-2 font-['Cairo'] text-sm font-bold text-white disabled:opacity-50 ${nakhla ? "bg-[#2D6A4F] hover:bg-[#358062]" : "bg-[#123c69]"}`}
              >
                التالي
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {visibleQuestions.map((question, questionIndex) => {
            const actualQuestionIndex = sequential ? safeQuestionIndex : questionIndex;
            const questionKey = `${active.key}:${question.id || actualQuestionIndex}`;
            const type = question.type || "multiple-choice";
            const selectedAnswer = answers[questionKey];
            const hasAnswered = selectedAnswer !== undefined;
            const isCorrect = hasAnswered && selectedAnswer === question.correctAnswer;
            const fallbackWrongFeedback =
              type === "fill-blank"
                ? "هذا الاختيار غير مناسب للفراغ. راجع سياق الجملة وحاول مرة أخرى."
                : "هذا الجواب غير صحيح. راجع السؤال وحاول مرة أخرى.";
            const fallbackCorrectFeedback = "أحسنت، جوابك صحيح.";
            const feedback = hasAnswered
              ? question.feedbacks?.[selectedAnswer] || (isCorrect ? fallbackCorrectFeedback : fallbackWrongFeedback)
              : "";
            const pairState = matchState[questionKey] || { selected: null, matched: [] };
            const matchPairs = question.matchPairs || [];
            const matchDone = type === "match" && matchPairs.length > 0 && pairState.matched.length >= matchPairs.length;
            const leftItems = matchPairs.map((pair, index) => ({ ...pair, index }));
            const rightItems = matchPairs.map((pair, index) => ({ ...pair, index }));

            return (
              <div
                key={questionKey}
                className="rounded-[16px] border border-[#e8e1d4] bg-[#fcf9f2] p-4 text-right"
              >
                <div className={`mb-3 flex items-start gap-2 rounded-[10px] border border-dashed bg-white px-3 py-2 font-['Cairo'] text-xs font-bold leading-6 ${nakhla ? "border-[#95D5B2] text-[#2D6A4F]" : "border-[#93b7e7] text-[#123c69]"}`}>
                  <span>🎯</span>
                  <span className="flex-1">{question.objective || "الهدف التعليمي الخاص بهذا السؤال"}</span>
                  {question.level ? (
                    <span className={levelBadgeClass(question.level, nakhla)}>
                      {question.level}
                    </span>
                  ) : null}
                </div>

                <div className="mb-3 text-[1.04rem] font-semibold leading-8 text-[#1E2B26]">
                  <span className={`ml-2 inline-grid h-7 w-7 place-items-center rounded-full font-['Cairo'] text-sm font-extrabold ${nakhla ? "bg-[#D8F0E2] text-[#2D6A4F]" : "bg-[#dbeafe] text-[#123c69]"}`}>
                    {sequential ? globalQuestionIndex + 1 : questionIndex + 1}
                  </span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 font-['Cairo'] text-[11px] font-bold ${nakhla ? "bg-[#EEF4EC] text-[#5C6B63]" : "bg-[#eaf2ff] text-[#475569]"}`}>
                    {typeLabel(type)}
                  </span>
                  {question.question}
                </div>

                {type === "match" ? (
                  <div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        {leftItems.map((pair) => {
                          const matched = pairState.matched.includes(pair.index);
                          return (
                            <button
                              key={`left-${pair.index}`}
                              type="button"
                              disabled={matched}
                              onClick={() => chooseMatchLeft(questionKey, pair.index)}
                              className={`w-full rounded-xl border px-3 py-3 text-center text-sm font-bold transition ${
                                matched
                                  ? nakhla ? "border-[#40916C] bg-[#D8F0E2] text-[#16352A]" : "border-[#1d4f8a] bg-[#dbeafe] text-[#0b2447]"
                                  : pairState.selected === pair.index
                                    ? nakhla ? "border-[#2D6A4F] bg-[#EEF4EC] text-[#2D6A4F]" : "border-[#123c69] bg-[#eaf2ff] text-[#123c69]"
                                    : nakhla ? "border-[#E8E1D4] bg-white text-[#1E2B26] hover:border-[#40916C] hover:bg-[#EEF4EC]" : "border-[#e8e1d4] bg-white text-[#0f172a] hover:border-[#1d4f8a] hover:bg-[#eaf2ff]"
                              }`}
                            >
                              {pair.left || `عنصر ${pair.index + 1}`}
                            </button>
                          );
                        })}
                      </div>
                      <div className="space-y-2">
                        {rightItems.map((pair) => {
                          const matched = pairState.matched.includes(pair.index);
                          const isWrong = pairState.wrong?.includes(`:${pair.index}:`);
                          return (
                            <button
                              key={`right-${pair.index}`}
                              type="button"
                              disabled={matched}
                              onClick={() => chooseMatchRight(questionKey, pair.index)}
                              className={`w-full rounded-xl border px-3 py-3 text-center text-sm font-bold transition ${
                                matched
                                  ? nakhla ? "border-[#40916C] bg-[#D8F0E2] text-[#16352A]" : "border-[#1d4f8a] bg-[#dbeafe] text-[#0b2447]"
                                  : isWrong
                                    ? "border-[#c96b6b] bg-[#f7e3e3] text-[#7a2e2e]"
                                    : nakhla ? "border-[#E8E1D4] bg-white text-[#1E2B26] hover:border-[#40916C] hover:bg-[#EEF4EC]" : "border-[#e8e1d4] bg-white text-[#0f172a] hover:border-[#1d4f8a] hover:bg-[#eaf2ff]"
                              }`}
                            >
                              {pair.right || `جواب ${pair.index + 1}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className={`mt-3 rounded-[11px] border-r-4 px-3 py-2 text-sm font-semibold leading-7 ${matchDone ? nakhla ? "border-[#40916C] bg-[#D8F0E2] text-[#16352A]" : "border-[#1d4f8a] bg-[#dbeafe] text-[#0b2447]" : pairState.wrong ? "border-[#c96b6b] bg-[#f7e3e3] text-[#7a2e2e]" : nakhla ? "border-[#95D5B2] bg-[#EEF4EC] text-[#5C6B63]" : "border-[#93b7e7] bg-[#eaf2ff] text-[#475569]"}`}>
                      {matchDone
                        ? "أحسنت، تم الربط بنجاح."
                        : pairState.wrong
                          ? "هذا الربط غير صحيح. فكّر في العلاقة بين العنصرين وحاول مرة أخرى."
                          : "انقر على عنصر من العمود الأول ثم اختر مطابقه من العمود الثاني."}
                    </div>
                  </div>
                ) : type === "fill-blank" ? (
                  <div>
                    <div className="mb-3 rounded-xl bg-white p-3 leading-8 text-[#1E2B26]">
                      <span className={`inline-block min-w-[90px] border-b-2 px-4 text-center font-bold ${hasAnswered && !isCorrect ? "border-[#c96b6b] text-[#c96b6b]" : nakhla ? "border-dashed border-[#40916C] text-[#2D6A4F]" : "border-dashed border-[#1d4f8a] text-[#123c69]"}`}>
                        {hasAnswered ? question.options[selectedAnswer] : "…"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {question.options.filter(Boolean).map((option, optionIndex) => {
                        const revealCorrect = isCorrect && question.correctAnswer === optionIndex;
                        const isWrongSelected = hasAnswered && selectedAnswer === optionIndex && !isCorrect;
                        return (
                          <button
                            key={optionIndex}
                            type="button"
                            disabled={isCorrect}
                            onClick={() => setAnswers((current) => ({ ...current, [questionKey]: optionIndex }))}
                            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                              revealCorrect
                                ? nakhla ? "border-[#40916C] bg-[#D8F0E2] text-[#16352A]" : "border-[#1d4f8a] bg-[#dbeafe] text-[#0b2447]"
                                : isWrongSelected
                                  ? "border-[#c96b6b] bg-[#f7e3e3] text-[#7a2e2e]"
                                  : nakhla ? "border-[#95D5B2] bg-white text-[#2D6A4F] hover:bg-[#EEF4EC]" : "border-[#93b7e7] bg-white text-[#123c69] hover:bg-[#eaf2ff]"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : type === "communicative" ? (
                  <div>
                    <textarea
                      value={textAnswers[questionKey] || ""}
                      onChange={(event) => setTextAnswers((current) => ({ ...current, [questionKey]: event.target.value }))}
                      placeholder="اكتب جوابك هنا..."
                      className={`min-h-[100px] w-full rounded-xl border border-[#E8E1D4] bg-white p-3 leading-8 text-[#1E2B26] outline-none ${nakhla ? "focus:border-[#40916C]" : "focus:border-[#1d4f8a]"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setModelVisible((current) => ({ ...current, [questionKey]: !current[questionKey] }))}
                      className={`mt-3 rounded-full px-4 py-2 font-['Cairo'] text-xs font-bold text-white ${nakhla ? "bg-[#2D6A4F] hover:bg-[#358062]" : "bg-[#123c69] hover:bg-[#0b2447]"}`}
                    >
                      أظهر إجابة مقترحة
                    </button>
                    {modelVisible[questionKey] ? (
                      <div className={`mt-3 rounded-[11px] border-r-4 px-4 py-3 text-sm font-semibold leading-7 ${nakhla ? "border-[#40916C] bg-[#D8F0E2] text-[#16352A]" : "border-[#1d4f8a] bg-[#dbeafe] text-[#0b2447]"}`}>
                        <span className="block font-['Cairo'] font-extrabold">إجابة مقترحة</span>
                        {question.modelAnswer || "يضيف المشرف الإجابة المقترحة من التحكم عن بعد."}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {question.options.filter(Boolean).map((option, optionIndex) => {
                      const revealCorrect = isCorrect && question.correctAnswer === optionIndex;
                      const isWrongSelected = hasAnswered && selectedAnswer === optionIndex && !isCorrect;
                      return (
                        <button
                          key={optionIndex}
                          type="button"
                          disabled={isCorrect}
                          onClick={() => setAnswers((current) => ({ ...current, [questionKey]: optionIndex }))}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-right text-sm font-medium transition ${
                            revealCorrect
                              ? nakhla ? "border-[#40916C] bg-[#D8F0E2] text-[#16352A]" : "border-[#1d4f8a] bg-[#dbeafe] text-[#0b2447]"
                              : isWrongSelected
                                ? "border-[#c96b6b] bg-[#f7e3e3] text-[#7a2e2e] opacity-100"
                                : hasAnswered && !isCorrect
                                  ? "border-[#E8E1D4] bg-white text-[#1E2B26] opacity-50"
                                  : nakhla ? "border-[#E8E1D4] bg-white text-[#1E2B26] hover:border-[#40916C] hover:bg-[#EEF4EC]" : "border-[#e8e1d4] bg-white text-[#0f172a] hover:border-[#1d4f8a] hover:bg-[#eaf2ff]"
                          }`}
                        >
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-['Cairo'] text-xs font-extrabold ${revealCorrect ? nakhla ? "bg-[#40916C] text-white" : "bg-[#1d4f8a] text-white" : isWrongSelected ? "bg-[#c96b6b] text-white" : nakhla ? "bg-[#EEF4EC] text-[#2D6A4F]" : "bg-[#eaf2ff] text-[#123c69]"}`}>
                            {optionIndex + 1}
                          </span>
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {feedback ? (
                  <div className={`mt-3 rounded-[11px] border-r-4 px-4 py-3 text-sm font-semibold leading-7 ${
                    isCorrect
                      ? nakhla ? "border-[#40916C] bg-[#D8F0E2] text-[#16352A]" : "border-[#1d4f8a] bg-[#dbeafe] text-[#0b2447]"
                      : "border-[#c96b6b] bg-[#f7e3e3] text-[#7a2e2e]"
                  }`}>
                    <span className="block font-['Cairo'] font-extrabold">
                      {isCorrect ? "إجابة صحيحة" : "إجابة غير صحيحة — حاول مرة أخرى"}
                    </span>
                    {feedback}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

function EmptyComponentState({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border-2 border-dashed border-primary/20 bg-white/70 p-5 text-center text-sm leading-8 text-muted-foreground">
      {text}
    </div>
  );
}


function ReadAlongText({
  text,
  glossary,
  progress,
}: {
  text: string;
  glossary: GlossaryItem[];
  progress: number;
}) {
  const tokens = text.match(/\S+|\s+/g) || [];
  const wordIndexes = tokens
    .map((token, index) => (/\s+/.test(token) ? -1 : index))
    .filter((index) => index >= 0);
  const activeWords = Math.floor(
    Math.min(Math.max(progress, 0), 1) * Math.max(wordIndexes.length, 1),
  );
  const activeSet = new Set(wordIndexes.slice(0, activeWords));
  const terms = [...glossary].sort((a, b) => b.term.length - a.term.length);

  const cleanToken = (token: string) =>
    token
      .replace(/[،؛:؟!.,()\[\]{}«»"']/g, "")
      .trim()
      .toLowerCase();

  return (
    <div className="whitespace-pre-wrap">
      {tokens.map((token, index) => {
        if (/\s+/.test(token)) return <span key={`space-${index}`}>{token}</span>;
        const match = terms.find(
          (item) => cleanToken(item.term) === cleanToken(token),
        );
        const highlighted = activeSet.has(index);
        const className = highlighted
          ? "rounded-[3px] bg-[#D8F0E2] px-0.5 text-[#16352A] transition-colors"
          : "transition-colors";
        if (match) {
          return (
            <span key={`${token}-${index}`} className={className}>
              <GlossaryTerm term={token} explanation={match.explanation} />
            </span>
          );
        }
        return (
          <span key={`${token}-${index}`} className={className}>
            {token}
          </span>
        );
      })}
    </div>
  );
}

function ReadingAudioControl({
  audioUrl,
  title,
  playing,
  currentTime,
  duration,
  audioRef,
  onPlayState,
  onTimeChange,
  onDurationChange,
}: {
  audioUrl: string | null;
  title: string;
  playing: boolean;
  currentTime: number;
  duration: number;
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  onPlayState: (playing: boolean) => void;
  onTimeChange: (time: number) => void;
  onDurationChange: (duration: number) => void;
}) {
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => onPlayState(true);
    const onPause = () => onPlayState(false);
    const onEnded = () => onPlayState(false);
    const onLoadedMetadata = () =>
      onDurationChange(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onTimeUpdate = () => onTimeChange(audio.currentTime || 0);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [audioUrl, audioRef, onDurationChange, onPlayState, onTimeChange]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    await audio.play().catch(() => undefined);
  };

  const seek = (value: string) => {
    const next = Number(value);
    onTimeChange(next);
    if (audioRef.current) audioRef.current.currentTime = next;
  };

  const format = (value: number) => {
    const total = Math.max(0, Math.floor(value));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  return (
    <div className="mb-4 rounded-2xl border border-[#95D5B2] bg-[#EEF4EC] p-3 text-[#1E2B26] shadow-sm">
      {audioUrl ? (
        <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!audioUrl}
          className="inline-flex items-center gap-2 rounded-full bg-[#16352A] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#2D6A4F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "إيقاف القراءة" : "تشغيل صوت النص"}
        </button>
        <div className="min-w-[180px] flex-1 text-right">
          <div className="truncate font-['Cairo'] text-xs font-bold text-[#16352A]">
            {title || "صوت النص"}
          </div>
          <div className="mt-1 flex items-center gap-2 font-['Cairo'] text-[11px] font-bold text-[#5C6B63]" dir="ltr">
            <span className="min-w-[2.5rem] tabular-nums">{format(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0)}
              step={1}
              value={Math.min(currentTime, duration || currentTime)}
              onChange={(event) => seek(event.target.value)}
              disabled={!audioUrl}
              className="h-1 flex-1 cursor-pointer accent-[#2D6A4F]"
            />
            <span className="min-w-[2.5rem] tabular-nums">{format(duration)}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 font-['Cairo'] text-xs font-semibold leading-6 text-[#2D6A4F]">
        أثناء تشغيل الصوت يتلوّن النص حسب موضع القراءة، وعند الإيقاف يبقى التلوين في نفس المكان.
      </div>
    </div>
  );
}

function LessonLikeLayout({
  mode,
  title,
  subtitle,
  entry,
  body,
  glossary,
  questionGroups,
  media,
  audio,
  readingAudioUrl,
}: {
  mode: "reading" | "listening";
  title: string;
  subtitle: string;
  entry: ContentEntry | null;
  body: string;
  glossary: GlossaryItem[];
  questionGroups: QuestionGroup[];
  media: ReactNode;
  audio?: ReactNode;
  readingAudioUrl?: string | null;
}) {
  const green = mode === "reading";
  const readingAudioRef = useRef<HTMLAudioElement | null>(null);
  const [readingPlaying, setReadingPlaying] = useState(false);
  const [readingCurrentTime, setReadingCurrentTime] = useState(0);
  const [readingDuration, setReadingDuration] = useState(0);
  // نحسب التلوين بتأخير بسيط حتى ما يسبقش الصوت.
  // التزامن الدقيق يحتاج timestamps، ولكن هذا التعويض كيخلي التلوين أقرب للصوت.
  const syncDelaySeconds = Math.min(1.8, Math.max(0.6, readingDuration * 0.018));
  const adjustedReadingTime = Math.max(0, readingCurrentTime - syncDelaySeconds);
  const readingProgress =
    readingAudioUrl && readingDuration > 0
      ? Math.min(adjustedReadingTime / readingDuration, 1)
      : 0;

  if (green) {
    return (
      <div className="overflow-hidden rounded-[20px] bg-[#FBF7F0] font-['Tajawal'] text-[#1E2B26] shadow-[0_10px_30px_-12px_rgba(22,53,42,.22)]">
        <div className="mx-auto grid max-w-[1280px] gap-4 p-3 sm:gap-[22px] sm:p-5 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <section className="overflow-hidden rounded-[20px] border border-[#E8E1D4] bg-white shadow-[0_10px_30px_-12px_rgba(22,53,42,.22)] xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
            <div className="bg-[#FCF9F2]">
              <figure className="relative m-0 bg-white">
                {media}
                {entry?.title ? (
                  <figcaption className="absolute bottom-2.5 right-3.5 rounded-full bg-[rgba(22,53,42,0.78)] px-3 py-1 font-['Cairo'] text-[0.72rem] text-white backdrop-blur-[3px]">
                    {entry.title} — صورة توضيحية
                  </figcaption>
                ) : null}
              </figure>
              <div className="px-4 pb-5 pt-4 sm:px-[26px] sm:pb-[26px] sm:pt-[22px]">
                {entry ? (
                  <div className="mb-[18px] flex flex-wrap items-start justify-between gap-3 border-b-2 border-dashed border-[#95D5B2] pb-3.5">
                    <div>
                      <h1 className="font-['Cairo'] text-xl font-extrabold text-[#16352A] sm:text-[1.5rem]">
                        {entry.title}
                      </h1>
                      <span className="mt-2 inline-flex rounded-full bg-[#F4E6CF] px-3 py-1 font-['Cairo'] text-[0.72rem] font-bold text-[#C0813B]">
                        النمط: سرديّ
                      </span>
                    </div>
                    {(entry.author || entry.source) ? (
                      <div className="text-left font-['Cairo'] text-[0.76rem] leading-7 text-[#5C6B63]">
                        {entry.author ? <div><b className="font-bold text-[#2D6A4F]">الكاتب:</b> {entry.author}</div> : null}
                        {entry.source ? <div><b className="font-bold text-[#2D6A4F]">المصدر:</b> {entry.source}</div> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {readingAudioUrl ? (
                  <ReadingAudioControl
                    audioUrl={readingAudioUrl}
                    title={entry?.title || title}
                    playing={readingPlaying}
                    currentTime={readingCurrentTime}
                    duration={readingDuration}
                    audioRef={readingAudioRef}
                    onPlayState={setReadingPlaying}
                    onTimeChange={setReadingCurrentTime}
                    onDurationChange={setReadingDuration}
                  />
                ) : null}
                {audio}

                <div className="mt-3 text-justify font-['Amiri'] text-lg leading-[2] text-[#23332c] sm:text-[1.28rem] sm:leading-[2.2]">
                  {body ? (
                    readingAudioUrl ? (
                      <ReadAlongText text={body} glossary={glossary} progress={readingProgress} />
                    ) : (
                      renderTextWithGlossary(body, glossary)
                    )
                  ) : (
                    "سيظهر نص القراءة هنا عندما يضيفه المشرف من التحكم عن بعد."
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#EEF4EC] px-3 py-2 font-['Cairo'] text-[0.78rem] text-[#5C6B63]">
                  <span className="font-bold text-[#2D6A4F]">●</span>
                  انقُر على الكلمات المُلوَّنة لتظهرَ معانيها في موضعها.
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[20px] border border-[#E8E1D4] bg-white shadow-[0_10px_30px_-12px_rgba(22,53,42,.22)]">
            {questionGroups.length > 0 ? (
              <QuestionStage
                groups={questionGroups}
                variant="nakhla"
                glossaryPanel={glossary.length > 0 ? <GlossaryPanel items={glossary} variant="green" /> : null}
              />
            ) : glossary.length > 0 ? (
              <div className="p-6">
                <GlossaryPanel items={glossary} variant="green" />
              </div>
            ) : (
              <div className="p-6">
                <EmptyComponentState text="لم يضف المشرف الأسئلة بعد." />
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#e8e1d4] bg-[#fbf7f0] shadow-sm">
      {/* تم حذف البار الداخلي باش يبقى قالب المجالات نقي بلا عنوان زائد. */}

      <div className="grid gap-3 p-3 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="overflow-hidden rounded-[24px] border border-[#e8e1d4] bg-[#fcf9f2] shadow-sm">
          <div className="relative bg-white">{media}</div>
          <div className="p-5">
            {entry ? (
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-blue-200 pb-3">
                <div>
                  <h3 className="text-xl font-extrabold text-[#0b2447]">
                    {entry.title}
                  </h3>
                  <span className="mt-2 inline-flex rounded-full bg-[#f4e6cf] px-3 py-1 text-xs font-bold text-[#c0813b]">
                    {green ? "النمط: نص قرائي" : "النمط: نص سماعي"}
                  </span>
                </div>
                {(entry.author || entry.source) ? (
                  <div className="rounded-xl bg-white p-2 text-left text-[11px] leading-5 text-slate-500 shadow-sm">
                    {entry.author ? <div><b className="text-blue-900">الكاتب:</b> {entry.author}</div> : null}
                    {entry.source ? <div><b className="text-blue-900">المصدر:</b> {entry.source}</div> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {green && readingAudioUrl ? (
              <SpotifyAudioPlayer
                audioUrl={readingAudioUrl}
                title={entry?.title || title}
                imageUrl={entry?.imagePost?.fileUrl}
                onPlayState={setReadingPlaying}
                onTimeChange={setReadingCurrentTime}
                onDurationChange={setReadingDuration}
              />
            ) : null}
            {audio}
            <div className="domain-text-compact max-h-[46vh] overflow-y-auto rounded-2xl bg-white p-3 text-right font-['Amiri'] text-[1.04rem] leading-[1.95] text-[#0f172a] shadow-sm">
              {body ? (
                green && readingAudioUrl ? (
                  <ReadAlongText
                    text={body}
                    glossary={glossary}
                    progress={readingProgress}
                  />
                ) : (
                  renderTextWithGlossary(body, glossary)
                )
              ) : green ? (
                "سيظهر نص القراءة هنا عندما يضيفه المشرف من التحكم عن بعد."
              ) : (
                "سيظهر نص الاستماع هنا عندما يضيفه المشرف من التحكم عن بعد."
              )}
            </div>
            <div className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold leading-6 text-blue-900">
              ● انقر على الكلمات الملوّنة إن أضاف المشرف شروحاتها في المعجم.
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e8e1d4] bg-white shadow-sm">
          <div className="border-b bg-blue-50/70 px-4 py-3 text-right">
            <h3 className="text-xl font-extrabold text-[#0b2447]">الأسئلة</h3>
          </div>
          <div className="p-3">
            {questionGroups.length > 0 ? (
              <QuestionStage groups={questionGroups} sequential />
            ) : (
              <EmptyComponentState text="لم يضف المشرف الأسئلة بعد." />
            )}
            {glossary.length > 0 ? (
              <GlossaryPanel items={glossary} label="شروحات الكلمات" />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}


function ListeningTemplate({
  entry,
  imagePost,
  audioUrl,
  questionGroups,
}: {
  entry: ContentEntry | null;
  imagePost: AdminSectionPost | null | undefined;
  audioUrl: string | null;
  questionGroups: QuestionGroup[];
}) {
  const numberedGroups = flattenGroupsAsNumbers(questionGroups);
  return (
    <div className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm" dir="rtl">
      {entry ? (
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-2 text-right font-['Cairo'] text-[#0f3f56]">
            {entry.author ? <div><b>الكاتب/ة:</b> {entry.author}</div> : null}
            {entry.source ? <div><b>المصدر:</b> {entry.source}</div> : null}
          </div>
          <div className="overflow-hidden rounded-2xl bg-white shadow-md">
            {imagePost?.fileUrl ? (
              <img src={imagePost.fileUrl} alt={entry?.title || "نص سماعي"} className="h-[270px] w-full object-cover" />
            ) : (
              <div className="grid h-[270px] place-items-center bg-slate-100 text-sm font-bold text-slate-500">صورة النص السماعي</div>
            )}
            {entry.title ? (
              <div className="px-4 py-4 text-center font-['Amiri'] text-2xl leading-10 text-slate-900">
                {entry.title}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <SpotifyAudioPlayer audioUrl={audioUrl} title={entry?.title || "نص الاستماع"} imageUrl={imagePost?.fileUrl} />
      {entry?.content ? (
        <div className="rounded-xl border-2 border-[#123c69] bg-white px-4 py-3 text-right text-sm font-bold leading-7 text-[#123c69]">
          الملخص: {entry.content}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border-2 border-[#123c69] bg-white">
        <div className="flex flex-col gap-1 bg-[#123c69] px-4 py-3 font-['Cairo'] text-base font-extrabold text-white sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:text-xl">
          <span>عدد الأسئلة: {numberedGroups.length}</span>
          <span>مجموع النقط: {numberedGroups.length * 2}</span>
        </div>
        {numberedGroups.length > 0 ? (
          <QuestionStage groups={numberedGroups} numbered sequential />
        ) : (
          <EmptyComponentState text="لم يضف المشرف أسئلة فهم المسموع بعد." />
        )}
      </div>
    </div>
  );
}

function ReadingPreview({
  posts,
  selectedPostId,
}: {
  posts: AdminSectionPost[];
  selectedPostId?: number | null;
}) {
  const entries = buildContentEntries(posts, "reading", "نص القراءة");
  const entry =
    entries.find((item) => item.id === selectedPostId) || entries[0] || null;
  const body =
    entry != null ? entry.content : getGenericContent(posts, "reading");
  const audioPost = getPrimaryMediaPost(posts, ["reading:audio"]);
  const readingAudioUrl =
    (entry?.audioUrl && entry.audioUrl) ||
    (audioPost?.fileUrl && (audioPost.fileType || "").startsWith("audio/")
      ? audioPost.fileUrl
      : null);
  const glossary = parseGlossary(entry?.glossary || getPlainContent(posts, "reading:glossary"));
  const foundQuestionGroups = findCardQuestionGroups(posts, "reading", entry?.id, [
    {
      key: "analysis",
      label: "الفهم",
      icon: "🔍",
      lead: "أسئلة متدرّجة في المستوى (مباشر ← استنتاجي ← ضمني ← إبداعي) ومتنوّعة في الصيغة.",
    },
    {
      key: "vocabulary",
      label: "المعجم",
      icon: "📚",
      lead: "الكلمات التي وردت في النص، للمراجعة والتثبيت.",
    },
    {
      key: "grammar",
      label: "القواعد",
      icon: "✍️",
      lead: "أسئلة قواعد اللغة المرتبطة بالنص.",
    },
    {
      key: "tarkib",
      label: "التركيب",
      icon: "🌱",
      lead: "أنشطة التركيب والإنتاج الكتابي.",
    },
  ]);
  const questionGroups = foundQuestionGroups;

  if (!entry && !body && glossary.length === 0 && questionGroups.length === 0) {
    return (
      <EmptyComponentState text="لا يوجد محتوى داخل فهم المقروء حالياً." />
    );
  }

  return (
    <LessonLikeLayout
      mode="reading"
      title="نص القراءة"
      subtitle="السنة الأولى إعدادي ‹ مكوّن القراءة"
      entry={entry}
      body={body}
      glossary={glossary}
      questionGroups={questionGroups}
      media={renderMedia(
        entry?.imagePost || null,
        "max-h-[260px] min-h-[230px]",
      )}
      readingAudioUrl={readingAudioUrl}
    />
  );
}

function ListeningPreview({
  posts,
  selectedPostId,
}: {
  posts: AdminSectionPost[];
  selectedPostId?: number | null;
}) {
  const entries = buildContentEntries(posts, "listening", "نص الاستماع");
  const entry =
    entries.find((item) => item.id === selectedPostId) || entries[0] || null;
  const body =
    entry != null ? entry.content : getGenericContent(posts, "listening");
  const imagePost =
    entry?.imagePost || getPrimaryMediaPost(posts, ["listening:image"]);
  const audioPost = getPrimaryMediaPost(posts, ["listening:audio"]);
  const audioUrl =
    (entry?.audioUrl && entry.audioUrl) ||
    (audioPost?.fileUrl && (audioPost.fileType || "").startsWith("audio/")
      ? audioPost.fileUrl
      : null);
  const labelForQuestion = (category: string, index: number) => {
    const suffix = category.split(":").pop() || `${index + 1}`;
    return /^\d+$/.test(suffix) ? suffix : `${index + 1}`;
  };
  const scopedQuestionGroups = entry?.id
    ? findQuestionGroupsByPrefix(posts, `listening:${entry.id}:questions:`, labelForQuestion)
    : [];
  const foundQuestionGroups = scopedQuestionGroups.length
    ? scopedQuestionGroups
    : findQuestionGroupsByPrefix(posts, "listening:questions:", labelForQuestion);
  const questionGroups = foundQuestionGroups;

  if (
    !entry &&
    !body &&
    !audioPost &&
    questionGroups.length === 0
  ) {
    return (
      <EmptyComponentState text="لا يوجد محتوى داخل فهم المسموع حالياً." />
    );
  }

  return (
    <ListeningTemplate
      entry={entry ? { ...entry, content: body } : null}
      imagePost={imagePost}
      audioUrl={audioUrl}
      questionGroups={questionGroups}
    />
  );
}

function extractYouTubeVideoId(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^"&?/\s]{11})/);
  return match?.[1] || "";
}

function LanguageVideoBlock({ post }: { post: AdminSectionPost | null }) {
  if (!post?.fileUrl) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[#d6dcf3] bg-[#eef1fa] p-8 text-center font-['Cairo'] text-sm font-bold text-[#3a4790]">
        أضف فيديو هذا الجزء من التحكم عن بعد.
      </div>
    );
  }

  const youtubeId = extractYouTubeVideoId(post.fileUrl);
  if (youtubeId) {
    return (
      <div className="platform-video-frame aspect-video overflow-hidden rounded-2xl bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}`}
          title={post.fileName || "فيديو الدرس"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return post.fileType?.startsWith("video/") ? (
    <video src={post.fileUrl} controls className="max-h-[320px] w-full rounded-2xl bg-black" />
  ) : (
    renderMedia(post, "max-h-[320px]")
  );
}

function LanguageLines({ text }: { text: string }) {
  const lines = parsePlainLines(text);
  if (!lines.length) return null;
  return (
    <ul className="space-y-2 text-right text-sm font-semibold leading-7 text-[#1e2233]">
      {lines.map((line, index) => (
        <li key={`${line}-${index}`} className="relative pr-4 before:absolute before:right-0 before:top-3 before:text-[8px] before:text-[#4c5ca8] before:content-['◆']">
          {line}
        </li>
      ))}
    </ul>
  );
}


type LanguageComment = {
  id: string;
  name: string;
  text: string;
  createdAt: string;
};

function LanguageComments({ storageKey }: { storageKey: string }) {
  const [comments, setComments] = useState<LanguageComment[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setComments(JSON.parse(window.localStorage.getItem(storageKey) || "[]") as LanguageComment[]);
    } catch {
      setComments([]);
    }
  }, [storageKey]);

  const submit = () => {
    if (typeof window === "undefined" || !text.trim()) return;
    const item: LanguageComment = {
      id: `comment:${Date.now()}`,
      name: name.trim() || "تلميذ(ة)",
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...comments].slice(0, 100);
    setComments(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setText("");
  };

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-[#d5ddd7] bg-white p-4 text-right">
      <div className="font-['Cairo'] text-lg font-extrabold text-[#123c69]">تعليقات التلاميذ</div>
      <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="اسمك" className="rounded-xl border border-[#d5ddd7] px-3 py-2 text-sm outline-none focus:border-[#123c69]" />
        <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} placeholder="اكتب تعليقك على الدرس مثل YouTube..." className="rounded-xl border border-[#d5ddd7] px-3 py-2 text-sm outline-none focus:border-[#123c69]" />
        <button type="button" onClick={submit} className="rounded-xl bg-[#123c69] px-4 py-2 font-['Cairo'] text-sm font-bold text-white">نشر</button>
      </div>
      <div className="space-y-2">
        {comments.length > 0 ? comments.map((comment) => (
          <div key={comment.id} className="rounded-xl border border-[#e8e1d4] bg-[#fcf9f2] p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-['Cairo'] text-xs font-extrabold text-[#123c69]">
              <span>{comment.name}</span>
              <span className="text-[#64748b]">{new Date(comment.createdAt).toLocaleString("ar-MA")}</span>
            </div>
            <div className="whitespace-pre-wrap text-sm font-semibold leading-7 text-[#1e293b]">{comment.text}</div>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-[#d5ddd7] bg-[#fcf9f2] p-4 text-center text-sm font-semibold text-[#64748b]">لا توجد تعليقات بعد. كن أول من يعلّق على هذا الدرس.</div>
        )}
      </div>
    </div>
  );
}

function LanguagePreview({ posts, selectedPostId }: { posts: AdminSectionPost[]; selectedPostId?: number | null }) {
  const entries = buildContentEntries(posts, "language", "الظاهرة اللغوية");
  const entry = entries.find((item) => item.id === selectedPostId) || entries[0] || null;

  const scoped = (suffix: string) => entry?.id ? `language:${entry.id}:${suffix}` : `language:${suffix}`;
  const getLangContent = (suffix: string) =>
    getPlainContent(posts, scoped(suffix)) || getPlainContent(posts, `language:${suffix}`);
  const getLangMedia = (suffix: string) =>
    getPrimaryMediaPost(posts, [scoped(suffix), `language:${suffix}`]);
  const getLangQuestions = (suffix: string, label: string) => {
    const scopedQuestions = findQuestionGroups(posts, [{ key: scoped(suffix), label }]);
    return scopedQuestions.length ? scopedQuestions : findQuestionGroups(posts, [{ key: `language:${suffix}`, label }]);
  };

  const tabs = [
    {
      key: "language:tab:1",
      label: getLangContent("tab:1:label") || "الفهم والتحليل",
      intro: getLangContent("tab:1:intro"),
      videoTitle: getLangContent("tab:1:video-title") || getLangContent("tab:1:label") || "عنوان الفيديو",
      videoDescription: getLangContent("tab:1:video-description") || "اكتب وصف الفيديو من التحكم عن بعد.",
      video: getLangMedia("tab:1:video"),
      questions: getLangQuestions("tab:1:questions", "التطبيقات"),
      videoEnabled: true,
    },
    {
      key: "language:tab:2",
      label: getLangContent("tab:2:label") || "الاستنتاج",
      intro: getLangContent("tab:2:intro"),
      videoTitle: getLangContent("tab:2:video-title") || getLangContent("tab:2:label") || "عنوان الفيديو",
      videoDescription: getLangContent("tab:2:video-description") || "اكتب وصف الفيديو من التحكم عن بعد.",
      video: getLangMedia("tab:2:video"),
      questions: getLangQuestions("tab:2:questions", "التطبيقات"),
      videoEnabled: true,
    },
    {
      key: "language:tab:khulasa",
      label: "خلاصة وتمييز",
      intro: getLangContent("tab:khulasa:intro"),
      concept: getLangContent("tab:khulasa:concept"),
      types: getLangContent("tab:khulasa:types"),
      examples: getLangContent("tab:khulasa:examples"),
      questionsTitle: getLangContent("tab:khulasa:questions-title") || "تطبيق التمييز",
      questions: getLangQuestions("tab:khulasa:questions", "التطبيقات"),
      videoEnabled: false,
    },
    {
      key: "language:tab:tawdif",
      label: "التوظيف التعبيري",
      intro: getLangContent("tab:tawdif:intro"),
      reminder: getLangContent("tab:tawdif:reminder"),
      image: getLangMedia("tab:tawdif:image"),
      questions: getLangQuestions("tab:tawdif:questions", "التطبيقات"),
      videoEnabled: false,
    },
  ];
  const [activeTab, setActiveTab] = useState(tabs[0].key);
  const [showApplications, setShowApplications] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const active = tabs.find((tab) => tab.key === activeTab) || tabs[0];

  useEffect(() => {
    setActiveTab(tabs[0].key);
    setShowApplications(false);
    setShowComments(false);
  }, [entry?.id]);

  useEffect(() => {
    setShowApplications(false);
    setShowComments(false);
  }, [activeTab]);

  if (!entry && posts.length === 0) {
    return <EmptyComponentState text="لم يتم إعداد درس الظاهرة اللغوية بعد. خاص الأستاذ يعمره من التحكم عن بعد." />;
  }

  const isKhulasa = active.key === "language:tab:khulasa";
  const isTawdif = active.key === "language:tab:tawdif";

  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-[#e6e3d9] bg-[#fbf7f0] shadow-sm" dir="rtl">
      <div className="border-b border-[#e6e3d9] bg-[#fcf9f2] px-5 py-4 text-right">
        <h2 className="font-['Cairo'] text-2xl font-extrabold text-[#123c69]">{entry?.title || "الظاهرة اللغوية"}</h2>
        {entry?.content ? <p className="mt-2 text-sm font-semibold leading-7 text-[#475569] whitespace-pre-wrap">{entry.content}</p> : null}
      </div>
      <div className="flex flex-wrap border-b border-[#e6e3d9] bg-[#fcf9f2]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-4 font-['Cairo'] text-sm font-extrabold transition ${
              activeTab === tab.key ? "bg-white text-[#123c69] shadow-inner border-b-4 border-[#123c69]" : "text-[#5c6173] hover:bg-[#eaf2ff]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="space-y-4 bg-white p-5">
        {active.intro ? (
          <div className="rounded-2xl border border-[#93b7e7] bg-[#eaf2ff] p-4 text-right text-sm font-semibold leading-7 text-[#123c69]">
            {active.intro}
          </div>
        ) : null}

        {"video" in active && active.videoEnabled ? (
          <div className="space-y-4">
            <LanguageVideoBlock post={active.video || null} />
            <div className="rounded-2xl border border-[#e8e1d4] bg-[#fcf9f2] p-4 text-right">
              <h3 className="font-['Cairo'] text-xl font-extrabold text-[#0b2447]">{active.videoTitle}</h3>
              <p className="mt-2 text-sm font-semibold leading-7 text-[#475569]">{active.videoDescription}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setShowComments((value) => !value)} className="rounded-xl border border-[#d5ddd7] bg-white px-4 py-2 font-['Cairo'] text-sm font-bold text-[#123c69]">{showComments ? "إخفاء التعليقات" : "التعليقات"}</button>
                <button type="button" onClick={() => setShowApplications((value) => !value)} className="rounded-xl bg-[#123c69] px-4 py-2 font-['Cairo'] text-sm font-bold text-white">{showApplications ? "إخفاء التطبيقات" : "التطبيقات"}</button>
              </div>
              {showComments ? (
                <LanguageComments storageKey={`nakhla-language-comments:${entry?.id || selectedPostId || active.key}`} />
              ) : null}
            </div>
          </div>
        ) : null}

        {isKhulasa && "concept" in active ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-[#e6e3d9] bg-white">
              <div className="bg-[#123c69] px-4 py-3 text-center font-['Cairo'] text-base font-extrabold text-white">المفهوم والأركان</div>
              <div className="space-y-3 p-4">
                <LanguageLines text={active.concept || ""} />
                {active.examples ? <div className="whitespace-pre-wrap rounded-xl bg-[#fcf9f2] p-3 font-['Amiri'] text-lg leading-8 text-[#1e2233]">{active.examples}</div> : null}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#e6e3d9] bg-white">
              <div className="bg-[#123c69] px-4 py-3 text-center font-['Cairo'] text-base font-extrabold text-white">الأنواع</div>
              <div className="p-4"><LanguageLines text={active.types || ""} /></div>
            </div>
          </div>
        ) : null}

        {isTawdif && "reminder" in active && active.reminder ? (
          <div className="overflow-hidden rounded-2xl border border-[#e6e3d9] bg-white">
            <div className="bg-[#123c69] px-4 py-3 text-center font-['Cairo'] text-base font-extrabold text-white">تذكّر قبل التوظيف</div>
            <div className="p-4"><LanguageLines text={active.reminder} /></div>
          </div>
        ) : null}
        {isTawdif && "image" in active && active.image?.fileUrl ? (
          <div className="rounded-2xl border border-[#93b7e7] bg-[#eaf2ff] p-3">{renderMedia(active.image, "max-h-[260px]")}</div>
        ) : null}

        {isKhulasa && "questionsTitle" in active && active.questions.length > 0 ? (
          <div className="rounded-xl bg-[#eaf2ff] px-4 py-3 text-right font-['Cairo'] text-sm font-extrabold text-[#123c69]">
            {active.questionsTitle}
          </div>
        ) : null}

        {((!active.videoEnabled && active.questions.length > 0) || showApplications) ? (
          active.questions.length > 0 ? (
            <QuestionStage groups={active.questions} sequential />
          ) : (
            <EmptyComponentState text="لم يضف الأستاذ تطبيقات هذا الجزء بعد." />
          )
        ) : null}
      </div>
    </div>
  );
}


type WritingSubmission = {
  id: string;
  student: string;
  answer: string;
  correction?: string;
  submittedAt: string;
};

function getWritingList(categoryContent: string, fallback: string[] = []) {
  const parsed = parsePlainLines(categoryContent);
  return parsed.length ? parsed : fallback;
}

const WRITING_HL_STYLES: Record<string, { label: string; dot: string; show: string }> = {
  per: { label: "الشخصيات", dot: "bg-[#CDE3F5]", show: "show-per" },
  zm: { label: "الزمان", dot: "bg-[#F6E3C5]", show: "show-zm" },
  mk: { label: "المكان", dot: "bg-[#CDEBD8]", show: "show-mk" },
  hd: { label: "الأحداث", dot: "bg-[#E6D8F0]", show: "show-hd" },
  ws: { label: "الوصف", dot: "bg-[#FAD9D9]", show: "show-ws" },
};

const WRITING_HL_ALIASES: Record<string, string> = {
  people: "per",
  time: "zm",
  place: "mk",
  events: "hd",
  description: "ws",
  per: "per",
  zm: "zm",
  mk: "mk",
  hd: "hd",
  ws: "ws",
};

function renderWritingModelText(text: string, activeHighlights: Set<string>) {
  const showClasses = [...activeHighlights]
    .map((key) => WRITING_HL_STYLES[key]?.show)
    .filter(Boolean)
    .join(" ");
  const parts = text.split(/(\[\[(?:\/)?(?:per|zm|mk|hd|ws|people|time|place|events|description)\]\])/g);
  const nodes: ReactNode[] = [];
  let openTag: string | null = null;
  for (const part of parts) {
    const open = part.match(/^\[\[(per|zm|mk|hd|ws|people|time|place|events|description)\]\]$/);
    const close = part.match(/^\[\[\/(per|zm|mk|hd|ws|people|time|place|events|description)\]\]$/);
    if (open) {
      openTag = WRITING_HL_ALIASES[open[1]] || open[1];
      continue;
    }
    if (close) {
      openTag = null;
      continue;
    }
    if (!part) continue;
    if (openTag) {
      nodes.push(
        <span key={`${openTag}-${nodes.length}`} className={`hl ${openTag} rounded-[5px] px-0.5 transition-colors`}>
          {part}
        </span>,
      );
    } else {
      nodes.push(<span key={`plain-${nodes.length}`}>{part}</span>);
    }
  }
  return (
    <div className={`startext whitespace-pre-wrap text-justify font-['Amiri'] text-[1.28rem] leading-[2.3] text-[#1E2B26] ${showClasses}`}>
      {nodes.length ? nodes : text}
    </div>
  );
}

function speakArabic(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ar-SA";
  utterance.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const arabic = voices.find((voice) => /ar/i.test(voice.lang));
  if (arabic) utterance.voice = arabic;
  window.speechSynthesis.speak(utterance);
}

const WRITING_CRITERIA = [
  {
    title: "١) فهمُ المعطى والالتزامُ بالمطلوب",
    points: "1 ن",
    items: [
      "فهمتُ المطلوبَ والتزمتُ به: نصٌّ سرديٌّ في موضوعِ التضحيةِ، ضمنَ الحجمِ المطلوب (12–15 سطرًا).",
    ],
  },
  {
    title: "٢) توظيفُ تقنياتِ المهارة: احترامُ خطواتِ النصِّ السرديّ",
    points: "3 ن",
    items: [
      "احترمتُ بنيةَ السرد: بدايةٌ (وضعيّةٌ أولى) ← حدثٌ/عقدةٌ ← نهايةٌ (وضعيّةٌ نهائيّة).",
      "وظّفتُ عناصرَ السرد: الشخصياتِ، والزمانَ والمكانَ، والأحداثَ المتسلسلة، والسارد.",
      "أدرجتُ الوصفَ في موضعِه (وصفُ شخصيةٍ أو مكانٍ أو حالٍ) في خدمةِ السرد.",
      "استعملتُ روابطَ التسلسلِ الزمنيّ (ثمّ، بعد ذلك، عندئذٍ، في الأخير...).",
    ],
  },
  {
    title: "٣) سلامةُ اللغةِ والتراكيبِ وعلاماتُ الترقيم",
    points: "2 ن",
    items: [
      "لغتي سليمةٌ من الأخطاءِ الإملائيّةِ والتعبيريّةِ والتركيبيّة.",
      "استعملتُ علاماتِ الترقيمِ استعمالًا مناسبًا (. ، ؛ : ؟ !).",
    ],
  },
] as const;

const WRITING_MIND_NODES = [
  { key: "shakhsiyat", icon: "👥", title: "الشخصيات", color: "#2E6FA8", bg: "#DCEAF7", desc: "مَن تدورُ حولَهم الأحداثُ؛ منها الرئيسةُ والثانويّة.", ex: "الرئيسة: عائشةُ (الأمّ). الثانويّة: الطبيبُ إبراهيم، الأبناء، الزبونات." },
  { key: "ahdath", icon: "📜", title: "الأحداث", color: "#7B4B9B", bg: "#ECE0F2", desc: "وقائعُ متسلسلةٌ تُروى بأفعالٍ تُكوّنُ الحبكة.", ex: "«جاءَ الطبيبُ… أُصيبت… سهِرت… فتحوا بابَ غرفتِها… وجدوها»." },
  { key: "zaman", icon: "🗺️", title: "الزمان والمكان", color: "#358062", bg: "#D8F0E2", desc: "الإطارُ الزمكانيُّ الذي تجري فيه الأحداث.", ex: "الزمان: اللياليَ، ذاتَ صباحٍ. المكان: الغرفةُ الصغيرة، ماكينةُ الخياطة." },
  { key: "sarid", icon: "👁️", title: "السارد والرؤية", color: "#5C6B63", bg: "#E7EAE6", desc: "مَن يَروي القصّةَ، وزاويةُ النظرِ التي يَحكي منها.", ex: "راوٍ يَسردُ بضميرِ الغائبِ من موقعِ العارفِ بأحوالِ الشخصية." },
  { key: "binya", icon: "🧱", title: "بنيةُ السرد", color: "#2D6A4F", bg: "#CDE9D7", desc: "هيكلُ القصّةِ: بدايةٌ ← عقدةٌ ← نهاية.", ex: "البداية: العملُ في الخياطة. العقدة: المرضُ والمعاناة. النهاية: الوفاةُ على مقعدِها." },
  { key: "wasf", icon: "🎨", title: "الوصف", color: "#C96B6B", bg: "#FAD9D9", desc: "يُرافِقُ السردَ فيَرسمُ الشخصيّةَ والمكانَ ويُعمّقُ التأثير.", ex: "«غرفتُها الصغيرة»، «رأسُها الذي كساه شعرٌ أبيض»." },
] as const;

function WritingMindMap() {
  const [active, setActive] = useState<string | null>(null);
  const node = WRITING_MIND_NODES.find((item) => item.key === active);
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-[#95D5B2] bg-[#D8F0E2] px-4 py-3 font-['Cairo'] text-sm leading-7 text-[#16352A]">
        🧠 أحسنت، اكتملت الأنشطة! هذه خطاطةٌ ذهنيّةٌ تفاعليّةٌ تُلخّصُ خصائصَ النصِّ السرديّ — انقُرْ أيَّ عنصرٍ لِتَكشِفَ تعريفَه ومثالَه.
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {WRITING_MIND_NODES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActive(item.key)}
            className={`rounded-full border-2 px-4 py-3 text-right font-['Cairo'] text-sm font-bold transition ${active === item.key ? "shadow-md" : "hover:brightness-95"}`}
            style={{ background: item.bg, borderColor: item.color, color: item.color }}
          >
            {item.icon} {item.title}
          </button>
        ))}
      </div>
      <div className="min-h-[78px] rounded-xl border border-[#E8E1D4] bg-white p-4">
        {node ? (
          <>
            <h5 className="mb-2 flex items-center gap-2 font-['Cairo'] text-base font-extrabold" style={{ color: node.color }}>
              <span className="inline-block h-3.5 w-3.5 rounded" style={{ background: node.bg, border: `1px solid ${node.color}` }} />
              {node.icon} {node.title}
            </h5>
            <p className="mb-2 font-['Tajawal'] text-[0.96rem] leading-7 text-[#1E2B26]">{node.desc}</p>
            <p className="rounded-lg border-r-[3px] border-[#40916C] bg-[#EEF4EC] px-3 py-2 font-['Amiri'] text-[1.08rem] leading-8 text-[#16352A]">
              <b className="font-['Cairo']">من النصّ:</b> {node.ex}
            </p>
          </>
        ) : (
          <p className="py-3 text-center font-['Cairo'] text-sm text-[#5C6B63]">انقُرْ عنصرًا في الخطاطةِ لِيَظهرَ تعريفُه ومثالُه من نصِّ الانطلاق.</p>
        )}
      </div>
    </div>
  );
}

function WritingCriteriaGrid() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const totalItems = WRITING_CRITERIA.reduce((sum, section) => sum + section.items.length, 0);
  const allDone = checked.size >= totalItems;
  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-[#95D5B2]">
      <div className="flex items-center gap-2 bg-[#16352A] px-4 py-3 font-['Cairo'] text-[0.95rem] font-bold text-white">
        <span>🧾 شبكةُ معاييرِ الإنجاز (تقويمٌ ذاتيّ)</span>
        <span className="mr-auto rounded-full bg-white/15 px-3 py-0.5 text-[0.82rem]">المجموع: 6 نقاط</span>
      </div>
      <div className="bg-white px-4 pb-3">
        {WRITING_CRITERIA.map((section) => (
          <div key={section.title} className="border-b border-[#E8E1D4] py-3 last:border-b-0">
            <div className="mb-2 flex items-center gap-2 font-['Cairo'] text-[0.95rem] font-bold text-[#2D6A4F]">
              <span>{section.title}</span>
              <span className="mr-auto rounded-full bg-[#D8F0E2] px-2.5 py-0.5 text-[0.78rem]">{section.points}</span>
            </div>
            {section.items.map((item, index) => {
              const id = `${section.title}-${index}`;
              const on = checked.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className="flex w-full items-start gap-2.5 py-1.5 text-right font-['Tajawal'] text-[0.95rem] leading-7"
                >
                  <span className={`mt-0.5 grid h-[21px] w-[21px] shrink-0 place-items-center rounded-md border-2 border-[#40916C] text-xs text-white ${on ? "bg-[#40916C]" : ""}`}>
                    {on ? "✓" : ""}
                  </span>
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {allDone ? (
        <div className="mx-3 mb-3 rounded-xl border border-[#95D5B2] bg-[#D8F0E2] px-3 py-2.5 font-['Cairo'] text-sm font-bold text-[#2D6A4F]">
          أحسنت — استوفى إنتاجُك جميعَ معاييرِ الإنجازِ الثلاثة. راجِعْه مرّةً أخيرةً ثمّ أرسِلْه إلى أستاذِك.
        </div>
      ) : null}
    </div>
  );
}

function WritingStoryPlanner({ onInsert }: { onInsert: (text: string) => void }) {
  const [plan, setPlan] = useState({ who: "", place: "", time: "", knot: "", develop: "", end: "", desc: "" });
  const build = () => {
    let start = "(البداية) ";
    if (plan.time) start += `${plan.time}، `;
    if (plan.place) start += `${plan.place}، `;
    start += plan.who ? `كان هناك ${plan.who}. ` : "... ";
    if (plan.desc) start += `${plan.desc}. `;
    let body = `${start}\n(العقدة) `;
    body += plan.knot ? `${plan.knot}. ` : "... ";
    if (plan.develop) body += `${plan.develop}. `;
    body += `\n(النهاية) `;
    body += plan.end ? `${plan.end}.` : "...";
    onInsert(body);
  };
  return (
    <div className="rounded-2xl border border-[#E8E1D4] bg-white p-4">
      <h4 className="mb-2 font-['Cairo'] text-base font-extrabold text-[#2D6A4F]">🧩 خطاطةُ تخطيطِ القصّة — خطّطْ قبلَ أن تكتُب</h4>
      <p className="mb-3 font-['Cairo'] text-[0.78rem] leading-6 text-[#5C6B63]">
        املأِ الخاناتِ لِتَرسُمَ هيكلَ قصّتِك، ثمّ اضغطْ «أدرِجْ مخطّطي» فيَنتقلَ إلى مساحةِ الكتابةِ هيكلًا تُوسّعُه.
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-[#E8E1D4] border-r-4 border-r-[#2E6FA8] bg-[#FCF9F2] p-3">
          <div className="mb-2 font-['Cairo'] text-sm font-bold text-[#16352A]">١) البداية — الوضعيّةُ الأولى</div>
          <input value={plan.who} onChange={(e) => setPlan((p) => ({ ...p, who: e.target.value }))} placeholder="مَن الشخصيّةُ؟" className="mb-2 w-full rounded-lg border px-2.5 py-2 text-sm" />
          <input value={plan.place} onChange={(e) => setPlan((p) => ({ ...p, place: e.target.value }))} placeholder="أين؟" className="mb-2 w-full rounded-lg border px-2.5 py-2 text-sm" />
          <input value={plan.time} onChange={(e) => setPlan((p) => ({ ...p, time: e.target.value }))} placeholder="متى؟" className="w-full rounded-lg border px-2.5 py-2 text-sm" />
        </div>
        <div className="rounded-xl border border-[#E8E1D4] border-r-4 border-r-[#7B4B9B] bg-[#FCF9F2] p-3">
          <div className="mb-2 font-['Cairo'] text-sm font-bold text-[#16352A]">٢) العقدة — الحدثُ / التضحية</div>
          <input value={plan.knot} onChange={(e) => setPlan((p) => ({ ...p, knot: e.target.value }))} placeholder="ما التضحيةُ أو المشكلةُ؟" className="mb-2 w-full rounded-lg border px-2.5 py-2 text-sm" />
          <input value={plan.develop} onChange={(e) => setPlan((p) => ({ ...p, develop: e.target.value }))} placeholder="كيف تطوّرت الأحداث؟" className="w-full rounded-lg border px-2.5 py-2 text-sm" />
        </div>
        <div className="rounded-xl border border-[#E8E1D4] border-r-4 border-r-[#40916C] bg-[#FCF9F2] p-3">
          <div className="mb-2 font-['Cairo'] text-sm font-bold text-[#16352A]">٣) النهاية — الوضعيّةُ النهائيّة</div>
          <input value={plan.end} onChange={(e) => setPlan((p) => ({ ...p, end: e.target.value }))} placeholder="كيف انتهت القصّة؟" className="w-full rounded-lg border px-2.5 py-2 text-sm" />
        </div>
        <div className="rounded-xl border border-[#E8E1D4] border-r-4 border-r-[#C96B6B] bg-[#FCF9F2] p-3">
          <div className="mb-2 font-['Cairo'] text-sm font-bold text-[#16352A]">✦ لمسةُ وصف</div>
          <input value={plan.desc} onChange={(e) => setPlan((p) => ({ ...p, desc: e.target.value }))} placeholder="صفْ شخصيّةً أو مكانًا" className="w-full rounded-lg border px-2.5 py-2 text-sm" />
        </div>
      </div>
      <button type="button" onClick={build} className="mt-3 rounded-xl border border-[#95D5B2] bg-[#EEF4EC] px-4 py-2 font-['Cairo'] text-sm font-bold text-[#2D6A4F] hover:bg-[#D8F0E2]">
        📝 أدرِجْ مخطّطي في مساحةِ الكتابة
      </button>
    </div>
  );
}

function WritingCorrectionPanel() {
  const storageKey = "nakhla-writing-production-current-user";
  const [correction, setCorrection] = useState("");

  const loadCorrection = () => {
    if (typeof window === "undefined") return;
    try {
      const current = JSON.parse(window.localStorage.getItem(storageKey) || "{}") as { id?: string; correction?: string };
      if (current.correction) setCorrection(current.correction);
      if (current.id) {
        const all = JSON.parse(window.localStorage.getItem("nakhla-writing-production-submissions") || "[]") as WritingSubmission[];
        const found = all.find((item) => item.id === current.id);
        if (found?.correction) setCorrection(found.correction);
      }
    } catch {
      setCorrection("");
    }
  };

  useEffect(() => {
    loadCorrection();
    const interval = window.setInterval(loadCorrection, 2500);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl border border-[#95D5B2] bg-[#EEF4EC] p-4 text-right">
      <div className="mb-2 font-['Cairo'] text-lg font-extrabold text-[#2D6A4F]">تصحيح الأستاذ</div>
      {correction ? (
        <div className="rounded-xl border border-[#95D5B2] bg-white p-4 text-sm font-semibold leading-8 text-[#16352A] whitespace-pre-wrap">
          {correction}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#95D5B2] bg-white p-4 text-sm font-semibold text-[#5C6B63]">
          لم يصلك تصحيح بعد. من بعد ما الأستاذ يصحح الإنتاج غادي يبان هنا بوحدك.
        </div>
      )}
    </div>
  );
}

function WritingPreview({ posts }: { posts: AdminSectionPost[] }) {
  const [tab, setTab] = useState<"acquisition" | "application" | "correction">("acquisition");
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [answer, setAnswer] = useState("");
  const [student, setStudent] = useState("");
  const [sent, setSent] = useState(false);
  const [acqProgress, setAcqProgress] = useState({ correct: 0, total: 0 });
  const mindMapUnlocked = acqProgress.total > 0 && acqProgress.correct >= acqProgress.total;

  const {
    title,
    author,
    source,
    modelText,
    rawModelText,
    situation,
    task,
    objective,
    filePost,
    resources,
    writingQuestionGroups,
    hasWritingContent,
  } = resolveWritingLesson(posts);

  if (!hasWritingContent) {
    return (
      <EmptyComponentState text="لم يتم إعداد الإنتاج الكتابي بعد. خاص الأستاذ يعمر محتوى الإنتاج الكتابي من التحكم عن بعد عاد يبان للتلاميذ." />
    );
  }

  const toggleHighlight = (key: string) => {
    setHighlight((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllHighlights = () => {
    const allKeys = Object.keys(WRITING_HL_STYLES);
    setHighlight((current) => (current.size >= allKeys.length ? new Set() : new Set(allKeys)));
  };

  const insertResource = (text: string) => {
    setAnswer((current) => `${current}${current.trim() ? " " : ""}${text} `);
  };

  const insertPlanner = (text: string) => {
    setAnswer((current) => (current.trim() ? `${current}\n\n${text}` : text));
  };

  const submit = () => {
    if (typeof window === "undefined" || !answer.trim()) return;
    const id = `writing-production:${Date.now()}`;
    const item: WritingSubmission = {
      id,
      student: student.trim() || "تلميذ(ة)",
      answer: answer.trim(),
      submittedAt: new Date().toISOString(),
    };
    const list = JSON.parse(window.localStorage.getItem("nakhla-writing-production-submissions") || "[]") as WritingSubmission[];
    const next = [item, ...list].slice(0, 200);
    window.localStorage.setItem("nakhla-writing-production-submissions", JSON.stringify(next));
    window.localStorage.setItem("nakhla-writing-production-current-user", JSON.stringify(item));
    setSent(true);
  };

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const lineCount = answer.trim() ? answer.split("\n").length : 0;
  const acqPct = acqProgress.total > 0 ? Math.round((acqProgress.correct / acqProgress.total) * 100) : 0;

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`flex-1 border-b-[3px] px-2 py-2.5 font-['Cairo'] text-sm font-bold transition sm:px-4 sm:py-3.5 sm:text-base ${
        tab === key
          ? "border-[#40916C] bg-white text-[#2D6A4F]"
          : "border-transparent bg-[#FCF9F2] text-[#5C6B63] hover:text-[#2D6A4F]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1080px] overflow-hidden rounded-[20px] border border-[#E8E1D4] bg-white shadow-[0_10px_30px_-12px_rgba(22,53,42,0.22)]" dir="rtl">
      <div className="sticky top-0 z-[5] flex border-b border-[#E8E1D4] bg-[#FCF9F2]">
        {tabBtn("acquisition", "الاكتساب")}
        {tabBtn("application", "التطبيق")}
        {tabBtn("correction", "تصحيح")}
      </div>

      <div className="min-h-[60vh] px-3 py-4 sm:px-5 sm:py-6 md:px-6">
        {tab === "acquisition" ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="lg:sticky lg:top-[calc(var(--app-chrome-h)+0.5rem)] lg:max-h-[calc(100dvh-var(--app-chrome-h)-1rem)] lg:overflow-y-auto">
              <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[14px] border border-[#95D5B2] bg-[#EEF4EC] px-4 py-3 font-['Cairo'] text-[0.84rem]">
                <span><b className="text-[#2D6A4F]">الكاتب:</b> {author || "—"}</span>
                <span className="text-[#5C6B63]"><b className="text-[#2D6A4F]">المصدر:</b> {source || "—"}</span>
                <span className="mr-auto rounded-full border border-[#e6cfa6] bg-[#F4E6CF] px-3 py-1 text-[0.78rem] font-bold text-[#8a5a1c]">نصّ انطلاق</span>
              </div>
              <h2 className="text-center font-['Cairo'] text-xl font-extrabold text-[#2D6A4F] sm:text-[1.4rem]">{title || "الإنتاج الكتابي"}</h2>
              <div className="mx-auto my-2 h-1 w-[60px] rounded bg-[#40916C] opacity-55" />
              <div className="mb-1 flex flex-wrap gap-2">
                {Object.entries(WRITING_HL_STYLES).map(([key, style]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleHighlight(key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-['Cairo'] text-[0.84rem] font-bold transition ${
                      highlight.has(key)
                        ? "border-[#40916C] bg-white shadow-[0_0_0_2px_#D8F0E2]"
                        : "border-[#E8E1D4] bg-white text-[#5C6B63]"
                    }`}
                  >
                    <span className={`h-3.5 w-3.5 rounded-full border border-black/15 ${style.dot}`} />
                    {style.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={toggleAllHighlights}
                  className="rounded-full border border-[#40916C] bg-[#358062] px-3.5 py-1.5 font-['Cairo'] text-[0.84rem] font-bold text-white"
                >
                  الكل
                </button>
              </div>
              <p className="mb-3 font-['Cairo'] text-[0.74rem] text-[#5C6B63]">انقُرْ لإبرازِ عناصرِ السردِ في النصّ.</p>
              <div className="mb-3 rounded-[14px] border border-[#E8E1D4] bg-[#FCF9F2] p-4">
                {renderWritingModelText(
                  modelText || "سيظهر هنا نص الاكتساب بعد أن يملأه الأستاذ من التحكم عن بعد.",
                  highlight,
                )}
              </div>
              <button
                type="button"
                onClick={() => speakArabic(rawModelText || stripWritingHighlightTags(modelText))}
                className="rounded-[11px] border border-[#95D5B2] bg-[#FCF9F2] px-4 py-2 font-['Cairo'] text-sm font-bold text-[#2D6A4F] hover:bg-[#D8F0E2]"
              >
                🔊 استماع إلى النصّ
              </button>
            </section>

            <section>
              <div className="mb-4 rounded-xl border border-[#E8E1D4] bg-[#EEF4EC] px-3.5 py-3 font-['Cairo'] text-[0.9rem] leading-7 text-[#5C6B63]">
                {objective || "أجب عن أسئلة الاكتساب اعتمادًا على نص الانطلاق، ثم انتقل إلى التطبيق."}
              </div>
              {acqProgress.total > 0 ? (
                <div className="mb-4">
                  <div className="mb-1 flex items-center justify-between font-['Cairo'] text-xs font-bold text-[#2D6A4F]">
                    <span>تقدّمُ الاكتساب</span>
                    <span>{acqProgress.correct}/{acqProgress.total}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E8E1D4]">
                    <div className="h-full rounded-full bg-[#40916C] transition-all" style={{ width: `${acqPct}%` }} />
                  </div>
                </div>
              ) : null}
              {writingQuestionGroups.length > 0 ? (
                <QuestionStage
                  groups={writingQuestionGroups}
                  sequential
                  variant="nakhla"
                  onProgress={setAcqProgress}
                />
              ) : (
                <EmptyComponentState text="لم يضف الأستاذ أسئلة الاكتساب بعد." />
              )}
              {mindMapUnlocked ? <WritingMindMap /> : null}
            </section>
          </div>
        ) : null}

        {tab === "application" ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#95D5B2] bg-gradient-to-br from-[#F0F6EE] to-[#E4EFDE] p-5">
              <div className="mb-2 flex items-center gap-2 font-['Cairo'] text-[0.85rem] font-extrabold tracking-wide text-[#2D6A4F]">📋 الوضعية الواقعية</div>
              <p className="font-['Tajawal'] text-[1.05rem] leading-[1.9] text-[#1E2B26]">{situation}</p>
              <div className="mt-3 rounded-xl border border-dashed border-[#40916C] bg-white px-3.5 py-3 font-['Tajawal'] text-[1.02rem] leading-[1.9]">
                <b className="font-['Cairo'] text-[#2D6A4F]">المطلوب:</b> {task}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8E1D4] bg-white p-4">
              <div className="mb-1 font-['Cairo'] text-base font-extrabold text-[#2D6A4F]">🧰 موارد داعمة للإنتاج</div>
              <p className="mb-3 font-['Cairo'] text-[0.74rem] text-[#5C6B63]">انقُرْ أيَّ موردٍ لِيُدرَجَ في مساحةِ الكتابة.</p>
              {(
                [
                  ["الزمان", resources.time, "bg-[#F6E3C5]"],
                  ["المكان", resources.place, "bg-[#CDEBD8]"],
                  ["الشخصيات", resources.people, "bg-[#CDE3F5]"],
                  ["الأحداث", resources.events, "bg-[#E6D8F0]"],
                  ["الوصف", resources.description, "bg-[#FAD9D9]"],
                ] as const
              ).map(([label, items, dot]) => (
                <div key={label} className="mb-3">
                  <div className="mb-1.5 flex items-center gap-2 font-['Cairo'] text-[0.86rem] font-bold text-[#2D6A4F]">
                    <span className={`h-3 w-3 rounded-full ${dot}`} />
                    {label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => insertResource(item)}
                        className="rounded-full border border-[#E8E1D4] bg-[#FCF9F2] px-3 py-1.5 font-['Tajawal'] text-[0.92rem] transition hover:border-[#40916C] hover:bg-[#D8F0E2]"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <WritingStoryPlanner onInsert={insertPlanner} />

            <div className="rounded-2xl border border-[#E8E1D4] bg-white p-4">
              <div className="mb-3 font-['Cairo'] text-base font-extrabold text-[#2D6A4F]">✍️ مساحة الإنتاج</div>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="اكتب نصك السردي هنا..."
                className="min-h-[200px] w-full resize-y rounded-[14px] border border-[#E8E1D4] bg-[#FCF9F2] p-4 font-['Amiri'] text-[1.2rem] leading-8 outline-none focus:border-[#40916C] focus:outline focus:outline-2 focus:outline-[#95D5B2]"
              />
              <div className="mt-1.5 text-left font-['Cairo'] text-[0.76rem] text-[#5C6B63]">
                الكلمات: {wordCount} · الأسطر: {lineCount}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => speakArabic(answer)}
                  disabled={!answer.trim()}
                  className="rounded-[11px] border border-[#95D5B2] bg-[#FCF9F2] px-4 py-2 font-['Cairo'] text-sm font-bold text-[#2D6A4F] hover:bg-[#D8F0E2] disabled:opacity-50"
                >
                  🔊 استماع لنصّي
                </button>
              </div>
              <WritingCriteriaGrid />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  value={student}
                  onChange={(e) => setStudent(e.target.value)}
                  placeholder="اسمك (اختياري)"
                  className="rounded-xl border border-[#E8E1D4] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={submit}
                  className="rounded-[11px] bg-[#358062] px-5 py-2.5 font-['Cairo'] text-sm font-bold text-white hover:bg-[#2D6A4F]"
                >
                  إرسال إلى الأستاذ
                </button>
                {sent ? <span className="text-sm font-bold text-[#2D6A4F]">تم الإرسال، انتظر التصحيح.</span> : null}
              </div>
            </div>

            {filePost?.fileUrl ? <div className="rounded-2xl border border-[#E8E1D4] bg-white p-4">{renderMedia(filePost)}</div> : null}
          </div>
        ) : null}

        {tab === "correction" ? <WritingCorrectionPanel /> : null}
      </div>

      <style>{`
        .show-per .hl.per { background: #CDE3F5; }
        .show-zm .hl.zm { background: #F6E3C5; }
        .show-mk .hl.mk { background: #CDEBD8; }
        .show-hd .hl.hd { background: #E6D8F0; }
        .show-ws .hl.ws { background: #FAD9D9; }
      `}</style>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white px-4 py-3 text-right shadow-sm">
      <div className="text-xs font-semibold text-primary">{label}</div>
      <div className="mt-1 text-sm text-slate-700">{value || "—"}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-right text-base">
      <span className="font-bold text-slate-900">{label}:</span>
      <span className="text-slate-700">{value || "—"}</span>
    </div>
  );
}

function ComponentPreview({
  componentKey,
  posts,
  selectedPostId,
}: {
  componentKey: ComponentKey;
  posts: AdminSectionPost[];
  selectedPostId?: number | null;
}) {
  switch (componentKey) {
    case "reading":
      return <ReadingPreview posts={posts} selectedPostId={selectedPostId} />;
    case "listening":
      return <ListeningPreview posts={posts} selectedPostId={selectedPostId} />;
    case "language":
      return <LanguagePreview posts={posts} selectedPostId={selectedPostId} />;
    case "writing":
      return <WritingPreview posts={posts} />;
    default:
      return null;
  }
}

function ContentEntryCard({
  entry,
  onOpen,
  imageOnly = false,
}: {
  entry: ContentEntry;
  onOpen: () => void;
  imageOnly?: boolean;
}) {
  if (imageOnly) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full overflow-hidden rounded-[26px] border border-[#d6dcf3] bg-white shadow-[0_14px_34px_rgba(33,40,80,0.12)]"
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-[#eef1fa] p-2">
          {entry.imagePost?.fileUrl ? (
            <img
              src={entry.imagePost.fileUrl}
              alt={entry.title || "الظاهرة اللغوية"}
              className="h-full w-full rounded-[20px] object-contain transition group-hover:scale-[1.02]"
            />
          ) : (
            <div className="grid h-full place-items-center rounded-[20px] border border-dashed border-[#b7c2ea] px-6 text-center font-['Cairo'] text-sm font-extrabold leading-7 text-[#3a4790]">
              صورة الدرس اللغوي
            </div>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="platform-hover-card block w-full overflow-hidden rounded-[26px] border border-[#c9a46a]/50 bg-white text-right shadow-[0_14px_34px_rgba(89,57,18,0.12)]"
    >
      <div className="aspect-[16/9] w-full overflow-hidden bg-[#f8edd8]">
        {entry.imagePost?.fileUrl ? (
          <img
            src={entry.imagePost.fileUrl}
            alt={entry.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 px-6 text-center text-sm font-bold leading-7 text-amber-800">
            سيضيف المشرف صورة هذه البطاقة من التحكم عن بعد
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="line-clamp-2 text-xl font-extrabold text-[#6b3f16]">
          {entry.title}
        </div>
        <div className="grid gap-1 text-sm leading-7 text-slate-700">
          {entry.author ? <InfoLine label="الكاتب" value={entry.author} /> : null}
          <InfoLine label="المصدر" value={entry.source} />
        </div>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#6b3f16] px-4 py-2 text-sm font-bold text-white">
          <ArrowLeft className="h-4 w-4" />
          فتح المحتوى
        </div>
      </div>
    </button>
  );
}

function ComponentEntriesGrid({
  component,
  posts,
  onOpen,
}: {
  component: DomainComponent;
  posts: AdminSectionPost[];
  onOpen: (postId: number) => void;
}) {
  const entries = buildContentEntries(
    posts,
    component.key,
    component.title,
  );

  if (entries.length === 0) {
    return (
      <EmptyComponentState text="سيظهر هنا تلقائياً كل محتوى يضيفه المشرف: صورة، عنوان النص، الكاتب، والمصدر." />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => (
        <ContentEntryCard
          key={entry.id}
          entry={entry}
          imageOnly={component.key === "language"}
          onOpen={() => onOpen(entry.id)}
        />
      ))}
    </div>
  );
}

function DomainContent({
  domain,
  posts,
  selectedComponent,
  setSelectedComponent,
}: {
  domain: DomainSection;
  posts: AdminSectionPost[];
  selectedComponent: ComponentKey | null;
  setSelectedComponent: (component: ComponentKey | null) => void;
}) {
  const activeComponent =
    domain.components.find(
      (component) => component.key === selectedComponent,
    ) ??
    domain.components[0] ??
    null;
  const [openedPostId, setOpenedPostId] = useState<number | null>(null);

  // Admin-managed entry video that auto-plays once each time the section is opened.
  const introPost = getPrimaryMediaPost(posts, ["intro-video"]);
  const [introOpen, setIntroOpen] = useState(false);
  const introShownRef = useRef(false);

  useEffect(() => {
    setOpenedPostId(null);
  }, [activeComponent?.key, domain.id]);

  useEffect(() => {
    if (introPost?.fileUrl && !introShownRef.current) {
      introShownRef.current = true;
      setIntroOpen(true);
    }
  }, [introPost?.fileUrl]);

  if (!activeComponent) return null;

  const needsEntryCard =
    activeComponent.key === "reading" || activeComponent.key === "listening" || activeComponent.key === "language";
  const readingLessonOpen =
    activeComponent.key === "reading" && openedPostId !== null;
  const writingLessonOpen = activeComponent.key === "writing";
  const nakhlaLessonOpen = readingLessonOpen || writingLessonOpen;
  const hideComponentTabs = readingLessonOpen;
  const componentPosts = posts.filter(
    (post) =>
      post.category === activeComponent.key ||
      post.category?.startsWith(`${activeComponent.key}:`),
  );

  return (
    <>
    {introOpen && introPost?.fileUrl ? (
      <DomainIntroVideo post={introPost} onClose={() => setIntroOpen(false)} />
    ) : null}
    <Card
      id={domain.id}
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border shadow-sm ${
        nakhlaLessonOpen
          ? "border-[#E8E1D4] bg-[#FBF7F0]"
          : "border-white/70 bg-white/92"
      }`}
    >
      <CardContent className={`flex min-h-0 flex-1 flex-col gap-4 overflow-visible ${nakhlaLessonOpen ? "p-2 md:p-2" : "p-3 md:p-4"}`}>
        <section className={`grid shrink-0 grid-cols-2 gap-2 sm:gap-3 ${hideComponentTabs ? "hidden" : "md:grid-cols-2 xl:grid-cols-4"}`}>
          {domain.components.map((component) => {
            const Icon = component.icon;
            return (
              <ThemedActionButton
                key={component.key}
                type="button"
                theme="important-content"
                active={selectedComponent === component.key}
                className="w-full justify-center text-center"
                onClick={() => {
                  setSelectedComponent(component.key);
                  setOpenedPostId(null);
                }}
              >
                <Icon className="h-4 w-4" />
                {component.title}
              </ThemedActionButton>
            );
          })}
        </section>

        <section
          className={`min-h-0 flex-1 overflow-auto text-right ${
            nakhlaLessonOpen
              ? "rounded-[18px] bg-[#FBF7F0] p-0"
              : "rounded-[18px] bg-white p-3 md:p-4"
          }`}
        >
          {needsEntryCard && openedPostId === null ? (
            <ComponentEntriesGrid
              component={activeComponent}
              posts={componentPosts}
              onOpen={(postId) => setOpenedPostId(postId)}
            />
          ) : (
            <div className={nakhlaLessonOpen ? "space-y-0" : "space-y-3"}>
              {needsEntryCard ? (
                <button
                  type="button"
                  onClick={() => setOpenedPostId(null)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold shadow-sm ${
                    nakhlaLessonOpen
                      ? "m-3 border-[#95D5B2] bg-white text-[#2D6A4F] hover:bg-[#EEF4EC]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <ArrowRight className="h-4 w-4" />
                  رجوع إلى البطاقات
                </button>
              ) : null}
              <ComponentPreview
                componentKey={activeComponent.key}
                posts={componentPosts}
                selectedPostId={openedPostId}
              />
            </div>
          )}

          {!nakhlaLessonOpen ? (
            <div className="mt-4 flex justify-end">
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-900 shadow-sm">
                <CheckCircle2 className="h-4 w-4" />
                يتم تسجيل هذا المكون تلقائياً في تقدم الطلاب
              </div>
            </div>
          ) : null}
        </section>
      </CardContent>
    </Card>
    </>
  );
}

function DomainIntroVideo({ post, onClose }: { post: AdminSectionPost; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tryPlay = async () => {
      try {
        await video.play();
      } catch {
        // Browser blocked autoplay-with-sound → fall back to muted autoplay so it still starts.
        video.muted = true;
        setMuted(true);
        try {
          await video.play();
        } catch {
          /* user can press play manually */
        }
      }
    };
    void tryPlay();
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-white/15 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-2 bg-gradient-to-l from-blue-900 via-blue-800 to-teal-700 px-4 py-3 text-white">
          <div className="flex items-center gap-2 font-extrabold"><Play className="h-5 w-5" /> فيديو تعريفي</div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/15 p-2 transition hover:bg-white/25" title="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>
        <video ref={videoRef} src={post.fileUrl || undefined} controls playsInline className="max-h-[70vh] w-full bg-black object-contain" />
        <div className="flex items-center justify-between gap-2 bg-white px-4 py-3">
          {muted ? (
            <button
              type="button"
              onClick={() => { const video = videoRef.current; if (video) { video.muted = false; setMuted(false); void video.play(); } }}
              className="rounded-xl bg-blue-900 px-4 py-2 text-sm font-bold text-white"
            >
              تشغيل بالصوت
            </button>
          ) : <span />}
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            تخطّي ومتابعة
          </button>
        </div>
      </div>
    </div>
  );
}
