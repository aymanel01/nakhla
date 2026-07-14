import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Quiz, QuizQuestion } from '@teaching-app/shared'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  Crown,
  Gift,
  Loader2,
  Lock,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  ArrowRight,
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/quizzes')({ component: QuizzesPage })

type StageType = 'main' | 'bonus'

type StageQuestion = QuizQuestion & {
  sourceTitle?: string
}

interface GameStage {
  number: number
  type: StageType
  title: string
  image: string
  x: number
  y: number
  questions: StageQuestion[]
  rewardLabel: string
}

interface StageConfig {
  stageType: StageType
  stageNumber: number
  title: string
  image: string | null
  questions: QuizQuestion[]
}

interface GameProfile {
  unlockedStage: number
  currentStage: number
  bestStage: number
  totalStars: number
  totalRewards: number
  soundEnabled: boolean
  completedMainStages: number[]
  completedBonusStages: number[]
}

interface LeaderboardEntry {
  rank: number
  id: number
  email: string
  unlockedStage: number
  currentStage: number
  bestStage: number
  totalStars: number
  totalRewards: number
  stopStage: number
  lastProgressAt: string | null
}

interface GameSnapshot {
  profile: GameProfile
  leaderboard: LeaderboardEntry[]
  monthlyChampion: {
    id: number
    email: string
    rewardPoints: number
    stars: number
    bestStage: number
    monthlyPrizeDh: number
  } | null
}

interface StageResultPopup {
  open: boolean
  kind: 'win' | 'lose' | 'bonus'
  title: string
  subtitle: string
  stars: number
  rewards: number
  correctCount: number
  total: number
  passRequired: number
  answersReview?: {
    question: string
    correctAnswer: string
    yourAnswer?: string
  }[]
  retryStage?: GameStage | null
  bonusStage?: GameStage | null
}

const MAIN_MAP = '/quiz-map/castle-main.jpeg'

const STAGE_IMAGES = [
  '/quiz-map/door-1.jpeg',
  '/quiz-map/door-2.jpeg',
  '/quiz-map/door-3.jpeg',
  '/quiz-map/door-4.jpeg',
  '/quiz-map/door-5.jpeg',
]

// Five locked palace doors. The player starts at الباب 1 and moves along the route until the palace finish.
const mainStagePositions = [
  { x: 16.4, y: 67.2, width: 7.6, height: 12.2 },
  { x: 27.8, y: 26.2, width: 7.0, height: 11.6 },
  { x: 54.2, y: 42.8, width: 6.8, height: 11.8 },
  { x: 82.4, y: 64.2, width: 7.2, height: 11.8 },
  { x: 80.2, y: 28.6, width: 7.4, height: 12.4 },
] as const

const bonusStagePositions = [
  { x: 25.0, y: 64.0 },
  { x: 32.0, y: 42.0 },
  { x: 49.0, y: 57.4 },
  { x: 67.0, y: 51.0 },
  { x: 73.2, y: 39.2 },
] as const

const playerTrackPoints = [
  { x: 16.4, y: 67.2 },
  { x: 25.0, y: 64.0 },
  { x: 27.8, y: 26.2 },
  { x: 32.0, y: 42.0 },
  { x: 54.2, y: 42.8 },
  { x: 49.0, y: 57.4 },
  { x: 82.4, y: 64.2 },
  { x: 67.0, y: 51.0 },
  { x: 80.2, y: 28.6 },
  { x: 73.2, y: 39.2 },
  { x: 88.0, y: 22.0 },
] as const
const startPoint = playerTrackPoints[0]
const stageTrackIndexes = [0, 2, 4, 6, 8, 10] as const

const rewardBank: StageQuestion[] = [
  { id: 'b1', question: 'ما هي عاصمة المغرب؟', options: ['فاس', 'الرباط', 'طنجة', 'مراكش'], correctAnswer: 1 },
  { id: 'b2', question: 'كم يساوي 7 × 8 ؟', options: ['54', '56', '58', '64'], correctAnswer: 1 },
  { id: 'b3', question: 'ما لون النجمة الذهبية في اللعبة؟', options: ['أحمر', 'أزرق', 'ذهبي', 'أسود'], correctAnswer: 2 },
  { id: 'b4', question: 'أي زر يفتح المرحلة التالية؟', options: ['إغلاق', 'التالي', 'حذف', 'رجوع'], correctAnswer: 1 },
  { id: 'b5', question: 'كم سؤال في كل مرحلة رئيسية؟', options: ['2', '3', '4', '5'], correctAnswer: 2 },
  { id: 'b6', question: 'أي مكافأة تظهر للفائز الشهري؟', options: ['20dh', '50dh', '100dh', '200dh'], correctAnswer: 2 },
  { id: 'b7', question: 'متى تُفتح المكافآت الإضافية؟', options: ['قبل اللعب', 'بعد إنهاء الباب', 'عند الخروج', 'بدون شروط'], correctAnswer: 1 },
  { id: 'b8', question: 'ماذا تربح عند الإجابة الصحيحة؟', options: ['نجوم فقط', 'مكافآت فقط', 'تقدّم ومكافآت', 'لا شيء'], correctAnswer: 2 },
]

function buildFallbackQuestions(count: number): StageQuestion[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1
    return {
      id: `fallback-${n}`,
      question: `السؤال ${n}: اختر الإجابة الصحيحة`,
      options: ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث', 'الخيار الرابع'],
      correctAnswer: n % 4,
      sourceTitle: 'مرحلة الخريطة',
    }
  })
}

function buildMainStages(quizzes: Quiz[], stageConfigs: StageConfig[]): GameStage[] {
  const stageConfigMap = new Map(
    stageConfigs.filter((config) => config.stageType === 'main').map((config) => [config.stageNumber, config]),
  )

  const flattened = quizzes.flatMap((quiz) =>
    quiz.questions.map((question, index) => ({
      ...question,
      id: `${quiz.id}-${question.id}-${index}`,
      sourceTitle: quiz.title,
    })),
  )

  const minimumQuestions = mainStagePositions.length * 4
  const questionPool =
    flattened.length >= minimumQuestions
      ? flattened.slice(0, minimumQuestions)
      : [...flattened, ...buildFallbackQuestions(minimumQuestions - flattened.length)]

  return mainStagePositions.map((position, index) => {
    const stageNumber = index + 1
    const stageConfig = stageConfigMap.get(stageNumber)
    const configuredQuestions = (stageConfig?.questions || []).slice(0, 4).map((question, qIndex) => ({
      ...question,
      id: `${stageNumber}-${question.id || `main-${stageNumber}-${qIndex}`}`,
      sourceTitle: stageConfig?.title || `الباب ${stageNumber}`,
    }))

    return {
      number: stageNumber,
      type: 'main',
      title: stageConfig?.title || `الباب ${stageNumber}`,
      image: stageConfig?.image || STAGE_IMAGES[index % STAGE_IMAGES.length],
      x: position.x,
      y: position.y,
      questions: configuredQuestions.length === 4 ? configuredQuestions : questionPool.slice(index * 4, index * 4 + 4),
      rewardLabel: `${stageNumber * 100} نقطة`,
    }
  })
}

function buildBonusStages(stageConfigs: StageConfig[]): GameStage[] {
  const stageConfigMap = new Map(
    stageConfigs.filter((config) => config.stageType === 'bonus').map((config) => [config.stageNumber, config]),
  )

  return bonusStagePositions.map((position, index) => {
    const stageNumber = index + 1
    const stageConfig = stageConfigMap.get(stageNumber)
    const configuredQuestions = (stageConfig?.questions || []).slice(0, 1).map((question, qIndex) => ({
      ...question,
      id: `${stageNumber}-${question.id || `bonus-${stageNumber}-${qIndex}`}`,
      sourceTitle: stageConfig?.title || `سؤال المسار ${stageNumber}`,
    }))

    return {
      number: stageNumber,
      type: 'bonus',
      title: stageConfig?.title || `سؤال المسار ${stageNumber}`,
      image: stageConfig?.image || STAGE_IMAGES[index % STAGE_IMAGES.length],
      x: position.x,
      y: position.y,
      questions: configuredQuestions.length > 0 ? configuredQuestions : [rewardBank[index % rewardBank.length]],
      rewardLabel: 'سؤال المسار',
    }
  })
}

function playTone(type: 'door' | 'win' | 'bonus' | 'lose') {
  if (typeof window === 'undefined') return

  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  const ctx = new AudioCtx()
  const gain = ctx.createGain()
  gain.connect(ctx.destination)
  gain.gain.value = 0.045
  const notes =
    type === 'door'
      ? [392, 494]
      : type === 'bonus'
        ? [659, 783, 988]
        : type === 'lose'
          ? [392, 330, 262]
          : [523, 659, 783, 1046]
  const now = ctx.currentTime

  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator()
    osc.type = type === 'lose' ? 'sine' : 'triangle'
    osc.frequency.value = freq
    osc.connect(gain)
    const start = now + index * 0.1
    const end = start + 0.14
    osc.start(start)
    osc.stop(end)
  })

  window.setTimeout(() => {
    void ctx.close()
  }, 1000)
}

function nameFromEmail(email?: string | null) {
  if (!email) return 'player'
  return email.split('@')[0] || 'player'
}

function buildDefaultSnapshot(): GameSnapshot {
  return {
    profile: {
      unlockedStage: 1,
      currentStage: 1,
      bestStage: 0,
      totalStars: 0,
      totalRewards: 0,
      soundEnabled: true,
      completedMainStages: [],
      completedBonusStages: [],
    },
    leaderboard: [],
    monthlyChampion: null,
  }
}

function QuizzesPage() {
  const [loading, setLoading] = useState(true)
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [stageConfigs, setStageConfigs] = useState<StageConfig[]>([])
  const [activeStage, setActiveStage] = useState<GameStage | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [doorBurst, setDoorBurst] = useState<number | null>(null)
  const [openedChest, setOpenedChest] = useState<number | null>(null)
  const [resultPopup, setResultPopup] = useState<StageResultPopup | null>(null)
  const [isStageTransitioning, setIsStageTransitioning] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(false)

  const loadData = async () => {
    const [quizzesRes, gameRes, configRes] = await Promise.all([
      api.get<{ quizzes: Quiz[] }>('/quizzes'),
      api.get<GameSnapshot>('/quizzes/game/me'),
      api.get<{ stages: StageConfig[] }>('/quizzes/game/config'),
    ])
    setQuizzes(quizzesRes.quizzes || [])
    setSnapshot({ ...buildDefaultSnapshot(), ...gameRes, profile: { ...buildDefaultSnapshot().profile, ...(gameRes?.profile || {}) } })
    setStageConfigs(configRes.stages || [])
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  const mainStages = useMemo(() => buildMainStages(quizzes, stageConfigs), [quizzes, stageConfigs])
  const bonusStages = useMemo(() => buildBonusStages(stageConfigs), [stageConfigs])

  const profile = snapshot?.profile ?? buildDefaultSnapshot().profile
  const soundEnabled = profile.soundEnabled ?? true
  const currentQuestion = activeStage?.questions[questionIndex]
  const leaderboard = snapshot?.leaderboard ?? []
  const progressStage = profile.bestStage ?? 0

  const [playerPosition, setPlayerPosition] = useState<{ x: number; y: number }>(startPoint)
  const [isPlayerWalking, setIsPlayerWalking] = useState(false)
  const animatedStageRef = useRef(0)

  useEffect(() => {
    const targetStageIndex = Math.max(0, Math.min((profile.currentStage || 1) - 1, stageTrackIndexes.length - 1))
    const fromStageIndex = Math.max(0, Math.min(animatedStageRef.current, stageTrackIndexes.length - 1))
    if (fromStageIndex === targetStageIndex) {
      setPlayerPosition(playerTrackPoints[stageTrackIndexes[targetStageIndex]] ?? startPoint)
      setIsPlayerWalking(false)
      return
    }

    const startIndex = stageTrackIndexes[fromStageIndex]
    const endIndex = stageTrackIndexes[targetStageIndex]
    const step = startIndex < endIndex ? 1 : -1
    const ids: number[] = []
    const stepDelay = 420
    let order = 0

    setIsPlayerWalking(true)

    for (let index = startIndex + step; step > 0 ? index <= endIndex : index >= endIndex; index += step) {
      order += 1
      ids.push(window.setTimeout(() => setPlayerPosition(playerTrackPoints[index] ?? startPoint), order * stepDelay))
    }

    ids.push(window.setTimeout(() => setIsPlayerWalking(false), (order + 1) * stepDelay))
    animatedStageRef.current = targetStageIndex
    return () => {
      ids.forEach((id) => window.clearTimeout(id))
      setIsPlayerWalking(false)
    }
  }, [profile.currentStage])

  const openStage = (stage: GameStage) => {
    if (!snapshot) return
    const unlocked = stage.type === 'main' ? stage.number <= profile.unlockedStage : profile.completedMainStages.includes(stage.number)
    if (!unlocked) return

    if (soundEnabled) playTone('door')
    setDoorBurst(stage.number * (stage.type === 'bonus' ? 100 : 1))
    setIsStageTransitioning(true)
    window.setTimeout(() => setDoorBurst(null), 320)
    setAnswers({})
    setQuestionIndex(0)
    window.setTimeout(() => {
      setActiveStage(stage)
      setIsStageTransitioning(false)
    }, 260)
  }

  const closeStage = () => {
    setActiveStage(null)
    setQuestionIndex(0)
    setAnswers({})
  }

  const retryStage = (stage: GameStage) => {
    setResultPopup(null)
    setAnswers({})
    setQuestionIndex(0)
    setActiveStage(stage)
  }

  const persistSound = async (nextValue: boolean) => {
    const res = await api.put<GameSnapshot>('/quizzes/game/sound', { soundEnabled: nextValue })
    setSnapshot(res)
  }

  const submitStage = async () => {
    if (!activeStage || !snapshot) return
    setSaving(true)

    try {
      const correctCount = activeStage.questions.reduce((sum, question) => sum + (answers[question.id] === question.correctAnswer ? 1 : 0), 0)
      const total = activeStage.questions.length
      const percentage = Math.round((correctCount / total) * 100)
      const passRequired = total
      const passed = correctCount >= passRequired
      const starsEarned =
        activeStage.type === 'main'
          ? passed
            ? percentage >= 100
              ? 3
              : percentage >= 90
                ? 2
                : 1
            : 0
          : passed
            ? 1
            : 0
      const rewardEarned = passed ? (activeStage.type === 'main' ? correctCount * 25 : correctCount * 20) : 0

      const review = activeStage.questions.map((question) => ({
        question: question.question,
        correctAnswer: question.options[question.correctAnswer] ?? '',
        yourAnswer: answers[question.id] !== undefined ? question.options[answers[question.id]] : 'بدون إجابة',
      }))

      const nextSnapshot = await api.post<GameSnapshot>('/quizzes/game/progress', {
        stageNumber: activeStage.number,
        stageType: activeStage.type,
        starsEarned,
        rewardEarned,
        soundEnabled,
        passed,
      })

      setSnapshot(nextSnapshot)
      closeStage()
      if (activeStage.type === 'bonus' && passed) {
        setOpenedChest(activeStage.number)
        window.setTimeout(() => setOpenedChest(null), 900)
      }

      const kind: StageResultPopup['kind'] = activeStage.type === 'bonus' ? (passed ? 'bonus' : 'lose') : passed ? 'win' : 'lose'
      const popupData: StageResultPopup = {
        open: true,
        kind,
        title: kind === 'lose' ? 'لقد خسرت المرحلة' : kind === 'bonus' ? 'مكافأة مفتوحة' : 'تم فتح المرحلة التالية',
        subtitle:
          kind === 'lose'
            ? `أجبت بشكل صحيح على ${correctCount} من ${total}. يجب أن تجيب على جميع الأسئلة بشكل صحيح لفتح الباب التالي.`
            : kind === 'bonus'
              ? `أجبت بشكل صحيح وربحت ${rewardEarned} نقطة إضافية.`
              : activeStage.number === 5 ? `Victory! وصلت إلى نهاية القصر بنسبة ${percentage}% ورجعت للخريطة.` : `Victory! أنهيت ${activeStage.title} بنسبة ${percentage}% وتم فتح الباب التالي.`,
        stars: starsEarned,
        rewards: rewardEarned,
        correctCount,
        total,
        passRequired,
        answersReview: review,
        retryStage: kind === 'lose' ? activeStage : null,
        bonusStage:
          activeStage.type === 'main' && passed
            ? bonusStages.find((stage) => stage.number === activeStage.number && !profile.completedBonusStages.includes(stage.number)) || null
            : null,
      }

      setResultPopup(popupData)

      if (soundEnabled) playTone(kind === 'bonus' ? 'bonus' : kind === 'lose' ? 'lose' : 'win')

    } finally {
      setSaving(false)
    }
  }

  if (loading || !snapshot) {
    return (
      <div className="flex min-h-[70vh] justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="relative min-h-app-content w-full rounded-xl bg-black">
      <style>{`
        .map-screen { background: radial-gradient(circle at top, #1e293b 0%, #020617 70%); padding:0; min-height:calc(100dvh - var(--app-chrome-h)); max-height:calc(100dvh - var(--app-chrome-h)); overflow-x:hidden; overflow-y:auto; align-items:flex-start; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .map-canvas { flex:0 0 auto; width:100%; max-width:100%; height:auto; min-height:min(56dvh, 420px); aspect-ratio:1376 / 768; }
        @supports not (height: 100dvh) { .map-screen { min-height:calc(100vh - var(--app-chrome-h)); max-height:calc(100vh - var(--app-chrome-h)); } }
        @media (max-width: 640px) { .map-canvas { min-height:min(52dvh, 360px); border-radius:0; } .door-label { font-size:10px; padding:3px 8px; bottom:-24px; } }
        .map-depth::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 50% 48%, rgba(255,220,140,.16), transparent 30%), radial-gradient(circle at 16% 68%, rgba(34,197,94,.10), transparent 18%), radial-gradient(circle at 88% 18%, rgba(255,214,102,.10), transparent 18%); mix-blend-mode: screen; pointer-events: none; }
        .door-node { position:absolute; transform: translate(-50%, -50%); transition: transform .22s ease, filter .22s ease, opacity .22s ease; transform-origin: center; }
        .door-node:hover { transform: translate(-50%, -50%) scale(1.03); filter: brightness(1.06); }
        .door-node:active { transform: translate(-50%, -50%) scale(.98); }
        .door-hitbox { position:relative; width:100%; height:100%; border-radius:18px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,.03), 0 10px 28px rgba(0,0,0,.18); overflow:visible; }
        .door-hitbox.unlocked { box-shadow: inset 0 0 0 1px rgba(255,244,181,.18), 0 0 0 2px rgba(255,219,77,.14), 0 14px 34px rgba(0,0,0,.22); }
        .door-hitbox.completed { box-shadow: inset 0 0 0 1px rgba(167,243,208,.26), 0 0 0 2px rgba(74,222,128,.16), 0 14px 34px rgba(0,0,0,.22); }
        .door-hitbox.locked { background:rgba(0,0,0,.16); }
        .door-label { position:absolute; left:50%; bottom:-28px; transform:translateX(-50%); white-space:nowrap; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; color:#fff; background:rgba(15,23,42,.68); backdrop-filter: blur(8px); box-shadow:0 10px 22px rgba(0,0,0,.2); }
        .door-node-main { animation: none; }
        .player-marker { position:absolute; width:48px; height:62px; transform: translate(-50%, -86%); transition: left .42s linear, top .42s linear; z-index:22; filter: drop-shadow(0 10px 14px rgba(0,0,0,.25)); }
        .player-marker img { width:100%; height:100%; object-fit:contain; animation: playerFloat 2.2s ease-in-out infinite; transform-origin: 50% 92%; }
        .player-marker.walking img { animation: playerWalk .48s ease-in-out infinite; }
        .player-marker.walking .player-aura { animation: auraWalk .48s ease-in-out infinite; }
        .player-aura { position:absolute; left:50%; bottom:5px; width:30px; height:10px; transform:translateX(-50%); border-radius:999px; background: radial-gradient(circle, rgba(255,255,255,.32), rgba(255,255,255,.06) 65%, transparent 72%); filter: blur(3px); }
        .stage-point { box-shadow: 0 0 0 1px rgba(255,255,255,.22), 0 0 18px rgba(251,191,36,.55), 0 0 42px rgba(250,204,21,.35); }
        .stage-point:hover { box-shadow: 0 0 0 1px rgba(255,255,255,.35), 0 0 22px rgba(251,191,36,.78), 0 0 56px rgba(250,204,21,.48); }
        .door-node-bonus { }
        .door-ring { animation: ringGlow 1.8s ease-in-out infinite; }
        .burst { animation: clickBurst .75s ease-out forwards; }
        .ranking-card { background: linear-gradient(180deg, rgba(245,232,202,.96), rgba(227,201,145,.94)); color: #3b2209; border: 1px solid rgba(255,247,220,.72); box-shadow: 0 28px 80px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.42); }
        .ranking-row { background: rgba(255,248,230,.62); }
        .ranking-top { background: linear-gradient(180deg, rgba(255,248,228,.99), rgba(241,219,170,.94)); }
        .chest-open { animation: chestOpen 1s ease-out forwards; }
        .popup-shell { animation: popupStrong .35s cubic-bezier(.2,1,.25,1); }
        .popup-win { background: radial-gradient(circle at top, rgba(250,204,21,.22), rgba(15,23,42,.96) 42%, rgba(2,6,23,.98) 100%); border-color: rgba(250,204,21,.35); box-shadow: 0 30px 100px rgba(245,158,11,.22); }
        .popup-bonus { background: radial-gradient(circle at top, rgba(16,185,129,.18), rgba(15,23,42,.96) 42%, rgba(2,6,23,.98) 100%); border-color: rgba(52,211,153,.30); box-shadow: 0 30px 100px rgba(16,185,129,.20); }
        .popup-lose { background: radial-gradient(circle at top, rgba(244,63,94,.22), rgba(15,23,42,.97) 42%, rgba(2,6,23,.99) 100%); border-color: rgba(251,113,133,.35); box-shadow: 0 30px 100px rgba(244,63,94,.22); animation: popupStrong .35s cubic-bezier(.2,1,.25,1), loseShake .55s ease-in-out .15s 1; }
        .popup-rays::before, .popup-rays::after { display:none;
          content: '';
          position: absolute;
          inset: -30%;
          background: conic-gradient(from 0deg, rgba(255,255,255,0), rgba(250,204,21,.6), rgba(255,255,255,0), rgba(16,185,129,.35), rgba(255,255,255,0));
          animation: spinSlow 7s linear infinite;
          opacity: .7;
        }
        .popup-rays::after { animation-direction: reverse; animation-duration: 9s; opacity: .45; }
        .confetti-dot { animation: confettiRise 1.4s ease-out infinite; }
        .ranking-panel { scrollbar-width: thin; }
.stage-view-enter { animation: stageIn .45s cubic-bezier(.2,1,.3,1); }
        .stage-door-scene { animation: none; }
        .question-card { animation: questionCardIn .55s cubic-bezier(.2,1,.3,1); }
        .question-option { transition: transform .2s ease, border-color .2s ease, background-color .2s ease, box-shadow .2s ease; }
        .question-option:hover { transform: translateY(-2px); }
        .transition-flash { animation: transitionFlash .65s ease-out; }
        .retry-pulse { animation: retryPulse 1s ease-in-out infinite; }
        .victory-badge { animation: victoryFloat 1.6s ease-in-out infinite; }
        @keyframes mapPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,215,0,.0), 0 10px 24px rgba(0,0,0,.22); }
          50% { box-shadow: 0 0 0 11px rgba(255,215,0,.18), 0 16px 32px rgba(0,0,0,.28); }
        }
        @keyframes ringGlow {
          0%,100% { opacity: .45; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: .95; transform: translate(-50%, -50%) scale(1.18); }
        }
        @keyframes coinFloat {
          0%,100% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-6px); }
        }
        @keyframes clickBurst {
          0% { opacity: .95; transform: translate(-50%, -50%) scale(.55); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2.2); }
        }
        @keyframes mapPanIn {
          from { opacity: 0; transform: scale(.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes chestOpen {
          0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          50% { transform: translate(-50%, -50%) scale(1.25) rotate(-8deg); filter: drop-shadow(0 0 18px rgba(250,204,21,.95)); }
          100% { transform: translate(-50%, -50%) scale(1.05) rotate(0deg); filter: drop-shadow(0 0 12px rgba(250,204,21,.8)); }
        }
        @keyframes popupStrong {
          0% { opacity: 0; transform: scale(.75) translateY(30px); }
          70% { opacity: 1; transform: scale(1.04) translateY(-8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes confettiRise {
          0% { transform: translateY(0) scale(.8); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-60px) scale(1.2); opacity: 0; }
        }
        @keyframes stageIn {
          from { opacity: 0; transform: scale(1.03); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes stageScenePulse {
          0%,100% { transform: scale(1.01); }
          50% { transform: scale(1.04); }
        }
        @keyframes questionCardIn {
          from { opacity: 0; transform: translateY(36px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes transitionFlash {
          0% { opacity: 0; }
          40% { opacity: .38; }
          100% { opacity: 0; }
        }
        @keyframes loseShake {
          0%, 100% { transform: scale(1) translateX(0); }
          15% { transform: scale(1.01) translateX(-10px); }
          30% { transform: scale(1.01) translateX(10px); }
          45% { transform: scale(1.01) translateX(-8px); }
          60% { transform: scale(1.01) translateX(8px); }
          75% { transform: scale(1.005) translateX(-4px); }
        }
        @keyframes retryPulse {
          0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,255,255,0); }
          50% { transform: scale(1.03); box-shadow: 0 0 0 10px rgba(255,255,255,.08); }
        }
        @keyframes victoryFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes ambientGlow {
          0%,100% { opacity: .55; }
          50% { opacity: .9; }
        }
        @keyframes playerFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes playerWalk {
          0%,100% { transform: translateY(0) rotate(-1.5deg) scaleX(1); }
          25% { transform: translateY(-7px) rotate(2deg) scaleX(1.02); }
          50% { transform: translateY(0) rotate(1.5deg) scaleX(.99); }
          75% { transform: translateY(-5px) rotate(-2deg) scaleX(1.02); }
        }
        @keyframes auraWalk {
          0%,100% { transform:translateX(-50%) scaleX(1); opacity:.72; }
          50% { transform:translateX(-50%) scaleX(.72); opacity:.42; }
        }
      `}</style>

      <div className="map-screen relative flex w-full items-start justify-start bg-slate-950 lg:justify-center">
        <div className="map-canvas map-depth relative overflow-hidden rounded-[18px] bg-black shadow-[0_0_80px_rgba(0,0,0,.55)]">
        <img src={MAIN_MAP} alt="Quiz map" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/22 via-transparent to-black/5" />
        <div className="absolute left-2 right-2 top-2 z-30 flex flex-col items-start gap-2 sm:left-4 sm:right-auto sm:top-4 sm:flex-row sm:items-center">
          <div className="flex w-full flex-wrap items-center gap-1.5 rounded-[18px] border border-white/15 bg-black/28 px-2 py-1.5 text-white shadow-2xl backdrop-blur-xl sm:w-auto sm:gap-2 sm:rounded-[22px] sm:px-3 sm:py-2">
          <Button variant="secondary" size="sm" onClick={() => void persistSound(!soundEnabled)} className="h-8 gap-1.5 bg-white/90 px-2 text-xs text-slate-900 hover:bg-white sm:gap-2 sm:px-3 sm:text-sm">
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'الصوت شغال' : 'الصوت متوقف'}</span>
          </Button>
          <div className="rounded-lg bg-white/15 px-2 py-1 text-xs sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">⭐ {profile.totalStars}</div>
          <div className="rounded-lg bg-white/15 px-2 py-1 text-xs sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">🎁 {profile.totalRewards}</div>
          <div className="hidden rounded-xl bg-white/15 px-3 py-2 text-sm md:block">أفضل باب {Math.max(progressStage || 1, 1)}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRankingOpen(true)}
          className="absolute right-2 top-2 z-30 flex items-center gap-1.5 rounded-xl border border-yellow-200/35 bg-gradient-to-l from-amber-700 via-yellow-700 to-orange-800 px-3 py-2 text-xs font-extrabold text-white shadow-2xl shadow-black/25 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-yellow-500/20 sm:right-4 sm:top-4 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
        >
          <Trophy className="h-5 w-5 text-yellow-200" />
          الترتيب
        </button>

        {rankingOpen ? (
          <div className="fixed inset-0 z-[95] flex items-start justify-center bg-black/55 p-4 pt-20 backdrop-blur-sm" onClick={() => setRankingOpen(false)}>
            <div className="ranking-panel ranking-card w-full max-w-[760px] overflow-hidden rounded-[32px]" onClick={(e) => e.stopPropagation()}>
              <div className="ranking-top px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => setRankingOpen(false)} className="rounded-full bg-amber-950/10 px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-950/18">إغلاق</button>
                  <div className="text-right">
                    <div className="text-xl font-black">ترتيب نقاط المكافآت</div>
                    <div className="text-[12px] text-amber-950/70">اضغط على زر الترتيب فوق الخريطة باش يطلع rank ديالك</div>
                  </div>
                  <Trophy className="h-7 w-7 text-amber-700" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {leaderboard.slice(0, 3).map((entry) => (
                    <div key={`top-${entry.id}`} className="rounded-3xl border border-white/45 bg-white/55 px-3 py-4 text-center shadow-sm">
                      <div className="flex items-center justify-center gap-1 text-[12px] font-black text-amber-900">
                        {entry.rank === 1 ? <Crown className="h-5 w-5 text-yellow-500" /> : <span>#{entry.rank}</span>}
                        <span>{entry.rank === 1 ? 'Top 1' : entry.rank === 2 ? 'Top 2' : 'Top 3'}</span>
                      </div>
                      <div className="mt-2 truncate text-sm font-bold">{nameFromEmail(entry.email)}</div>
                      <div className="mt-1 text-xs text-amber-950/75">🎁 {entry.totalRewards} · ⭐ {entry.totalStars} · باب {entry.bestStage}</div>
                    </div>
                  ))}
                </div>
                {snapshot.monthlyChampion ? (
                  <div className="mt-4 rounded-2xl border border-white/40 bg-white/42 px-4 py-3 text-right text-sm text-amber-950/80">
                    <div className="flex items-center justify-end gap-2 font-bold text-amber-800"><span>فائز الشهر</span><Sparkles className="h-4 w-4" /></div>
                    <div className="mt-1 font-semibold">{nameFromEmail(snapshot.monthlyChampion.email)} · {snapshot.monthlyChampion.monthlyPrizeDh} DH</div>
                  </div>
                ) : null}
              </div>
              <div className="max-h-[46vh] overflow-y-auto px-4 pb-4 pt-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {leaderboard.length === 0 ? (
                    <div className="col-span-full rounded-2xl bg-white/45 p-6 text-center text-sm font-semibold text-amber-950/70">مازال ما كاين حتى ترتيب.</div>
                  ) : leaderboard.map((entry) => (
                    <div key={entry.id} className="ranking-row rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3 text-amber-950">
                        <div className="text-left text-xs font-semibold opacity-85">
                          <div>⭐ {entry.totalStars}</div>
                          <div>🎁 {entry.totalRewards}</div>
                        </div>
                        <div className="min-w-0 text-right">
                          <div className="flex items-center justify-end gap-2 font-bold">
                            <span className="truncate">{nameFromEmail(entry.email)}</span>
                            {entry.rank === 1 ? <Crown className="h-4 w-4 text-yellow-500" /> : <span className="text-[11px] opacity-65">#{entry.rank}</span>}
                          </div>
                          <div className="mt-1 text-[11px] opacity-70">وصل إلى الباب {Math.min(entry.stopStage, 5)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={`player-marker pointer-events-none ${isPlayerWalking ? 'walking' : ''}`}
          style={{ left: `${playerPosition.x}%`, top: `${playerPosition.y}%` }}
        >
          <img src="/quiz-map/player.png" alt="player" />
          <span className="player-aura" />
        </div>

        {mainStages.map((stage) => {
          const unlocked = stage.number <= profile.unlockedStage
          const completed = profile.completedMainStages.includes(stage.number)
          const stageReached = stage.number <= progressStage
          const position = mainStagePositions[stage.number - 1]
          return (
            <div
              key={`main-${stage.number}`}
              className="absolute z-20"
              style={{ left: `${stage.x}%`, top: `${stage.y}%`, width: `${position.width}%`, height: `${position.height}%` }}
            >
              {doorBurst === stage.number ? <span className="burst absolute inset-0 rounded-[20px] border-2 border-yellow-200/90" /> : null}
              <button
                type="button"
                onClick={() => openStage(stage)}
                className={`door-node door-node-main ${unlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-90'}`}
                style={{ width: '100%', height: '100%' }}
                title={stage.title}
              >
                <span className={`door-hitbox ${completed ? 'completed' : unlocked ? 'unlocked' : 'locked'}`}>
                  {!unlocked ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="rounded-full bg-black/50 p-2 text-white shadow-xl"><Lock className="h-5 w-5" /></span>
                    </span>
                  ) : completed ? (
                    <span className="absolute right-1 top-1 rounded-full bg-emerald-400/90 p-1 text-white shadow-lg">
                      <Star className="h-3.5 w-3.5 fill-current" />
                    </span>
                  ) : (
                    <span className="absolute right-1 top-1 rounded-full bg-yellow-300/90 p-1 text-amber-950 shadow-lg">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                  )}
                </span>
                <span className={`door-label ${stageReached ? '' : 'opacity-80'}`}>{stage.title}</span>
              </button>
            </div>
          )
        })}

        {bonusStages.map((stage) => {
          const unlocked = profile.completedMainStages.includes(stage.number)
          const completed = profile.completedBonusStages.includes(stage.number)
          const burstKey = stage.number * 100
          const isOpenAnimating = openedChest === stage.number
          return (
            <div key={`bonus-${stage.number}`} className="absolute z-30" style={{ left: `${stage.x}%`, top: `${stage.y}%` }}>
              {doorBurst === burstKey ? <span className="burst absolute h-20 w-20 rounded-full border-2 border-yellow-200/90" /> : null}
              <button
                type="button"
                onClick={() => openStage(stage)}
                className={`door-node door-node-bonus absolute flex h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[14px] border-2 ${completed ? 'border-emerald-300 bg-emerald-500' : unlocked ? 'border-yellow-300 bg-yellow-400' : 'border-white/30 bg-slate-800/85'} text-white shadow-lg ${isOpenAnimating ? 'chest-open' : ''}`}
                title={stage.rewardLabel}
              >
                {unlocked ? <Gift className="h-4 w-4 text-amber-950" /> : <Lock className="h-4 w-4" />}
              </button>
              <span className={`absolute top-[54px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold text-white ${completed ? 'bg-emerald-700/80' : unlocked ? 'bg-amber-900/70' : 'bg-black/55'}`}>مسار {stage.number}</span>
            </div>
          )
        })}

        {isStageTransitioning ? <div className="transition-flash pointer-events-none absolute inset-0 z-40 bg-white/20" /> : null}
        </div>
      </div>

      {activeStage && currentQuestion ? (
        <div className="fixed inset-0 z-50 h-[100dvh] overflow-y-auto overflow-x-hidden bg-black stage-view-enter" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <img src={activeStage.image} alt={activeStage.title} className="stage-door-scene fixed inset-0 h-full w-full object-cover" />
          <div className="fixed inset-0 bg-gradient-to-t from-black/82 via-black/35 to-black/30" />
          <div className="fixed inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />

          <div className="sticky left-3 top-3 z-20 mb-3 ml-3 flex w-fit items-center gap-2 rounded-2xl bg-black/45 px-3 py-2 text-white backdrop-blur-md">
            <button
              type="button"
              onClick={closeStage}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white/20"
            >
              <ArrowRight className="h-4 w-4" />
              رجوع للخريطة
            </button>
            <div>
              <div className="text-[11px] text-white/70">{activeStage.type === 'main' ? 'مرحلة رئيسية' : 'سؤال مكافأة'}</div>
              <div className="text-sm font-bold">{activeStage.title}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-xs">{questionIndex + 1} / {activeStage.questions.length}</div>
          </div>

          <div className="relative z-10 min-h-[100dvh] px-3 pb-28 pt-3">
            <div className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-2xl items-end justify-center">
              <div className="question-card flex max-h-[calc(100dvh-9rem)] w-full flex-col overflow-hidden rounded-[22px] border border-white/15 bg-black/55 p-3 text-white shadow-[0_20px_55px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-4">
                <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="text-right text-lg font-bold leading-7 sm:text-xl sm:leading-8">{currentQuestion.question}</div>

                  <div className="mt-3 space-y-2 pr-1">
                  {currentQuestion.options.map((option, optionIndex) => {
                    const selected = answers[currentQuestion.id] === optionIndex
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }))}
                        className={`question-option w-full rounded-2xl border p-3 text-right text-sm sm:text-base ${selected ? 'border-yellow-300 bg-yellow-300/15 shadow-lg' : 'border-white/20 bg-white/8 hover:border-yellow-300/55 hover:bg-white/12'}`}
                      >
                        {option}
                      </button>
                    )
                  })}
                  </div>
                </div>

                <div className="sticky bottom-0 z-30 mt-3 flex shrink-0 flex-col gap-2 rounded-b-[18px] border-t border-white/10 bg-black/80 pt-3 pb-2 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (questionIndex > 0) setQuestionIndex((prev) => prev - 1)
                    }}
                    disabled={questionIndex <= 0}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-40"
                  >
                    <ArrowRight className="h-4 w-4" />
                    رجوع
                  </button>
                  {questionIndex < activeStage.questions.length - 1 ? (
                    <Button onClick={() => setQuestionIndex((prev) => prev + 1)} disabled={answers[currentQuestion.id] === undefined} className="gap-2 rounded-2xl bg-white text-slate-950 hover:bg-white/90">
                      التالي
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={() => void submitStage()} disabled={answers[currentQuestion.id] === undefined || saving} className="w-full gap-2 rounded-2xl bg-white text-slate-950 hover:bg-white/90 sm:w-auto">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                      <span className="sm:hidden">إنهاء المرحلة</span>
                      <span className="hidden sm:inline">إنهاء المرحلة والرجوع للخريطة</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {resultPopup?.open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className={`popup-shell popup-rays relative flex max-h-[90dvh] w-full max-w-[380px] flex-col overflow-hidden rounded-[26px] border p-4 text-center text-white ${resultPopup.kind === 'lose' ? 'popup-lose' : resultPopup.kind === 'bonus' ? 'popup-bonus' : 'popup-win'}`}>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 14 }).map((_, index) => (
                <span
                  key={index}
                  className="confetti-dot absolute h-3 w-3 rounded-full"
                  style={{
                    left: `${8 + index * 6}%`,
                    bottom: `${10 + (index % 4) * 6}%`,
                    background: index % 3 === 0 ? '#facc15' : index % 3 === 1 ? '#34d399' : '#ffffff',
                    animationDelay: `${index * 0.08}s`,
                  }}
                />
              ))}
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 flex-col">
              <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md ${resultPopup.kind === 'lose' ? '' : 'victory-badge'}`}>
                {resultPopup.kind === 'lose' ? (
                  <Lock className="h-8 w-8 text-rose-300" />
                ) : resultPopup.kind === 'bonus' ? (
                  <Gift className="h-8 w-8 text-emerald-300" />
                ) : (
                  <Trophy className="h-8 w-8 text-yellow-300" />
                )}
              </div>

              <div className={`text-2xl font-extrabold ${resultPopup.kind === 'lose' ? 'text-rose-200' : resultPopup.kind === 'bonus' ? 'text-emerald-200' : 'text-yellow-200'}`}>{resultPopup.title}</div>
              <div className="mt-3 text-base text-white/80">{resultPopup.subtitle}</div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <div className="text-xs text-white/65">النجوم</div>
                  <div className="mt-1 text-xl font-bold">{resultPopup.stars}</div>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <div className="text-xs text-white/65">المكافآت</div>
                  <div className="mt-1 text-xl font-bold">{resultPopup.rewards}</div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/85">
                النتيجة: {resultPopup.correctCount} / {resultPopup.total} · المطلوب للنجاح: {resultPopup.passRequired} / {resultPopup.total}
              </div>

              {resultPopup.answersReview?.length ? (
                <div className="mt-3 max-h-28 space-y-2 overflow-y-auto rounded-2xl bg-black/25 p-2 text-right">
                  {resultPopup.answersReview.map((item, index) => (
                    <div key={index} className="rounded-2xl bg-white/10 px-3 py-3">
                      <div className="text-sm font-semibold">{item.question}</div>
                      <div className="mt-2 text-xs text-rose-200">إجابتك: {item.yourAnswer}</div>
                      <div className="mt-1 text-xs text-emerald-200">الإجابة الصحيحة: {item.correctAnswer}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {resultPopup.retryStage ? (
                <div className="sticky bottom-0 z-20 mt-4 grid shrink-0 grid-cols-2 gap-2 rounded-b-[22px] bg-slate-950/85 pt-3 backdrop-blur">
                  <Button className="retry-pulse rounded-2xl bg-white text-slate-950 hover:bg-white/90" onClick={() => retryStage(resultPopup.retryStage!)}>
                    إعادة نفس المرحلة
                  </Button>
                  <Button variant="secondary" className="rounded-2xl bg-white/10 text-white hover:bg-white/20" onClick={() => { setResultPopup(null); closeStage() }}>
                    العودة إلى الخريطة
                  </Button>
                </div>
              ) : resultPopup.bonusStage ? (
                <div className="sticky bottom-0 z-20 mt-4 grid shrink-0 grid-cols-2 gap-2 rounded-b-[22px] bg-slate-950/85 pt-3 backdrop-blur">
                  <Button className="rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={() => { const nextBonus = resultPopup.bonusStage; setResultPopup(null); if (nextBonus) openStage(nextBonus) }}>
                    سؤال المكافأة
                  </Button>
                  <Button variant="secondary" className="rounded-2xl bg-white/10 text-white hover:bg-white/20" onClick={() => setResultPopup(null)}>
                    العودة إلى الخريطة
                  </Button>
                </div>
              ) : (
                <Button className="sticky bottom-0 z-20 mt-4 w-full shrink-0 rounded-2xl bg-white text-slate-950 hover:bg-white/90" onClick={() => setResultPopup(null)}>
                  العودة إلى الخريطة
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
