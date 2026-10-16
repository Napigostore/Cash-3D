# Cash to Freedom (Dòng Tiền 3D)

A 3D board game about money: earn, spend, invest, and escape the Grind Mill.

- `web/dong-tien-3d.html` – the game (Vietnamese source, single file, Three.js r128).
- `tools/build_web.py` – builds `ios/CashToFreedom/www/{vi,en}.html`. The English build uses an international setting with prices in USD (2,500 VND = $1, so game balance is unchanged). Translations live in `tools/en/`, keyed to `tools/vn_phrases.txt`.
- `ios/` – iOS app (Swift + WKWebView, XcodeGen). Bundle id `com.cashtofreedom.app`.
- `android/` – Android WebView app.
- `docs/` – support and privacy pages (GitHub Pages).
- `sim/` – Node balance simulation.

## Shipping to the App Store (GitHub Actions, `.github/workflows/ios.yml`)

Every push compiles the app on a GitHub Mac. Add a tag to the commit message (or run the workflow by hand) to do more:

| Tag | What it does |
|---|---|
| `[testflight]` | Signs and uploads a build to App Store Connect / TestFlight |
| `[listing]` | Takes screenshots (vi + en) on a 6.9" iPhone simulator and uploads texts + screenshots from `ios/fastlane/metadata` |
| `[submit]` | Attaches the newest processed build and submits for App Review |

Secrets: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`.

After changing the game text, add the new phrases to `tools/en/` (the build lists any untranslated ones).
