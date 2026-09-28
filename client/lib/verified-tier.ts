/**
 * Níveis de verificação de conta.
 *
 * - `official` → conta da equipe LinKa (admin). Selo dourado em forma de roseta.
 * - `notable`  → usuário importante verificado pelo admin. Selo azul redondo.
 *
 * `profiles.is_verified` continua existindo e fica sincronizado (true sempre que
 * há nível), mas a cor/forma do selo vem de `profiles.verified_tier`.
 * Migração: `docs/migrations/20260928-verified-tiers.sql`.
 */
export type VerifiedTier = "official" | "notable";

const TIER_RANK: Record<VerifiedTier, number> = { notable: 1, official: 2 };

/** true quando `next` é um selo acima de `prev` (null conta como "sem selo"). */
export function isVerifiedUpgrade(prev: VerifiedTier | null, next: VerifiedTier | null): boolean {
  return (next ? TIER_RANK[next] : 0) > (prev ? TIER_RANK[prev] : 0);
}

/** Deriva o nível do selo a partir de uma linha de `profiles` (null = sem selo). */
export function verifiedTierOf(
  row: { is_verified?: boolean | null; verified_tier?: string | null } | null | undefined,
): VerifiedTier | null {
  if (!row || row.is_verified !== true) return null;
  return row.verified_tier === "official" ? "official" : "notable";
}
