import * as React from "react";
import { type Language, type TranslationKey, t as translate } from "./i18n";

const STORAGE_KEY = "ritmofit-language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = React.createContext<LanguageContextValue>({
  language: "pt",
  setLanguage: () => {},
  t: (key) => key,
});

/**
 * Idioma da primeira abertura, lido do aparelho.
 *
 * A troca manual de idioma vive em **Perfil → Configurações**, ou seja, só
 * existe depois do login — quem instala o app não tem como escolher antes de
 * ver a tela de Login e o cadastro inteiro. Sem esta função o padrão era `pt`
 * fixo, e a tradução dessas telas nunca aparecia para ninguém.
 *
 * O app é Brasil-primeiro e só tem dois idiomas: qualquer variante de português
 * (pt, pt-BR, pt-PT) fica em `pt`; todo o resto cai em `en`.
 */
function detectDeviceLanguage(): Language {
  try {
    const tags = [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language,
    ].filter(Boolean);
    const first = tags[0]?.toLowerCase() ?? "";
    return first.startsWith("pt") ? "pt" : "en";
  } catch {
    return "pt";
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "pt") return stored;
      // Sem escolha salva: segue o aparelho. A escolha do usuário, quando
      // houver, sempre vence — por isso o `stored` é checado primeiro.
      return detectDeviceLanguage();
    } catch {
      return "pt";
    }
  });

  const setLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }, []);

  const t = React.useCallback(
    (key: TranslationKey) => translate(language, key),
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return React.useContext(LanguageContext);
}
