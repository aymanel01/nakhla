// Marker prefix for a self-contained domain "card" stored in a single admin
// content post (content = `${CARD_CONTENT_PREFIX}${JSON.stringify(CardContent)}`).
export const CARD_CONTENT_PREFIX = '__CARD__:'

export interface DomainCardContent {
  title?: string
  author?: string
  source?: string
  body?: string
  glossary?: string
  audioUrl?: string
}

export function parseDomainCardContent(content: string): DomainCardContent | null {
  if (!content.startsWith(CARD_CONTENT_PREFIX)) return null
  try {
    const data = JSON.parse(content.slice(CARD_CONTENT_PREFIX.length)) as DomainCardContent
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}

/** Returns user-facing text from stored content; never the raw __CARD__ JSON wrapper. */
export function getDomainCardDisplayBody(content: string): string {
  const card = parseDomainCardContent(content)
  if (card) return card.body?.trim() || ''
  if (content.startsWith(CARD_CONTENT_PREFIX)) return ''
  return content.trim()
}

export type UserRole = 'user' | 'admin'

export type UserStatus = 'pending' | 'approved' | 'rejected'

export interface User {
  id: number
  email: string
  role: UserRole
  status: UserStatus
  emailVerified: boolean
  createdAt: string
  fullName: string
  profilePhotoUrl: string | null
}
export type AdminSection = 'accounts' | 'tracking' | 'students' | 'social-economic'
export interface AdminSectionPost {
  id: number
  section: string
  userId: number
  userEmail: string
  content: string
  category: string | null
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  fileSize: number | null
  createdAt: string
}

export interface AuthUser extends User {
  // User returned from /auth/me
}
export interface ChatSettings {
  usersCanSend: boolean

  
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  fullName: string
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  message: string
}

export interface RegisterResponse {
  message: string
  pending: boolean
  needsEmailVerification?: boolean
}

export interface VerifyEmailResponse {
  message: string
  verified: boolean
}

export interface ResendVerificationResponse {
  message: string
}

export interface ErrorResponse {
  error: string
  message: string
}

export interface UsersListResponse {
  users: User[]
}

// Lectures (YouTube videos)
export interface Lecture {
  id: number
  title: string
  description: string
  youtubeUrl: string
  keyPoints: string | null
  order: number
  createdAt: string
  fileType: string | null
  fileUrl: string | null
  fileName: string | null
  fileSize?: number | null
  thumbnailUrl?: string | null
}

export interface CreateLectureRequest {
  title: string
  description: string
  youtubeUrl?: string
  keyPoints?: string
  order?: number
  fileUrl?: string | null
  fileName?: string | null
  fileType?: string | null
  fileSize?: number | null
  thumbnailUrl?: string | null
}

// Student creations (إبداعات التلاميذ)
export type StudentCreationType = 'بودكاست' | 'قصص مصورة' | 'قصص قصيرة' | 'صورة و تعليق'

export interface StudentCreation {
  id: number
  title: string
  type: StudentCreationType
  description: string | null
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  fileSize: number | null
  thumbnailUrl?: string | null
  createdBy: number
  createdAt: string
}

export interface CreateStudentCreationRequest {
  title: string
  type: StudentCreationType
  description?: string
  fileUrl?: string | null
  fileName?: string | null
  fileType?: string | null
  fileSize?: number | null
  thumbnailUrl?: string | null
}

// Exercises (PDFs parsed to HTML)
export type UnitEvaluationDomain = 'social-economic'

export interface ExerciseField {
  id: string
  type: 'text' | 'number' | 'textarea' | 'select'
  label: string
  placeholder?: string
  options?: string[]
  required?: boolean
}

export interface Exercise {
  id: number
  title: string
  description: string
  fields: ExerciseField[]
  lectureId: number | null
  order: number
  createdAt: string
  fileUrl: string | null
  fileName: string | null
  fileType?: string | null
  fileSize?: number | null
  domain: UnitEvaluationDomain
}

export interface CreateExerciseRequest {
  title: string
  description: string
  fields: ExerciseField[]
  lectureId?: number | null
  order?: number
  domain?: UnitEvaluationDomain
  fileUrl?: string | null
  fileName?: string | null
  fileType?: string | null
  fileSize?: number | null
}

export interface ExerciseSubmission {
  id: number
  exerciseId: number
  userId: number
  userEmail?: string
  userFullName?: string | null
  exerciseTitle?: string
  exerciseDomain?: UnitEvaluationDomain
  answers: Record<string, string>
  submittedAt: string
  fileUrl?: string | null
  fileName?: string | null
  fileType?: string | null
  fileSize?: number | null
  correctionText?: string | null
  correctionFileUrl?: string | null
  correctionFileName?: string | null
  correctionFileType?: string | null
  correctionFileSize?: number | null
  correctedAt?: string | null
}

// Quiz
export type QuizDifficulty = 'easy' | 'medium' | 'hard'

export type QuizQuestionType = 'multiple-choice' | 'match' | 'fill-blank' | 'communicative'

export interface QuizMatchPair {
  left: string
  right: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  type?: QuizQuestionType
  feedbacks?: string[]
  matchPairs?: QuizMatchPair[]
  modelAnswer?: string
  objective?: string
  level?: string
}

export interface Quiz {
  id: number
  title: string
  description: string
  questions: QuizQuestion[]
  difficulty: QuizDifficulty
  lectureId?: number | null
  lectureTitle?: string

  fileUrl?: string | null
  fileName?: string | null
  fileType?: string | null
  fileSize?: number | null

  createdAt: string
}

export interface CreateQuizRequest {
  title: string
  description: string
  questions: QuizQuestion[]
  difficulty?: QuizDifficulty
  lectureId?: number | null

  fileUrl?: string | null
  fileName?: string | null
  fileType?: string | null
  fileSize?: number | null
}

export interface QuizAttempt {
  id: number
  quizId: number
  userId: number
  answers: Record<string, number>
  score: number
  totalQuestions: number
  submittedAt: string
}

// Homework
export interface Homework {
  id: number
  title: string
  description: string
  lectureId: number | null
  dueDate: string | null
  solution: string | null
  createdAt: string
  groupName: string | null
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
}

export interface CreateHomeworkRequest {
  title: string
  description: string
  lectureId?: number | null
  dueDate?: string | null
}

export interface HomeworkSubmission {
  id: number
  homeworkId: number
  userId: number
  userEmail?: string
  userFullName?: string | null
  homeworkTitle?: string | null
  groupName?: string | null
  content: string
  submittedAt: string
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  fileSize?: number | null
  correctionText?: string | null
  correctionFileUrl?: string | null
  correctionFileName?: string | null
  correctionFileType?: string | null
  correctionFileSize?: number | null
  correctedAt?: string | null
}

export interface CreateHomeworkSubmissionRequest {
  content: string
}

// Chat Messages
export interface Message {
  id: number
  userId: number
  userEmail: string
  content: string
  createdAt: string
  fileName: string | null
  fileType: string | null
  fileUrl: string | null
  fileSize: number | null


}
export interface GroupMessage {
  id: number
  groupName: string
  userId: number
  userEmail: string
  content: string
  createdAt: string
  fileName: string | null
  fileType: string | null
  fileUrl: string | null
  groupId: number

}
export interface Group {
  id: number
  name: string
  createdAt: string
  memberCount: number
  description: string | null
}

export interface CreateMessageRequest {
  content: string
}

// Resources (library materials by skill area)
export type ResourceType = 'الاستماع' | 'اللغة' | 'القراءة' | 'الكتابة'

export interface Resource {
  id: number
  title: string
  type: ResourceType
  unitName: string | null
  groupName: string | null
  studentCount: number
  activityCount: number
  labName: string | null
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  fileSize: number | null
  description: string | null
  isArchived: boolean
  createdAt: string
  createdBy: number
}

export interface ResourceStats {
  totalResources: number
  activeResources: number
  archivedResources: number
  totalGroups: number
  totalStudents: number
}

export interface CreateResourceRequest {
  title: string
  type: ResourceType
  unitName?: string
  groupName?: string
  studentCount?: number
  activityCount?: number
  labName?: string
  fileUrl?: string
  fileName?: string
  fileType?: string
  fileSize?: number
  description?: string
}

// Student / content progress
export type ContentProgressItemType = 'lecture' | 'domain_component'

export interface UserContentProgress {
  itemType: ContentProgressItemType
  itemId: string
  completedAt: string
}

export interface ProgressCount {
  completed: number
  total: number
}

export interface ProgressDetailLists {
  completed: string[]
  remaining: string[]
}

export interface StudentFullProgress {
  id: number
  email: string
  palace: ProgressCount
  domains: ProgressCount
  lectures: ProgressCount
  exercises: ProgressCount
  homework: ProgressCount
  details: {
    palace: ProgressDetailLists
    domains: ProgressDetailLists
    lectures: ProgressDetailLists
    exercises: ProgressDetailLists
    homework: ProgressDetailLists
  }
  averageScore: number
  totalAttempts: number
  lastActivity: string | null
}
