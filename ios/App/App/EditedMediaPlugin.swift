import AVFoundation
import Capacitor
import CryptoKit
import Foundation
import Photos
import UniformTypeIdentifiers

/// Ponte com a galeria de fotos do iOS. Faz duas coisas:
///
/// 1. **Ler** — exporta a versão **atual (editada)** de um asset (ver abaixo).
/// 2. **Escrever** — salva uma mídia nova no rolo da câmera em pedaços
///    (`startMediaWrite` → `appendMediaWrite`* → `saveMediaWrite`), usado pelo
///    "salvar rascunho" do flow. A escrita é fatiada porque um vídeo de até
///    100MB viraria uma string base64 de ~133MB se atravessasse a ponte de uma
///    vez só — memória que o WKWebView não tem para dar.
///
/// Por que a parte de leitura existe:
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
        CAPPluginMethod(name: "compressVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purgeStaleCache", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startMediaWrite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appendMediaWrite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveMediaWrite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "compressMediaWrite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelMediaWrite", returnType: CAPPluginReturnPromise)
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

    /// Diretório de staging das mídias que estão sendo escritas para a galeria.
    /// Separado do cache de leitura para o purge nunca esbarrar nele.
    private lazy var outgoingDirectory: URL = {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first ?? fileManager.temporaryDirectory
        let directory = caches.appendingPathComponent("LinkaMediaSave", isDirectory: true)
        if !fileManager.fileExists(atPath: directory.path) {
            try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: nil)
        }
        return directory
    }()

    /// Sessões de escrita em andamento, por token. Só é tocado dentro de
    /// `queue`, que é serial — daí não precisar de lock.
    private var writeSessions: [String: URL] = [:]

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

    /// Exporta um vídeo da galeria **reduzido para 720p**, para publicação.
    ///
    /// Por que existe, separado do `getMediaUrl`: aquele exporta com
    /// `AVAssetExportPresetHighestQuality`, ou seja, mantém 4K/60fps do sensor.
    /// Um shot publicado assim chegava a ~66MB — 200× uma foto do feed, e o
    /// maior custo isolado de Storage do app. Aqui o preset encaixa o vídeo na
    /// caixa 1280x720, que é de sobra para um vídeo vertical curto visto no
    /// celular.
    ///
    /// O preset **não amplia**: fonte menor que 720p sai do mesmo tamanho, então
    /// chamar isto nunca piora o arquivo.
    ///
    /// Cache próprio (prefixo `c720_`), porque o mesmo asset pode ter as duas
    /// cópias em disco — a original exportada e a comprimida.
    @objc public func compressVideo(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("Parameter 'id' is required")
            return
        }

        queue.async {
            guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
                call.reject("Asset not found")
                return
            }
            guard asset.mediaType == .video else {
                call.reject("Asset is not a video")
                return
            }

            if let cached = self.cachedCompressedFile(for: asset) {
                self.resolveCompressed(call, with: cached)
                return
            }

            guard let file = self.exportCompressedVideo(asset) else {
                // Quem chama cai no caminho normal (sem compressão) — publicar
                // grande é melhor que não publicar.
                call.reject("Could not compress this video")
                return
            }
            self.resolveCompressed(call, with: file)
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

    // MARK: - Escrita na galeria (salvar rascunho do flow)

    /// Abre um arquivo de staging vazio e devolve o token que identifica a sessão.
    @objc public func startMediaWrite(_ call: CAPPluginCall) {
        // Só letras/números: o valor vem do JS e vira nome de arquivo.
        let raw = call.getString("ext") ?? "jpg"
        let ext = String(raw.filter { $0.isLetter || $0.isNumber }).lowercased()
        let safeExt = ext.isEmpty ? "jpg" : ext

        queue.async {
            let token = UUID().uuidString
            let url = self.outgoingDirectory.appendingPathComponent("\(token).\(safeExt)")
            guard self.fileManager.createFile(atPath: url.path, contents: nil) else {
                call.reject("Não foi possível preparar o arquivo", "WRITE_FAILED")
                return
            }
            self.writeSessions[token] = url
            call.resolve(["token": token])
        }
    }

    /// Anexa um pedaço (base64) ao arquivo da sessão.
    @objc public func appendMediaWrite(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let chunk = call.getString("data") else {
            call.reject("Parâmetros 'token' e 'data' são obrigatórios")
            return
        }

        queue.async {
            guard let url = self.writeSessions[token] else {
                call.reject("Sessão de escrita inválida", "WRITE_FAILED")
                return
            }
            guard let data = Data(base64Encoded: chunk) else {
                call.reject("Pedaço inválido", "WRITE_FAILED")
                return
            }
            do {
                let handle = try FileHandle(forWritingTo: url)
                defer { try? handle.close() }
                _ = try handle.seekToEnd()
                try handle.write(contentsOf: data)
                call.resolve()
            } catch {
                call.reject("Falha ao gravar a mídia: \(error.localizedDescription)", "WRITE_FAILED")
            }
        }
    }

    /// Fecha a sessão e move o arquivo para o rolo da câmera.
    @objc public func saveMediaWrite(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.reject("Parâmetro 'token' é obrigatório")
            return
        }
        let isVideo = call.getBool("isVideo") ?? false

        queue.async {
            guard let url = self.writeSessions.removeValue(forKey: token) else {
                call.reject("Sessão de escrita inválida", "WRITE_FAILED")
                return
            }

            // `.addOnly` pede só permissão de ESCRITA (NSPhotoLibraryAddUsageDescription),
            // sem exigir acesso de leitura à galeria inteira.
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
                guard status == .authorized || status == .limited else {
                    try? self.fileManager.removeItem(at: url)
                    call.reject("Acesso às Fotos negado", "PERMISSION_DENIED")
                    return
                }

                let resourceType: PHAssetResourceType = isVideo ? .video : .photo
                PHPhotoLibrary.shared().performChanges({
                    let request = PHAssetCreationRequest.forAsset()
                    let options = PHAssetResourceCreationOptions()
                    options.shouldMoveFile = true
                    request.addResource(with: resourceType, fileURL: url, options: options)
                }, completionHandler: { success, error in
                    // `shouldMoveFile` costuma consumir o arquivo; o remove é a
                    // rede de segurança para quando a criação falha no meio.
                    try? self.fileManager.removeItem(at: url)
                    if success {
                        call.resolve(["saved": true])
                    } else {
                        call.reject(error?.localizedDescription ?? "Falha ao salvar na galeria", "WRITE_FAILED")
                    }
                })
            }
        }
    }

    /// Fecha a sessão e devolve o vídeo **reencodado em 720p**, sem passar pela
    /// galeria.
    ///
    /// É o caminho do vídeo escolhido por `<input type="file">`: ali o JS recebe
    /// um `File` do WebView, **sem `PHAsset`** — o `compressVideo` acima não tem
    /// o que buscar na fototeca. Aqui o arquivo é remontado em disco pelos
    /// `appendMediaWrite` e o AVFoundation trabalha em cima desse arquivo.
    ///
    /// Terceiro final possível de uma sessão de escrita, ao lado de
    /// `saveMediaWrite` (vai para a galeria) e `cancelMediaWrite` (descarta).
    @objc public func compressMediaWrite(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.reject("Parâmetro 'token' é obrigatório")
            return
        }

        queue.async {
            guard let source = self.writeSessions.removeValue(forKey: token) else {
                call.reject("Sessão de escrita inválida", "WRITE_FAILED")
                return
            }
            // O arquivo remontado só serve de entrada — sai daqui de qualquer jeito.
            defer { try? self.fileManager.removeItem(at: source) }

            self.purgeOutgoingLeftovers()

            let asset = AVURLAsset(url: source)
            let presetName = AVAssetExportPreset1280x720
            guard AVAssetExportSession.exportPresets(compatibleWith: asset).contains(presetName),
                  let session = AVAssetExportSession(asset: asset, presetName: presetName) else {
                call.reject("Formato de vídeo não suportado para compressão", "UNSUPPORTED_MEDIA")
                return
            }

            let fileType: AVFileType = session.supportedFileTypes.contains(.mp4) ? .mp4 : .mov
            let ext = fileType == .mp4 ? "mp4" : "mov"
            let output = self.outgoingDirectory.appendingPathComponent("\(token)-720.\(ext)")
            // O AVAssetExportSession falha se o destino já existir.
            try? self.fileManager.removeItem(at: output)

            session.outputURL = output
            session.outputFileType = fileType
            session.shouldOptimizeForNetworkUse = true

            let semaphore = DispatchSemaphore(value: 0)
            session.exportAsynchronously { semaphore.signal() }
            semaphore.wait()

            guard session.status == .completed else {
                try? self.fileManager.removeItem(at: output)
                call.reject(
                    session.error?.localizedDescription ?? "Falha ao comprimir o vídeo",
                    "COMPRESS_FAILED"
                )
                return
            }

            let webPath = self.bridge?.portablePath(fromLocalURL: output)?.absoluteString ?? output.absoluteString
            call.resolve([
                "path": output.path,
                "webPath": webPath,
                "mimeType": self.mimeType(forExtension: ext),
                "size": self.fileSize(at: output)
            ])
        }
    }

    /// Descarta uma sessão abandonada (o JS chama isto quando desiste no meio).
    @objc public func cancelMediaWrite(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.resolve()
            return
        }
        queue.async {
            if let url = self.writeSessions.removeValue(forKey: token) {
                try? self.fileManager.removeItem(at: url)
            }
            call.resolve()
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

    /// Reexporta o vídeo na caixa 1280x720 (H.264). Mesmo desenho do
    /// `exportVideo` acima — inclusive os dois semáforos, porque tanto o
    /// `requestAVAsset` quanto o `exportAsynchronously` respondem em outra fila
    /// e esta função é chamada de dentro de `queue`, que é serial.
    private func exportCompressedVideo(_ asset: PHAsset) -> ExportedFile? {
        let options = PHVideoRequestOptions()
        options.version = .current
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true

        let semaphore = DispatchSemaphore(value: 0)
        var exported: ExportedFile?

        PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, _ in
            defer { semaphore.signal() }
            guard let avAsset = avAsset else { return }

            let presetName = AVAssetExportPreset1280x720
            // Nem todo asset aceita todo preset (áudio exótico, codec sem
            // suporte). Sem esta checagem o init devolveria nil e a compressão
            // falharia silenciosamente.
            guard AVAssetExportSession.exportPresets(compatibleWith: avAsset).contains(presetName),
                  let session = AVAssetExportSession(asset: avAsset, presetName: presetName) else {
                CAPLog.print("EditedMedia: 720p preset unavailable for this asset")
                return
            }

            let fileType: AVFileType = session.supportedFileTypes.contains(.mp4) ? .mp4 : .mov
            let ext = fileType == .mp4 ? "mp4" : "mov"
            let url = self.compressedCacheURL(for: asset, ext: ext)

            if self.fileManager.fileExists(atPath: url.path) {
                exported = ExportedFile(url: url, mimeType: self.mimeType(forExtension: ext))
                return
            }

            session.outputURL = url
            session.outputFileType = fileType
            // Move o `moov` para o início do arquivo. Sem isso o player só
            // descobre a duração depois de baixar tudo — a mesma dor que o
            // `duration_ms` do flow resolve no lado do banco.
            session.shouldOptimizeForNetworkUse = true

            let exportSemaphore = DispatchSemaphore(value: 0)
            session.exportAsynchronously { exportSemaphore.signal() }
            exportSemaphore.wait()

            if session.status == .completed {
                exported = ExportedFile(url: url, mimeType: self.mimeType(forExtension: ext))
            } else {
                try? self.fileManager.removeItem(at: url)
                CAPLog.print("EditedMedia: video compression failed: \(session.error?.localizedDescription ?? "unknown error")")
            }
        }

        semaphore.wait()
        return exported
    }

    private func resolveCompressed(_ call: CAPPluginCall, with file: ExportedFile) {
        let webPath = bridge?.portablePath(fromLocalURL: file.url)?.absoluteString ?? file.url.absoluteString

        // Sem `width`/`height` de propósito: os de `PHAsset` são os do ORIGINAL
        // e mentiriam sobre o arquivo devolvido. Quem chama não precisa deles.
        call.resolve([
            "path": file.url.path,
            "webPath": webPath,
            "mimeType": file.mimeType,
            "size": fileSize(at: file.url)
        ])
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

    /// Recolhe restos de compressões anteriores no diretório de staging.
    ///
    /// O `compressMediaWrite` deixa o arquivo de saída em disco para o WebView
    /// buscar por `fetch` — ninguém avisa quando essa leitura termina, então a
    /// limpeza é preguiçosa: na próxima compressão, apaga o que tem mais de 1h.
    /// Nunca toca em arquivo de sessão aberta (`queue` é serial, então
    /// `writeSessions` está estável aqui).
    private func purgeOutgoingLeftovers() {
        let active = Set(writeSessions.values.map { $0.path })
        let cutoff = Date().addingTimeInterval(-3600)

        guard let items = try? fileManager.contentsOfDirectory(
            at: outgoingDirectory,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        ) else { return }

        for item in items where !active.contains(item.path) {
            let values = try? item.resourceValues(forKeys: [.contentModificationDateKey])
            guard let date = values?.contentModificationDate, date < cutoff else { continue }
            try? fileManager.removeItem(at: item)
        }
    }

    private func cachePrefix(for asset: PHAsset) -> String {
        let reference = asset.modificationDate ?? asset.creationDate ?? Date(timeIntervalSince1970: 0)
        let stamp = Int(reference.timeIntervalSince1970 * 1000)
        return "\(sha256(asset.localIdentifier))_\(stamp)."
    }

    // MARK: - Cache do vídeo comprimido
    //
    // Mesmo diretório do cache de leitura, de propósito: assim o
    // `purgeStaleEntries` também recolhe estes arquivos. O prefixo `c720_` vem
    // ANTES do hash, então a busca do cache normal (`hasPrefix("<hash>_…")`)
    // nunca casa com um comprimido, e vice-versa.

    private func compressedCachePrefix(for asset: PHAsset) -> String {
        return "c720_\(cachePrefix(for: asset))"
    }

    private func compressedCacheURL(for asset: PHAsset, ext: String) -> URL {
        return cacheDirectory.appendingPathComponent("\(compressedCachePrefix(for: asset))\(ext)")
    }

    private func cachedCompressedFile(for asset: PHAsset) -> ExportedFile? {
        let prefix = compressedCachePrefix(for: asset)
        guard let items = try? fileManager.contentsOfDirectory(
            at: cacheDirectory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return nil }

        guard let match = items.first(where: { $0.lastPathComponent.hasPrefix(prefix) }) else { return nil }
        return ExportedFile(url: match, mimeType: mimeType(forExtension: match.pathExtension))
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
