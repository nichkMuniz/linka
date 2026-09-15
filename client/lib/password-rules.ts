/**
 * Regra de senha forte do app — fonte única.
 *
 * Vale no cadastro (`Login.tsx`), na redefinição por código (o "salvar nova
 * senha" do mesmo arquivo) e na troca de senha das Configurações. Antes a regra
 * morava só no `Login.tsx`, e a tela de Configurações exigia apenas 6
 * caracteres: dava para criar uma conta com senha forte e, minutos depois,
 * rebaixá-la para `123456` pelo drawer de settings.
 *
 * `isStrongPassword` é derivada de `passwordRules`, então o checklist que o
 * usuário vê e a trava que libera o botão não têm como discordar.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** Chaves de i18n das regras, na ordem em que são exibidas. */
export type PasswordRuleKey = "pwd_rule_min" | "pwd_rule_upper" | "pwd_rule_special";

export function passwordRules(pwd: string): { key: PasswordRuleKey; ok: boolean }[] {
  return [
    { key: "pwd_rule_min", ok: pwd.length >= PASSWORD_MIN_LENGTH },
    { key: "pwd_rule_upper", ok: /[A-Z]/.test(pwd) },
    { key: "pwd_rule_special", ok: /[^a-zA-Z0-9]/.test(pwd) },
  ];
}

export function isStrongPassword(pwd: string): boolean {
  return passwordRules(pwd).every((r) => r.ok);
}
