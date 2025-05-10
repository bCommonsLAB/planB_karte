# Typdefinitionen für Plan B Karte

In diesem Verzeichnis sind die zentralen Typdefinitionen für das Projekt gespeichert. Dies verhindert Duplizierung und stellt eine einheitliche Typisierung im gesamten Projekt sicher.

## Verfügbare Typen

Die Datei `marker.d.ts` definiert folgende Typen:

- `MarkerDocument`: MongoDB-Dokumenttyp, der ein GeoJSON-Feature erweitert
- `MarkerProperties`: Typisierte Properties für MongoDB-Marker (Name, Beschreibung, etc.)
- `MarkerGeometry`: Geometrie-Typ für Marker (nur Point unterstützt)
- `MarkerCollection`: Feature-Collection von Markern
- `FlatMarkerData`: Flache Datenstruktur für CSV-Import/-Export
- `ImportConfig`: Konfiguration für den Import-Prozess
- `ImportResult`: Ergebnis des Import-Prozesses

## Anwendung in den API-Routen

Um die zentral definierten Typen zu verwenden, müssen folgende Änderungen an den API-Routen vorgenommen werden:

### 1. In `web/app/api/places/route.ts`:

```typescript
// MongoDB-Dokumenttyp, der ein GeoJSON-Feature erweitert
// interface MarkerDocument { ... } <-- Diese lokale Definition entfernen

// Die global definierte MarkerDocument wird automatisch erkannt
```

### 2. In `web/app/api/places/[id]/route.ts`:

```typescript
// MongoDB-Dokumenttyp, der ein GeoJSON-Feature erweitert
// interface MarkerDocument { ... } <-- Diese lokale Definition entfernen

// Die global definierte MarkerDocument wird automatisch erkannt
```

### 3. In `web/app/api/places/import/route.ts`:

```typescript
// Alle lokalen Interface-Definitionen entfernen:
// interface CSVImportData { ... }
// interface MarkerDocument { ... }
// interface ImportConfig { ... }
// interface ImportResult { ... }

// In der Funktion den Parameternamen anpassen:
function convertToGeoJSON(data: FlatMarkerData[]): Feature[] {
  // ...
}
```

## Vorteile der zentralen Typdefinitionen

1. **DRY-Prinzip**: Keine Duplizierung von Typdefinitionen
2. **Konsistenz**: Einheitliche Typdefinitionen im gesamten Projekt
3. **Wartbarkeit**: Änderungen an den Typdefinitionen müssen nur an einer Stelle vorgenommen werden
4. **Typsicherheit**: Bessere Typüberprüfung durch TypeScript 