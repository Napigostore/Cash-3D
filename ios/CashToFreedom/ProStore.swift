import Foundation
import StoreKit

/// Cash to Freedom PRO: a one-time, non-consumable in-app purchase (StoreKit 2).
/// When App Store Connect does not return the product (not approved yet, agreements pending),
/// `available` stays false and the game hides every PRO offer.
@MainActor
final class ProStore {
    static let productID = "com.cashtofreedom.app.pro"

    private(set) var product: Product?
    private(set) var owned = false
    var onChange: (() -> Void)?
    private var updates: Task<Void, Never>?

    init() {
        // Purchases approved elsewhere (Ask to Buy, another device, refunds) arrive here.
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
        if product == nil {
            product = try? await Product.products(for: [Self.productID]).first
        }
        var has = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.productID == Self.productID, transaction.revocationDate == nil {
                has = true
            }
        }
        owned = has
        onChange?()
    }

    /// Returns an error message for the player, or nil.
    func buy() async -> String? {
        guard let product else { return nil }
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

    /// State sent to the game: window.proUpdate({...}).
    func stateJSON(error: String? = nil) -> String {
        var state: [String: Any] = ["available": product != nil, "owned": owned, "price": product?.displayPrice ?? ""]
        if let error { state["error"] = error }
        let data = (try? JSONSerialization.data(withJSONObject: state)) ?? Data("{}".utf8)
        return String(decoding: data, as: UTF8.self)
    }
}
