import { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Exercise } from '@teaching-app/shared'
import { api } from '@/lib/api'
import { colors } from '@/lib/colors'

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    api
      .get<{ exercises: Exercise[] }>('/exercises')
      .then(({ exercises }) => setExercises(exercises))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!selectedExercise) return
    setSubmitting(true)
    try {
      await api.post(`/exercises/${selectedExercise.id}/submit`, { answers })
      setSubmitted(true)
    } catch (error) {
      Alert.alert('خطأ', 'فشل إرسال التقويم')
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

  if (exercises.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="document-text-outline" size={64} color={colors.light.mutedForeground} />
        <Text style={styles.emptyTitle}>لا توجد تقويمات حالياً</Text>
        <Text style={styles.emptyText}>سيتم إضافة تقويم الوحدة قريباً</Text>
      </View>
    )
  }

  if (selectedExercise) {
    if (submitted) {
      return (
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          <Text style={styles.emptyTitle}>تم إرسال التقويم بنجاح!</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setSelectedExercise(null)
              setAnswers({})
              setSubmitted(false)
            }}
          >
            <Text style={styles.buttonText}>العودة للتقويمات</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.formContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setSelectedExercise(null)
            setAnswers({})
          }}
        >
          <Text style={styles.backButtonText}>العودة للقائمة</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.light.primary} />
        </TouchableOpacity>

        <View style={styles.exerciseCard}>
          <Text style={styles.exerciseTitle}>{selectedExercise.title}</Text>
          <Text style={styles.exerciseDescription}>{selectedExercise.description}</Text>
        </View>

        {selectedExercise.fields.map((field) => (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={[styles.input, field.type === 'textarea' && styles.textarea]}
              placeholder={field.placeholder}
              placeholderTextColor={colors.light.mutedForeground}
              value={answers[field.id] || ''}
              onChangeText={(text) => setAnswers((prev) => ({ ...prev, [field.id]: text }))}
              multiline={field.type === 'textarea'}
              numberOfLines={field.type === 'textarea' ? 4 : 1}
              keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              textAlign="right"
            />
          </View>
        ))}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.light.primaryForeground} />
          ) : (
            <Text style={styles.submitButtonText}>إرسال التقويم</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelectedExercise(item)}>
            <View style={styles.iconContainer}>
              <Ionicons name="document-text" size={32} color={colors.light.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={styles.fieldCount}>{item.fields.length} حقول</Text>
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
    backgroundColor: `${colors.light.primary}20`,
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
    color: colors.light.primary,
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
  exerciseCard: {
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
  exerciseTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.light.foreground,
    textAlign: 'right',
    marginBottom: 8,
  },
  exerciseDescription: {
    fontSize: 14,
    color: colors.light.mutedForeground,
    textAlign: 'right',
    lineHeight: 22,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.light.foreground,
    textAlign: 'right',
    marginBottom: 8,
  },
  required: {
    color: colors.light.destructive,
  },
  input: {
    backgroundColor: colors.light.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.light.foreground,
    textAlign: 'right',
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: colors.light.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: colors.light.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
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
