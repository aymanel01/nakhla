import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../_layout'
import { colors } from '@/lib/colors'

export default function ProfileScreen() {
  const { user, logout, isAdmin } = useAuth()

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تسجيل الخروج',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          {user?.profilePhotoUrl ? (
            <Image source={{ uri: user.profilePhotoUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={48} color={colors.light.primary} />
          )}
        </View>
        <Text style={styles.email}>{user?.fullName || user?.email}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={[styles.badge, isAdmin && styles.adminBadge]}>
          <Text style={[styles.badgeText, isAdmin && styles.adminBadgeText]}>
            {isAdmin ? 'مسؤول' : 'مستخدم'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الحساب</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="chevron-back" size={20} color={colors.light.mutedForeground} />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemText}>الإعدادات</Text>
            <Ionicons name="settings-outline" size={24} color={colors.light.foreground} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="chevron-back" size={20} color={colors.light.mutedForeground} />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemText}>المساعدة</Text>
            <Ionicons name="help-circle-outline" size={24} color={colors.light.foreground} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="chevron-back" size={20} color={colors.light.mutedForeground} />
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemText}>حول التطبيق</Text>
            <Ionicons name="information-circle-outline" size={24} color={colors.light.foreground} />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
        <Ionicons name="log-out-outline" size={24} color={colors.light.destructive} />
      </TouchableOpacity>

      <Text style={styles.version}>الإصدار 1.0.0</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${colors.light.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.light.foreground,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: colors.light.mutedForeground,
    marginBottom: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  badge: {
    backgroundColor: colors.light.secondary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  adminBadge: {
    backgroundColor: `${colors.light.primary}20`,
  },
  badgeText: {
    fontSize: 14,
    color: colors.light.mutedForeground,
    fontWeight: '500',
  },
  adminBadgeText: {
    color: colors.light.primary,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.mutedForeground,
    textAlign: 'right',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.light.foreground,
  },
  logoutButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.light.destructive}10`,
    padding: 16,
    borderRadius: 12,
    marginTop: 32,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.destructive,
  },
  version: {
    fontSize: 12,
    color: colors.light.mutedForeground,
    textAlign: 'center',
    marginTop: 24,
  },
})
