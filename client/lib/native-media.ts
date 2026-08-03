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
  purgeStaleCache(options?: { limit?: number }): Promise<{ removed: number }>;
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
