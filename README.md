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
npm run dev
```

Die Anwendung ist dann unter http://localhost:3000 erreichbar.

Der Admin-Bereich ist unter http://localhost:3000/admin/places verfügbar.

## Datenstruktur

Die Daten werden als GeoJSON-Features in der MongoDB-Collection `places` gespeichert. Die ursprüngliche Quelle `markers.json` wird nicht mehr verwendet.

## API-Endpunkte

- `GET /api/places` - Gibt alle Orte zurück
- `GET /api/places?category=A` - Filtert Orte nach Kategorie

## Verwaltung über die Admin-Oberfläche

Die Admin-Oberfläche ermöglicht:
- Anzeigen aller Orte
- Filtern nach Kategorien
- Suchen nach Namen

## Entwicklung

- Die Hauptseite mit der Karte befindet sich in `web/pages/index.tsx`
- Die Kartenkomponente ist in `web/components/MapExplorer.tsx` und `web/components/PlanBMap/index.tsx`
- Die MongoDB-Anbindung erfolgt in den API-Endpunkten und Server-Side-Rendering-Funktionen

## Projektstruktur

Das Repository ist in zwei Hauptteile gegliedert:

- `lib/`: Die ursprüngliche Kartenimplementierung mit Parcel-Bundler
- `web/`: Eine Next.js-Anwendung, die die Karte als Komponente verwendet

## Ursprüngliche Kartenanwendung (lib/)

Die ursprüngliche Anwendung ist eine einfache Webseite, die MapLibre GL JS verwendet, um Orte auf einer Karte anzuzeigen.

### Installation

```bash
cd lib
yarn install
```

### Entwicklungsserver starten

```bash
cd lib
yarn start
```

Die Anwendung ist dann unter http://localhost:1234 verfügbar.

### Produktions-Build erstellen

```bash
cd lib
yarn build
```

## Next.js-Anwendung (web/)

Die Next.js-Anwendung demonstriert, wie die Karte als Komponente in einer modernen Webanwendung verwendet werden kann.

### Installation

```bash
cd web
yarn install
```

### Entwicklungsserver starten

```bash
cd web
yarn dev
```

Die Anwendung ist dann unter http://localhost:3000 verfügbar.

### Produktions-Build erstellen

```bash
cd web
yarn build
yarn start
```

## Gemeinsames Git-Repository und Deployment

Beide Anwendungen teilen sich dasselbe Git-Repository. Für das Deployment können sie jedoch separat konfiguriert werden:

1. **GitHub Pages für die ursprüngliche Anwendung:**
   Die ursprüngliche Anwendung kann über den vorhandenen GitHub Action Workflow auf GitHub Pages bereitgestellt werden.

2. **Vercel/Netlify für die Next.js-Anwendung:**
   Die Next.js-Anwendung kann über Dienste wie Vercel oder Netlify bereitgestellt werden, wobei das Stammverzeichnis auf `web/` gesetzt wird.

## Marker anpassen

Die Markerdaten befinden sich in JSON-Dateien:

- Ursprüngliche Anwendung: `lib/src/markers.json`
- Next.js-Anwendung: `web/data/markers.json`

Das Format ist GeoJSON mit zusätzlichen Eigenschaften für jeden Punkt, darunter:
- Name
- Beschreibung
- Kategorie (A, B oder C)
- Koordinaten
- Öffnungszeiten
- Kontaktinformationen

## Lizenz

MIT 