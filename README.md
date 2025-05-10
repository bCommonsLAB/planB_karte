# Plan B Karte mit MongoDB

Diese Anwendung zeigt Orte und Points of Interest auf einer interaktiven Karte. Die Daten werden in einer MongoDB-Datenbank gespeichert.

## Setup

1. Konfiguriere die MongoDB-Verbindung:
   - Erstelle eine `.env`-Datei im `web`-Verzeichnis mit folgenden Inhalten:
     ```
     MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
     MONGODB_DATABASE_NAME=planB
     ```

2. Importiere die Daten in MongoDB:
   ```
   cd web
   node scripts/import-markers.js
   ```

3. Überprüfe die importierten Daten:
   ```
   node scripts/check-markers.js
   ```

## Anwendung starten

```
cd web
npm run dev
```

Die Anwendung ist dann unter http://localhost:3000 erreichbar.

Der Admin-Bereich ist unter http://localhost:3000/admin/places verfügbar.

## Datenstruktur

Die Daten werden als GeoJSON-Features in der MongoDB-Collection `places` gespeichert. Die ursprüngliche Quelle `markers.json` wird nicht mehr verwendet.

## API-Endpunkte

- `GET /api/places` - Gibt alle Orte zurück
- `GET /api/places?category=A` - Filtert Orte nach Kategorie
- `POST /api/places` - Erstellt einen neuen Ort
- `PUT /api/places/:id` - Aktualisiert einen bestehenden Ort
- `DELETE /api/places/:id` - Löscht einen Ort

## Projektstruktur

Das Repository ist in zwei Hauptkomponenten gegliedert:

### Kartenkomponente (`/lib`)

Die Kartenkomponente ist eine eigenständige React-Komponente, die in anderen Anwendungen wiederverwendet werden kann.

- **Technologie:** React, TypeScript, Parcel-Bundler, MapLibre GL JS
- **Hauptdateien:**
  - `src/ts/PlanBMap.tsx` - Die Hauptkomponente für die Kartenanzeige
  - `src/ts/main.ts` - Einstiegspunkt für die Kartenkomponente
  - `src/ts/query_overpass.ts` - Hilfsfunktionen für Overpass-API-Abfragen
  - `src/index.html` - Demo-HTML für die eigenständige Kartenkomponente

Die Komponente kann eigenständig als NPM-Paket genutzt oder direkt in andere Projekte integriert werden.

### Web-Anwendung (`/web`)

Die vollständige Web-Anwendung mit Next.js, die die Kartenkomponente verwendet und erweiterte Funktionen bereitstellt.

- **Technologie:** Next.js, React, TypeScript, MongoDB, Tailwind CSS
- **Hauptkomponenten:**
  - `/components/PlanBMap/index.tsx` - Erweiterte Version der Kartenkomponente
  - `/components/MapExplorer.tsx` - UI-Komponente für die Kartenexploration
  - `/components/PlaceDetail.tsx` - Detailansicht für Orte
  - `/components/DebugOverlay.tsx` - Debugging-Werkzeug

- **Hauptseiten:**
  - `/pages/index.tsx` - Hauptseite mit Karte
  - `/app/api/places/` - API-Endpunkte für Ortsdaten
  - `/app/admin/` - Admin-Bereich für die Datenverwaltung

## Funktionalitäten

### Kartenkomponente (lib)

- Anzeige von Markern aus GeoJSON-Daten
- Kategorisierung von Markern mit verschiedenen Farben
- Filter nach Kategorien
- Marker-Popup mit Detailinformationen
- Integration mit Overpass API für Trinkwasserquellen

### Web-Anwendung (web)

- Erweiterte Kartenkomponente mit zusätzlichen Funktionen
- Detailansicht für Orte mit allen Informationen
- Bearbeitung und Erstellung neuer Orte
- Admin-Bereich zur Datenverwaltung
- API-Endpunkte für den Datenzugriff
- Filtern nach Kategorien
- Export/Import von Daten als CSV
- Koordinatenkorrektur für fehlerhafte Daten
- Responsive Design für verschiedene Geräte

## Koordinatensystem

Die Anwendung verwendet:
- Intern: GeoJSON-Format mit [longitude, latitude] (WGS84)
- In Formularen: [latitude, longitude] für die Benutzereingabe
- Automatische Koordinatenkorrektur für fehlerhafte Daten
- Validierung von Koordinaten im erlaubten Bereich (10km um Brixen)

## Entwicklertools

### Kartenkomponente (lib)

```bash
cd lib
yarn install
yarn start  # Entwicklungsserver auf Port 1234
yarn build  # Produktions-Build
```

### Web-Anwendung (web)

```bash
cd web
yarn install
yarn dev    # Entwicklungsserver auf Port 3000
yarn build  # Produktions-Build
yarn start  # Produktionsserver starten
```

## Docker

Die Web-Anwendung kann mit Docker ausgeführt werden:

```bash
cd web
docker build -t planb-karte .
docker run -p 3000:3000 planb-karte
```

## Lizenz

MIT 