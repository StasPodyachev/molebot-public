import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import ru from './ru';
import en from './en';

type Lang = 'ru' | 'en';
const messages: Record<Lang, Record<string, string>> = { ru, en };

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
});

function detectLang(): Lang {
  const stored = localStorage.getItem('lang') as Lang | null;
  if (stored === 'ru' || stored === 'en') return stored;
  const path = window.location.pathname;
  if (path.startsWith('/ru')) return 'ru';
  if (path.startsWith('/en')) return 'en';
  // Default to English
  return 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    // Update URL without reload
    const path = window.location.pathname.replace(/^\/(ru|en)/, '') || '/';
    window.history.replaceState(null, '', `/${l}${path}`);
  };

  const t = (key: string) => messages[lang][key] ?? key;

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useT() {
  return useContext(LangContext);
}
