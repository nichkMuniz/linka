import AVFoundation
import Capacitor
import CryptoKit
import Foundation
import Photos
import UniformTypeIdentifiers

/// Exporta a versão **atual (editada)** de um asset da galeria do iOS.
///
/// Por que este plugin existe:
/// o `@capgo/capacitor-photo-library` exporta o arquivo full-res via
/// `PHAssetResource` e escolhe o primeiro recurso que casa com
/// `.photo || .fullSizePhoto || .alternatePhoto`. Edições feitas no app Fotos
/// (recorte, marcação, filtro) são **não destrutivas**: o asset continua com o
/// recurso `.photo` original e ganha um `.fullSizePhoto` com o render editado.
/// Como o `.photo` vem antes na lista, o app acabava exportando o print inteiro
/// em vez do recorte que o usuário vê na galeria.
///
/// Aqui usamos `PHImageManager` com `version = .current`, que sempre devolve o
/// render editado, e uma chave de cache que inclui a data de modificação do
/// asset — o `localIdentifier` **não muda** quando a foto é editada, então
/// cache indexado só por ele nunca invalida.
@objc(EditedMediaPlugin)
public class EditedMediaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EditedMediaPlugin"
    public let jsName = "EditedMedia"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getMediaUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purgeStaleCache", returnType: CAPPluginReturnPromise)
    ]

    private struct ExportedFile {
        let url: URL
        let mimeType: String
    }

    private let queue = DispatchQueue(label: "linka.editedmedia", qos: .userInitiated)
    private let fileManager = FileManager.default

    /// Diretório próprio (não mexe no cache do plugin de galeria).
    /// Só é tocado dentro de `queue`, que é serial.
    private lazy var cacheDirectory: URL = {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first ?? fileManager.temporaryDirectory
        let directory = caches.appendingPathComponent("LinkaEditedMedia", isDirectory: true)
        if !fileManager.fileExists(atPath: directory.path) {
            try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: nil)
        }
        return directory
    }()

    // MARK: - Métodos expostos ao JS

    @objc public func getMediaUrl(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("Parameter 'id' is required")
            return
        }

        queue.async {
            guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
                call.reject("Asset not found")
                return
            }

            // Já exportamos essa versão do asset nesta instalação?
            if let cached = self.cachedFile(for: asset) {
                self.resolve(call, with: cached, asset: asset)
                return
            }

            switch asset.mediaType {
            case .image:
                self.resolve(call, with: self.exportImage(asset), asset: asset)
            case .video:
                self.resolve(call, with: self.exportVideo(asset), asset: asset)
            default:
                call.reject("Unsupported media type")
            }
        }
    }

    /// Remove cópias em cache mais antigas que a última edição do asset —
    /// inclusive as do plugin de galeria, cujo nome de arquivo é o SHA-256 do
    /// `localIdentifier` e portanto sobrevive a qualquer edição.
    @objc public func purgeStaleCache(_ call: CAPPluginCall) {
        let limit = call.getInt("limit") ?? 400
        queue.async {
            let removed = self.purgeStaleEntries(limit: limit)
            call.resolve(["removed": removed])
        }
    }

    // MARK: - Export

    private func exportImage(_ asset: PHAsset) -> ExportedFile? {
        let options = PHImageRequestOptions()
        options.version = .current // ← devolve o render editado, não o original
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        options.isSynchronous = true // seguro: já estamos numa fila de background

        var exported: ExportedFile?

        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, uti, _, _ in
            guard let data = data else { return }

            let (mimeType, ext) = self.typeInfo(forUTI: uti, fallbackMime: "image/jpeg", fallbackExt: "jpg")
            let url = self.cacheURL(for: asset, ext: ext)

            if self.fileManager.fileExists(atPath: url.path) {
                exported = ExportedFile(url: url, mimeType: mimeType)
                return
            }

            do {
                try data.write(to: url, options: .atomic)
                exported = ExportedFile(url: url, mimeType: mimeType)
            } catch {
                CAPLog.print("EditedMedia: failed to write \(url.lastPathComponent): \(error.localizedDescription)")
            }
        }

        return exported
    }

    private func exportVideo(_ asset: PHAsset) -> ExportedFile? {
        let options = PHVideoRequestOptions()
        options.version = .current
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true

        let semaphore = DispatchSemaphore(value: 0)
        var exported: ExportedFile?

        PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, _ in
            defer { semaphore.signal() }

            // Vídeo sem edição: já é um arquivo em disco, basta copiar.
            if let urlAsset = avAsset as? AVURLAsset {
                let ext = urlAsset.url.pathExtension.isEmpty ? "mov" : urlAsset.url.pathExtension
                let url = self.cacheURL(for: asset, ext: ext)
                if !self.fileManager.fileExists(atPath: url.path) {
                    do {
                        try self.fileManager.copyItem(at: urlAsset.url, to: url)
                    } catch {
                        CAPLog.print("EditedMedia: failed to copy video: \(error.localizedDescription)")
                        return
                    }
                }
                exported = ExportedFile(url: url, mimeType: self.mimeType(forExtension: ext))
                return
            }

            // Vídeo aparado/editado: vem como composição, precisa exportar.
            guard let avAsset = avAsset else { return }
            guard let session = AVAssetExportSession(asset: avAsset, presetName: AVAssetExportPresetHighestQuality) else { return }

            let fileType: AVFileType = session.supportedFileTypes.contains(.mp4) ? .mp4 : .mov
            let ext = fileType == .mp4 ? "mp4" : "mov"
            let url = self.cacheURL(for: asset, ext: ext)

            if self.fileManager.fileExists(atPath: url.path) {
                exported = ExportedFile(url: url, mimeType: self.mimeType(forExtension: ext))
                return
            }

            session.outputURL = url
            session.outputFileType = fileType
            session.shouldOptimizeForNetworkUse = true

            let exportSemaphore = DispatchSemaphore(value: 0)
            session.exportAsynchronously { exportSemaphore.signal() }
            exportSemaphore.wait()

            if session.status == .completed {
                exported = ExportedFile(url: url, mimeType: self.mimeType(forExtension: ext))
            } else {
                try? self.fileManager.removeItem(at: url)
                CAPLog.print("EditedMedia: video export failed: \(session.error?.localizedDescription ?? "unknown error")")
            }
        }

        semaphore.wait()
        return exported
    }

    private func resolve(_ call: CAPPluginCall, with file: ExportedFile?, asset: PHAsset) {
        guard let file = file else {
            call.reject("Could not export the current version of this asset")
            return
        }

        let webPath = bridge?.portablePath(fromLocalURL: file.url)?.absoluteString ?? file.url.absoluteString

        call.resolve([
            "path": file.url.path,
            "webPath": webPath,
            "mimeType": file.mimeType,
            "size": fileSize(at: file.url),
            // pixelWidth/pixelHeight já refletem a versão editada — agora batem
            // com os bytes que estamos devolvendo.
            "width": asset.pixelWidth,
            "height": asset.pixelHeight
        ])
    }

    // MARK: - Cache

    private func purgeStaleEntries(limit: Int) -> Int {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first ?? fileManager.temporaryDirectory
        let photoLibraryRoot = caches.appendingPathComponent("CapPhotoLibrary", isDirectory: true)
        let directories = [
            photoLibraryRoot.appendingPathComponent("thumbnails", isDirectory: true),
            photoLibraryRoot.appendingPathComponent("files", isDirectory: true),
            cacheDirectory
        ]

        var entries: [(url: URL, date: Date)] = []
        for directory in directories {
            guard let items = try? fileManager.contentsOfDirectory(
                at: directory,
                includingPropertiesForKeys: [.contentModificationDateKey],
                options: [.skipsHiddenFiles]
            ) else { continue }

            for item in items {
                let values = try? item.resourceValues(forKeys: [.contentModificationDateKey])
                entries.append((item, values?.contentModificationDate ?? Date.distantPast))
            }
        }

        guard !entries.isEmpty else { return 0 }

        // Os candidatos a cache furado são exatamente os assets editados mais
        // recentemente — daí a ordenação por modificationDate.
        let fetchOptions = PHFetchOptions()
        fetchOptions.sortDescriptors = [NSSortDescriptor(key: "modificationDate", ascending: false)]
        fetchOptions.fetchLimit = max(1, limit)

        var removed = 0
        PHAsset.fetchAssets(with: fetchOptions).enumerateObjects { asset, _, _ in
            guard let modified = asset.modificationDate else { return }
            let prefix = self.sha256(asset.localIdentifier)

            for entry in entries where entry.url.lastPathComponent.hasPrefix(prefix) && entry.date < modified {
                try? self.fileManager.removeItem(at: entry.url)
                removed += 1
            }
        }

        return removed
    }

    private func cacheURL(for asset: PHAsset, ext: String) -> URL {
        return cacheDirectory.appendingPathComponent("\(cachePrefix(for: asset))\(ext)")
    }

    /// A extensão do arquivo só é conhecida depois do request (depende do UTI),
    /// então a busca no cache é feita pelo prefixo `<hash>_<modificado>.`.
    private func cachedFile(for asset: PHAsset) -> ExportedFile? {
        let prefix = cachePrefix(for: asset)
        guard let items = try? fileManager.contentsOfDirectory(
            at: cacheDirectory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return nil }

        guard let match = items.first(where: { $0.lastPathComponent.hasPrefix(prefix) }) else { return nil }
        return ExportedFile(url: match, mimeType: mimeType(forExtension: match.pathExtension))
    }

    private func cachePrefix(for asset: PHAsset) -> String {
        let reference = asset.modificationDate ?? asset.creationDate ?? Date(timeIntervalSince1970: 0)
        let stamp = Int(reference.timeIntervalSince1970 * 1000)
        return "\(sha256(asset.localIdentifier))_\(stamp)."
    }

    // MARK: - Helpers

    private func sha256(_ value: String) -> String {
        return SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func typeInfo(forUTI uti: String?, fallbackMime: String, fallbackExt: String) -> (String, String) {
        guard let uti = uti, let type = UTType(uti) else {
            return (fallbackMime, fallbackExt)
        }
        return (type.preferredMIMEType ?? fallbackMime, type.preferredFilenameExtension ?? fallbackExt)
    }

    private func mimeType(forExtension ext: String) -> String {
        guard let type = UTType(filenameExtension: ext), let mime = type.preferredMIMEType else {
            return "application/octet-stream"
        }
        return mime
    }

    private func fileSize(at url: URL) -> Int {
        let attributes = try? fileManager.attributesOfItem(atPath: url.path)
        return (attributes?[.size] as? NSNumber)?.intValue ?? -1
    }
}
