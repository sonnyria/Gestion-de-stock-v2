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

Note: Barcode scanning uses the browser's HTML5 Barcode Detection API (`BarcodeDetector`) and falls back to a JavaScript decoder (dynamically loaded ZXing via CDN) when unavailable — no AI model is required for barcode recognition.

## Product stock history

Each product now keeps a timestamped history of its quantity. When you update a product's stock (via + or -), a point is recorded with the timestamp and the new quantity. You can view a graph of the stock history on the product details screen to inspect changes over time.

### Time filter

The graph includes a time filter with these options:
- 7j (7 days)
- 1 m (1 month ~ 30 days)
- 3 m (3 months ~ 90 days)
- 1 a (1 year ~ 365 days)
- Tout (full history)
- Tout (full history)

### Agrégation et affichage

Le graphique propose également une agrégation des données pour lisser ou regrouper les points :
- Aucun : affiche tous les points (raw)
- Journée : moyenne quotidienne
- Mois : moyenne par mois
- Trimestre : moyenne par trimestre (T1..T4)
- Année : moyenne annuelle

L'agrégation calcule la moyenne des valeurs de quantité dans chaque bucket (jour/mois/trimestre/année) et affiche le point moyen pour ce bucket.
Vous pouvez choisir simultanément une période et une agrégation (par ex. 3 mois + Journée) pour mieux analyser les tendances.
