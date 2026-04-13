# Besucher-Führungen-Rechner

Ein leichtgewichtiger Webrechner für die Planung von Besucherführungen –
konzeptionell angelehnt an den „Besucher-Budget-Rechner", aber mit Fokus auf
**Führungen** statt auf Besucherzahlen.

## Eingabemaske

1. **Grundeinstellungen**
   - Gruppengröße (Personen pro Führung)
   - Dauer einer Führung in Minuten
   - Auslastungsstufen als Anzahl Führungen pro Tag:
     - **LOW** · Vorbelegung z. B. 2
     - **MEDIUM** · Vorbelegung z. B. 4
     - **HIGH** · Vorbelegung z. B. 6

2. **Musterwoche**
   - Pro Wochentag wird die **Anzahl Führungen** eingegeben
   - Schnellwahl pro Tag (LOW / MED / HIGH) oder als Bulk-Aktion für die Woche
   - Dient im Jahresplanungs-Modus als Vorlage

## Zwei Modi

### Modus 1 – Wochenplanung
Auswertung der Musterwoche:
- Führungen, Besucher, Führungsstunden / Woche
- Auslastungsampel je Tag (LOW / MEDIUM / HIGH / ÜBER HIGH)
- Durchschnittliche Wochenauslastung

### Modus 2 – Jahresplanung
Vollständige Jahresübersicht mit einer Tabelle je Tag:

| Spalte            | Inhalt                                                 |
|-------------------|--------------------------------------------------------|
| Wochentag         | Mo–So                                                  |
| Datum             | TT.MM.JJJJ                                             |
| Ferien/Feiertag   | Automatisch vorbefüllt (bundesweite DE-Feiertage), editierbar |
| Auslastung        | Dropdown: —, LOW, MEDIUM, HIGH, Manuell                |
| Führungen         | Anzahl Führungen (manuell editierbar)                  |
| Mögl. Gäste       | Führungen × Gruppengröße                               |
| MA-Stunden        | Führungen × Dauer                                      |
| Notizen           | Freitext                                               |

Zusätzlich:
- **Jahr** wählbar (2000–2099)
- Button **„Musterwoche auf Jahr anwenden"** überträgt die Musterwoche auf
  jeden passenden Wochentag des ausgewählten Jahres
- Option **„Feiertage als Ruhetage"** setzt an Feiertagen automatisch 0 Führungen
- Jahres-KPIs: Führungen, Gäste, MA-Stunden, Führungstage

## Nutzung

`index.html` im Browser öffnen – keine Build-Tools, kein Server nötig.

## Dateien

- `index.html` – Struktur und Layout
- `styles.css` – Design (Karten, Farbcodes, Jahrestabelle)
- `script.js` – Berechnungen, Feiertagsberechnung, Tabellen-Rendering
