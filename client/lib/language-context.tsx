import * as React from "react";
import {
  type Language,
  type TranslationKey,
  t as translate,
  loadLanguage,
  persistLanguage,
  resolveLanguage,
} from "./i18n";


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

// Idioma da primeira abertura: a escolha salva e, sem ela, o do aparelho —
// `resolveLanguage` (i18n.ts). A troca manual vive em Perfil → Configurações,
// ou seja, só existe depois do login; sem seguir o aparelho, quem instala o app
// nunca veria Login e cadastro traduzidos.

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // O App.tsx já carregou o dicionário deste idioma antes do primeiro render.
  const [language, setLanguageState] = React.useState<Language>(resolveLanguage);

  // A escolha é gravada NA HORA (quem lê fora do React — `tUi` — vê o idioma
  // novo já no próximo render); a tela só troca quando o dicionário estiver na
  // memória, para não passar por um frame em português.
  const setLanguage = React.useCallback((lang: Language) => {
    persistLanguage(lang);
    loadLanguage(lang).finally(() => setLanguageState(lang));
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
