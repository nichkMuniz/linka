import * as React from "react";
import { ShieldBan } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import { resetSupabaseAuth } from "@/lib/supabase";

/**
 * Tela mostrada quando a conta foi banida pela moderação.
 *
 * **Por que existe:** a trava de verdade é o `banned_until` do GoTrue, que
 * recusa login e renovação de token. Mas o access token que já está no device
 * segue válido até expirar — sem esta tela, o banido continuaria usando o app
 * normalmente por até uma hora, e depois seria cuspido para o login sem
 * entender por quê.
 *
 * Não é um `Navigate` para `/login` de propósito: mandar a pessoa para a tela
 * de entrada sem explicação vira "o app parou de funcionar" no review da App
 * Store. Ela sai quando quiser, pelo botão.
 */
export function BannedScreen() {
  const { t } = useLanguage();
  const [leaving, setLeaving] = React.useState(false);

  async function handleLeave() {
    setLeaving(true);
    await resetSupabaseAuth();
    // O listener do AuthProvider zera o user e o RequireAuth manda para /login.
  }

  return (
    <div
      className="min-h-dvh bg-background flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(2rem, env(safe-area-inset-left))",
        paddingRight: "max(2rem, env(safe-area-inset-right))",
      }}
    >
      <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
        <ShieldBan className="w-8 h-8 text-destructive" />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">{t("banned_title")}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("banned_description")}
        </p>
      </div>

      <Button variant="outline" onClick={handleLeave} disabled={leaving} className="w-full max-w-xs">
        {t("settings_logout")}
      </Button>
    </div>
  );
}
