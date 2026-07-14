import {
  createFileRoute,
  Outlet,
  Link,
  useLocation,
  Navigate,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAuth } from "./__root";
import type { AdminSectionPost } from "@teaching-app/shared";
import { api } from "@/lib/api";
import {
  Home,
  PlayCircle,
  FileText,
  HelpCircle,
  MessageCircle,
  Loader2,
  Users,
  Radio,
  Sparkles,
  Palette,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSectionThemeByPath } from "@/lib/platform-section-themes";
import { playCardClickSound, playCardHoverSound } from "@/lib/ui-sound";

const defaultPageTheme = {
  accent: "#0f766e",
  from: "#0f766e",
  via: "#059669",
  to: "#047857",
  softBg: "linear-gradient(180deg, rgba(15,118,110,0.06) 0%, rgba(255,255,255,0.97) 28%)",
};

function resolvePageTheme(pathname: string) {
  const section = getSectionThemeByPath(pathname);
  if (!section) return defaultPageTheme;
  return {
    accent: section.accent,
    from: section.from,
    via: section.via,
    to: section.gradientTo,
    softBg: section.softBg,
  };
}

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const location = useLocation();
  const sectionNavRef = useRef<HTMLDivElement>(null);
  const tutorialCategory = useMemo(() => {
    const path = location.pathname;
    if (path === "/home") return "tutorial:home";
    if (path === "/important-content") return "tutorial:important-content";
    if (path === "/groups") return "tutorial:groups";
    if (path === "/resources") return "tutorial:resources";
    if (path === "/lectures") return "tutorial:lectures";
    if (path === "/exercises") return "tutorial:exercises";
    if (path === "/chat") return "tutorial:chat";
    if (path === "/quizzes") return "tutorial:quizzes";
    return null;
  }, [location.pathname]);
  const [tutorialPost, setTutorialPost] = useState<AdminSectionPost | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    if (!tutorialCategory) {
      setTutorialPost(null);
      return;
    }
    let alive = true;
    api
      .get<{ posts: AdminSectionPost[] }>(
        `/admin/content/social-economic?category=${encodeURIComponent(tutorialCategory)}`,
      )
      .then(({ posts }) => {
        if (alive) setTutorialPost(posts.find((post) => post.fileUrl || post.content) || null);
      })
      .catch(() => {
        if (alive) setTutorialPost(null);
      });
    return () => {
      alive = false;
    };
  }, [tutorialCategory]);

  useEffect(() => {
    const nav = sectionNavRef.current;
    if (!nav) {
      document.documentElement.style.setProperty("--app-section-nav-h", "0px");
      return;
    }
    const syncSectionNavHeight = () => {
      document.documentElement.style.setProperty(
        "--app-section-nav-h",
        `${nav.offsetHeight}px`,
      );
    };
    syncSectionNavHeight();
    const observer = new ResizeObserver(syncSectionNavHeight);
    observer.observe(nav);
    window.addEventListener("resize", syncSectionNavHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncSectionNavHeight);
    };
  }, [location.pathname]);

  const tutorialVideoUrl = tutorialPost?.fileUrl || tutorialPost?.content || "";

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  const navItems = [
    { to: "/home", label: "الرئيسية", icon: Home, previewImage: "/design/welcome-bg.jpg" },
    { to: "/important-content", label: "المجالات", icon: Sparkles, previewImage: "/section-images/social-economic-banner.jpg" },
    { to: "/exercises", label: "تقويم الوحدة", icon: FileText, previewImage: "/section-images/evaluation-banner.jpg" },
    { to: "/groups", label: "المجموعات", icon: Users, previewImage: "/section-images/groups-banner.jpg" },
    { to: "/resources", label: "إبداعات التلاميذ", icon: Palette, previewImage: "/section-images/creativity-banner.jpg" },
    { to: "/lectures", label: "المكتبة الرقمية", icon: PlayCircle, previewImage: "/section-images/library-banner.jpg" },
    { to: "/chat", label: "المحادثة", icon: MessageCircle, previewImage: "/section-images/chat-banner.jpg" },
    {
      to: "/quizzes",
      label: "أبواب القصر",
      icon: HelpCircle,
      customIconSrc: "/section-images/quiz-game-logo.jpg",
      previewImage: "/section-images/quiz-banner.jpg",
    },
    ...(isAdmin
      ? [{ to: "/admin", label: "التحكم عن بعد", icon: Radio, previewImage: "/section-images/groups-banner.jpg" }]
      : []),
  ] as const;

  const navItemsWithTheme = navItems.map((item) => {
    const theme = resolvePageTheme(item.to);
    const section = getSectionThemeByPath(item.to);
    return {
      ...item,
      accent: theme.accent,
      previewImage: section?.bannerImage ?? item.previewImage,
    };
  });

  if (location.pathname === "/welcome") {
    return <Outlet />;
  }

  const pageTheme = resolvePageTheme(location.pathname);
  const isQuizPage = location.pathname === "/quizzes";
  const isSectionPage = Boolean(getSectionThemeByPath(location.pathname));

  return (
    <div className="space-y-0 pb-2" dir="rtl">
      <div ref={sectionNavRef} className="platform-third-sticky">
        <nav className="platform-main-nav rounded-none border-0 bg-white/95 p-1 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="platform-nav-wrap flex min-w-0 items-center gap-1">
            <div className="platform-nav-scroll flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1">
              {navItemsWithTheme.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={`${item.to}-${item.label}`}
                    to={item.to}
                    onClick={() => playCardClickSound()}
                    onMouseEnter={() => playCardHoverSound()}
                    style={
                      isActive
                        ? ({
                            borderColor: `${item.accent}55`,
                            backgroundColor: `${item.accent}14`,
                            color: item.accent,
                          } as CSSProperties)
                        : undefined
                    }
                    className={cn(
                      "group relative flex min-w-[88px] snap-start items-center justify-center gap-1 overflow-hidden rounded-lg border border-transparent px-2 py-1.5 text-[10px] font-bold text-slate-700 transition-all duration-300 sm:min-w-[96px] sm:px-1.5 sm:text-xs md:min-w-0 md:text-[11px]",
                      !isActive &&
                        "bg-transparent hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-md",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute inset-y-0 right-0 w-0.5 transition-opacity duration-300",
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-70",
                      )}
                      style={{ backgroundColor: item.accent }}
                    />
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md transition-all duration-300",
                        isActive ? "bg-white shadow-sm" : "bg-slate-100 text-slate-700 group-hover:bg-white",
                      )}
                      style={isActive ? { color: item.accent } : undefined}
                    >
                      {"customIconSrc" in item && item.customIconSrc ? (
                        <img
                          src={item.customIconSrc}
                          alt={item.label}
                          className="h-full w-full object-contain p-0.5 transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <Icon className="h-3 w-3 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5" />
                      )}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                playCardClickSound();
                window.history.back();
              }}
              onMouseEnter={() => playCardHoverSound()}
              className="platform-back-button flex shrink-0 items-center gap-1 rounded-lg border bg-white/95 px-2 py-1.5 text-[10px] font-bold shadow-sm backdrop-blur transition hover:-translate-y-0.5 sm:px-2 sm:text-[11px]"
            style={{
              borderColor: `${pageTheme.accent}44`,
              color: pageTheme.accent,
            }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              رجوع
            </button>
          </div>
        </nav>
      </div>

      {tutorialPost && !location.pathname.startsWith("/admin") ? (
        <>
          <button
            type="button"
            onClick={() => setTutorialOpen(true)}
            className="fixed left-3 z-[85] inline-flex items-center gap-2 rounded-full border bg-white/95 px-3 py-2 text-xs font-extrabold shadow-lg backdrop-blur transition hover:-translate-y-0.5 max-md:top-[calc(var(--app-chrome-h)+0.5rem)] top-[118px]"
            style={{
              borderColor: `${pageTheme.accent}44`,
              color: pageTheme.accent,
            }}
          >
            <PlayCircle className="h-4 w-4" />
            فيديو توضيحي
          </button>
          {tutorialOpen ? (
            <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4" onClick={() => setTutorialOpen(false)}>
              <div className="w-[min(760px,94vw)] rounded-[28px] bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <button type="button" onClick={() => setTutorialOpen(false)} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">إغلاق</button>
                  <div className="text-right text-lg font-extrabold text-slate-950">فيديو توضيحي</div>
                </div>
                {tutorialVideoUrl ? (
                  <video src={tutorialVideoUrl} controls className="aspect-video w-full rounded-[20px] bg-black object-contain" />
                ) : (
                  <div className="rounded-2xl bg-emerald-50 p-5 text-center text-sm font-bold text-emerald-900">لم يتم إضافة فيديو لهذه الصفحة بعد.</div>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <main className="min-w-0 flex-1">
        <div
          style={
            {
              "--card-accent": pageTheme.accent,
              "--section-from": pageTheme.from,
              "--section-via": pageTheme.via,
              "--section-to": pageTheme.to,
              background: pageTheme.softBg,
            } as CSSProperties
          }
          className={cn(
            isSectionPage && "section-themed-shell",
            isQuizPage ? "p-0" : "p-2 md:p-3",
          )}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
