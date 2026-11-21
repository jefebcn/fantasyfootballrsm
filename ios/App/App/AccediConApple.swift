import UIKit
import Capacitor
import AuthenticationServices
import StoreKit

/**
 * «Accedi con Apple» nativo (Alex, 14/11).
 *
 * L'app è il sito aperto in un guscio: il sito chiede ad Apple il «gettone»
 * firmato (identityToken) tramite questo plugin, e poi lo passa a Supabase
 * con signInWithIdToken (src/apple.js). Il flusso web di Supabase dentro
 * l'app non andrebbe: l'app apre solo fantatitano.site (app-bound domains).
 *
 * Il plugin della community (@capacitor-community/apple-sign-in) vuole
 * Capacitor 7 nel suo Package.swift e non si risolve con il nostro 8: questo
 * fa la stessa cosa in meno righe, senza dipendenze.
 */
class FantaBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AccediConApplePlugin())
        bridge?.registerPluginInstance(FantaNativoPlugin())
    }
}

@objc(AccediConApplePlugin)
public class AccediConApplePlugin: CAPPlugin, CAPBridgedPlugin,
    ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {

    public let identifier = "AccediConApplePlugin"
    public let jsName = "AccediConApple"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "accedi", returnType: CAPPluginReturnPromise)
    ]

    private var chiamata: CAPPluginCall?

    /// { nonce: sha256 esadecimale } -> { identityToken, authorizationCode, user, email, givenName, familyName }
    @objc func accedi(_ call: CAPPluginCall) {
        let richiesta = ASAuthorizationAppleIDProvider().createRequest()
        richiesta.requestedScopes = [.fullName, .email]
        if let nonce = call.getString("nonce"), !nonce.isEmpty { richiesta.nonce = nonce }
        chiamata = call
        DispatchQueue.main.async {
            let controllo = ASAuthorizationController(authorizationRequests: [richiesta])
            controllo.delegate = self
            controllo.presentationContextProvider = self
            controllo.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let finestra = bridge?.webView?.window { return finestra }
        let scena = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        return scena?.windows.first(where: { $0.isKeyWindow }) ?? scena?.windows.first ?? UIWindow()
    }

    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = chiamata else { return }
        chiamata = nil
        guard let credenziale = authorization.credential as? ASAuthorizationAppleIDCredential,
              let dati = credenziale.identityToken,
              let token = String(data: dati, encoding: .utf8) else {
            call.reject("Apple non ha restituito il gettone d'accesso.", "NO_TOKEN")
            return
        }
        call.resolve([
            "identityToken": token,
            "authorizationCode": credenziale.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? "",
            "user": credenziale.user,
            // nome ed e-mail arrivano SOLO al primo accesso con Apple: dopo sono vuoti
            "email": credenziale.email ?? "",
            "givenName": credenziale.fullName?.givenName ?? "",
            "familyName": credenziale.fullName?.familyName ?? ""
        ])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = chiamata else { return }
        chiamata = nil
        let annullato = (error as? ASAuthorizationError)?.code == .canceled
        call.reject(annullato ? "Annullato." : error.localizedDescription, annullato ? "CANCELED" : "FAILED")
    }
}

/**
 * Le piccole cose da app vera (Alex, 15/11): la vibrazione quando si conferma
 * la formazione o arriva un ordine, e la richiesta di recensione dell'App
 * Store al momento giusto (src/nativo.js decide quando; iOS decide se
 * mostrarla davvero, al massimo tre volte l'anno).
 */
@objc(FantaNativoPlugin)
public class FantaNativoPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FantaNativoPlugin"
    public let jsName = "FantaNativo"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "vibra", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recensione", returnType: CAPPluginReturnPromise)
    ]

    /// { tipo: "leggera" | "media" | "successo" | "errore" }
    @objc func vibra(_ call: CAPPluginCall) {
        let tipo = call.getString("tipo") ?? "leggera"
        DispatchQueue.main.async {
            switch tipo {
            case "successo": UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "errore": UINotificationFeedbackGenerator().notificationOccurred(.error)
            case "media": UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
            call.resolve()
        }
    }

    @objc func recensione(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scena = self.bridge?.webView?.window?.windowScene
                ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else {
                call.reject("Nessuna finestra attiva.")
                return
            }
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scena)
            } else {
                SKStoreReviewController.requestReview(in: scena)
            }
            call.resolve()
        }
    }
}
