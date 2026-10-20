import SwiftUI

// Liquid Glass (iOS 26) an einer einzigen Stelle: Alle Ansichten benutzen nur die Helfer dieser Datei, nie die
// Glas-APIs direkt. Ab iOS 26 echtes Liquid Glass (`glassEffect`, `GlassEffectContainer`, `glassEffectID`,
// `.buttonStyle(.glass)` / `.glassProminent`, einklappende Tab-Leiste), auf iOS 18 dieselbe Form mit
// `.ultraThinMaterial` bzw. den klassischen Knopfstilen.
//
// Regeln (Human Interface Guidelines): Glas nur auf der Navigations- und Bedienebene, die über dem Inhalt schwebt –
// Tab-Leiste, schwebende Wochenleiste, Bedienknöpfe der Jetzt-Karte, Werkzeugknöpfe, Filterchips, Knöpfe über dem
// Kopf der Stundenansicht. Inhalte (Kacheln, Karten, Listen) bleiben deckend und gut lesbar. Getönt wird nur der
// hervorgehobene Petrol-Knopf.
//
// Übersetzen: Das Projekt braucht das iOS-26-SDK (Xcode 26, Swift 6.2); Zielsystem ist iOS 18.

#if !compiler(>=6.2)
#error("EduOrga braucht Xcode 26 (iOS-26-SDK, Swift 6.2) – Liquid Glass ist sonst nicht verfügbar.")
#endif

// MARK: - Glasfläche

extension View {
    /// Glasfläche in einer Form: ab iOS 26 Liquid Glass (optional getönt, optional interaktiv – reagiert auf Berührung),
    /// sonst `.ultraThinMaterial` mit feinem Rand und weichem Schatten.
    @ViewBuilder
    func glasFlaeche<Umriss: Shape>(_ form: Umriss, ton: Color? = nil, interaktiv: Bool = false) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(Glasstil.glas(ton: ton, interaktiv: interaktiv), in: form)
        } else {
            self
                .background {
                    ZStack {
                        form.fill(.ultraThinMaterial)
                        if let ton { form.fill(ton.opacity(0.85)) }
                    }
                }
                .overlay { form.stroke(Color.primary.opacity(0.08), lineWidth: 0.5) }
                .shadow(color: Color.black.opacity(0.12), radius: 10, x: 0, y: 3)
        }
    }

    /// Kennung für das Verschmelzen und Morphen von Glasflächen innerhalb einer `GlasGruppe` (ab iOS 26).
    @ViewBuilder
    func glasKennung(_ id: String, in raum: Namespace.ID) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffectID(id, in: raum)
        } else {
            self
        }
    }

    /// Knopf aus Glas: ab iOS 26 `.glass` bzw. `.glassProminent` (Petrol), sonst `.bordered` bzw. `.borderedProminent`.
    @ViewBuilder
    func glasKnopf(hervorgehoben: Bool = false) -> some View {
        if #available(iOS 26.0, *) {
            if hervorgehoben {
                self.buttonStyle(.glassProminent)
            } else {
                self.buttonStyle(.glass)
            }
        } else {
            if hervorgehoben {
                self.buttonStyle(.borderedProminent)
            } else {
                self.buttonStyle(.bordered)
            }
        }
    }

    /// Tab-Leiste klappt beim Rollen nach unten ein (ab iOS 26).
    @ViewBuilder
    func tabLeisteEinklappbar() -> some View {
        if #available(iOS 26.0, *) {
            self.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
    }

    /// Weicher Übergang des Inhalts unter schwebenden Leisten (Rollkante, ab iOS 26; davor macht das System das selbst).
    @ViewBuilder
    func weicheRollkante(_ kanten: Edge.Set = .all) -> some View {
        if #available(iOS 26.0, *) {
            self.scrollEdgeEffectStyle(.soft, for: kanten)
        } else {
            self
        }
    }

    /// Hintergrund eines Blatts: ab iOS 26 das Glas des Systems (Blätter mit Höhenstufen bekommen es selbst – kein
    /// eigener Hintergrund), davor die Blattfarbe.
    @ViewBuilder
    func blattHintergrund() -> some View {
        if #available(iOS 26.0, *) {
            self
        } else {
            self.presentationBackground(Farben.blatt)
        }
    }
}

/// Glas-Art zusammensetzen (nur iOS 26).
@available(iOS 26.0, *)
enum Glasstil {
    static func glas(ton: Color?, interaktiv: Bool) -> Glass {
        var g = Glass.regular
        if let ton { g = g.tint(ton) }
        if interaktiv { g = g.interactive() }
        return g
    }
}

// MARK: - Werkzeug mit eigener Glasfläche

extension View {
    /// Lupe als eigenes Werkzeug oben rechts: öffnet die Suche nach Plänen als Blatt (ab iOS 26 mit festem Abstand zu
    /// den übrigen Knöpfen, damit sie eine eigene Glasfläche bekommt). Profil und Einstellungen sind ein eigener Reiter.
    @ViewBuilder
    func suchWerkzeug() -> some View {
        if #available(iOS 26.0, *) {
            self.toolbar {
                ToolbarSpacer(.fixed, placement: .topBarTrailing)
                ToolbarItem(placement: .topBarTrailing) { SuchKnopf() }
            }
        } else {
            self.toolbar {
                ToolbarItem(placement: .topBarTrailing) { SuchKnopf() }
            }
        }
    }
}

// MARK: - Gruppe

/// Gruppe nah beieinander liegender Glasflächen: ab iOS 26 ein `GlassEffectContainer` (Flächen verschmelzen und
/// morphen gemeinsam, das Glas wird nur einmal berechnet), davor ein durchgereichter Inhalt.
struct GlasGruppe<Inhalt: View>: View {
    var abstand: CGFloat = 8
    @ViewBuilder var inhalt: () -> Inhalt

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: abstand) {
                inhalt()
            }
        } else {
            inhalt()
        }
    }
}

// MARK: - Runder Glasknopf

/// Runder Glasknopf mit Symbol (Schließen, Blättern, Menü über dem Kopf der Stundenansicht), Tippfläche 44 pt.
struct GlasSymbol: View {
    let name: String
    var farbe: Color = Farben.text
    var groesse: CGFloat = 40

    var body: some View {
        Image(systemName: name)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(farbe)
            .frame(width: groesse, height: groesse)
            .glasFlaeche(Circle(), interaktiv: true)
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(Circle())
    }
}

// MARK: - Filterchip

/// Filterchip aus Glas (Suche): gewählt Petrol-Glas mit weißer Schrift, sonst klares Glas.
struct GlasChip: View {
    let titel: String
    let gewaehlt: Bool
    let waehlen: () -> Void

    var body: some View {
        Button(action: waehlen) {
            Text(titel)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(gewaehlt ? Farben.aufAkzent : Farben.text)
                .padding(.horizontal, 16)
                .frame(minHeight: 36)
                .glasFlaeche(Capsule(), ton: gewaehlt ? Farben.akzent : nil, interaktiv: true)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(gewaehlt ? .isSelected : [])
    }
}
