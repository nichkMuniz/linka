import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Ban, Flag } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { ReportDrawer } from "@/components/shared/report-drawer";
import { BlockUserDialog } from "@/components/shared/block-user-dialog";

/**
 * Menu de segurança sobre OUTRO usuário: denunciar e bloquear.
 *
 * Junta as duas ações que a Guideline 1.2 exige num único ponto de entrada,
 * para que exista sempre o mesmo gesto — o "..." — onde quer que um usuário
 * apareça. Denúncia sem bloqueio deixa a vítima esperando moderação; bloqueio
 * sem denúncia não avisa ninguém. As duas juntas é o que a Apple procura.
 *
 * Encapsula os dois filhos (ReportDrawer e BlockUserDialog) para o callsite
 * precisar de um estado booleano só. Eles montam apenas quando abertos.
 */
export function UserSafetyDrawer({
  open,
  onOpenChange,
  userId,
  userName,
  onBlocked,
  content,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
  /** Chamado depois de bloquear — normalmente para sair da tela do bloqueado. */
  onBlocked?: () => void;
  /**
   * Conteúdo específico em foco (o post aberto, o flow em exibição). Quando
   * informado, o menu ganha uma primeira linha para denunciar o CONTEÚDO, além
   * de denunciar o autor.
   *
   * A distinção importa para a Guideline 1.2: denunciar o usuário sinaliza um
   * comportamento, denunciar o conteúdo aponta a peça exata que precisa sair.
   * O painel de admin trata os dois como filas diferentes.
   */
  content?: { type: "post" | "shot" | "flow"; id: string; label: string } | null;
}) {
  const { t } = useLanguage();
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportContentOpen, setReportContentOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);

  const rowStyle: React.CSSProperties = {
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.1)",
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
          className="!rounded-t-[32px] !border-0"
          style={{
            background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            borderTop: "1px solid rgba(255,255,255,.14)",
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader>
            <DrawerTitle style={{ color: "#fff" }}>{t("user_safety_title")}</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-3">
            {content && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  setReportContentOpen(true);
                }}
                className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
                style={rowStyle}
              >
                <Flag className="h-[18px] w-[18px] shrink-0" style={{ color: "rgba(255,255,255,.7)" }} />
                <span className="text-sm font-medium flex-1" style={{ color: "#fff" }}>
                  {content.label}
                </span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenChange(false);
                setReportOpen(true);
              }}
              className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
              style={rowStyle}
            >
              <Flag className="h-[18px] w-[18px] shrink-0" style={{ color: "rgba(255,255,255,.7)" }} />
              <span className="text-sm font-medium flex-1" style={{ color: "#fff" }}>
                {/* Com duas denúncias na tela, "Denunciar" sozinho não diz o
                    alvo — vira "Denunciar usuário" ao lado de "Denunciar post". */}
                {content ? t("report_user") : t("user_safety_report")}
              </span>
            </button>

            <button
              onClick={() => {
                onOpenChange(false);
                setBlockOpen(true);
              }}
              className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
              style={rowStyle}
            >
              <Ban className="h-[18px] w-[18px] shrink-0 text-destructive" />
              <span className="text-sm font-medium flex-1 text-destructive">
                {t("block_user_action").replace("{name}", userName)}
              </span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {reportOpen && (
        <ReportDrawer
          open={reportOpen}
          onOpenChange={setReportOpen}
          type="user"
          target={userId ? { id: userId, userId, userName } : null}
        />
      )}

      {reportContentOpen && content && (
        <ReportDrawer
          open={reportContentOpen}
          onOpenChange={setReportContentOpen}
          type={content.type}
          target={userId ? { id: content.id, userId, userName } : null}
        />
      )}

      <BlockUserDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        userId={userId}
        userName={userName}
        onDone={onBlocked}
      />
    </>
  );
}
