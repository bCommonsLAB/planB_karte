/**
 * Import-Skript für Marker-Daten
 * 
 * Dieses Skript liest die GeoJSON-Daten aus markers.json und importiert sie in die
 * MongoDB-Datenbank in die Collection 'places'.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

// Dotenv explizit laden
dotenv.config();

async function importMarkers() {
  let client = null;
  
  try {
    console.log('Starte Import der Marker-Daten in MongoDB...');
    console.log('Prüfe Umgebungsvariablen:');
    console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'Vorhanden' : 'Fehlt');
    console.log('- MONGODB_DATABASE_NAME:', process.env.MONGODB_DATABASE_NAME ? 'Vorhanden' : 'Fehlt');
    console.log('- MONGODB_COLLECTION_NAME:', process.env.MONGODB_COLLECTION_NAME ? 'Vorhanden' : 'Fehlt');
    
    // Pfad zur markers.json-Datei
    const filePath = path.join(process.cwd(), 'data/markers.json');
    
    // Prüfen, ob die Datei existiert
    if (!fs.existsSync(filePath)) {
      console.error(`Datei nicht gefunden: ${filePath}`);
      console.log('Aktuelles Verzeichnis:', process.cwd());
      console.log('Verzeichnisinhalt:');
      fs.readdirSync(process.cwd()).forEach(file => {
        console.log('- ' + file);
      });
      return;
    }
    
    // Datei einlesen
    const fileData = fs.readFileSync(filePath, 'utf8');
    const geojsonData = JSON.parse(fileData);
    
    // Datenbankverbindung herstellen
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI ist nicht definiert');
    }
    
    console.log('Versuche, Verbindung zur Datenbank herzustellen...');
    
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 75000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      retryReads: true
    });
    
    await client.connect();
    console.log('MongoDB-Verbindung erfolgreich hergestellt');
    
    // Korrigiere Datenbankname auf 'planB', da dieser bereits existiert
    const dbName = 'planB'; // Feste Schreibweise, um das Problem zu umgehen
    
    const db = client.db(dbName);
    console.log(`Verbunden mit Datenbank: ${dbName}`);
    
    // Collection abrufen
    const collection = db.collection('places');
    
    // Prüfen, ob die Collection bereits existiert und Daten enthält
    const count = await collection.countDocuments();
    if (count > 0) {
      console.log(`Die Collection 'places' enthält bereits ${count} Dokumente.`);
      const shouldContinue = process.argv.includes('--force');
      
      if (!shouldContinue) {
        console.log('Um bestehende Daten zu überschreiben, starten Sie das Skript mit dem Parameter --force');
        return;
      }
      
      console.log('Bestehende Daten werden gelöscht...');
      await collection.deleteMany({});
    }
    
    // Features aus dem GeoJSON extrahieren und in MongoDB importieren
    const features = geojsonData.features;
    console.log(`Importiere ${features.length} Marker...`);
    
    // Features direkt importieren
    const result = await collection.insertMany(features);
    
    console.log(`Import abgeschlossen: ${result.insertedCount} Marker wurden importiert.`);
    
    // Erstelle einen Index für die geometrischen Daten für effizientere Abfragen
    await collection.createIndex({ geometry: "2dsphere" });
    console.log('Geo-Index wurde erstellt.');
    
  } catch (error) {
    console.error('Fehler beim Importieren der Marker:', error);
  } finally {
    // Datenbankverbindung schließen
    if (client) {
      await client.close();
      console.log('Datenbankverbindung geschlossen.');
    }
  }
}

// Skript ausführen
importMarkers()
  .then(() => console.log('Import-Skript beendet.'))
  .catch(err => console.error('Fehler beim Ausführen des Import-Skripts:', err)); 