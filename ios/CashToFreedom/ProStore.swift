import Foundation
import StoreKit

/// Cash to Freedom PRO (StoreKit 2): a monthly and a yearly auto-renewable subscription, and a lifetime unlock.
/// When App Store Connect returns none of them (not approved yet, agreements pending), `available` stays false,
/// the game hides every offer and keeps the Prosperity Track open.
@MainActor
final class ProStore {
    static let monthly = "com.cashtofreedom.app.pro.monthly"
    static let yearly = "com.cashtofreedom.app.pro.yearly"
    static let lifetime = "com.cashtofreedom.app.pro"
    static let all = [monthly, yearly, lifetime]

    private(set) var products: [Product] = []
    private(set) var owned = false
    var onChange: (() -> Void)?
    private var updates: Task<Void, Never>?

    init() {
        // Renewals, refunds, Ask to Buy and purchases on other devices arrive here.
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await transaction.finish()
                    await self?.refresh()
                }
            }
        }
    }

    deinit { updates?.cancel() }

    func refresh() async {
        if products.isEmpty, let found = try? await Product.products(for: Self.all) {
            products = found.sorted { (Self.all.firstIndex(of: $0.id) ?? 9) < (Self.all.firstIndex(of: $1.id) ?? 9) }
        }
        var has = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, Self.all.contains(transaction.productID), transaction.revocationDate == nil {
                has = true
            }
        }
        owned = has
        onChange?()
    }

    /// Returns an error message for the player, or nil.
    func buy(_ id: String) async -> String? {
        guard let product = products.first(where: { $0.id == id }) ?? products.first else { return nil }
        do {
            switch try await product.purchase() {
            case .success(let verification):
                if case .verified(let transaction) = verification {
                    await transaction.finish()
                    await refresh()
                    return nil
                }
                return "Giao dịch không xác minh được."
            case .userCancelled, .pending:
                return nil
            @unknown default:
                return nil
            }
        } catch {
            return error.localizedDescription
        }
    }

    func restore() async -> String? {
        do {
            try await AppStore.sync()
            await refresh()
            return owned ? nil : "Không tìm thấy giao dịch PRO trên Apple ID này."
        } catch {
            return error.localizedDescription
        }
    }

    /// State sent to the game: window.proUpdate({available, owned, price, plans: [{id, kind, price}]}).
    func stateJSON(error: String? = nil) -> String {
        let plans: [[String: String]] = products.map { p in
            let kind = p.id == Self.monthly ? "month" : p.id == Self.yearly ? "year" : "life"
            return ["id": p.id, "kind": kind, "price": p.displayPrice]
        }
        var state: [String: Any] = ["available": !products.isEmpty, "owned": owned, "price": products.first?.displayPrice ?? "", "plans": plans]
        if let error { state["error"] = error }
        let data = (try? JSONSerialization.data(withJSONObject: state)) ?? Data("{}".utf8)
        return String(decoding: data, as: UTF8.self)
    }
}
