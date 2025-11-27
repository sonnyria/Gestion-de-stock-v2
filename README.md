<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1vw-ZsxB_qxKZRDpxeHTZYWjSbUNV2oXS

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. (Optional) If you plan to use an external AI service for product suggestions in future, set an API key in [.env.local](.env.local) or via your preferred method. The app no longer requires a key for barcode scanning.
3. Run the app:
   `npm run dev`

## Build & Preview (Production)

1. Build the production bundle:
   `npm run build`
2. Preview the built app locally:
   `npm run preview`

Note: The `dist/` folder is now ignored by git (`.gitignore`) and will not be committed. If you are deploying by pushing the `dist/` artifacts to a hosting service, ensure your CI or deployment process handles the build step and publishes the `dist/` output.

Note: Barcode scanning uses the browser's HTML5 Barcode Detection API (`BarcodeDetector`) when available.
On browsers that do not support `BarcodeDetector` (notably iOS Safari/Chrome which use WebKit), the app falls back to a JavaScript decoder (`ZXing`).
To improve compatibility on iOS we now include `@zxing/browser` as a local dependency, and the app will try the local import first (then CDN only if the local import fails).

## Product stock history

Each product now keeps a timestamped history of its quantity. When you update a product's stock (via + or -), a point is recorded with the timestamp and the new quantity. You can view a graph of the stock history on the product details screen to inspect changes over time.

### Time filter

The graph includes a time filter with these options:
- 7j (7 days)
- 1 m (1 month ~ 30 days)
- 3 m (3 months ~ 90 days)
- 1 a (1 year ~ 365 days)
- Tout (full history)
 
Note: Le tooltip indiquera uniquement la valeur numérique du point affiché (moyenne/médiane/max), sans afficher le nombre d'échantillons.

### Agrégation et affichage

Le graphique propose également une agrégation des données pour lisser ou regrouper les points :
- Aucun : affiche tous les points (raw)
- Journée : valeur maximale journalière (Base: max/jour)
- Mois : moyenne par mois
- Trimestre : moyenne par trimestre (T1..T4)
- Année : moyenne annuelle

L'agrégation calcule la valeur du bucket selon la méthode choisie (moyenne, médiane, max). Pour l'option Journée, le bucket utilise la valeur maximale enregistrée pendant la journée.
Vous pouvez choisir simultanément une période et une agrégation (par ex. 3 mois + Journée) pour mieux analyser les tendances.

Note: Lorsque vous utilisez une agrégation (ex: Journée), si aucun changement n'a eu lieu pendant une journée, la valeur affichée pour ce jour sera reportée depuis la journée précédente (carry-forward). Cela garantit que le niveau de stock apparent reste logique si aucun mouvement n'a été enregistré pour un produit sur une journée donnée.

## Developer notes & debugging (quick start)

If you need to debug scanner issues or modify behavior quickly, follow these steps:

1. Run the dev server with debug logs enabled:

   ```bash
   npm install
   npm run dev
   ```

   - Dev builds enable debug logs for `services/logger.ts` since `import.meta.env.DEV` will be `true`.

2. Clear the service worker & localStorage if you encounter stale behavior:

   - Unregister the service worker via DevTools > Application > Service Workers.
   - Clear localStorage keys used by the app: `stock_inventory`, `stock_settings`, `scanner_device_id`.

3. Diagnostic tools & data collection:

   - The scanner overlay includes a diagnostics exporter — use it (dev only) to collect a JSON file containing:
     - User agent
     - Whether `BarcodeDetector` was available
     - Whether ZXing import succeeded
     - The selected device id
     - How many attempts were made and the most recent detection result

4. If the scanner is failing on iOS (WebKit):
   - Confirm that `BarcodeDetector` is not available (Safari/Chrome on iOS won't support it).
   - Check that ZXing fallback is available (we prefer local `@zxing/browser` import; if the local import fails, the app falls back to a CDN import).
   - On iOS, ZXing can be slower; consider lowering canvas resolution (see `components/Scanner.tsx` videoConstraints) to improve performance.

5. Fast recovery steps for field support:

   - Force-stop the scanner UI, clear `scanner_device_id` and let the user reselect a camera.
   - Use the Export Diagnostics button (Dev only) and attach the resulting JSON for follow-up.

6. CI & Deployment:

   - The repo uses a GitHub Actions workflow that deploys to GitHub Pages (peaceiris/actions-gh-pages). The build step runs `npm run build`.
   - If the service worker is causing stale behavior in preview/production, unregister the worker and re-build after updates.

7. Adding / removing debug log statements

   - Use `services/logger.ts` as your single logging interface in code. `logger.debug` only prints in dev mode; `logger.info` prints in dev too; `logger.warn/error` always print.
   - Add logs using these helpers to keep production console clean from debug noise.

8. Local testing tips for camera/scanner issues:

   - Test with a desktop camera or a known barcode image first (works in the browser).
   - Confirm device permissions in browser settings and try switching the `scanner_device_id`.
   - Clear localStorage `scanner_device_id` if the saved id is no longer valid.

If you want, I can add an explicit 'Force close' button on the scanner overlay to ensure the scanner unmounts and resets readers immediately.
