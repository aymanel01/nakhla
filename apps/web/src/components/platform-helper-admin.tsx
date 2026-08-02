import { useEffect, useState } from 'react'
import type { AdminSectionPost, PlatformHelperConfig, PlatformHelperSectionConfig } from '@teaching-app/shared'
import { PLATFORM_HELPER_CONFIG_CATEGORY } from '@teaching-app/shared'
import { api } from '@/lib/api'
import {
  HELPER_CORNER_OPTIONS,
  HELPER_PAGE_OPTIONS,
  buildDefaultPlatformHelperConfig,
  mergePlatformHelperConfig,
  parsePlatformHelperConfig,
  serializePlatformHelperConfig,
} from '@/lib/platform-helper-config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'

export function PlatformHelperAdmin() {
  const [config, setConfig] = useState<PlatformHelperConfig>(() => buildDefaultPlatformHelperConfig())
  const [selectedPage, setSelectedPage] = useState(HELPER_PAGE_OPTIONS[0].path)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const pageInfo = HELPER_PAGE_OPTIONS.find((item) => item.path === selectedPage) || HELPER_PAGE_OPTIONS[0]
  const section = config.sections[selectedPage] || { greeting: '', tips: [''] }

  const loadConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<{ posts: AdminSectionPost[] }>(
        `/admin/content/social-economic?category=${encodeURIComponent(PLATFORM_HELPER_CONFIG_CATEGORY)}`,
      )
      const post = response.posts.find((item) => item.category === PLATFORM_HELPER_CONFIG_CATEGORY && item.content)
      const parsed = parsePlatformHelperConfig(post?.content)
      setConfig(parsed ?? buildDefaultPlatformHelperConfig())
    } catch (err) {
      console.error('Failed to load helper config:', err)
      setError('تعذر تحميل إعدادات المرشد.')
      setConfig(buildDefaultPlatformHelperConfig())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const updateSection = (patch: Partial<PlatformHelperSectionConfig>) => {
    setConfig((prev: PlatformHelperConfig) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [selectedPage]: { ...section, ...patch },
      },
    }))
  }

  const updateTip = (index: number, value: string) => {
    const tips = [...section.tips]
    tips[index] = value
    updateSection({ tips })
  }

  const addTip = () => updateSection({ tips: [...section.tips, ''] })

  const removeTip = (index: number) => {
    const tips = section.tips.filter((_tip: string, i: number) => i !== index)
    updateSection({ tips: tips.length ? tips : [''] })
  }

  const saveConfig = async () => {
    setSaving(true)
    setError(null)
    try {
      const cleaned: PlatformHelperConfig = {
        ...config,
        sections: Object.fromEntries(
          Object.entries(config.sections).map(([path, value]: [string, PlatformHelperSectionConfig]) => [
            path,
            {
              greeting: value.greeting.trim(),
              tips: value.tips.map((tip: string) => tip.trim()).filter(Boolean),
            },
          ]),
        ),
      }

      await api.put('/admin/content/social-economic/upsert', {
        category: PLATFORM_HELPER_CONFIG_CATEGORY,
        content: serializePlatformHelperConfig(cleaned),
      })
      setConfig(mergePlatformHelperConfig(cleaned))
      setSavedAt(new Date().toLocaleTimeString('ar-EG'))
    } catch (err) {
      console.error('Failed to save helper config:', err)
      setError('تعذر حفظ إعدادات المرشد.')
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = () => {
    if (!confirm('هل تريد استعادة النصوص والموضع الافتراضي؟')) return
    setConfig(buildDefaultPlatformHelperConfig())
  }

  return (
    <Card className="rounded-[28px] border-emerald-100 bg-white/95 shadow-sm">
      <CardHeader className="border-b bg-emerald-50/70 pb-3 text-right">
        <CardTitle className="text-emerald-950">مرشد نخلة — النصوص والموضع</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-4" dir="rtl">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-emerald-800">
            <Loader2 className="h-5 w-5 animate-spin" />
            جاري التحميل...
          </div>
        ) : (
          <>
            <div className="grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-bold text-emerald-900">تفعيل المرشد</Label>
                <label className="flex items-center gap-2 text-sm font-bold text-emerald-950">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(event) => setConfig((prev: PlatformHelperConfig) => ({ ...prev, enabled: event.target.checked }))}
                    className="h-4 w-4 rounded border-emerald-300"
                  />
                  إظهار مرشد نخلة للتلاميذ
                </label>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-emerald-900">زاوية الشاشة</Label>
                <select
                  className="h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm font-bold text-emerald-950 shadow-sm outline-none focus:border-emerald-400"
                  value={config.position.corner}
                  onChange={(event) =>
                    setConfig((prev: PlatformHelperConfig) => ({
                      ...prev,
                      position: { ...prev.position, corner: event.target.value as PlatformHelperConfig['position']['corner'] },
                    }))
                  }
                >
                  {HELPER_CORNER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-emerald-900">المسافة الأفقية (px)</Label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={config.position.offsetX}
                  onChange={(event) =>
                    setConfig((prev: PlatformHelperConfig) => ({
                      ...prev,
                      position: { ...prev.position, offsetX: Number(event.target.value) || 0 },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-emerald-900">المسافة العمودية (px)</Label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={config.position.offsetY}
                  onChange={(event) =>
                    setConfig((prev: PlatformHelperConfig) => ({
                      ...prev,
                      position: { ...prev.position, offsetY: Number(event.target.value) || 0 },
                    }))
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="font-bold text-emerald-900">ارتفاع فقاعة الكلام (px)</Label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={config.position.bubbleLift}
                  onChange={(event) =>
                    setConfig((prev: PlatformHelperConfig) => ({
                      ...prev,
                      position: { ...prev.position, bubbleLift: Number(event.target.value) || 0 },
                    }))
                  }
                />
                <p className="text-xs text-slate-500">كلما زاد الرقم ارتفعت الفقاعة فوق الشخصية (مناسب لإظهار الإصبع).</p>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                <Label className="font-bold text-slate-800">الصفحة / القسم</Label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm outline-none focus:border-emerald-400"
                  value={selectedPage}
                  onChange={(event) => setSelectedPage(event.target.value)}
                >
                  {HELPER_PAGE_OPTIONS.map((option) => (
                    <option key={option.path} value={option.path}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-slate-800">التحية — {pageInfo.label}</Label>
                <Input
                  value={section.greeting}
                  onChange={(event) => updateSection({ greeting: event.target.value })}
                  placeholder="مثال: مرحبًا بك في الرئيسية!"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="font-bold text-slate-800">نصائح المساعدة</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTip} className="gap-1">
                  <Plus className="h-4 w-4" />
                  إضافة نصيحة
                </Button>
              </div>

              {section.tips.map((tip: string, index: number) => (
                <div key={`${selectedPage}-${index}`} className="flex items-start gap-2">
                  <Textarea
                    value={tip}
                    onChange={(event) => updateTip(index, event.target.value)}
                    rows={2}
                    placeholder={`النصيحة ${index + 1}`}
                    className="min-h-[72px] flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTip(index)}
                    disabled={section.tips.length <= 1}
                    aria-label="حذف النصيحة"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-100 pt-4">
              <div className="text-xs font-bold text-slate-500">
                {savedAt ? `آخر حفظ: ${savedAt}` : 'لم يُحفظ بعد في هذه الجلسة'}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={resetDefaults} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  استعادة الافتراضي
                </Button>
                <Button type="button" onClick={saveConfig} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ الإعدادات
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
