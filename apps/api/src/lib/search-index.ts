import { db } from '../db/index.js'
import {
  getDomainCardDisplayBody,
  parseDomainCardContent,
  type SearchIndexItem,
} from '@teaching-app/shared'

const DOMAIN_SECTIONS = ['social-economic'] as const
const COMPONENT_KEYS = ['reading', 'listening', 'language', 'writing'] as const

const componentLabels: Record<(typeof COMPONENT_KEYS)[number], string> = {
  reading: 'فهم المقروء',
  listening: 'فهم المسموع',
  language: 'الظاهرة اللغوية',
  writing: 'الإنتاج الكتابي',
}

const domainLabels: Record<(typeof DOMAIN_SECTIONS)[number], string> = {
  'social-economic': 'المجال الاجتماعي والاقتصادي',
}

function uniqueTerms(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    terms.push(trimmed)
  }
  return terms
}

function snippet(value: string | null | undefined, max = 240): string {
  const text = value?.replace(/\s+/g, ' ').trim() || ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function extractQuestionTerms(content: string): string[] {
  const raw = content.startsWith('__DOMAIN_QUESTIONS__:')
    ? content.slice('__DOMAIN_QUESTIONS__:'.length)
    : content

  if (!raw.trim().startsWith('[')) return []

  try {
    const questions = JSON.parse(raw) as Array<{
      question?: string
      options?: string[]
      objective?: string
      level?: string
    }>
    if (!Array.isArray(questions)) return []

    return questions.flatMap((question) =>
      uniqueTerms([
        question.question,
        question.objective,
        question.level,
        ...(question.options || []),
      ]),
    )
  } catch {
    return []
  }
}

function extractPostTerms(content: string): { label?: string; terms: string[] } {
  const card = parseDomainCardContent(content)
  if (card) {
    return {
      label: card.title?.trim(),
      terms: uniqueTerms([
        card.title,
        card.author,
        card.source,
        snippet(card.body, 400),
        snippet(card.glossary, 200),
      ]),
    }
  }

  const questionTerms = extractQuestionTerms(content)
  if (questionTerms.length > 0) {
    return { terms: questionTerms }
  }

  const plain = getDomainCardDisplayBody(content)
  return {
    label: plain ? snippet(plain, 80) : undefined,
    terms: uniqueTerms([snippet(plain, 400)]),
  }
}

function pushDomainPosts(items: SearchIndexItem[]) {
  const rows = db
    .prepare(`
      SELECT id, section, category, content
      FROM admin_section_posts
      WHERE section IN (${DOMAIN_SECTIONS.map(() => '?').join(', ')})
    `)
    .all(...DOMAIN_SECTIONS) as Array<{
    id: number
    section: (typeof DOMAIN_SECTIONS)[number]
    category: string | null
    content: string
  }>

  for (const row of rows) {
    const category = row.category?.trim() || ''
    if (!category) continue

    const domain = domainLabels[row.section as (typeof DOMAIN_SECTIONS)[number]] || row.section
    const extracted = extractPostTerms(row.content || '')
    if (extracted.terms.length === 0 && !extracted.label) continue

    const componentKey = COMPONENT_KEYS.find(
      (key) => category === key || category.startsWith(`${key}:`),
    )

    if (componentKey && category === componentKey) {
      const label = extracted.label || `${componentLabels[componentKey]} #${row.id}`
      items.push({
        id: `domain-post-${row.id}`,
        label,
        subtitle: `${domain} · ${componentLabels[componentKey]}`,
        keywords: uniqueTerms([label, ...extracted.terms, componentLabels[componentKey], domain]),
        to: '/important-content',
        hash: `${row.section}--${componentKey}`,
        openPayload: {
          type: 'domain-post',
          postId: row.id,
          component: componentKey,
        },
      })
      continue
    }

    if (componentKey && category.includes(':questions:')) {
      const cardPostId = Number(category.split(':')[1])
      const questionLabel = extracted.terms[0]
        ? snippet(extracted.terms[0], 72)
        : `سؤال في ${componentLabels[componentKey]}`
      items.push({
        id: `domain-question-${row.id}`,
        label: questionLabel,
        subtitle: `${domain} · ${componentLabels[componentKey]} · أسئلة`,
        keywords: uniqueTerms([
          questionLabel,
          ...extracted.terms,
          componentLabels[componentKey],
          domain,
          'أسئلة',
        ]),
        to: '/important-content',
        hash: `${row.section}--${componentKey}`,
        openPayload: {
          type: 'domain-post',
          postId: Number.isInteger(cardPostId) && cardPostId > 0 ? cardPostId : row.id,
          component: componentKey,
        },
      })
    }
  }
}

function pushLectures(items: SearchIndexItem[]) {
  const rows = db.prepare('SELECT id, title, description, key_points FROM lectures').all() as Array<{
    id: number
    title: string
    description: string
    key_points: string | null
  }>

  for (const row of rows) {
    items.push({
      id: `lecture-${row.id}`,
      label: row.title,
      subtitle: 'المكتبة الرقمية',
      keywords: uniqueTerms([row.title, row.description, row.key_points]),
      to: '/lectures',
      search: { open: row.id },
    })
  }
}

function pushExercises(items: SearchIndexItem[]) {
  const rows = db.prepare('SELECT id, title, description FROM exercises').all() as Array<{
    id: number
    title: string
    description: string
  }>

  for (const row of rows) {
    items.push({
      id: `exercise-${row.id}`,
      label: row.title,
      subtitle: 'تقويم الوحدة',
      keywords: uniqueTerms([row.title, row.description]),
      to: '/exercises',
      search: { open: row.id },
    })
  }
}

function pushResources(items: SearchIndexItem[]) {
  const rows = db
    .prepare(`
      SELECT id, title, description, unit_name, group_name, type
      FROM resources
      WHERE is_archived = 0
    `)
    .all() as Array<{
    id: number
    title: string
    description: string | null
    unit_name: string | null
    group_name: string | null
    type: string
  }>

  for (const row of rows) {
    items.push({
      id: `resource-${row.id}`,
      label: row.title,
      subtitle: `إبداعات التلاميذ · ${row.type}`,
      keywords: uniqueTerms([
        row.title,
        row.description,
        row.unit_name,
        row.group_name,
        row.type,
      ]),
      to: '/resources',
    })
  }
}

function pushStudentCreations(items: SearchIndexItem[]) {
  const rows = db.prepare('SELECT id, title, description, type, creator_name, section_name FROM student_creations').all() as Array<{
    id: number
    title: string
    description: string | null
    type: string
    creator_name: string | null
    section_name: string | null
  }>

  for (const row of rows) {
    items.push({
      id: `creation-${row.id}`,
      label: row.title,
      subtitle: [row.type, row.creator_name, row.section_name].filter(Boolean).join(' · ') || `إبداعات التلاميذ · ${row.type}`,
      keywords: uniqueTerms([row.title, row.description, row.type, row.creator_name, row.section_name]),
      to: '/resources',
    })
  }
}

function pushGroups(items: SearchIndexItem[]) {
  const rows = db.prepare('SELECT id, name, description FROM project_groups').all() as Array<{
    id: number
    name: string
    description: string | null
  }>

  for (const row of rows) {
    items.push({
      id: `group-${row.id}`,
      label: row.name,
      subtitle: 'المجموعات',
      keywords: uniqueTerms([row.name, row.description]),
      to: '/groups',
    })
  }
}

function pushHomework(items: SearchIndexItem[]) {
  const rows = db.prepare('SELECT id, title, description FROM homework').all() as Array<{
    id: number
    title: string
    description: string
  }>

  for (const row of rows) {
    items.push({
      id: `homework-${row.id}`,
      label: row.title,
      subtitle: 'مشاريع المجموعات',
      keywords: uniqueTerms([row.title, row.description]),
      to: '/homework',
    })
  }
}

function pushQuizzes(items: SearchIndexItem[]) {
  const rows = db.prepare('SELECT id, title, description, questions FROM quizzes').all() as Array<{
    id: number
    title: string
    description: string
    questions: string
  }>

  for (const row of rows) {
    const questionTerms = extractQuestionTerms(row.questions)
    items.push({
      id: `quiz-${row.id}`,
      label: row.title,
      subtitle: 'أبواب القصر',
      keywords: uniqueTerms([row.title, row.description, ...questionTerms]),
      to: '/quizzes',
    })
  }
}

export function buildSearchIndex(): SearchIndexItem[] {
  const items: SearchIndexItem[] = []
  pushDomainPosts(items)
  pushLectures(items)
  pushExercises(items)
  pushResources(items)
  pushStudentCreations(items)
  pushGroups(items)
  pushHomework(items)
  pushQuizzes(items)
  return items
}
