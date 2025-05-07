# PlanB Karte in Next.js verwenden

Diese Anleitung erklärt, wie du die PlanB Karte als Komponente in einer Next.js-Anwendung verwenden kannst.

## Installation

1. Kopiere folgende Dateien in dein Next.js-Projekt:
   - `src/ts/PlanBMap.tsx` → `components/PlanBMap.tsx`
   - `src/ts/query_overpass.ts` → `utils/query_overpass.ts`
   - `src/markers.json` → `data/markers.json` (oder verwende deine eigene GeoJSON-Datei)

2. Installiere die notwendigen Abhängigkeiten:

```bash
npm install maplibre-gl axios osm2geojson-lite @types/geojson
# oder mit yarn
yarn add maplibre-gl axios osm2geojson-lite @types/geojson
```

3. Aktualisiere den Pfad zum Importieren von `query_overpass.ts` in `PlanBMap.tsx`:

```typescript
// Ändere diese Zeile
import { overpassToGeojson } from './query_overpass';
// zu
import { overpassToGeojson } from '../utils/query_overpass';
```

## Verwendung

Da MapLibre GL mit dem Document-Objekt arbeitet, musst du die Komponente dynamisch laden, um serverseitiges Rendering zu vermeiden:

```tsx
// pages/map.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import markersData from '../data/markers.json';

const PlanBMap = dynamic(() => import('../components/PlanBMap'), {
  ssr: false
});

const MapPage = () => {
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <PlanBMap markers={markersData} />
    </div>
  );
};

export default MapPage;
```

## Anpassbare Parameter

Die `PlanBMap`-Komponente akzeptiert folgende Props:

| Parameter | Typ | Standard | Beschreibung |
|-----------|-----|----------|-------------|
| `markers` | `GeoJSON` | *erforderlich* | GeoJSON-Daten mit den Markern |
| `mapStyle` | `string` | MapTiler Basic Style | URL zum MapLibre-Style |
| `mapApiKey` | `string` | Standard MapTiler-Key | API-Schlüssel für den Kartendienst |
| `center` | `LngLatLike` | Brixen-Koordinaten | Startposition der Karte |
| `zoom` | `number` | 13.5 | Startzoomstufe der Karte |
| `categoryColors` | `object` | `{ A: "#FF0000", B: "#00FF00", C: "#0000FF" }` | Farben für die Kategorien |
| `showDrinkingWater` | `boolean` | `true` | Trinkwasserstellen anzeigen |
| `height` | `string` | `'100%'` | Höhe des Kartencontainers |
| `width` | `string` | `'100%'` | Breite des Kartencontainers |

## Beispiel mit angepassten Parametern

```tsx
import React from 'react';
import dynamic from 'next/dynamic';
import customMarkers from '../data/my-markers.json';

const PlanBMap = dynamic(() => import('../components/PlanBMap'), {
  ssr: false
});

// Eigene Farbschemen definieren
const customCategoryColors = {
  A: "#8B0000", // Dunkelrot
  B: "#006400", // Dunkelgrün
  C: "#00008B", // Dunkelblau
};

const CustomMapPage = () => {
  return (
    <div style={{ height: '600px', width: '100%' }}>
      <PlanBMap 
        markers={customMarkers}
        mapStyle="https://api.maptiler.com/maps/streets/style.json"
        center={{ lon: 11.6603, lat: 46.7176 }}
        zoom={14}
        categoryColors={customCategoryColors}
        showDrinkingWater={false}
      />
    </div>
  );
};

export default CustomMapPage;
```

## Eigene GeoJSON-Daten verwenden

Um eigene Daten zu verwenden, erstelle eine GeoJSON-Datei mit der folgenden Struktur:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "Name": "Beispielort",
        "Beschreibung": "Beschreibung des Ortes",
        "Öffnungszeiten": "Mo-Fr 9-18 Uhr",
        "Kategorie": "A"
      },
      "geometry": { 
        "type": "Point", 
        "coordinates": [11.65, 46.70] 
      }
    },
    // weitere Orte...
  ]
}
```

Die `Kategorie`-Eigenschaft muss mit den Schlüsseln in `categoryColors` übereinstimmen.

## Styling

Die Komponente bringt ihre eigenen Styles mit. Wenn du die Darstellung anpassen möchtest, kannst du in deiner CSS/SCSS-Datei folgende Klassen überschreiben:

```css
.filter-group {
  /* Stil für die Kategorie-Filter */
}

.filter-ctrl {
  /* Stil für die Textfilter-Steuerung */
}
```

## Hinweise

- Die Karte benötigt Internetzugang, um die Kartenkacheln von MapTiler zu laden.
- Du kannst die Standardwerte in der Komponente anpassen.
- Stelle sicher, dass dein API-Schlüssel für den Kartendienst gültig ist. 