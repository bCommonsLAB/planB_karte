# Mehrsprachigkeit in der Plan B Karte

Diese Dokumentation beschreibt die Implementierung der Mehrsprachigkeit (Deutsch/Italienisch) für Ortseinträge in der Plan B Karte.

## Datenmodell

Jeder Ort enthält nun zusätzlich zu den deutschen Feldern `Name` und `Beschreibung` auch die italienischen Entsprechungen `Nome` und `Descrizione`:

```json
{
  "type": "Feature",
  "properties": {
    "Name": "Haus der Solidarität",
    "Nome": "Casa della Solidarietà",
    "Beschreibung": "Das Besondere am HdS ist, dass...",
    "Descrizione": "La particolarità della CdS è che...",
    // ... weitere Felder
  },
  "geometry": {
    "type": "Point",
    "coordinates": [11.66351, 46.70702]
  }
}
```

## Implementierte Funktionalitäten

1. **Datenmigration**: Bestehende Orte wurden mit leeren italienischen Feldern versehen
2. **API-Erweiterung**: Die API unterstützt die mehrsprachigen Felder beim Abrufen und Speichern
3. **Suchfunktion**: Die Textsuche durchsucht sowohl deutsche als auch italienische Felder

## Anleitung zur Migration

Die Migration bestehender Daten erfolgt über das Skript `migrateToMultilingual.js`:

```bash
# Installation der Abhängigkeiten
npm install dotenv mongodb

# Ausführen des Migrationsskripts
node web/scripts/migrateToMultilingual.js
```

## Testdaten

Zum Testen der Mehrsprachigkeit können Sie das Skript `generateMultilingualExamples.js` verwenden:

```bash
# Erzeugt mehrsprachige Beispieldaten
node web/scripts/generateMultilingualExamples.js > examples.json
```

## Benutzeroberfläche

Die Mehrsprachigkeit sollte in der Benutzeroberfläche wie folgt implementiert werden:

1. **Kartenansicht**: 
   - Anzeigen der Namen in der aktuell ausgewählten Sprache
   - Fallback auf den deutschen Namen, wenn der italienische nicht verfügbar ist

2. **Detailansicht**:
   - Anzeigen aller verfügbaren Sprachversionen oder
   - Umschaltmöglichkeit zwischen den Sprachen

3. **Bearbeitungsformulare**:
   - Eingabefelder für beide Sprachversionen
   - Kennzeichnung der Pflichtfelder (nur die deutschen Felder sind Pflicht)

## Nächste Schritte

1. Frontend-Komponenten anpassen, um mehrsprachige Inhalte zu unterstützen
2. Sprachauswahl-Funktion in der Benutzeroberfläche implementieren
3. Export-Funktionen für die Daten anpassen, um beide Sprachversionen zu berücksichtigen 