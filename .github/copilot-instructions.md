# Copilot / AI Agent Instructions — GestionStock AI

Important: Read the quick facts below before making code changes.

## Quick start (commands)
- Dev server: `npm install` then `npm run dev` (Vite)
- Build: `npm run build`
- Preview build: `npm run preview`

## Big picture
- This is a small single-page React + Vite app that runs fully in the browser (PWA-ready).
- UI flows and state are handled client-side (no backend). Persistent state is in `localStorage`.
- Main entry point: `App.tsx` — contains top-level state (inventory array & settings) and view routing using the `ViewState` enum from `types.ts`.
- UI components live in `components/`: `Scanner.tsx`, `ProductForm.tsx`, and `StockControl.tsx`.
 - No AI model is required for barcode scanning; barcode detection occurs locally using the browser's `BarcodeDetector` with a ZXing fallback (`services/barcodeService.ts`).
- PWA files: `manifest.json` and `sw.js` (service worker caches CDN and app files). `index.html` uses an importmap for AI Studio / CDN usage.

## Key files to reference (examples)
 - `App.tsx` — local state + localStorage read/write (`stock_inventory`, `stock_settings`), export/import logic, view handling, backup/restore UI, and settings modal.
 - `services/barcodeService.ts` — implements local barcode reading using `BarcodeDetector`, and falls back to a CDN-delivered ZXing browser build when needed.
- `types.ts` — canonical types (Product, ViewState, ProductEnhancement). Always import and use these for new code.
- `components/Scanner.tsx` — camera handling, device selection saved as `scanner_device_id`, torch support (`track.getCapabilities()`), automatic scanning loop using React `setInterval` and `webcam.getScreenshot()`.
- `sw.js` — service worker caching behavior; note the offline behavior and the `urlsToCache` list (it caches source files & CDNs; during dev you may need to unregister it).

## Local / dev state and testing notes
 - Inventory is saved under `localStorage.stock_inventory`. For tests or to reset app state, clear that key (or all localStorage).
- To test scanning locally (webcam), run the app and open it in a browser with camera access. The scanner saves chosen device id in `localStorage.scanner_device_id`.
- If Scanner errors or a saved device id breaks access, clear `scanner_device_id` (localStorage) or change the camera via the top UI select.

## PWA and cache gotchas
- `sw.js` aggressively caches a few runtime files including TypeScript/TSX sources. During development, unregister or disable the service worker to ensure changes show up immediately.
- `index.html` uses an importmap (AI Studio CDN). In Vite dev, imports are normal ESM. If you see mismatches between the CDN versions and `node_modules`, try:
  - Removing or temporarily commenting the importmap for local dev OR
  - Use the local `node_modules` packages (npm install) and rely on Vite.

  ## Notable mismatches & gotchas
  - The README previously mentioned setting `GEMINI_API_KEY` in `.env.local`, but the application no longer requires that for barcode detection.
   - `sw.js` caches source `.tsx/.ts` files. If changes don't show up, unregister the service worker and clear caches.
   - The gemini-based barcode scanner has been removed — barcode reading is performed locally using `services/barcodeService.ts`.

## Patterns and conventions to follow when coding
 - Use the `types.ts` types for all product-related shapes; keep the `Product` fields consistent (`barcode`, `name`, `quantity`, `lastUpdated`).
- UI uses Tailwind classes (via CDN in `index.html`). Keep the UI consistent with existing utility classes.
- Local state management: components are functional; `App.tsx` owns the inventory and settings. Add new features by adding functions in `App` and passing handlers as props.
 - No Gemini or AI usage for barcode scanning. If any future AI enhancements are added, centralize them into a single service and avoid scattering API clients around components.

## How to add a new feature that uses AI (recommended pattern)
1. Add any new types in `types.ts` and ensure components import those types.
 2. Add client helper in a dedicated `services/` file and encapsulate any external API usage: keep a single getClient() usage for authentication.
3. In your component, call the exported service function and handle possible rejections or null values — UI should fall back gracefully.
4. Store pennies/persistent values in `localStorage` keys that are prefixed with `stock_` if they represent inventory-related configuration.

## Debugging tips (specific to this repo)
 - If a future AI integration fails, verify any needed API key presence (localStorage or env) per the service implementation and show sensible fallback UX.
- If the Scanner shows a black screen or fails to list a camera: check `navigator.mediaDevices.enumerateDevices()` in the browser console and confirm `scanner_device_id` is valid.
- To avoid stale files during debugging, clear browser cache and unregister service worker.
- The dev server is Vite — inspect the console output for module resolution errors.

## Metrics and analytics
- No analytics or backend metrics present in the repository.

## Safety and maintenance notes
 - No server-side secrets are stored in code. The service worker ignores API calls so network requests are not cached for external APIs by default.

## Where to look next / helpful pointers
- `App.tsx` for overall state + localStorage logic
 - `services/barcodeService.ts` for barcode detection and any future AI integration helpers
- `components/Scanner.tsx` for webcam, torch and device selection patterns
- `sw.js` for cache and offline behavior

---
Please let me know if you want these instructions expanded with code examples or unit-test guidelines.