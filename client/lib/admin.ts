/**
 * Lista de admins do app.
 *
 * **Isto é guarda de UI, não autorização.** Quem autoriza escrita é a tabela
 * `app_admins` no servidor, checada pelas RPCs `SECURITY DEFINER` do painel —
 * esta lista só decide o que a interface mostra (a rota `/admin` e os
 * indicadores de curadoria embutidos nas telas normais).
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
