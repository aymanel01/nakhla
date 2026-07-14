import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

export const Route = createFileRoute('/_authenticated/welcome')({
  component: WelcomePage,
})

function WelcomePage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const startDashboard = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('nakhla-welcome-seen', '1')
    }
    navigate({ to: '/home' })
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    video.muted = false
    video.volume = 1
    const playPromise = video.play()
    if (playPromise) playPromise.catch(() => undefined)
  }, [])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8edd8] bg-cover bg-center p-3 md:p-5" style={{ backgroundImage: "linear-gradient(rgba(255,248,236,0.38), rgba(255,248,236,0.55)), url('/design/welcome-bg.jpg')" }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.46),transparent_52%)]" />
      <div className="absolute -right-24 top-12 h-96 w-96 rounded-full bg-amber-200/20 blur-3xl" />
      <div className="absolute -left-20 bottom-0 h-96 w-96 rounded-full bg-teal-200/15 blur-3xl" />

      <section className="relative z-10 flex w-full max-w-3xl items-center justify-center rounded-[30px] border border-white/25 bg-white/10 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-4">
        <div className="absolute inset-x-12 bottom-4 h-10 rounded-full bg-black/30 blur-2xl" />
        <video
          ref={videoRef}
          src="/important-content/welcome-auto.mp4"
          className="relative z-10 aspect-video w-full max-h-[70vh] rounded-[24px] bg-black object-contain shadow-[0_18px_48px_rgba(0,0,0,0.32)]"
          autoPlay
          playsInline
          preload="auto"
          onEnded={startDashboard}
        />
      </section>
    </div>
  )
}
