package vn.dongtien.game;

import android.app.Activity;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

/**
 * Cash to Freedom PRO on Google Play: subscription "pro" (base plans "monthly", "yearly") and the one-time
 * product "pro_lifetime". Mirrors the iOS ProStore: the game receives window.proUpdate({available, owned, price, plans}).
 * While Play returns no product (not published yet, not installed from Play), available stays false and the game
 * keeps the Prosperity Track open.
 */
class ProBilling {
    static final String SUBS = "pro";
    static final String LIFETIME = "pro_lifetime";

    private final Activity activity;
    private final Consumer<String> send;
    private final BillingClient client;
    private ProductDetails subs, lifetime;
    private boolean owned;

    ProBilling(Activity activity, Consumer<String> send) {
        this.activity = activity;
        this.send = send;
        client = BillingClient.newBuilder(activity)
                .setListener(this::onPurchases)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) refresh();
                else push(null);
            }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    /** Products, then what the player owns, then tell the game. */
    void refresh() {
        query(SUBS, BillingClient.ProductType.SUBS, pd -> {
            subs = pd;
            query(LIFETIME, BillingClient.ProductType.INAPP, pd2 -> {
                lifetime = pd2;
                checkOwned();
            });
        });
    }

    private void query(String id, String type, Consumer<ProductDetails> done) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build()))
                .build();
        client.queryProductDetailsAsync(params, (result, details) -> {
            List<ProductDetails> list = details.getProductDetailsList();
            done.accept(list == null || list.isEmpty() ? null : list.get(0));
        });
    }

    private void checkOwned() {
        owned = false;
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (r1, subsList) -> {
            handle(subsList);
            client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r2, inappList) -> {
                handle(inappList);
                push(null);
            });
        });
    }

    private void handle(List<Purchase> purchases) {
        if (purchases == null) return;
        for (Purchase p : purchases) {
            if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            if (!p.getProducts().contains(SUBS) && !p.getProducts().contains(LIFETIME)) continue;
            owned = true;
            if (!p.isAcknowledged()) {
                client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> { });
            }
        }
    }

    private void onPurchases(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK) {
            handle(purchases);
            push(null);
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            checkOwned();
        } else if (code != BillingClient.BillingResponseCode.USER_CANCELED) {
            push(result.getDebugMessage().isEmpty() ? "Giao dịch không thành công" : result.getDebugMessage());
        }
    }

    /** id: "pro:monthly", "pro:yearly" or "pro_lifetime". */
    void buy(String id) {
        BillingFlowParams.ProductDetailsParams item = null;
        if (id.startsWith(SUBS + ":") && subs != null && subs.getSubscriptionOfferDetails() != null) {
            String plan = id.substring(SUBS.length() + 1);
            for (ProductDetails.SubscriptionOfferDetails offer : subs.getSubscriptionOfferDetails()) {
                if (plan.equals(offer.getBasePlanId()) && offer.getOfferId() == null) {
                    item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(subs).setOfferToken(offer.getOfferToken()).build();
                    break;
                }
            }
        } else if (LIFETIME.equals(id) && lifetime != null) {
            item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(lifetime).build();
        }
        if (item == null) { push("Gói này chưa sẵn sàng trên Google Play"); return; }
        BillingFlowParams.ProductDetailsParams finalItem = item;
        activity.runOnUiThread(() -> client.launchBillingFlow(activity,
                BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(finalItem)).build()));
    }

    void restore() { refresh(); }

    private void push(String error) {
        try {
            JSONArray plans = new JSONArray();
            String first = "";
            if (subs != null && subs.getSubscriptionOfferDetails() != null) {
                List<String[]> found = new ArrayList<>();
                for (ProductDetails.SubscriptionOfferDetails offer : subs.getSubscriptionOfferDetails()) {
                    if (offer.getOfferId() != null) continue; // base plans only, no free-trial offers
                    String price = offer.getPricingPhases().getPricingPhaseList().get(0).getFormattedPrice();
                    String kind = "yearly".equals(offer.getBasePlanId()) ? "year" : "month";
                    found.add(new String[]{SUBS + ":" + offer.getBasePlanId(), kind, price});
                }
                found.sort((a, b) -> a[1].equals("month") ? -1 : b[1].equals("month") ? 1 : 0);
                for (String[] f : found) plans.put(new JSONObject().put("id", f[0]).put("kind", f[1]).put("price", f[2]));
            }
            if (lifetime != null && lifetime.getOneTimePurchaseOfferDetails() != null) {
                plans.put(new JSONObject().put("id", LIFETIME).put("kind", "life").put("price", lifetime.getOneTimePurchaseOfferDetails().getFormattedPrice()));
            }
            if (plans.length() > 0) first = plans.getJSONObject(0).getString("price");
            JSONObject state = new JSONObject().put("available", plans.length() > 0).put("owned", owned).put("price", first).put("plans", plans);
            if (error != null) state.put("error", error);
            send.accept("window.proUpdate&&window.proUpdate(" + state + ")");
        } catch (Exception ignored) { }
    }
}
