/**
 * Ponte do client para a configuração de compartilhamento.
 *
 * A fonte da verdade é `shared/share-config.ts` (importável também pelo
 * server/ e pelas funções serverless em api/). Este arquivo apenas reexporta,
 * para que o client continue importando de `@/lib/share-url`.
 */
export {
  SHARE_DOMAIN,
  SHARE_BASE_URL,
  SHARE_HOSTS,
  APP_URL_SCHEME,
  APP_STORE_ID,
  APP_STORE_URL,
  TERMS_URL,
  PRIVACY_URL,
  SUPPORT_URL,
  postShareUrl,
  profileShareUrl,
  isShareHost,
  parseDeepLinkUrl,
  type DeepLinkTarget,
} from "@shared/share-config";
