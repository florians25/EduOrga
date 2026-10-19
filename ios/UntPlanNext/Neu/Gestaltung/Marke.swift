import SwiftUI

// Marke EduOrga (design/MARKE.md): Produktname, Slogan, Monogramm (design/logo/edo-monogramm.svg) und Wortmarke
// („Edu“ halbfett, „Orga“ normal). Technische Kennungen (Bundle-ID, URL-Schema, Ziel UntPlanNext) bleiben unverändert.

enum Marke {
    static let name = "EduOrga"
    static let slogan = "Einfach mehr Schulalltag."
    /// Rechtlicher Hinweis (Über-Dialoge, README)
    static let hinweis = "EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz selbst verantwortlich."
    /// Primärfarbe der Marke, unabhängig vom Erscheinungsbild (Logo-Kachel)
    static let petrol = Color(hexWert: 0x164C55)
    /// Helles Petrol-Quadrat des Monogramms
    static let quadrat = Color(hexWert: 0x7FC9C9)
}

/// Das „E“ des Monogramms im 64er-Raster (Pfad M18 14h28v6H24v9h14v6H24v9h22v6H18z), skaliert auf das Rechteck.
struct EdoZeichen: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 64
        let ox = rect.minX + (rect.width - 64 * s) / 2
        let oy = rect.minY + (rect.height - 64 * s) / 2
        let punkte: [(CGFloat, CGFloat)] = [(18, 14), (46, 14), (46, 20), (24, 20), (24, 29), (38, 29), (38, 35), (24, 35),
                                            (24, 44), (46, 44), (46, 50), (18, 50)]
        var p = Path()
        for (i, punkt) in punkte.enumerated() {
            let pt = CGPoint(x: ox + punkt.0 * s, y: oy + punkt.1 * s)
            if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
        }
        p.closeSubpath()
        return p
    }
}

/// Helles Quadrat am mittleren Balken (x 41, y 29, 6 × 6 im 64er-Raster).
struct EdoQuadrat: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 64
        let ox = rect.minX + (rect.width - 64 * s) / 2
        let oy = rect.minY + (rect.height - 64 * s) / 2
        return Path(CGRect(x: ox + 41 * s, y: oy + 29 * s, width: 6 * s, height: 6 * s))
    }
}

/// Monogramm: Petrol-Kachel mit weißem „E“ und hellem Quadrat (abgerundet wie ein App-Symbol).
struct EdoMonogramm: View {
    var groesse: CGFloat = 64

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: groesse * 0.2237, style: .continuous)
                .fill(Marke.petrol)
            EdoZeichen()
                .fill(Color.white)
            EdoQuadrat()
                .fill(Marke.quadrat)
        }
        .frame(width: groesse, height: groesse)
        .accessibilityHidden(true)
    }
}

/// Wortmarke „EduOrga“ – „Edu“ halbfett, „Orga“ normal – in der Text- bzw. Primärfarbe.
struct EdoWortmarke: View {
    var schrift: Font = .largeTitle
    var farbe: Color = Farben.text

    var body: some View {
        (Text("Edu").fontWeight(.semibold) + Text("Orga").fontWeight(.regular))
            .font(schrift)
            .foregroundStyle(farbe)
            .accessibilityLabel(Marke.name)
    }
}
