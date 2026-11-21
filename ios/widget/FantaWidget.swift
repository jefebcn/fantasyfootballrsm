import WidgetKit
import SwiftUI

/**
 * Il widget di Fantatitano per la schermata Home (Alex, 15/11).
 *
 * Mostra la prossima giornata: quanto manca alla chiusura delle formazioni
 * e le prime partite. Durante la giornata dice «In campo». Toccandolo si
 * apre l'app sulla formazione (il link di fantatitano.site apre l'app).
 *
 * I dati arrivano da https://fantatitano.site/widget.json, un file pubblico
 * fatto a ogni pubblicazione del sito (scripts/widget-dati.mjs) con lo stesso
 * calendario dell'app: il widget non ha bisogno dell'account. Se la rete
 * manca usa l'ultima copia scaricata.
 *
 * Questo file va nel target «FantaWidget» (Widget Extension) creato in Xcode,
 * copiato al posto di quello che fa Xcode:
 * vedi IOS.md, sezione 13.
 */

// MARK: - Dati

struct Partita: Codable, Hashable { let casa: String; let ospite: String; let quando: Date }
struct Giornata: Codable { let giornata: Int; let chiusura: Date; let partite: [Partita] }
struct DatiWidget: Codable { let giornate: [Giornata] }

enum Fonte {
    static let indirizzo = URL(string: "https://fantatitano.site/widget.json")!
    static let chiave = "fanta.widget.json"

    static func decodifica(_ d: Data) -> DatiWidget? {
        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .custom { decoder in
            let s = try decoder.singleValueContainer().decode(String.self)
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let data = f.date(from: s) { return data }
            f.formatOptions = [.withInternetDateTime]
            if let data = f.date(from: s) { return data }
            throw DecodingError.dataCorruptedError(in: try decoder.singleValueContainer(), debugDescription: s)
        }
        return try? dec.decode(DatiWidget.self, from: d)
    }

    static func carica() async -> DatiWidget? {
        var richiesta = URLRequest(url: indirizzo, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        richiesta.setValue("FantatitanoWidget", forHTTPHeaderField: "User-Agent")
        if let risposta = try? await URLSession.shared.data(for: richiesta),
           (risposta.1 as? HTTPURLResponse)?.statusCode == 200, let dati = decodifica(risposta.0) {
            UserDefaults.standard.set(risposta.0, forKey: chiave)
            return dati
        }
        if let d = UserDefaults.standard.data(forKey: chiave) { return decodifica(d) }
        return nil
    }
}

// MARK: - Cosa mostrare

struct Voce: TimelineEntry {
    let date: Date
    let stato: Stato
    enum Stato {
        case daSchierare(Giornata)   // formazione aperta: conto alla rovescia
        case inCampo(Giornata)       // dopo la chiusura, mentre si gioca
        case vuoto                   // niente dati (prima apertura senza rete)
    }
}

func statoPer(_ dati: DatiWidget?, adesso: Date) -> Voce.Stato {
    guard let g = dati?.giornate.sorted(by: { $0.chiusura < $1.chiusura }) else { return .vuoto }
    // in campo: chiusa, e l'ultima partita non e' finita da piu' di 3 ore
    if let corrente = g.last(where: { $0.chiusura <= adesso }),
       let ultima = corrente.partite.map(\.quando).max(), adesso < ultima.addingTimeInterval(3 * 3600) {
        return .inCampo(corrente)
    }
    if let prossima = g.first(where: { $0.chiusura > adesso }) { return .daSchierare(prossima) }
    return .vuoto
}

struct Fornitore: TimelineProvider {
    func placeholder(in context: Context) -> Voce { Voce(date: .now, stato: .vuoto) }

    func getSnapshot(in context: Context, completion: @escaping (Voce) -> Void) {
        Task { completion(Voce(date: .now, stato: statoPer(await Fonte.carica(), adesso: .now))) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Voce>) -> Void) {
        Task {
            let dati = await Fonte.carica()
            let adesso = Date.now
            let voce = Voce(date: adesso, stato: statoPer(dati, adesso: adesso))
            // si rilegge al prossimo cambio (la chiusura) o comunque fra 3 ore
            var prossimo = adesso.addingTimeInterval(3 * 3600)
            if case .daSchierare(let g) = voce.stato, g.chiusura < prossimo { prossimo = g.chiusura.addingTimeInterval(60) }
            completion(Timeline(entries: [voce], policy: .after(prossimo)))
        }
    }
}

// MARK: - Aspetto

private let viola = Color(red: 75 / 255, green: 6 / 255, blue: 252 / 255)
private let blu = Color(red: 43 / 255, green: 69 / 255, blue: 181 / 255)
private let lime = Color(red: 217 / 255, green: 245 / 255, blue: 31 / 255)

private let giorno: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "it_IT")
    f.timeZone = TimeZone(identifier: "Europe/Rome")
    f.dateFormat = "EEE d/M · HH:mm"
    return f
}()
private let ora: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "it_IT")
    f.timeZone = TimeZone(identifier: "Europe/Rome")
    f.dateFormat = "EEE HH:mm"
    return f
}()

struct Vista: View {
    @Environment(\.widgetFamily) var famiglia
    let voce: Voce

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            sinistra
            if famiglia != .systemSmall, let g = giornataMostrata { partite(g) }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .foregroundStyle(.white)
        .widgetURL(URL(string: collegamento))
        .containerBackground(for: .widget) {
            LinearGradient(colors: [blu, viola], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }

    private var giornataMostrata: Giornata? {
        switch voce.stato {
        case .daSchierare(let g), .inCampo(let g): return g
        case .vuoto: return nil
        }
    }

    private var collegamento: String {
        if case .daSchierare = voce.stato { return "https://fantatitano.site/#/rosa/formazione" }
        return "https://fantatitano.site/#/"
    }

    @ViewBuilder private var sinistra: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("FANTATITANO").font(.system(size: 11, weight: .black)).foregroundStyle(lime)
            switch voce.stato {
            case .daSchierare(let g):
                Text("\(g.giornata)ª giornata").font(.system(size: 15, weight: .bold))
                Text("Formazione entro").font(.system(size: 12)).opacity(0.85)
                Text(g.chiusura, style: .relative)
                    .font(.system(size: 22, weight: .heavy)).monospacedDigit()
                    .minimumScaleFactor(0.6).lineLimit(1)
                Spacer(minLength: 0)
                Text(giorno.string(from: g.chiusura)).font(.system(size: 11, weight: .semibold)).opacity(0.8)
            case .inCampo(let g):
                Text("\(g.giornata)ª giornata").font(.system(size: 15, weight: .bold))
                Text("IN CAMPO").font(.system(size: 22, weight: .heavy)).foregroundStyle(lime)
                Spacer(minLength: 0)
                Text("Segui i voti nell'app").font(.system(size: 11, weight: .semibold)).opacity(0.8)
            case .vuoto:
                Text("Apri l'app").font(.system(size: 15, weight: .bold))
                Spacer(minLength: 0)
                Text("La prossima giornata comparirà qui").font(.system(size: 11)).opacity(0.8)
            }
        }
        .frame(maxWidth: famiglia == .systemSmall ? .infinity : 130, alignment: .leading)
    }

    private func partite(_ g: Giornata) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(g.partite.prefix(4)), id: \.self) { p in
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(p.casa) – \(p.ospite)").font(.system(size: 12, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
                    Text(ora.string(from: p.quando)).font(.system(size: 10)).opacity(0.75)
                }
            }
            if g.partite.count > 4 {
                Text("e altre \(g.partite.count - 4)").font(.system(size: 10, weight: .semibold)).foregroundStyle(lime)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Il widget

struct FantaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FantaWidget", provider: Fornitore()) { voce in
            Vista(voce: voce)
        }
        .configurationDisplayName("Fantatitano")
        .description("Quanto manca alla chiusura della formazione e le partite della giornata.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct FantaWidgetBundle: WidgetBundle {
    var body: some Widget { FantaWidget() }
}
