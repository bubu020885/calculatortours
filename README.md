# Besucher-Führungen-Rechner

Ein Webrechner zur Planung von Besucherführungen – analog zum
Besucher-Budget-Rechner, aber mit Fokus auf **Führungen** statt auf
Besucherzahlen.

## Funktionen

### Eingabemaske (Einstellungen)

- **Jahr** (2000–2099) und **Bundesland** für die Schulferien
- **Gruppengröße** (Personen pro Führung)
- **Dauer je Führung** (Minuten)
- **Auslastungsstufen** – Anzahl Führungen pro Tag:
  - LOW / MEDIUM / HIGH
- **Option**: Feiertage als Ruhetage (0 Führungen)
- **Musterwoche** – 7 Tageskarten mit Anzahl Führungen und
  Schnellwahl LOW / MED / HIGH
- Bulk-Aktionen: „Alle LOW / MEDIUM / HIGH / Zurücksetzen"

### Modus 1 – Wochenauswertung

Summen der Musterwoche:

- Führungen / Woche
- Besucher / Woche (= Führungen × Gruppengröße)
- MA-Stunden (= Führungen × Dauer)
- Ø Auslastung

### Modus 2 – Jahreskalender

Alle 365/366 Tage als durchlaufende Tabelle mit Monatstrennern:

| Spalte | Inhalt |
|---|---|
| Datum | TT.MM.JJJJ |
| Tag | Mo–So |
| Feiertag / Schulferien | automatisch befüllt |
| Auslastung | Dropdown: Keine, LOW, MEDIUM, HIGH, Manuell |
| Führungen | Zahl (manuell überschreibbar) |
| Gäste | Führungen × Gruppengröße |
| MA-Std. | Führungen × Dauer |
| Notizen | Freitext |

Farbcodierung der Zeilen:

- **Wochenende** – orange
- **Feiertag** – rot
- **Schulferien** – gelb
- Feiertag + Schulferien – rot/gelb geteilt

Aktionen:

- „Jahreskalender generieren" – lädt Feiertage + Schulferien, baut die Tabelle
- „Musterwoche erneut anwenden" – überträgt die Musterwoche auf das Jahr
- „Jahr zurücksetzen" – setzt alle Tageswerte auf 0

### Feiertage & Ferien

- **Feiertage**: bundesweit, lokal berechnet (Gauss'sche Osterformel)
- **Schulferien** (API, je Bundesland):
  1. Primär: [openholidaysapi.org](https://openholidaysapi.org)
  2. Fallback: [ferien-api.de](https://ferien-api.de)
- Status und Quelle werden unter der Eingabemaske angezeigt

## Nutzung

`index.html` im Browser öffnen – kein Build, kein Server nötig
(Internetverbindung wird für die Ferien-API benötigt).

## Dateien

- `index.html` – Struktur und Layout
- `styles.css` – Design (abgestimmt auf den Besucher-Budget-Rechner)
- `script.js` – Berechnungen, API-Integration, Tabellen-Rendering
