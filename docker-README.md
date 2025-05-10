# Plan B Karte - Docker-Anleitung

Diese Anleitung erklärt, wie die Plan B Karte-Anwendung mit Docker gestartet werden kann.

## Voraussetzungen

- Docker und Docker Compose installiert
- Git-Repository geklont

## Schnellstart

1. Stelle sicher, dass du im Hauptverzeichnis des Projekts bist
2. Führe folgenden Befehl aus, um die Anwendung zu starten:

```bash
docker-compose up -d
```

Die Anwendung ist dann unter http://localhost:3000 erreichbar.

## Detaillierte Schritte

### 1. Umgebungsvariablen konfigurieren

Wenn du spezielle Konfigurationen vornehmen möchtest, kopiere die Beispieldatei:

```bash
cp web/.env.example web/.env
```

Dann kannst du die Werte in der `.env`-Datei anpassen.

### 2. Docker-Container bauen und starten

```bash
# Container bauen (beim ersten Mal oder nach Änderungen nötig)
docker-compose build

# Container starten
docker-compose up -d
```

### 3. Initialisierung der Daten

Die Anwendung wird automatisch die GeoJSON-Daten in die MongoDB-Datenbank importieren, 
wenn keine Daten vorhanden sind. Du kannst den Import-Fortschritt überwachen mit:

```bash
docker-compose logs mongo-init
```

### 4. Anwendung stoppen

```bash
docker-compose down
```

Um auch die persistenten Daten zu löschen:

```bash
docker-compose down -v
```

## Fehlerbehebung

### MongoDB-Verbindungsprobleme

Falls die Anwendung keine Verbindung zur MongoDB herstellen kann, 
überprüfe die MONGODB_URI-Umgebungsvariable im docker-compose.yml.

### Daten importieren

Wenn du eigene Daten importieren möchtest, platziere deine GeoJSON-Datei im 
`web/data/markers.json` und starte den Import-Container neu:

```bash
docker-compose up -d --no-deps --build mongo-init
```

### Logs anzeigen

```bash
# Alle Logs anzeigen
docker-compose logs

# Logs einer bestimmten Komponente anzeigen
docker-compose logs web
docker-compose logs mongodb
```

## Entwicklung mit Docker

Für die Entwicklung mit Hot-Reloading kannst du den folgenden Befehl ausführen:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Produktionsumgebung

Für die Produktionsumgebung solltest du die Ports nicht öffentlich exponieren und
sicherstellen, dass die MongoDB-Datenbank mit Authentifizierung geschützt ist.
Siehe docker-compose.prod.yml für ein Beispiel. 