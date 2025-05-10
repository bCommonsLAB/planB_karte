# Bereinigung der redundanten Koordinatenfelder

Im ursprünglichen Datenmodell wurden die Koordinaten an zwei Stellen gespeichert:

1. In den Properties als `Koordinate N` und `Koordinate O`
2. Im GeoJSON-Standard `geometry.coordinates` als [Lon, Lat]

Diese Redundanz kann zu Inkonsistenzen führen und erhöht das Datenvolumen unnötig. Daher haben wir beschlossen, die redundanten Felder in den Properties zu entfernen und ausschließlich die GeoJSON-Struktur zu verwenden.

## Änderungen im Code

- Die Verweise auf `Koordinate N` und `Koordinate O` wurden aus dem Code entfernt.
- Der Code verwendet jetzt ausschließlich `geometry.coordinates` für alle Koordinatenbezüge.

## Bereinigung der Datenbank

Zur Bereinigung der Datenbank führe folgende Schritte aus:

1. Öffne die API-Route im Browser: `/api/maintenance/cleanup-coordinates`

Diese API-Route führt eine Datenbankabfrage durch, die alle redundanten Koordinatenfelder in den Properties entfernt.

## Alternativer Ansatz mit MongoDB Shell

Falls du direkten Zugriff auf die MongoDB-Datenbank hast, kannst du auch folgenden Befehl ausführen:

```javascript
db.places.updateMany({}, { 
  $unset: { 
    'properties.Koordinate N': '', 
    'properties.Koordinate O': '' 
  } 
});
```

## Sicherheit

Hinweis: Die `/api/maintenance/cleanup-coordinates`-Route ist nur für einmalige Wartungszwecke gedacht und sollte nach erfolgreicher Ausführung deaktiviert oder entfernt werden.

## Überprüfung

Nach der Bereinigung sollte ein beliebiger Datensatz in der Datenbank keine `Koordinate N` und `Koordinate O` Felder mehr in den Properties enthalten. 