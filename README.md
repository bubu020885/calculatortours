# Besucher-Führungen-Rechner

Ein leichtgewichtiger Webrechner für die Planung von Besucherführungen – konzeptionell
angelehnt an den „Besucher-Budget-Rechner“, aber mit Fokus auf **Führungen** statt
auf Besucherzahlen.

## Konzept

1. **Grundeinstellungen** (Eingabemaske)
   - Gruppengröße (Personen pro Führung)
   - Dauer einer Führung in Minuten
   - Auslastungsstufen als Anzahl Führungen pro Tag:
     - **LOW** · Vorbelegung z. B. 2
     - **MEDIUM** · Vorbelegung z. B. 4
     - **HIGH** · Vorbelegung z. B. 6

2. **Wochenplanung**
   - Pro Wochentag wird die **Anzahl Führungen** eingegeben
   - Schnellwahl pro Tag (LOW / MED / HIGH) oder als Bulk-Aktion für die ganze Woche

3. **Auswertung**
   - Summen: Führungen, Besucher, Führungsstunden pro Woche
   - Auslastungsampel je Tag (LOW / MEDIUM / HIGH / ÜBER HIGH)
   - Durchschnittliche Wochenauslastung

## Nutzung

Einfach `index.html` im Browser öffnen – keine Build-Tools, kein Server nötig.

## Dateien

- `index.html` – Struktur und Layout
- `styles.css` – Design (Karten, Farbcodes je Auslastungsstufe)
- `script.js` – Berechnungen und Interaktion
