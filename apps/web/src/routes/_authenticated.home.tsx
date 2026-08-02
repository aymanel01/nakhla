import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ZoomIn, X } from "lucide-react";
import { useState, type CSSProperties } from "react";
import {
  platformSectionThemes,
  type PlatformSectionTheme,
} from "@/lib/platform-section-themes";
import { playCardClickSound, playCardHoverSound } from "@/lib/ui-sound";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  const [preview, setPreview] = useState<PlatformSectionTheme | null>(null);

  const openPreview = (section: PlatformSectionTheme) => {
    setPreview(section);
    playCardHoverSound();
  };

  return (
    <div
      className="relative -m-2 min-h-app-content w-[calc(100%+1rem)] bg-[#f8edd8] bg-cover bg-center p-3 text-center md:-m-3 md:w-[calc(100%+1.5rem)] md:p-5"
      dir="rtl"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,248,236,0.38), rgba(255,248,236,0.46)), url('/design/welcome-bg.jpg')",
      }}
    >
      {preview ? (
        <div
          className="home-card-preview fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px] md:p-8"
          onClick={() => setPreview(null)}
          role="presentation"
        >
          <div
            className="home-card-preview-panel relative w-[min(680px,96vw)] overflow-hidden rounded-[28px] border-[5px] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.42)]"
            style={{ borderColor: preview.accent }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={preview.title}
          >
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute start-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white shadow-lg transition hover:bg-black/80"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={preview.image}
              alt={preview.title}
              className="block max-h-[min(68vh,580px)] w-full object-contain"
            />
            <div
              className="px-5 py-4 text-center font-['Cairo'] text-2xl font-extrabold text-white md:text-3xl"
              style={{
                background: `linear-gradient(135deg, ${preview.from}, ${preview.via})`,
              }}
            >
              {preview.title}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 bg-white px-5 py-4">
              <Link
                to={preview.path}
                onClick={() => {
                  playCardClickSound();
                  setPreview(null);
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-6 py-2.5 font-['Cairo'] text-base font-extrabold text-white shadow-lg transition hover:brightness-110"
                style={{
                  background: `linear-gradient(135deg, ${preview.from}, ${preview.via})`,
                }}
              >
                دخول القسم
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-2.5 font-['Cairo'] text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <img
        src="/branding/platform-sections-logo-transparent.png"
        alt="أقسام منصة نخلة"
        className="mx-auto mb-4 h-auto w-[min(260px,82%)] object-contain drop-shadow-[0_6px_14px_rgba(67,46,20,0.12)] sm:w-[min(310px,80%)]"
      />
      <p className="mx-auto mb-4 max-w-xl font-['Cairo'] text-sm font-semibold text-[#5c4a32] md:text-base">
        اضغط على البطاقة للدخول، أو زر «تكبير» لعرضها بحجم أكبر.
      </p>
      <div className="platform-sections-grid grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {platformSectionThemes.map((section) => {
          const isActive = preview?.path === section.path;
          return (
            <div
              key={section.path}
              className={`platform-hover-card relative aspect-[4/3] min-w-0 overflow-hidden rounded-[20px] border bg-white shadow-lg md:rounded-[24px] ${section.border} ${section.shadow} ${isActive ? "home-card-active" : ""}`}
              style={{ "--card-accent": section.accent } as CSSProperties}
            >
              <Link
                to={section.path}
                aria-label={section.title}
                onClick={() => playCardClickSound()}
                onMouseEnter={() => playCardHoverSound()}
                className="block h-full w-full"
              >
                <img
                  src={section.image}
                  alt={section.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </Link>
              <button
                type="button"
                aria-label={`تكبير ${section.title}`}
                title="تكبير"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openPreview(section);
                }}
                className="absolute end-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-black/55 px-2.5 py-1.5 font-['Cairo'] text-[11px] font-extrabold text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-black/70 sm:px-3 sm:text-xs"
              >
                <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                تكبير
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
