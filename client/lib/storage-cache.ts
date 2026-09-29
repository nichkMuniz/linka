/**
 * `cacheControl` (em segundos) dos uploads para o Supabase Storage.
 *
 * Sem este campo o Supabase grava `max-age=3600`: passada 1 hora, o WebView
 * precisa perguntar ao servidor se cada imagem mudou antes de exibi-la — uma
 * ida e volta de ~300ms POR IMAGEM, mesmo com o arquivo já no aparelho. Era o
 * "as imagens carregam devagar" ao trocar de tela (perfil, metas, conversas).
 *
 * Todo upload do app grava num caminho NOVO (timestamp ou UUID no nome) e
 * nunca sobrescreve, então o arquivo é imutável: pode ficar em cache por 1 ano,
 * no aparelho e na CDN. Trocar a foto de perfil gera outro arquivo e outra URL.
 *
 * NÃO use em caminho reaproveitado com `upsert: true` (ex.: imagens do
 * catálogo de exercícios, `manual/{id}.jpg`) — ali a versão nova ficaria
 * escondida atrás do cache. Os scripts do catálogo usam 7 dias.
 */
export const IMMUTABLE_CACHE_CONTROL = "31536000";
