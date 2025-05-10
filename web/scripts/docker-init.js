/**
 * MongoDB-Initialisierungsskript für Docker
 * 
 * Dieses Skript importiert die Marker aus der JSON-Datei in die MongoDB-Datenbank,
 * wenn die MongoDB-Collection noch leer ist.
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Konfigurationen aus Umgebungsvariablen oder Standardwerte
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/planB';
const DATABASE_NAME = process.env.MONGODB_DATABASE_NAME || 'planB';
const COLLECTION_NAME = 'places';

// Pfad zur Marker-Datei
const MARKERS_FILE_PATH = path.join(__dirname, '../data/markers.json');

async function importMarkers() {
  console.log('Starte MongoDB-Initialisierung...');
  
  try {
    // Prüfen, ob die Markerdatei existiert
    if (!fs.existsSync(MARKERS_FILE_PATH)) {
      console.error(`Fehler: Markerdatei nicht gefunden unter ${MARKERS_FILE_PATH}`);
      return;
    }
    
    // Verbindung zur MongoDB herstellen
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('MongoDB-Verbindung hergestellt');
    
    // Datenbank und Collection auswählen
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Prüfen, ob die Collection bereits Daten enthält
    const count = await collection.countDocuments();
    
    if (count > 0) {
      console.log(`Die Collection '${COLLECTION_NAME}' enthält bereits ${count} Dokumente. Import wird übersprungen.`);
      await client.close();
      return;
    }
    
    // Markerdaten aus der JSON-Datei laden
    const markersJson = fs.readFileSync(MARKERS_FILE_PATH, 'utf8');
    const markers = JSON.parse(markersJson);
    
    // GeoJSON-Features extrahieren
    const features = markers.features || [];
    
    if (features.length === 0) {
      console.warn('Keine Marker zum Importieren gefunden');
      await client.close();
      return;
    }
    
    // Features in die Datenbank importieren
    const result = await collection.insertMany(features);
    console.log(`${result.insertedCount} Marker erfolgreich importiert`);
    
    // Erstelle einen geospatial Index für die Koordinaten
    await collection.createIndex({ "geometry.coordinates": "2dsphere" });
    console.log('Geospatial-Index erstellt');
    
    // Verbindung schließen
    await client.close();
    console.log('MongoDB-Verbindung geschlossen');
    
  } catch (error) {
    console.error('Fehler beim Importieren der Marker:', error);
  }
}

// Hauptfunktion ausführen
importMarkers(); 