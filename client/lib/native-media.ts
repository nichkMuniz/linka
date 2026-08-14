import { Capacitor, registerPlugin } from "@capacitor/core";
import { PhotoLibrary, type PhotoLibraryAsset } from "@capgo/capacitor-photo-library";

/**
 * Ponte para o plugin nativo `EditedMediaPlugin` (ios/App/App/EditedMediaPlugin.swift).
 *
 * O `PhotoLibrary.getPhotoUrl` do @capgo exporta o asset via PHAssetResource e
 * acaba pegando o recurso `.photo` — que no iOS é sempre o arquivo ORIGINAL.
 * Como as edições do app Fotos (recorte, marcação, filtro) são não destrutivas,
 * uma foto recortada continua tendo o original intacto e o app publicava o print
 * inteiro em vez do recorte que aparece na galeria. O plugin nativo usa
 * `PHImageManager` com `version = .current`, que devolve o render editado.
 */
interface EditedMediaPlugin {
  getMediaUrl(options: { id: string }): Promise<{
    path: string;
    webPath: string;
    mimeType: string;
    size: number;
    width: number;
    height: number;
  }>;
  compressVideo(options: { id: string }): Promise<{
    path: string;
    webPath: string;
    mimeType: string;
    size: number;
  }>;
  purgeStaleCache(options?: { limit?: number }): Promise<{ removed: number }>;
  // Escrita fatiada na galeria (ver `saveMediaToPhotos` no fim do arquivo)
  startMediaWrite(options: { ext: string }): Promise<{ token: string }>;
  appendMediaWrite(options: { token: string; data: string }): Promise<void>;
  saveMediaWrite(options: { token: string; isVideo: boolean }): Promise<{ saved: boolean }>;
  compressMediaWrite(options: { token: string }): Promise<{
    path: string;
    webPath: string;
    mimeType: string;
    size: number;
  }>;
  cancelMediaWrite(options: { token: string }): Promise<void>;
}

const EditedMedia = registerPlugin<EditedMediaPlugin>("EditedMedia");

const isIOS = () => Capacitor.getPlatform() === "ios";

export interface NativeMediaFile {
  webPath: string;
  mimeType?: string;
}

/**
 * Teto do lado maior da imagem renderizada pelo caminho 2 (abaixo). O recorte
 * final já é exportado com no máximo 2160px (`MAX_EXPORT` em
 * inline-crop-preview), então acima disso não há ganho visível.
 */
const MAX_SOURCE_EDGE = 2560;

/**
 * URL local do arquivo de um asset da galeria, **sempre na versão editada** —
 * o que o usuário vê no app Fotos. Três caminhos, em ordem de fidelidade:
 *
 * 1. `EditedMedia.getMediaUrl` (plugin nativo) — bytes da versão atual na
 *    resolução original. Só existe em builds feitos depois de 28/07/2026.
 * 2. `PhotoLibrary.getThumbnailUrl` pedindo **as dimensões reais do asset** —
 *    por dentro isso é `PHImageManager.requestImage`, cujo `version` default é
 *    `.current`, ou seja, o render **editado**. É o que conserta o bug mesmo
 *    sem o plugin nativo. `asset.width/height` já são os da versão editada, e
 *    passar essa proporção evita que o `contentMode: .aspectFill` do plugin
 *    recorte a imagem. Vale só para foto: para vídeo esse método devolveria um
 *    frame estático.
 * 3. `PhotoLibrary.getPhotoUrl` — último recurso. Devolve o `PHAssetResource`
 *    `.photo`, que numa foto editada é o **original** (o print inteiro).
 */
export async function getNativeMediaUrl(asset: PhotoLibraryAsset): Promise<NativeMediaFile> {
  if (isIOS()) {
    try {
      const result = await EditedMedia.getMediaUrl({ id: asset.id });
      if (result?.webPath) return { webPath: result.webPath, mimeType: result.mimeType };
    } catch {
      // plugin ausente no build instalado — segue para o caminho 2
    }
  }

  if (asset.type === "image" && asset.width > 0 && asset.height > 0) {
    try {
      const longEdge = Math.max(asset.width, asset.height);
      const ratio = longEdge > MAX_SOURCE_EDGE ? MAX_SOURCE_EDGE / longEdge : 1;
      const rendered = await PhotoLibrary.getThumbnailUrl({
        id: asset.id,
        width: Math.max(1, Math.round(asset.width * ratio)),
        height: Math.max(1, Math.round(asset.height * ratio)),
        quality: 0.92,
      });
      if (rendered?.webPath) {
        return { webPath: rendered.webPath, mimeType: rendered.mimeType || "image/jpeg" };
      }
    } catch {
      // segue para o caminho 3
    }
  }

  const { webPath, mimeType } = await PhotoLibrary.getPhotoUrl({ id: asset.id });
  return { webPath, mimeType };
}

/**
 * Vídeo da galeria já **reduzido para 720p**, para publicar como shot.
 *
 * O caminho normal (`getNativeMediaUrl`) exporta com
 * `AVAssetExportPresetHighestQuality`: mantém o 4K do sensor e produzia shots de
 * ~66MB — 200× uma foto do feed, e o maior custo isolado de Storage do app.
 * 720p é de sobra para vídeo vertical curto visto no celular, e o preset **não
 * amplia** (fonte menor sai igual), então chamar isto nunca piora o arquivo.
 *
 * Degrada em silêncio para o vídeo sem compressão quando:
 *   - a plataforma não é iOS;
 *   - o build instalado é anterior a este método (usuário em versão antiga);
 *   - o codec do asset não aceita o preset, ou a exportação falha.
 *
 * Publicar grande é melhor do que não publicar — por isso nunca lança.
 *
 * ⚠️ É **demorado** (reencoda o vídeo inteiro): quem chama precisa mostrar
 * estado de carregamento, senão a tela parece travada.
 */
export async function getCompressedVideoUrl(asset: PhotoLibraryAsset): Promise<NativeMediaFile> {
  if (isIOS()) {
    try {
      const result = await EditedMedia.compressVideo({ id: asset.id });
      if (result?.webPath) return { webPath: result.webPath, mimeType: result.mimeType };
    } catch {
      // sem o método no build, ou export falhou — segue sem compressão
    }
  }
  return getNativeMediaUrl(asset);
}

/**
 * Descarta cópias em cache anteriores à última edição do asset — inclusive as
 * miniaturas do @capgo, cujo nome de arquivo é só o hash do `localIdentifier`
 * (que não muda quando a foto é editada) e por isso nunca invalidam sozinhas.
 * Deve rodar antes do primeiro `getLibrary` da sessão.
 */
let purged = false;
export async function purgeStaleMediaCache(): Promise<void> {
  if (purged || !isIOS()) return;
  purged = true;
  try {
    await EditedMedia.purgeStaleCache();
  } catch {
    // plugin ausente (build antigo) — segue sem purge
  }
}

/* -------------------------------------------------------------------------- */
/*  Salvar mídia na galeria do celular                                        */
/* -------------------------------------------------------------------------- */

export type SaveMediaFailure =
  /** usuário negou o acesso às Fotos */
  | "permission"
  /** build instalado é anterior ao plugin (ou plataforma sem suporte) */
  | "unsupported"
  | "unknown";

export class SaveMediaError extends Error {
  constructor(
    public readonly reason: SaveMediaFailure,
    message: string,
  ) {
    super(message);
    this.name = "SaveMediaError";
  }
}

/**
 * Tamanho de cada pedaço enviado pela ponte. **Múltiplo de 3** de propósito:
 * cada pedaço é decodificado de base64 isoladamente no lado nativo, então um
 * corte fora do alinhamento de 3 bytes geraria padding no meio do arquivo.
 */
const SAVE_CHUNK_BYTES = 3 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function extensionFor(blob: Blob, kind: "image" | "video"): string {
  const base = (blob.type || "").split(";")[0].trim().toLowerCase();
  return EXT_BY_MIME[base] ?? (kind === "video" ? "mp4" : "jpg");
}

function chunkToBase64(chunk: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler a mídia"));
    reader.readAsDataURL(chunk);
  });
}

/**
 * Salva uma mídia no rolo da câmera (iOS) ou dispara o download (navegador).
 *
 * O arquivo é transferido em pedaços de 3MB porque um vídeo de flow pode ter
 * até 100MB — enviar tudo de uma vez viraria uma string base64 de ~133MB e
 * estouraria a memória do WKWebView.
 *
 * Lança `SaveMediaError` com o motivo, para a tela escolher a mensagem certa.
 */
export async function saveMediaToPhotos(
  blob: Blob,
  kind: "image" | "video",
  fileName = `linka-${Date.now()}`,
): Promise<void> {
  const ext = extensionFor(blob, kind);

  if (!isIOS()) {
    // Navegador (dev): baixa o arquivo em vez de escrever na galeria.
    if (typeof document === "undefined") {
      throw new SaveMediaError("unsupported", "Salvar mídia não é suportado aqui");
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName}.${ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  let token: string;
  try {
    ({ token } = await EditedMedia.startMediaWrite({ ext }));
  } catch (err: any) {
    // Plugin ausente: o build instalado é anterior a esta funcionalidade.
    throw new SaveMediaError(
      err?.code === "UNIMPLEMENTED" ? "unsupported" : "unknown",
      err?.message || "Não foi possível salvar",
    );
  }

  try {
    for (let offset = 0; offset < blob.size; offset += SAVE_CHUNK_BYTES) {
      const data = await chunkToBase64(blob.slice(offset, offset + SAVE_CHUNK_BYTES));
      await EditedMedia.appendMediaWrite({ token, data });
    }
    await EditedMedia.saveMediaWrite({ token, isVideo: kind === "video" });
  } catch (err: any) {
    await EditedMedia.cancelMediaWrite({ token }).catch(() => {});
    throw new SaveMediaError(
      err?.code === "PERMISSION_DENIED" ? "permission" : "unknown",
      err?.message || "Não foi possível salvar",
    );
  }
}

/**
 * Reencoda um vídeo já em memória para **720p**, antes do upload.
 *
 * Complemento do `getCompressedVideoUrl`: aquele parte do `PHAsset` da galeria
 * in-app, este parte de um `Blob`/`File`. É o caminho do vídeo escolhido por
 * `<input type="file">` (shot pelo seletor de arquivos, flow importado da
 * galeria) — ali o WebView entrega os bytes sem nenhuma referência à fototeca,
 * então o AVFoundation não tem em que se apoiar.
 *
 * A solução reaproveita a escrita fatiada que já existia para salvar na
 * galeria: o blob é remontado num arquivo nativo em pedaços de 3MB e o
 * `compressMediaWrite` reencoda esse arquivo. Chunking porque um vídeo de
 * dezenas de MB viraria uma string base64 ~33% maior atravessando a ponte de
 * uma vez — memória que o WKWebView não tem.
 *
 * **Nunca lança e nunca piora**: devolve o blob original se a plataforma não é
 * iOS, se o build não tem o método, se o codec não aceita o preset, ou se o
 * resultado não ficou menor que a entrada.
 *
 * ⚠️ Demorado (reencoda o vídeo inteiro): quem chama precisa de indicador.
 */
export async function compressVideoBlob(blob: Blob): Promise<Blob> {
  if (!isIOS() || blob.size === 0) return blob;

  let token: string;
  try {
    ({ token } = await EditedMedia.startMediaWrite({ ext: extensionFor(blob, "video") }));
  } catch {
    return blob; // plugin ausente no build instalado
  }

  try {
    for (let offset = 0; offset < blob.size; offset += SAVE_CHUNK_BYTES) {
      const data = await chunkToBase64(blob.slice(offset, offset + SAVE_CHUNK_BYTES));
      await EditedMedia.appendMediaWrite({ token, data });
    }
    const { webPath } = await EditedMedia.compressMediaWrite({ token });
    const response = await fetch(webPath);
    const compressed = await response.blob();
    // Vídeo já pequeno/baixa resolução pode sair MAIOR — nesse caso o original vence.
    return compressed.size > 0 && compressed.size < blob.size ? compressed : blob;
  } catch {
    // `compressMediaWrite` já consome a sessão; o cancel só vale quando a
    // falha foi antes dele, e falhar aqui não muda nada.
    await EditedMedia.cancelMediaWrite({ token }).catch(() => {});
    return blob;
  }
}
