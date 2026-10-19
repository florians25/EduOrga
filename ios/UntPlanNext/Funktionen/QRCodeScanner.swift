import AVFoundation
import SwiftUI
import UIKit

// QR-Code der Schule scannen (Einrichtung): Die Schule verteilt einen QR-Code mit dem Einrichtungslink
// „untplannext://einrichten?server=plan.meine-schule.de“ bzw. einfach mit ihrer EduOrga-Adresse. Kamera über
// AVFoundation (Erlaubnis: NSCameraUsageDescription in ios/Info.plist).

/// Liest aus dem Inhalt eines QR-Codes (bzw. eines eingefügten Texts) die Adresse der Schule.
enum Einrichtungscode {
    /// „untplannext://einrichten?server=…“, „https://…?server=…“, „https://plan.schule.de/…“ oder „plan.schule.de“.
    static func adresse(aus text: String) -> String? {
        let roh = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !roh.isEmpty, !roh.contains(" ") || roh.hasPrefix("untplannext:") else { return nil }
        if let teile = URLComponents(string: roh) {
            if let server = teile.queryItems?.first(where: { $0.name.lowercased() == "server" })?.value?
                .trimmingCharacters(in: .whitespacesAndNewlines), !server.isEmpty {
                return server
            }
            let schema = (teile.scheme ?? "").lowercased()
            if schema == "http" || schema == "https", let host = teile.host, host.contains(".") {
                var adresse = schema + "://" + host
                if let port = teile.port { adresse += ":\(port)" }
                // Unterpfad behalten (Installation unter /eduorga …), bekannte Seiten der Oberfläche abschneiden
                let pfad = teile.path
                if !pfad.isEmpty, pfad != "/" {
                    let ohne = pfad.components(separatedBy: "/").prefix { !["login", "anmelden", "api", "app", "index.html"].contains($0.lowercased()) }
                    let basis = ohne.joined(separator: "/")
                    if basis.count > 1 { adresse += basis.hasPrefix("/") ? basis : "/" + basis }
                }
                return adresse
            }
            if schema == "untplannext" { return nil }
        }
        // Reine Adresse („plan.meine-schule.de“)
        let klein = roh.lowercased()
        if klein.contains("."), !klein.contains("://"), !klein.contains("@") { return roh }
        return nil
    }
}

/// Blatt mit dem Kamerabild und einem Rahmen; ein erkannter Code schließt das Blatt und übergibt die Adresse.
struct QRCodeScannerBlatt: View {
    let gefunden: (String) -> Void
    @Environment(\.dismiss) private var schliessen
    @State private var erlaubnis: AVAuthorizationStatus = AVCaptureDevice.authorizationStatus(for: .video)
    @State private var hinweis: String? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                switch erlaubnis {
                case .authorized:
                    QRCodeKamera { text in
                        if let adresse = Einrichtungscode.adresse(aus: text) {
                            Haptik.erfolg()
                            gefunden(adresse)
                            schliessen()
                        } else {
                            hinweis = "Dieser QR-Code enthält keine EduOrga-Adresse."
                        }
                    }
                    .ignoresSafeArea()
                    sucher
                case .notDetermined:
                    ProgressView()
                        .tint(.white)
                default:
                    keineErlaubnis
                }
            }
            .navigationTitle("QR-Code scannen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
            }
            .task {
                if erlaubnis == .notDetermined {
                    let ok = await AVCaptureDevice.requestAccess(for: .video)
                    erlaubnis = ok ? .authorized : .denied
                }
            }
        }
    }

    /// Rahmen in der Mitte und Erklärung darunter.
    private var sucher: some View {
        VStack(spacing: 20) {
            Spacer()
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(Color.white.opacity(0.9), lineWidth: 3)
                .frame(width: 240, height: 240)
                .accessibilityHidden(true)
            VStack(spacing: 6) {
                Text("QR-Code Ihrer Schule in den Rahmen halten")
                    .font(.headline)
                Text(hinweis ?? "Den Code finden Sie z. B. im Elternbrief, auf der Website oder im Aushang der Schule.")
                    .font(.subheadline)
                    .opacity(0.85)
            }
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 32)
            Spacer()
            Spacer()
        }
    }

    private var keineErlaubnis: some View {
        VStack(spacing: 14) {
            Image(systemName: "camera.fill")
                .font(.largeTitle)
            Text("Kein Zugriff auf die Kamera")
                .font(.headline)
            Text("Erlauben Sie EduOrga den Zugriff auf die Kamera in den Einstellungen – oder geben Sie die Adresse Ihrer Schule von Hand ein.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .opacity(0.85)
            Button("Einstellungen öffnen") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(Farben.akzent)
        }
        .foregroundStyle(.white)
        .padding(32)
    }
}

/// Kamerabild mit Erkennung von QR-Codes (AVCaptureSession, AVCaptureMetadataOutput).
struct QRCodeKamera: UIViewControllerRepresentable {
    let erkannt: (String) -> Void

    func makeUIViewController(context: Context) -> QRCodeKameraController {
        let c = QRCodeKameraController()
        c.erkannt = erkannt
        return c
    }

    func updateUIViewController(_ uiViewController: QRCodeKameraController, context: Context) {
        uiViewController.erkannt = erkannt
    }
}

final class QRCodeKameraController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var erkannt: ((String) -> Void)? = nil
    private let sitzung = AVCaptureSession()
    private var vorschau: AVCaptureVideoPreviewLayer? = nil
    private var zuletzt: String? = nil

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        guard let geraet = AVCaptureDevice.default(for: .video),
              let eingabe = try? AVCaptureDeviceInput(device: geraet),
              sitzung.canAddInput(eingabe) else { return }
        sitzung.addInput(eingabe)
        let ausgabe = AVCaptureMetadataOutput()
        guard sitzung.canAddOutput(ausgabe) else { return }
        sitzung.addOutput(ausgabe)
        ausgabe.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
        if ausgabe.availableMetadataObjectTypes.contains(.qr) {
            ausgabe.metadataObjectTypes = [.qr]
        }
        let ebene = AVCaptureVideoPreviewLayer(session: sitzung)
        ebene.videoGravity = .resizeAspectFill
        ebene.frame = view.bounds
        view.layer.addSublayer(ebene)
        vorschau = ebene
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        vorschau?.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let s = sitzung
        if !s.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { s.startRunning() }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        let s = sitzung
        if s.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { s.stopRunning() }
        }
    }

    nonisolated func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject],
                                    from connection: AVCaptureConnection) {
        guard let code = metadataObjects.first as? AVMetadataMachineReadableCodeObject, let text = code.stringValue else { return }
        // Der Delegate läuft auf der Hauptwarteschlange (siehe setMetadataObjectsDelegate)
        MainActor.assumeIsolated {
            self.melden(text)
        }
    }

    private func melden(_ text: String) {
        guard text != zuletzt else { return }
        zuletzt = text
        erkannt?(text)
    }
}
