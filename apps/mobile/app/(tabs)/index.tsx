import { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import type { Lecture } from '@teaching-app/shared'
import { api } from '@/lib/api'
import { colors } from '@/lib/colors'

const { width } = Dimensions.get('window')

export default function LecturesScreen() {
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null)

  useEffect(() => {
    api
      .get<{ lectures: Lecture[] }>('/lectures')
      .then(({ lectures }) => setLectures(lectures))
      .finally(() => setLoading(false))
  }, [])

  const extractYouTubeId = (url: string): string => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    const match = url.match(regex)
    return match?.[1] || ''
  }

  const getYouTubeThumbnail = (url: string): string => {
    const videoId = extractYouTubeId(url)
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    )
  }

  if (lectures.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="play-circle-outline" size={64} color={colors.light.mutedForeground} />
        <Text style={styles.emptyTitle}>لا توجد محاضرات حالياً</Text>
        <Text style={styles.emptyText}>سيتم إضافة المحاضرات قريباً</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={lectures}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelectedLecture(item)}>
            <Image source={{ uri: getYouTubeThumbnail(item.youtubeUrl) }} style={styles.thumbnail} />
            <View style={styles.playOverlay}>
              <Ionicons name="play-circle" size={48} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selectedLecture} animationType="slide" onRequestClose={() => setSelectedLecture(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedLecture(null)}>
              <Ionicons name="close" size={28} color={colors.light.foreground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedLecture?.title}
            </Text>
            <View style={{ width: 28 }} />
          </View>
          {selectedLecture && (
            <WebView
              source={{
                uri: `https://www.youtube.com/embed/${extractYouTubeId(selectedLecture.youtubeUrl)}?autoplay=1`,
              }}
              style={styles.webview}
              allowsFullscreenVideo
            />
          )}
          <View style={styles.modalContent}>
            <Text style={styles.modalDescription}>{selectedLecture?.description}</Text>
          </View>
        </View>
      </Modal>
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
    gap: 16,
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  thumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: colors.light.muted,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.foreground,
    textAlign: 'right',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.light.mutedForeground,
    textAlign: 'right',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.light.foreground,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  webview: {
    width: width,
    height: (width * 9) / 16,
  },
  modalContent: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 16,
    color: colors.light.foreground,
    textAlign: 'right',
    lineHeight: 24,
  },
})
