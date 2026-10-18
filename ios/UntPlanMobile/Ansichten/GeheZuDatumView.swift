import SwiftUI

/// „Gehe zu Datum“ als Popover am Menüknopf des Plans: oben links „Heute“, rechts „Auswählen“, darunter der
/// Monatskalender des Systems (Woche ab Montag).
struct GeheZuDatumView: View {
    let start: Date
    let auswaehlen: (Date) -> Void
    @State private var wahl = Date()

    private var kalender: Calendar { Datumsformat.kalender }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Heute") {
                    auswaehlen(Date())
                }
                Spacer(minLength: 20)
                Text("Gehe zu Datum")
                    .font(.headline)
                    .foregroundStyle(Farben.text)
                Spacer(minLength: 20)
                Button("Auswählen") {
                    auswaehlen(wahl)
                }
                .fontWeight(.semibold)
            }
            .foregroundStyle(Farben.akzent)
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 6)
            Divider()
            DatePicker("Datum", selection: $wahl, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
                .tint(Farben.akzent)
                .environment(\.locale, Locale(identifier: "de_DE"))
                .environment(\.calendar, kalender)
                .padding(.horizontal, 8)
                .padding(.bottom, 8)
        }
        .frame(width: 340)
        .background(Farben.blatt)
        .onAppear { wahl = start }
    }
}
