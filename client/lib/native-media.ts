import { Capacitor, registerPlugin } from "@capacitor/core";
import { PhotoLibrary } from "@capgo/capacitor-photo-library";

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
 * URL local do arquivo full-res de um asset da galeria, já na versão editada.
 * Cai para o `PhotoLibrary.getPhotoUrl` se o plugin nativo não responder
 * (build antigo sem o plugin, web, ou asset que o iOS não consegue renderizar).
 */
export async function getNativeMediaUrl(assetId: string): Promise<NativeMediaFile> {
  if (isIOS()) {
    try {
      const result = await EditedMedia.getMediaUrl({ id: assetId });
      if (result?.webPath) return { webPath: result.webPath, mimeType: result.mimeType };
    } catch {
      // segue para o fallback abaixo
    }
  }

  const { webPath, mimeType } = await PhotoLibrary.getPhotoUrl({ id: assetId });
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
