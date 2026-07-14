import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { platformSectionThemes } from "@/lib/platform-section-themes";
import { playCardClickSound, playCardHoverSound } from "@/lib/ui-sound";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  return (
    <div
      className="-m-2 min-h-app-content w-[calc(100%+1rem)] bg-[#f8edd8] bg-cover bg-center p-3 text-center md:-m-3 md:w-[calc(100%+1.5rem)] md:p-5"
      dir="rtl"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,248,236,0.38), rgba(255,248,236,0.46)), url('/design/welcome-bg.jpg')",
      }}
    >
      <img
        src="/branding/platform-sections-logo-transparent.png"
        alt="أقسام منصة نخلة"
        className="mx-auto mb-4 h-auto w-[min(260px,82%)] object-contain drop-shadow-[0_6px_14px_rgba(67,46,20,0.12)] sm:w-[min(310px,80%)]"
      />
      <div className="platform-sections-grid grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {platformSectionThemes.map((section) => (
          <Link
            key={section.path}
            to={section.path}
            aria-label={section.title}
            onClick={() => playCardClickSound()}
            onMouseEnter={() => playCardHoverSound()}
            style={{ "--card-accent": section.accent } as CSSProperties}
            className={`platform-hover-card block aspect-[4/3] min-w-0 overflow-hidden rounded-[20px] border bg-white text-center shadow-lg md:rounded-[24px] ${section.border} ${section.shadow}`}
          >
            <img
              src={section.image}
              alt={section.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
