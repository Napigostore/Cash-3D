package vn.dongtien.game;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.webkit.WebViewAssetLoader;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONObject;

import java.util.concurrent.Executor;

public class MainActivity extends Activity {
    private WebView web;
    private final Executor mainExecutor = r -> new Handler(Looper.getMainLooper()).post(r);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b1424"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // Serve the game from an https origin so Firebase (auth, Firestore) works inside the WebView.
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    /** Called from JavaScript: Android.googleSignIn(webClientId). Result goes back to window.onNativeGoogle(token, error). */
    private class Bridge {
        @JavascriptInterface
        public void googleSignIn(String webClientId) {
            runOnUiThread(() -> signInWithGoogle(webClientId));
        }
    }

    private void signInWithGoogle(String webClientId) {
        GetGoogleIdOption option = new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(webClientId)
                .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager.create(this).getCredentialAsync(this, request, new CancellationSignal(), mainExecutor,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse result) {
                        Credential c = result.getCredential();
                        if (c instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                            GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(((CustomCredential) c).getData());
                            js("window.onNativeGoogle(" + JSONObject.quote(g.getIdToken()) + ")");
                        } else {
                            js("window.onNativeGoogle(null," + JSONObject.quote("Không nhận được tài khoản Google") + ")");
                        }
                    }

                    @Override
                    public void onError(GetCredentialException e) {
                        String msg = e.getMessage() == null ? "Đã hủy" : e.getMessage();
                        js("window.onNativeGoogle(null," + JSONObject.quote(msg) + ")");
                    }
                });
    }

    private void js(String code) {
        web.post(() -> web.evaluateJavascript(code, null));
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){var v=document.getElementById('viewer');if(v&&!v.hidden){v.hidden=true;v.innerHTML='';return 1}return 0})()",
            r -> { if (!"1".equals(r)) MainActivity.super.onBackPressed(); });
    }
}
