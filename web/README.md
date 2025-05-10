# Plan B Karte - Webapplikation

Diese Webapplikation zeigt Orte in Brixen (Südtirol) auf einer interaktiven Karte an. Die Anwendung basiert auf Next.js und MapLibre GL und ist Teil des Plan B Projekts.

## Funktionalitäten

- Darstellung von Orten auf einer Karte mit unterschiedlichen Markern je nach Kategorie
- Detailansicht von Orten mit wichtigen Informationen
- Bearbeitung und Erstellung neuer Orte
- Filterung nach Kategorien
- Import/Export von Daten im CSV-Format
- Automatische Korrektur fehlerhafter Koordinaten

## Technische Details

### Kernkomponenten

- **MapExplorer**: Die Hauptkomponente, die die Kartenansicht und die Listenansicht enthält
- **PlanBMap**: Die Kartenkomponente, die MapLibre GL integriert
- **PlaceDetail**: Die Detailansicht für Orte mit Bearbeitungsmöglichkeit
- **DebugOverlay**: Ein Overlay für Entwickler, das verschiedene Zustände anzeigt

### Datenstruktur

Die Orte werden als GeoJSON-Features gespeichert und haben folgende Struktur:

```typescript
interface MongoDBFeature extends Feature {
  _id?: string;
  properties: {
    Name: string;
    Beschreibung?: string;
    Adresse?: string;
    Öffnungszeiten?: string;
    Telefonnummer?: string;
    Email?: string;
    Ansprechperson?: string;
    Kategorie?: string;
    Tags?: string;
    // Weitere Eigenschaften...
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}
```

### Koordinatenhandling

Ein wichtiger Aspekt der Anwendung ist das Handling von Koordinaten:

- Die Anwendung korrigiert automatisch falsch formatierte Koordinaten (z.B. 116.566 → 11.6566)
- Orte, die außerhalb eines 10 km Radius um Brixen liegen, werden als fehlerhaft markiert
- Fehlerhafte Marker werden mit einem Warndreieck an einem Referenzpunkt angezeigt

### Zustandsmanagement

Die Anwendung verwendet mehrere Ansätze zur Zustandsverwaltung:

1. **Komponenten-lokaler Zustand**: React useState für komponentenspezifische Daten
2. **Globale Variablen**: Window-Eigenschaften für komponentenübergreifende Kommunikation
3. **Zentrales Zustandsmanagement**: Ein appState-Modul für typisierten globalen Zustand
4. **Custom Hooks**: Spezielle Hooks (useMapInteraction) für domänenspezifische Logik

## Entwicklung

### Voraussetzungen

- Node.js 14+
- npm oder yarn
- MongoDB (für API-Zugriff)

### Installation

```bash
# Installation der Abhängigkeiten
npm install
# oder
yarn install

# Entwicklungsserver starten
npm run dev
# oder
yarn dev
```

### Debugging

Die Anwendung bietet eine Debug-Overlay-Komponente, die im Entwicklungsmodus verfügbar ist und folgende Informationen anzeigt:

- Status des Ortsauswahl-Modus
- Aktuell ausgewählte Koordinaten
- Status des Detail-Dialogs
- Name des ausgewählten Ortes
- Status des Bearbeitungsmodus
- Zoom-Level der Karte

### Bekannte Probleme und Lösungen

1. **Koordinatenprobleme**:
   - Problem: Viele Marker werden nicht korrekt angezeigt wegen falscher Koordinatenformate
   - Lösung: Automatische Korrektur der Koordinaten

2. **Dialog- und Ortsauswahl-Probleme**:
   - Problem: Der Detail-Dialog und der Ortsauswahl-Modus funktionieren nicht zuverlässig
   - Lösung: Zentrale Zustandsverwaltung und bessere Synchronisierung

3. **Debugging-Schwierigkeiten**:
   - Problem: Schwierigkeiten, den Zustand der Anwendung zu überwachen
   - Lösung: Debug-Overlay mit Live-Anzeige des Anwendungszustands

## Projektstruktur

```
web/
├── app/            - Next.js App Router
├── components/     - React-Komponenten
│   ├── PlanBMap/   - Kartenkomponente
│   ├── ui/         - UI-Komponenten
│   └── ...
├── data/           - Statische Daten
├── hooks/          - Custom React Hooks
├── lib/            - Bibliotheken und Utilities
├── public/         - Öffentliche Dateien
├── styles/         - CSS-Dateien
├── types/          - TypeScript-Typdefinitionen
└── utils/          - Hilfsfunktionen
```

## Best Practices

- Verwende die Koordinaten-Utilities für jegliche Koordinatenmanipulation
- Nutze das zentrale Zustandsmanagement für komponentenübergreifende Kommunikation
- Implementiere sinnvolle Fehlerbehandlung für Netzwerkanfragen
- Teste neue Funktionen gründlich mit verschiedenen Daten

## Lizenz

© 2023 Plan B Projekt - Alle Rechte vorbehalten 