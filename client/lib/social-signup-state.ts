// Estado do cadastro por Google/Apple. Separado de `social-auth.ts` para o
// `App.tsx` (chunk de entrada) poder consultá-lo sem carregar os plugins de login.
//
// Conta nova por provedor: o trigger `handle_new_user` cria a linha de
// `profiles` na hora (com um @ tirado do email), então "tem perfil" não diz se o
// cadastro terminou. Quem diz é `user_metadata.signup_completed`, gravado no fim
// dos passos de perfil (e o aceite dos Termos acontece nesses passos).

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const SOCIAL_PROVIDERS = new Set(["google", "apple"]);

/**
 * Contas de provedor criadas antes deste corte vieram do login social antigo
 * (removido em 2026-06) e já passaram pelo cadastro daquela época — sem o
 * corte, seriam jogadas de novo nos passos de perfil.
 */
const SOCIAL_RELAUNCH_AT = Date.parse("2026-09-29T00:00:00Z");

const completedKey = (userId: string) => `linka_signup_completed_${userId}`;

/**
 * O usuário entrou por Google/Apple e ainda não terminou os passos de perfil.
 *
 * Lê também uma marca local: o `auth-context` só troca o objeto `user` quando
 * muda o id, então o `user_metadata` que ele entrega fica velho depois do
 * `updateUser` que marca o cadastro como concluído.
 */
export function needsSocialSignupCompletion(user: User | null | undefined): boolean {
  if (!user) return false;
  const provider = String(user.app_metadata?.provider ?? "");
  if (!SOCIAL_PROVIDERS.has(provider)) return false;
  if (user.user_metadata?.signup_completed === true) return false;
  if (Date.parse(user.created_at) < SOCIAL_RELAUNCH_AT) return false;
  try {
    if (localStorage.getItem(completedKey(user.id)) === "1") return false;
  } catch {
    // Sem storage: vale o metadata.
  }
  return true;
}

/**
 * Marca o cadastro por provedor como concluído (metadata + marca local).
 *
 * Lança se o metadata não gravar: é ele que o servidor lê para decidir se a
 * conta é um cadastro abandonado (e apagá-la — migração 20261001). Concluir
 * só com a marca local deixaria uma conta "pronta" no app que o banco ainda
 * considera incompleta.
 */
export async function markSocialSignupCompleted(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({ data: { signup_completed: true } });
  if (error) throw error;
  try {
    localStorage.setItem(completedKey(userId), "1");
  } catch {
    // ignore
  }
}

/** Conta sem senha (só Google/Apple) — biometria não se aplica a ela. */
export function hasPasswordIdentity(user: User | null | undefined): boolean {
  if (!user) return false;
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers)) return providers.includes("email");
  return String(user.app_metadata?.provider ?? "email") === "email";
}
