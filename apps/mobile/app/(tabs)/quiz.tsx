import { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Quiz } from '@teaching-app/shared'
import { api } from '@/lib/api'
import { colors } from '@/lib/colors'

export default function QuizScreen() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; total: number } | null>(null)

  useEffect(() => {
    api
      .get<{ quizzes: Quiz[] }>('/quizzes')
      .then(({ quizzes }) => setQuizzes(quizzes))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!selectedQuiz) return
    setSubmitting(true)
    try {
      const { attempt } = await api.post<{ attempt: { score: number; totalQuestions: number } }>(
        `/quizzes/${selectedQuiz.id}/submit`,
        { answers }
      )
      setResult({ score: attempt.score, total: attempt.totalQuestions })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    )
  }

  if (quizzes.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="help-circle-outline" size={64} color={colors.light.mutedForeground} />
        <Text style={styles.emptyTitle}>لا توجد أبواب حالياً</Text>
        <Text style={styles.emptyText}>سيتم إضافة أبواب القصر قريباً</Text>
      </View>
    )
  }

  if (selectedQuiz) {
    if (result) {
      const percentage = Math.round((result.score / result.total) * 100)
      const isPass = percentage >= 70

      return (
        <View style={styles.centered}>
          <View style={[styles.resultCircle, { backgroundColor: isPass ? '#dcfce7' : '#fef3c7' }]}>
            <Text style={[styles.resultPercentage, { color: isPass ? '#16a34a' : '#d97706' }]}>
              {percentage}%
            </Text>
          </View>
          <Text style={styles.emptyTitle}>اكتمل الباب!</Text>
          <Text style={styles.resultText}>
            حصلت على {result.score} من {result.total}
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setSelectedQuiz(null)
              setAnswers({})
              setResult(null)
            }}
          >
            <Text style={styles.buttonText}>العودة للأبواب</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.formContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setSelectedQuiz(null)
            setAnswers({})
          }}
        >
          <Text style={styles.backButtonText}>العودة للقائمة</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.light.primary} />
        </TouchableOpacity>

        <View style={styles.quizCard}>
          <Text style={styles.quizTitle}>{selectedQuiz.title}</Text>
          <Text style={styles.quizDescription}>{selectedQuiz.description}</Text>
        </View>

        {selectedQuiz.questions.map((question, qIndex) => (
          <View key={question.id} style={styles.questionContainer}>
            <Text style={styles.questionText}>
              {qIndex + 1}. {question.question}
            </Text>
            <View style={styles.optionsContainer}>
              {question.options.map((option, oIndex) => (
                <TouchableOpacity
                  key={oIndex}
                  style={[styles.optionButton, answers[question.id] === oIndex && styles.optionSelected]}
                  onPress={() => setAnswers((prev) => ({ ...prev, [question.id]: oIndex }))}
                >
                  <View
                    style={[styles.radioCircle, answers[question.id] === oIndex && styles.radioCircleSelected]}
                  >
                    {answers[question.id] === oIndex && <View style={styles.radioInner} />}
                  </View>
                  <Text
                    style={[styles.optionText, answers[question.id] === oIndex && styles.optionTextSelected]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[
            styles.submitButton,
            Object.keys(answers).length !== selectedQuiz.questions.length && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting || Object.keys(answers).length !== selectedQuiz.questions.length}
        >
          {submitting ? (
            <ActivityIndicator color={colors.light.primaryForeground} />
          ) : (
            <Text style={styles.submitButtonText}>إرسال الإجابات</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={quizzes}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelectedQuiz(item)}>
            <View style={[styles.iconContainer, { backgroundColor: '#8b5cf620' }]}>
              <Ionicons name="help-circle" size={32} color="#8b5cf6" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={[styles.fieldCount, { color: '#8b5cf6' }]}>{item.questions.length} أسئلة</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.background,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.light.foreground,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.light.mutedForeground,
    marginTop: 8,
  },
  list: {
    padding: 16,
  },
  card: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.light.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.foreground,
    textAlign: 'right',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.light.mutedForeground,
    textAlign: 'right',
    marginBottom: 8,
  },
  fieldCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  formContainer: {
    padding: 16,
  },
  backButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    color: colors.light.primary,
    fontSize: 16,
    marginLeft: 8,
  },
  quizCard: {
    backgroundColor: colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quizTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.light.foreground,
    textAlign: 'right',
    marginBottom: 8,
  },
  quizDescription: {
    fontSize: 14,
    color: colors.light.mutedForeground,
    textAlign: 'right',
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.light.foreground,
    textAlign: 'right',
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.light.primary,
    backgroundColor: `${colors.light.primary}10`,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.light.mutedForeground,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.light.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.light.primary,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.light.foreground,
    textAlign: 'right',
  },
  optionTextSelected: {
    color: colors.light.primary,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: colors.light.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.light.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
  resultCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultPercentage: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  resultText: {
    fontSize: 16,
    color: colors.light.mutedForeground,
    marginTop: 8,
  },
  button: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  buttonText: {
    color: colors.light.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
})
