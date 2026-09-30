import * as React from "react";

/**
 * Lista fixa de admins do app (os donos).
 *
 * **Isto é guarda de UI, não autorização.** Quem autoriza escrita é
 * `is_app_admin()` no servidor, checada pelas RPCs `SECURITY DEFINER` do
 * painel — esta lista só decide o que a interface mostra. Desde 2026-09-30
 * admin = esta lista **ou** selo oficial (ver `useIsAdmin`).
 */
export const ADMIN_USER_IDS = [
  "c954d5ab-9d72-4785-bc21-bf469a5e8052",
  "67e0640a-4762-4758-bb0f-449be951cc6a",
  "94548d81-76be-4c8b-9ff7-ccb946cd4e69",
];

export function isAdminUser(userId: string | null | undefined): boolean {
  return !!userId && ADMIN_USER_IDS.includes(userId);
}

/**
 * Admin de verdade para a interface: a lista fixa **ou** o selo OFICIAL
 * (`verified_tier = 'official'`). O selo verificado azul (`notable`) não
 * conta. Mesma regra do `is_app_admin()` do servidor (migração
 * 20260930-official-is-admin) e do botão "Admin" do perfil — antes a rota
 * /admin só aceitava a lista e o oficial caía no feed.
 *
 * @returns `true`/`false`, ou `null` enquanto o perfil ainda está sendo lido.
 */
export function useIsAdmin(userId: string | null | undefined): boolean | null {
  const listed = isAdminUser(userId);
  const [official, setOfficial] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!userId || listed) return;
    setOfficial(null);
    let active = true;
    // Import dinâmico: este arquivo entra no chunk de ENTRADA (App.tsx) e o
    // `ritmofit-db` é enorme — mesmo motivo do `useBanGuard`.
    import("@/lib/ritmofit-db")
      .then(async ({ getUserProfileDb }) => {
        // O próprio perfil sempre existe: null é leitura que falhou (ex.:
        // logo após o login) — tenta mais uma vez antes de negar.
        for (const delay of [0, 1200]) {
          if (delay) await new Promise((r) => setTimeout(r, delay));
          const profile = await getUserProfileDb(userId);
          if (!active) return;
          if (profile) {
            setOfficial(profile.verified_tier === "official");
            return;
          }
        }
        if (active) setOfficial(false);
      })
      .catch(() => {
        if (active) setOfficial(false);
      });
    return () => {
      active = false;
    };
  }, [userId, listed]);

  if (!userId) return false;
  return listed ? true : official;
}

/**
 * Modelo do INSERT que preenche a anatomia de um exercício.
 *
 * `muscles.id` é um slug legível (`peitoral_clavicular`, `biceps_braquial`),
 * então o snippet sai daqui quase pronto — só falta trocar o placeholder e
 * repetir a linha por músculo recrutado.
 *
 * Compartilhado entre o painel admin e o indicador embutido no detalhe do
 * exercício: os dois oferecem a MESMA cópia, para o admin não ter que lembrar
 * o formato dependendo de onde viu a lacuna.
 */
export function anatomySqlSnippet(
  workoutId: string,
  name: string,
  muscleGroup?: string | null,
): string {
  return [
    `-- ${name}${muscleGroup ? ` (${muscleGroup})` : ""}`,
    "insert into workout_muscles (workout_id, muscle_id, role, emphasis) values",
    `  ('${workoutId}', 'SLUG_DO_MUSCULO', 'primary', 80);`,
  ].join("\n");
}
