import { Stack } from 'expo-router'
import { colors } from '@/lib/colors'

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.light.background },
        headerTintColor: colors.light.foreground,
        headerTitleAlign: 'center',
        contentStyle: { backgroundColor: colors.light.background },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'تسجيل الدخول' }} />
      <Stack.Screen name="register" options={{ title: 'إنشاء حساب' }} />
    </Stack>
  )
}
