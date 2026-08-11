import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { ExerciseAnatomy } from "@/components/shared/exercise-anatomy";
import { DietImage } from "@/components/shared/diet-image";
import { useLanguage } from "@/lib/language-context";
import { GLASS_SHEET_STYLE, GLASS_SHEET_PROPS } from "@/lib/glass-styles";
import { toast } from "@/components/ui/use-toast";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import {
  updateCustomWorkoutDb,
  deleteCustomWorkoutDb,
  uploadCustomExercisePhotoDb,
} from "@/lib/ritmofit-db";

export interface ItemDetailData {
  /** 1 = exercício, 2 = dieta */
  type: 1 | 2;
  name: string;
  photo: string | null;
  description?: string | null;
  /** linha de meta: grupo muscular / categoria · kcal */
  meta?: string | null;
  /** id no catálogo — obrigatório para habilitar a edição */
  id?: string;
  /**
   * true = exercício criado manualmente pelo próprio usuário (`Workout.isCustom`).
   * Só então a ação de editar aparece — itens do catálogo não são editáveis.
   */
  canEdit?: boolean;
}

export interface ItemDetailSaved {
  id: string;
  name: string;
  description: string;
  photo: string | null;
}

interface ItemDetailDrawerProps {
  item: ItemDetailData | null;
  onClose: () => void;
  /** Chamado após salvar a edição — a lista de origem atualiza o item. */
  onSaved?: (updated: ItemDetailSaved) => void;
  /** Chamado após apagar o exercício custom — a lista de origem o remove. */
  onDeleted?: (id: string) => void;
}

/**
 * Drawer glass que mostra a imagem ampliada de um exercício/dieta + descrição
 * de como executar/preparar. Reutilizável a partir de qualquer lista de itens.
 *
 * Para **exercícios criados pelo usuário** (`canEdit`), traz também o modo de
 * edição: nome, "como executar" e foto (adicionar/trocar/remover).
 */
export function ItemDetailDrawer({ item, onClose, onSaved, onDeleted }: ItemDetailDrawerProps) {
  const { t } = useLanguage();

  const [editing, setEditing] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Inputs dentro da área rolável do drawer — mantém o campo em foco acima do
  // teclado do iOS (par obrigatório com o padding-bottom da CSS var, abaixo).
  useKeyboardInputScroll(scrollRef, editing);

  const canEdit = !!item && item.type === 1 && !!item.canEdit && !!item.id;

  // Sai do modo de edição (e descarta rascunho) sempre que o item muda/fecha.
  React.useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
  }, [item?.id, item?.name]);

  const resetDraft = React.useCallback(() => {
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoRemoved(false);
  }, []);

  React.useEffect(() => {
    if (!editing) resetDraft();
  }, [editing, resetDraft]);

  // Revoga a object URL do preview ao desmontar.
  const photoPreviewRef = React.useRef<string | null>(null);
  photoPreviewRef.current = photoPreview;
  React.useEffect(
    () => () => { if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current); },
    [],
  );

  const startEditing = () => {
    if (!item) return;
    setEditName(item.name);
    setEditDesc(item.description ?? "");
    resetDraft();
    setConfirmDelete(false);
    setEditing(true);
  };

  const handleDelete = async () => {
    if (!item?.id || deleting) return;
    setDeleting(true);
    try {
      await deleteCustomWorkoutDb(item.id);
      toast({ title: t("goals_item_deleted") });
      onDeleted?.(item.id);
      onClose();
    } catch (err: any) {
      toast({
        title: t("goals_item_delete_error"),
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: t("newpost_invalid_type"), variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t("newpost_file_too_large"), variant: "destructive" });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhotoRemoved(false);
  };

  const handleSave = async () => {
    if (!item?.id || saving) return;
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    try {
      // `undefined` = não mexe na foto; `null` = remover.
      let photo: string | null | undefined;
      if (photoFile) photo = await uploadCustomExercisePhotoDb(photoFile);
      else if (photoRemoved) photo = null;

      const description = editDesc.trim();
      await updateCustomWorkoutDb(item.id, {
        name,
        description,
        ...(photo !== undefined ? { photo } : {}),
      });

      toast({ title: t("goals_item_edit_saved") });
      onSaved?.({
        id: item.id,
        name,
        description,
        photo: photo !== undefined ? photo : item.photo,
      });
      setEditing(false);
    } catch (err: any) {
      toast({
        title: t("goals_item_edit_error"),
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Foto exibida: preview do rascunho > removida > a atual do item.
  const shownPhoto = editing
    ? (photoPreview ?? (photoRemoved ? null : item?.photo ?? null))
    : (item?.photo ?? null);

  return (
    <Drawer
      open={!!item}
      onOpenChange={(v) => { if (!v) onClose(); }}
      noBodyStyles
      shouldScaleBackground={false}
    >
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={GLASS_SHEET_STYLE}
      >
        {item && (
          <>
            <DrawerHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <DrawerTitle className="text-base font-semibold leading-snug text-white">
                  {editing ? t("goals_item_edit_title") : item.name}
                </DrawerTitle>
                {canEdit && !editing && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white active:scale-95 transition-transform"
                    style={{
                      background: "rgba(255,255,255,.08)",
                      border: "1px solid rgba(255,255,255,.16)",
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("goals_item_edit")}
                  </button>
                )}
              </div>
            </DrawerHeader>

            <div
              ref={scrollRef}
              className="flex-1 min-h-0 overflow-y-auto px-4 space-y-4"
              style={{ paddingBottom: "calc(1.5rem + var(--keyboard-height, 0px))" }}
            >
              <div
                className="w-full aspect-square rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,255,255,.04)" }}
              >
                {item.type === 1 ? (
                  <ExerciseImage photo={shownPhoto} name={editing ? editName : item.name} className="w-full h-full" />
                ) : (
                  <DietImage photo={shownPhoto} name={item.name} className="w-full h-full" />
                )}
              </div>

              {editing ? (
                <div className="space-y-4">
                  {/* Foto */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-white">
                      {t("goals_create_exercise_photo")}
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoPick}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-xl px-3 py-2 text-xs font-semibold text-white active:scale-95 transition-transform"
                        style={{
                          background: "rgba(255,255,255,.08)",
                          border: "1px solid rgba(255,255,255,.16)",
                        }}
                      >
                        {shownPhoto
                          ? t("goals_item_edit_photo_change")
                          : t("goals_create_exercise_photo_cta")}
                      </button>
                      {shownPhoto && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoFile(null);
                            setPhotoPreview((prev) => {
                              if (prev) URL.revokeObjectURL(prev);
                              return null;
                            });
                            setPhotoRemoved(true);
                          }}
                          className="rounded-xl px-3 py-2 text-xs font-semibold active:scale-95 transition-transform"
                          style={{
                            background: "rgba(239,68,68,.12)",
                            border: "1px solid rgba(239,68,68,.35)",
                            color: "#fca5a5",
                          }}
                        >
                          {t("goals_create_exercise_photo_remove")}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nome */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-white">
                      {t("goals_create_exercise_name")}
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={120}
                      className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                      style={{
                        background: "rgba(255,255,255,.06)",
                        border: "1px solid rgba(255,255,255,.14)",
                      }}
                    />
                  </div>

                  {/* Como executar */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-white">
                      {t("goals_create_exercise_howto")}
                    </label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={5}
                      placeholder={t("goals_create_exercise_howto_placeholder")}
                      className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none resize-none"
                      style={{
                        background: "rgba(255,255,255,.06)",
                        border: "1px solid rgba(255,255,255,.14)",
                      }}
                    />
                  </div>

                  {/* Apagar exercício — ação destrutiva com confirmação inline */}
                  <div className="pt-1">
                    {confirmDelete ? (
                      <div
                        className="rounded-xl p-3 space-y-3"
                        style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)" }}
                      >
                        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,.8)" }}>
                          {t("goals_item_delete_confirm")}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            disabled={deleting}
                            className="flex-1 rounded-lg py-2 text-xs font-semibold text-white active:scale-95 transition-transform disabled:opacity-50"
                            style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}
                          >
                            {t("goals_cancel")}
                          </button>
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex-1 rounded-lg py-2 text-xs font-bold text-white active:scale-95 transition-transform disabled:opacity-50"
                            style={{ background: "#ef4444" }}
                          >
                            {deleting ? t("goals_picker_loading") : t("goals_item_delete_yes")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold active:scale-95 transition-transform"
                        style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#fca5a5" }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("goals_item_delete")}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {item.meta && (
                    <p className="text-sm" style={{ color: "rgba(255,255,255,.6)" }}>{item.meta}</p>
                  )}

                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold text-white">
                      {item.type === 1 ? t("goals_item_how_exercise") : t("goals_item_how_diet")}
                    </h3>
                    <p
                      className="text-sm leading-relaxed whitespace-pre-line"
                      style={{ color: "rgba(255,255,255,.7)" }}
                    >
                      {item.description?.trim() || t("goals_item_no_desc")}
                    </p>
                  </div>

                  {/* Anatomia — só exercício. Não renderiza nada quando o item
                      não tem músculos mapeados (alongamento, catálogo ainda não
                      semeado), então não há estado vazio a tratar aqui. */}
                  {item.type === 1 && <ExerciseAnatomy workoutId={item.id} />}
                </>
              )}
            </div>

            {/* Rodapé fixo do modo de edição */}
            {editing && (
              <div
                className="shrink-0 flex gap-2 px-4 pt-3"
                style={{
                  borderTop: "1px solid rgba(255,255,255,.1)",
                  paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold text-white active:scale-95 transition-transform disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,.06)",
                    border: "1px solid rgba(255,255,255,.14)",
                  }}
                >
                  {t("goals_cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !editName.trim()}
                  className="flex-1 rounded-xl py-3 text-sm font-bold text-white active:scale-95 transition-transform disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)" }}
                >
                  {saving ? t("goals_picker_loading") : t("goals_item_edit_save")}
                </button>
              </div>
            )}
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
