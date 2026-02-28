# Tosun Bau – Anwesenheit & Zahlungen (PWA, lokal)

## Installation auf iPhone/iPad (ohne App Store)
1) Lade diesen Ordner auf **einen HTTPS-Webspace** (z.B. deine Website).
2) Öffne die URL in **Safari**.
3) Teilen → **Zum Home-Bildschirm**.

Die Daten werden **lokal auf dem Gerät** gespeichert (IndexedDB).

## Testen am PC
Im Projektordner:
```bash
python -m http.server 8000
```
Dann im Browser öffnen: http://localhost:8000

> Offline-Modus (Service Worker) funktioniert auf iPhone/iPad zuverlässig nur über HTTPS.
