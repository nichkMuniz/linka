/**
 * Por qual flow do usuário abrir o viewer.
 *
 * Regra (a mesma do Instagram): abre no **primeiro flow ainda não visto**, em ordem
 * cronológica. Se o autor postou 3 flows que você já viu e publicou um 4º, tocar no anel
 * leva direto ao 4º — e não faz você reassistir os três anteriores.
 *
 * Quando todos já foram vistos (rever de propósito), volta ao mais antigo, que é o
 * comportamento esperado ao reabrir um flow já assistido.
 *
 * O conjunto de vistos vem de `getMyViewedFlowUserIdsDb` (tabela `flow_user_viewed`),
 * então vale entre sessões e aparelhos — não é um estado só de memória.
 */
export function pickFlowEntry<T extends { id: string; created_at: string }>(
  userStories: T[],
  viewedIds?: Set<string> | null,
): T | null {
  if (!userStories.length) return null;

  const chronological = [...userStories].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  if (viewedIds?.size) {
    const firstUnseen = chronological.find((s) => !viewedIds.has(s.id));
    if (firstUnseen) return firstUnseen;
  }

  return chronological[0];
}
