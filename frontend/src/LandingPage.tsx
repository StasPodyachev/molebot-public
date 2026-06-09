/**
 * LandingPage.tsx — лендинг Molebot.Mantle.
 *
 * Точный порт лендинга molebot.org (Репо 1) с адаптацией текстов под Mantle.
 * Архитектура Репо 2 — одностраничная (SPA без react-router), поэтому навигация
 * по разделам идёт через якоря (#how, #security, ...), а CTA «Создать крота»
 * вызывает Privy-логин/минт через колбэк onActivate.
 *
 * Анимации (1:1 с оригиналом):
 *   - IntersectionObserver для появления секций при скролле
 *   - Parallax-эффект на hero
 *   - Hover-эффекты на карточках
 *   - Счётчик кротов с анимацией набора цифр
 *   - Theme toggle (dark/light)
 *
 * Эндпоинты: статистика подтягивается с /api/stats (мягко деградирует).
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useT } from "./i18n";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

interface PlatformStats {
  total_moles: number;
  active_moles: number;
  total_volume_usd: number;
  updated_at: string;
}

interface LandingPageProps {
  /** Создать крота — Privy-логин (если не авторизован) или минт. */
  onActivate: () => void;
  /** Подарить крота — пока ведёт на тот же flow активации. */
  onGift?: () => void;
  /** Авторизован ли пользователь — меняет подпись CTA в шапке. */
  authenticated?: boolean;
  /** Готовность Privy — отключает кнопки до инициализации. */
  ready?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Theme                                                                       */
/* -------------------------------------------------------------------------- */

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("molebot-theme") as Theme | null;
  if (stored) return stored;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/* -------------------------------------------------------------------------- */
/* IntersectionObserver hook                                                  */
/* -------------------------------------------------------------------------- */

function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/* -------------------------------------------------------------------------- */
/* Counter animation                                                          */
/* -------------------------------------------------------------------------- */

function useCountUp(target: number, enabled: boolean): number {
  const [count, setCount] = useState(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || target <= 0) return;

    let current = 0;
    const step = () => {
      current += Math.ceil((target - current) / 8);
      if (current >= target) {
        setCount(target);
        return;
      }
      setCount(current);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [target, enabled]);

  return count;
}

/* -------------------------------------------------------------------------- */
/* SVG Logo                                                                   */
/* -------------------------------------------------------------------------- */

function MolebotLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#9945ff" />
      <ellipse cx="16" cy="17" rx="9" ry="8" fill="#1a1816" />
      <circle cx="12" cy="15" r="2.5" fill="white" />
      <circle cx="20" cy="15" r="2.5" fill="white" />
      <circle cx="12.8" cy="14.8" r="1" fill="#1a1816" />
      <circle cx="20.8" cy="14.8" r="1" fill="#1a1816" />
      <ellipse cx="16" cy="19.5" rx="2.5" ry="1.5" fill="#3d1f00" />
      <ellipse cx="16" cy="19" rx="1.5" ry="1" fill="#b06dff" opacity="0.6" />
      <ellipse cx="8" cy="21" rx="2.5" ry="1.5" fill="#1a1816" />
      <ellipse cx="24" cy="21" rx="2.5" ry="1.5" fill="#1a1816" />
      <path d="M5 26 Q16 22 27 26 L27 32 L5 32Z" fill="#2a1f10" opacity="0.7" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Theme icon                                                                 */
/* -------------------------------------------------------------------------- */

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* FadeInSection wrapper                                                      */
/* -------------------------------------------------------------------------- */

function FadeInSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useRevealOnScroll<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LandingPage                                                                */
/* -------------------------------------------------------------------------- */

export default function LandingPage({ onActivate, onGift, authenticated = false, ready = true }: LandingPageProps) {
  const { t, lang, setLang } = useT();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  const levelData = [
    { emoji: "🌱", name: t("levels.sleeper"), xp: "0 XP", type: "" },
    { emoji: "⛏️", name: t("levels.digger"), xp: "150 XP", type: "active" },
    { emoji: "🔭", name: t("levels.scout"), xp: "200 XP", type: "" },
    { emoji: "📈", name: t("levels.trader"), xp: "300 XP", type: "" },
    { emoji: "🧠", name: t("levels.strategist"), xp: "500 XP", type: "" },
    { emoji: "👑", name: t("levels.hivemaster"), xp: "1000 XP", type: "" },
    { emoji: "⚡", name: t("levels.alpha"), xp: "2000 XP", type: "gold" },
    { emoji: "🐉", name: t("levels.mythic"), xp: "10 000 XP", type: "gold" },
  ];

  const handleGift = onGift ?? onActivate;

  // Parallax on hero
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fetch stats
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/stats`, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as PlatformStats;
        if (!cancelled) setStats(json);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("molebot-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const totalMoles = stats?.total_moles ?? 27;
  const animatedCount = useCountUp(totalMoles, true);

  // Parallax offset
  const parallaxY = scrollY * 0.3;

  return (
    <div className="landing">
      {/* ═══════════════════════════════════════════════════ STYLES ═══ */}
      <style>{`
        .landing {
          --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
          --text-sm: clamp(0.875rem, 0.8rem + 0.35vw, 1rem);
          --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
          --text-lg: clamp(1.125rem, 1rem + 0.75vw, 1.5rem);
          --text-xl: clamp(1.5rem, 1.2rem + 1.25vw, 2.25rem);
          --text-2xl: clamp(2rem, 1.2rem + 2.5vw, 3.5rem);
          --text-3xl: clamp(2.5rem, 1rem + 4vw, 5rem);
          --text-hero: clamp(3rem, 0.5rem + 7vw, 7.5rem);

          --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem;
          --space-4: 1rem; --space-5: 1.25rem; --space-6: 1.5rem;
          --space-8: 2rem; --space-10: 2.5rem; --space-12: 3rem;
          --space-16: 4rem; --space-20: 5rem; --space-24: 6rem; --space-32: 8rem;

          --radius-sm: 0.375rem; --radius-md: 0.5rem; --radius-lg: 0.75rem;
          --radius-xl: 1rem; --radius-2xl: 1.5rem; --radius-full: 9999px;

          --transition-interactive: 180ms cubic-bezier(0.16, 1, 0.3, 1);
          --font-display: 'Cabinet Grotesk', 'Inter', sans-serif;
          --font-body: 'Satoshi', 'Inter', sans-serif;
          --content-narrow: 640px; --content-default: 960px; --content-wide: 1200px;
        }
        [data-theme="dark"], .landing {
          --color-bg: #0d0c0b; --color-surface: #131210; --color-surface-2: #1a1916;
          --color-surface-offset: #201e1b; --color-surface-dynamic: #2a2825;
          --color-divider: #2e2c28; --color-border: #363330;
          --color-text: #e8e5e0; --color-text-muted: #8a8680; --color-text-faint: #4a4844;
          --color-text-inverse: #0d0c0b;
          --color-primary: #9945ff; --color-primary-hover: #b06dff;
          --color-primary-active: #7a2fe0; --color-primary-highlight: #2a1a40;
          --color-success: #14f195; --color-success-dim: rgba(20, 241, 149, 0.12);
          --color-error: #ff6b6b; --color-error-dim: rgba(255, 107, 107, 0.12);
          --color-gold: #ffd166; --color-gold-dim: rgba(255, 209, 102, 0.12);
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
          --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
          --shadow-lg: 0 12px 40px rgba(0,0,0,0.6);
          --shadow-glow: 0 0 40px rgba(153, 69, 255, 0.15);
        }
        [data-theme="light"] .landing {
          --color-bg: #f5f4f0; --color-surface: #fafaf8; --color-surface-2: #ffffff;
          --color-surface-offset: #eeecea; --color-surface-dynamic: #e5e3df;
          --color-divider: #dbd9d5; --color-border: #d0cdc9;
          --color-text: #1a1816; --color-text-muted: #6b6866; --color-text-faint: #aeaba6;
          --color-text-inverse: #f5f4f0;
          --color-primary: #7b2ff7; --color-primary-hover: #6318e0;
          --color-primary-active: #4d0fba; --color-primary-highlight: #ede0ff;
          --color-success: #0aab66; --color-success-dim: rgba(10, 171, 102, 0.1);
          --color-error: #e03030; --color-error-dim: rgba(224, 48, 48, 0.1);
          --color-gold: #c9920a; --color-gold-dim: rgba(201, 146, 10, 0.1);
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.07);
          --shadow-md: 0 4px 16px rgba(0,0,0,0.09);
          --shadow-lg: 0 12px 40px rgba(0,0,0,0.12);
          --shadow-glow: 0 0 40px rgba(123, 47, 247, 0.12);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .landing { font-family: var(--font-body); font-size: var(--text-base); color: var(--color-text); background: var(--color-bg); line-height: 1.6; overflow-x: hidden; min-height: 100dvh; }
        .landing h1, .landing h2, .landing h3, .landing h4 { text-wrap: balance; line-height: 1.15; font-family: var(--font-display); }
        .landing p { text-wrap: pretty; }
        .landing a, .landing button { transition: color var(--transition-interactive), background var(--transition-interactive), border-color var(--transition-interactive), box-shadow var(--transition-interactive), transform var(--transition-interactive); }
        .landing ::selection { background: rgba(153, 69, 255, 0.25); color: var(--color-text); }
        .landing :focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; border-radius: var(--radius-sm); }
        @media (prefers-reduced-motion: reduce) {
          .landing *, .landing *::before, .landing *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }

        .container { max-width: var(--content-default); margin-inline: auto; padding-inline: clamp(var(--space-4), 5vw, var(--space-10)); }
        .container--wide { max-width: var(--content-wide); }
        .container--narrow { max-width: var(--content-narrow); }
        .section { padding-block: clamp(var(--space-16), 8vw, var(--space-32)); }

        .btn { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-5); border-radius: var(--radius-full); font-family: var(--font-display); font-weight: 700; font-size: var(--text-sm); text-decoration: none; white-space: nowrap; cursor: pointer; border: none; }
        .btn--primary { background: var(--color-primary); color: #fff; box-shadow: 0 0 20px rgba(153, 69, 255, 0.3); }
        .btn--primary:hover { background: var(--color-primary-hover); box-shadow: 0 0 30px rgba(153, 69, 255, 0.5); transform: translateY(-1px); }
        .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .btn--ghost { background: var(--color-surface-offset); color: var(--color-text); border: 1px solid var(--color-border); }
        .btn--ghost:hover { background: var(--color-surface-dynamic); border-color: var(--color-text-faint); }
        .btn--lg { padding: var(--space-4) var(--space-8); font-size: var(--text-base); }

        .section-label { font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-primary); margin-bottom: var(--space-4); }
        .section-title { font-size: var(--text-2xl); font-weight: 900; letter-spacing: -0.03em; color: var(--color-text); margin-bottom: var(--space-6); }
        .section-sub { font-size: var(--text-lg); color: var(--color-text-muted); max-width: 52ch; line-height: 1.5; }

        /* ── Header ── */
        .landing-header { position: sticky; top: 0; z-index: 100; background: color-mix(in oklab, var(--color-bg) 85%, transparent); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid color-mix(in oklab, var(--color-border) 60%, transparent); }
        .landing-header__inner { display: flex; align-items: center; justify-content: space-between; height: 60px; max-width: var(--content-wide); margin-inline: auto; padding-inline: clamp(var(--space-4), 5vw, var(--space-10)); }
        .landing-header__logo { display: flex; align-items: center; gap: var(--space-2); text-decoration: none; color: var(--color-text); font-family: var(--font-display); font-weight: 800; font-size: var(--text-lg); letter-spacing: -0.01em; background: none; border: none; cursor: pointer; }
        .landing-header__nav { display: flex; align-items: center; gap: var(--space-6); }
        .landing-header__nav a { text-decoration: none; color: var(--color-text-muted); font-size: var(--text-sm); font-weight: 500; }
        .landing-header__nav a:hover { color: var(--color-text); }
        .landing-header__actions { display: flex; align-items: center; gap: var(--space-3); }
        .theme-toggle-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--radius-full); color: var(--color-text-muted); background: transparent; cursor: pointer; border: none; }
        .theme-toggle-btn:hover { color: var(--color-text); background: var(--color-surface-offset); }
        .lang-toggle-btn { display: flex; align-items: center; justify-content: center; height: 36px; padding: 0 var(--space-3); border-radius: var(--radius-full); color: var(--color-text-muted); background: transparent; cursor: pointer; border: 1px solid var(--color-border); font-family: var(--font-display); font-weight: 600; font-size: var(--text-xs); }
        .lang-toggle-btn:hover { color: var(--color-text); background: var(--color-surface-offset); border-color: var(--color-text-faint); }

        /* ── Hero ── */
        .hero { position: relative; min-height: 92svh; display: grid; place-items: center; overflow: hidden; padding-block: clamp(var(--space-16), 10vw, var(--space-32)); }
        .hero__bg { position: absolute; inset: 0; z-index: 0; background: radial-gradient(ellipse 80% 60% at 60% 40%, rgba(153, 69, 255, 0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(20, 241, 149, 0.05) 0%, transparent 60%); }
        .hero__inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: clamp(var(--space-10), 5vw, var(--space-16)); align-items: center; max-width: var(--content-wide); margin-inline: auto; padding-inline: clamp(var(--space-4), 5vw, var(--space-10)); }
        .hero__text { max-width: 52ch; }
        .hero__badge { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full); background: var(--color-primary-highlight); border: 1px solid color-mix(in oklab, var(--color-primary) 40%, transparent); color: var(--color-primary); font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: var(--space-6); }
        .hero__badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary); animation: hero-pulse 2s ease-in-out infinite; }
        @keyframes hero-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
        .hero__headline { font-size: var(--text-hero); font-weight: 900; letter-spacing: -0.03em; color: var(--color-text); margin-bottom: var(--space-6); line-height: 1.05; }
        .hero__headline em { font-style: normal; background: linear-gradient(135deg, var(--color-primary), var(--color-success)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero__sub { font-size: var(--text-lg); color: var(--color-text-muted); line-height: 1.5; max-width: 44ch; margin-bottom: var(--space-10); }
        .hero__actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
        .hero__social-proof { margin-top: var(--space-8); display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); font-size: var(--text-xs); }
        .hero__image-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .hero__image-card { position: relative; border-radius: var(--radius-2xl); overflow: hidden; border: 1px solid var(--color-border); box-shadow: var(--shadow-lg), var(--shadow-glow); width: 100%; max-width: 520px; }
        .hero__image-card img { width: 100%; height: auto; display: block; }
        .hero__mood-pill { position: absolute; top: var(--space-4); right: var(--space-4); display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: color-mix(in oklab, var(--color-surface) 90%, transparent); backdrop-filter: blur(12px); border-radius: var(--radius-full); border: 1px solid var(--color-border); font-size: var(--text-xs); font-weight: 600; }
        .hero__stat-pill { position: absolute; bottom: var(--space-4); left: var(--space-4); display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: color-mix(in oklab, var(--color-surface) 90%, transparent); backdrop-filter: blur(12px); border-radius: var(--radius-full); border: 1px solid var(--color-border); font-size: var(--text-xs); font-weight: 600; }
        .hero__stat-up { color: var(--color-success); }

        /* ── Steps ── */
        .steps__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-6); margin-top: var(--space-12); }
        .step-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-2xl); padding: var(--space-8); position: relative; overflow: hidden; }
        .step-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--color-primary), var(--color-success)); opacity: 0; transition: opacity 0.3s ease; }
        .step-card:hover::before { opacity: 1; }
        .step-card:hover { box-shadow: var(--shadow-md); transform: translateY(-4px); }
        .step-num { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--radius-full); background: var(--color-primary-highlight); color: var(--color-primary); font-family: var(--font-display); font-weight: 800; font-size: var(--text-base); margin-bottom: var(--space-6); border: 1px solid color-mix(in oklab, var(--color-primary) 30%, transparent); }
        .step-card h3 { font-size: var(--text-lg); font-weight: 700; margin-bottom: var(--space-3); color: var(--color-text); }
        .step-card p { font-size: var(--text-base); color: var(--color-text-muted); line-height: 1.6; }

        /* ── Mood section ── */
        .mood-section { padding-block: clamp(var(--space-16), 8vw, var(--space-24)); background: var(--color-surface); border-block: 1px solid var(--color-divider); }
        .mood-section__inner { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(var(--space-10), 5vw, var(--space-16)); align-items: center; }
        .nft-card { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-2xl); overflow: hidden; box-shadow: var(--shadow-lg); }
        .nft-card__img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; }
        .nft-card__body { padding: var(--space-5); }
        .nft-card__name { font-family: var(--font-display); font-weight: 800; font-size: var(--text-lg); margin-bottom: var(--space-1); }
        .nft-card__serial { font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-4); }
        .nft-card__stats { display: flex; gap: var(--space-4); }
        .nft-stat { flex: 1; }
        .nft-stat__label { font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-1); }
        .nft-stat__value { font-family: var(--font-display); font-weight: 800; font-size: var(--text-lg); }
        .nft-stat__value--up { color: var(--color-success); }
        .nft-stat__value--down { color: var(--color-error); }
        .nft-mood-badge { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 600; margin-bottom: var(--space-4); }
        .nft-mood-badge--happy { background: var(--color-success-dim); color: var(--color-success); }
        .nft-mood-badge--sad { background: var(--color-error-dim); color: var(--color-error); }

        /* ── Security ── */
        .features-bento { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-top: var(--space-12); }
        .feature-tile { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-6); }
        .feature-tile:nth-child(1) { grid-column: span 2; }
        .feature-icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-lg); background: var(--color-surface-offset); margin-bottom: var(--space-4); color: var(--color-text-muted); }
        .feature-tile h3 { font-size: var(--text-base); font-weight: 700; margin-bottom: var(--space-2); color: var(--color-text); }
        .feature-tile p { font-size: var(--text-sm); color: var(--color-text-muted); line-height: 1.55; }
        .feature-tag { display: inline-block; margin-top: var(--space-3); font-size: var(--text-xs); font-weight: 600; color: var(--color-text-faint); letter-spacing: 0.04em; }

        /* ── Levels ── */
        .levels-track { display: flex; align-items: flex-start; gap: var(--space-3); margin-top: var(--space-12); overflow-x: auto; padding-bottom: var(--space-4); -webkit-overflow-scrolling: touch; scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }
        .level-item { flex-shrink: 0; width: 120px; display: flex; flex-direction: column; align-items: center; gap: var(--space-2); text-align: center; }
        .level-orb { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; border: 2px solid var(--color-border); background: var(--color-surface); position: relative; }
        .level-orb--active { background: var(--color-primary-highlight); border-color: var(--color-primary); box-shadow: 0 0 20px rgba(153,69,255,0.3); }
        .level-orb--gold { background: var(--color-gold-dim); border-color: var(--color-gold); box-shadow: 0 0 20px rgba(255,209,102,0.25); }
        .level-name { font-size: var(--text-xs); font-weight: 700; color: var(--color-text); }
        .level-xp { font-size: var(--text-xs); color: var(--color-text-faint); }
        .level-connector { flex-shrink: 0; align-self: center; width: var(--space-4); height: 2px; background: var(--color-divider); }

        /* ── Gift ── */
        .gift-section { padding-block: clamp(var(--space-16), 8vw, var(--space-24)); background: var(--color-surface); border-block: 1px solid var(--color-divider); }
        .gift-inner { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(var(--space-10), 5vw, var(--space-16)); align-items: center; }
        .gift-image { border-radius: var(--radius-2xl); overflow: hidden; }
        .gift-image img { width: 100%; }
        .gift-text p { color: var(--color-text-muted); font-size: var(--text-lg); line-height: 1.6; margin-bottom: var(--space-8); }

        /* ── Mint CTA ── */
        .mint-cta { padding-block: clamp(var(--space-16), 8vw, var(--space-32)); text-align: center; }
        .mint-cta__card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-2xl); padding: clamp(var(--space-10), 6vw, var(--space-20)); position: relative; overflow: hidden; max-width: 720px; margin-inline: auto; }
        .mint-cta__glow { position: absolute; inset: 0; background: radial-gradient(ellipse 60% 50% at 50% 100%, rgba(153,69,255,0.1), transparent); pointer-events: none; }
        .mint-cta__title { font-size: var(--text-2xl); font-weight: 900; letter-spacing: -0.03em; margin-bottom: var(--space-4); position: relative; }
        .mint-cta__sub { font-size: var(--text-lg); color: var(--color-text-muted); margin-bottom: var(--space-10); max-width: 42ch; margin-inline: auto; position: relative; }
        .mint-cta__actions { display: flex; justify-content: center; flex-wrap: wrap; gap: var(--space-3); position: relative; }
        .price-tiers { display: flex; justify-content: center; gap: var(--space-4); flex-wrap: wrap; margin-top: var(--space-8); position: relative; }
        .price-tier { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); padding: var(--space-3) var(--space-5); background: var(--color-surface-offset); border: 1px solid var(--color-border); border-radius: var(--radius-lg); transition: all var(--transition-interactive); }
        .price-tier:hover { border-color: var(--color-primary); background: var(--color-primary-highlight); transform: translateY(-2px); }
        .price-tier__range { font-size: var(--text-xs); color: var(--color-text-muted); }
        .price-tier__price { font-family: var(--font-display); font-weight: 800; font-size: var(--text-base); color: var(--color-text); }
        .price-tier--active { border-color: var(--color-primary); background: var(--color-primary-highlight); }
        .price-tier--active .price-tier__price { color: var(--color-primary); }

        /* ── Footer ── */
        .landing-footer { border-top: 1px solid var(--color-divider); padding-block: var(--space-12); }
        .landing-footer__inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); }
        .landing-footer__brand { display: flex; align-items: center; gap: var(--space-2); font-weight: 700; font-family: var(--font-display); }
        .landing-footer__links { display: flex; gap: var(--space-6); }
        .landing-footer__links a { text-decoration: none; color: var(--color-text-muted); font-size: var(--text-sm); }
        .landing-footer__links a:hover { color: var(--color-text); }
        .landing-footer__copy { color: var(--color-text-faint); font-size: var(--text-xs); }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .hero__inner { grid-template-columns: 1fr; }
          .hero__image-wrap { display: none; }
          .mood-section__inner, .gift-inner { grid-template-columns: 1fr; }
          .steps__grid { grid-template-columns: 1fr; }
          .features-bento { grid-template-columns: 1fr 1fr; }
          .feature-tile:nth-child(1) { grid-column: span 2; }
          .landing-header__nav { display: none; }
        }
        @media (max-width: 540px) {
          .features-bento { grid-template-columns: 1fr; }
          .feature-tile:nth-child(1) { grid-column: span 1; }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════ HEADER ═══ */}
      <header className="landing-header">
        <div className="landing-header__inner">
          <button type="button" className="landing-header__logo" aria-label="Molebot" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <MolebotLogo size={32} />
            Molebot
          </button>

          <nav className="landing-header__nav" role="navigation" aria-label={t("nav.main")}>
            <a href="#how">{t("nav.how")}</a>
            <a href="#security">{t("nav.security")}</a>
            <a href="#levels">{t("nav.levels")}</a>
            <a href="#mint">{t("nav.mint")}</a>
          </nav>

          <div className="landing-header__actions">
            <button className="lang-toggle-btn" onClick={() => setLang(lang === "ru" ? "en" : "ru")} aria-label={t("lang.switch")}>
              {t("lang.switch")}
            </button>
            <button className="theme-toggle-btn" onClick={toggleTheme} aria-label={t("nav.theme")}>
              <ThemeIcon theme={theme} />
            </button>
            <button type="button" className="btn btn--primary" onClick={onActivate} disabled={!ready}>
              {authenticated ? t("dashboard.open") : t("nav.create")}
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════ HERO ═══ */}
      <section className="hero" ref={heroRef} aria-labelledby="hero-title">
        <div className="hero__bg" aria-hidden="true" style={{ transform: `translateY(${parallaxY}px)` }} />
        <div className="hero__inner">
          <div className="hero__text">
            <div className="hero__badge">
              <span className="hero__badge-dot" aria-hidden="true" />
              Mantle · Testnet · Live
            </div>

            <h1 className="hero__headline" id="hero-title">
              {t("hero.line1")}<br />
              {t("hero.line2")}<br />
              <em>{t("hero.line3")}</em>
            </h1>

            <p className="hero__sub">
              {t("hero.sub")}
            </p>

            <div className="hero__actions">
              <button type="button" className="btn btn--primary btn--lg" onClick={onActivate} disabled={!ready}>
                {t("hero.cta_create")}
              </button>
              <a href="#levels" className="btn btn--ghost btn--lg">
                {t("hero.cta_levels")}
              </a>
            </div>

            <div className="hero__social-proof" role="group" aria-label={t("stats.title")}>
              <div className="hero__avatars" aria-hidden="true" style={{ display: "flex" }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="hero__avatar" style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--color-bg)", marginLeft: i > 0 ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", background: "var(--color-surface-dynamic)" }}>
                    🐾
                  </div>
                ))}
              </div>
              <span>
                {t("hero.social_proof").replace("{count}", String(animatedCount))}
              </span>
            </div>
          </div>

          <div className="hero__image-wrap" aria-hidden="true">
            <div className="hero__image-card">
              <img
                src="https://user-gen-media-assets.s3.amazonaws.com/gpt4o_images/46439875-d13f-4c97-bb46-9d9959be6172.png"
                alt={t("img.hero_alt")}
                width="520" height="360"
                loading="eager"
              />
              <div className="hero__mood-pill">
                <span>😊</span> <span>{t("hero.mood_happy")}</span>
              </div>
              <div className="hero__stat-pill">
                <span className="hero__stat-up">▲ 14.80 MNT</span>
                <span style={{ color: "var(--color-text-muted)" }}>{t("hero.per_24h")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ HOW IT WORKS ═══ */}
      <section className="steps section" id="how" aria-labelledby="how-title">
        <div className="container">
          <p className="section-label">{t("how.section_label")}</p>
          <h2 className="section-title" id="how-title">{t("how.title")}</h2>
          <p className="section-sub">{t("how.sub")}</p>

          <div className="steps__grid">
            {[
              { num: "1", title: t("how.step1_title"), desc: t("how.step1_desc") },
              { num: "2", title: t("how.step2_title"), desc: t("how.step2_desc") },
              { num: "3", title: t("how.step3_title"), desc: t("how.step3_desc") },
            ].map((step) => (
              <FadeInSection key={step.num}>
                <article className="step-card">
                  <div className="step-num" aria-hidden="true">{step.num}</div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </article>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ MOOD / NFT ═══ */}
      <section className="mood-section" id="nft" aria-labelledby="mood-title">
        <div className="container container--wide">
          <div className="mood-section__inner">
            <FadeInSection>
              <div className="nft-card">
                <img
                  src="https://user-gen-media-assets.s3.amazonaws.com/gpt4o_images/272c4265-2b6b-457a-bf61-d6f82c5c7473.png"
                  alt={t("img.mood_alt")}
                  width="480" height="480"
                  loading="lazy"
                  className="nft-card__img"
                />
                <div className="nft-card__body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                    <div>
                      <div className="nft-card__name">Molebot #042</div>
                      <div className="nft-card__serial">{t("nft.demo_subtitle")}</div>
                    </div>
                    <span className="nft-mood-badge nft-mood-badge--happy">😊 {t("mood.happy")}</span>
                  </div>
                  <div className="nft-card__stats">
                    <div className="nft-stat">
                      <div className="nft-stat__label">{t("nft.today")}</div>
                      <div className="nft-stat__value nft-stat__value--up">+3.2%</div>
                    </div>
                    <div className="nft-stat">
                      <div className="nft-stat__label">{t("nft.total_trades")}</div>
                      <div className="nft-stat__value">127</div>
                    </div>
                    <div className="nft-stat">
                      <div className="nft-stat__label">All-time P&L</div>
                      <div className="nft-stat__value nft-stat__value--up">+48.20 MNT</div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>

            <FadeInSection>
              <p className="section-label">{t("nft.section_label")}</p>
              <h2 className="section-title" id="mood-title">{t("nft.headline1")}<br />{t("nft.headline2")}</h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-lg)", lineHeight: 1.6, marginBottom: "var(--space-8)", maxWidth: "44ch" }}>
                {t("nft.desc")}
              </p>
              <ul role="list" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {[
                  { emoji: "😊", title: t("mood.happy"), desc: t("mood.happy_desc") },
                  { emoji: "🧐", title: t("mood.focused"), desc: t("mood.focused_desc") },
                  { emoji: "😴", title: t("mood.sleeping"), desc: t("mood.sleeping_desc") },
                ].map((m) => (
                  <li key={m.title} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>{m.emoji}</span>
                    <div>
                      <strong style={{ color: "var(--color-text)" }}>{m.title}</strong>{" "}
                      <span style={{ color: "var(--color-text-muted)" }}>{m.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ SECURITY ═══ */}
      <section className="security section" id="security" aria-labelledby="security-title">
        <div className="container">
          <p className="section-label">{t("security.section_label")}</p>
          <h2 className="section-title" id="security-title">{t("security.headline1")}<br />{t("security.headline2")}</h2>
          <p className="section-sub">{t("security.sub")}</p>

          <div className="features-bento">
            {[
              { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>, title: t("security.feature1_title"), desc: t("security.feature1_desc"), tag: "Privy Embedded Wallet", span: true },
              { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, title: t("security.feature2_title"), desc: t("security.feature2_desc"), tag: "EIP-712 Signing", span: false },
              { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>, title: t("security.feature3_title"), desc: t("security.feature3_desc"), tag: "Mantle On-chain", span: false },
              { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>, title: t("security.feature4_title"), desc: t("security.feature4_desc"), tag: "Agni Finance", span: false },
            ].map((feat, i) => (
              <FadeInSection key={i} className="feature-tile">
                <div className="feature-icon" aria-hidden="true">{feat.icon}</div>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
                <span className="feature-tag">{feat.tag}</span>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ LEVELS ═══ */}
      <section className="levels section" id="levels" aria-labelledby="levels-title">
        <div className="container container--wide">
          <p className="section-label">{t("levels.section_label")}</p>
          <h2 className="section-title" id="levels-title">{t("levels.headline1")}<br />{t("levels.headline2")}</h2>
          <p className="section-sub">{t("levels.sub")}</p>

          <div className="levels-track" role="list" aria-label={t("levels.title")}>
            {levelData.map((lvl, i) => (
              <React.Fragment key={lvl.name}>
                <FadeInSection>
                  <div className="level-item" role="listitem">
                    <div className={`level-orb${lvl.type === "active" ? " level-orb--active" : ""}${lvl.type === "gold" ? " level-orb--gold" : ""}`}>
                      {lvl.emoji}
                    </div>
                    <div className="level-name">{lvl.name}</div>
                    <div className="level-xp">{lvl.xp}</div>
                  </div>
                </FadeInSection>
                {i < levelData.length - 1 && <div className="level-connector" aria-hidden="true" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ GIFT ═══ */}
      <section className="gift-section" id="gift" aria-labelledby="gift-title">
        <div className="container container--wide">
          <div className="gift-inner">
            <FadeInSection>
              <div className="gift-image">
                <img
                  src="https://user-gen-media-assets.s3.amazonaws.com/gpt4o_images/937c7569-9f52-4fb6-8b2d-6bb42d0600f5.png"
                  alt={t("img.gift_alt")}
                  width="480" height="480"
                  loading="lazy"
                />
              </div>
            </FadeInSection>
            <FadeInSection>
              <div className="gift-text">
                <p className="section-label">{t("gift.section_label")}</p>
                <h2 className="section-title" id="gift-title">{t("gift.headline1")}<br />{t("gift.headline2")}</h2>
                <p>{t("gift.desc")}</p>
                <button type="button" className="btn btn--primary btn--lg" onClick={handleGift} disabled={!ready}>
                  {t("gift.button")}
                </button>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ MINT CTA ═══ */}
      <section className="mint-cta section" id="mint" aria-labelledby="mint-title">
        <div className="container">
          <div className="mint-cta__card">
            <div className="mint-cta__glow" aria-hidden="true" />
            <h2 className="mint-cta__title" id="mint-title">{t("cta.title")}</h2>
            <p className="mint-cta__sub">{t("cta.sub")}</p>
            <div className="mint-cta__actions">
              <button type="button" className="btn btn--primary btn--lg" onClick={onActivate} disabled={!ready}>{t("cta.create")}</button>
              <button type="button" className="btn btn--ghost btn--lg" onClick={handleGift} disabled={!ready}>{t("cta.gift")}</button>
            </div>
            <div className="price-tiers" role="group" aria-label={t("cta.prices_aria")}>
              <div className="price-tier price-tier--active">
                <div className="price-tier__range">#1–100</div>
                <div className="price-tier__price">0.05 MNT</div>
              </div>
              <div className="price-tier">
                <div className="price-tier__range">#101–500</div>
                <div className="price-tier__price">0.08 MNT</div>
              </div>
              <div className="price-tier">
                <div className="price-tier__range">#501–1000</div>
                <div className="price-tier__price">0.1 MNT</div>
              </div>
              <div className="price-tier">
                <div className="price-tier__range">#1001+</div>
                <div className="price-tier__price">0.15 MNT</div>
              </div>
            </div>
            <p style={{ marginTop: "var(--space-5)", fontSize: "var(--text-xs)", color: "var(--color-text-faint)", position: "relative" }}>
              {t("cta.footer")}
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ FOOTER ═══ */}
      <footer className="landing-footer">
        <div className="container container--wide">
          <div className="landing-footer__inner">
            <div className="landing-footer__brand">
              <MolebotLogo size={24} />
              Molebot
            </div>
            <nav className="landing-footer__links" aria-label={t("footer.aria_label")}>
              <a href="https://github.com/StasPodyachev/molebot_mantle" target="_blank" rel="noopener noreferrer">{t("footer.github")}</a>
              <a href="https://explorer.sepolia.mantle.xyz" target="_blank" rel="noopener noreferrer">{t("footer.explorer")}</a>
              <a href="https://dorahacks.io" target="_blank" rel="noopener noreferrer">{t("footer.hackathon")}</a>
            </nav>
            <p className="landing-footer__copy">{t("footer.copy")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
