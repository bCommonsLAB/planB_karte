/**
 * Import-Skript für Marker-Daten
 * 
 * Dieses Skript liest die GeoJSON-Daten aus markers.json und importiert sie in die
 * MongoDB-Datenbank in die Collection 'places'.
 */

import * as fs from 'fs';
import * as path from 'path';
import { connectToDatabase, closeDatabaseConnection } from '../lib/mongodb-service';
import { Feature } from 'geojson';

async function importMarkers() {
  try {
    console.log('Starte Import der Marker-Daten in MongoDB...');
    
    // Pfad zur markers.json-Datei
    const filePath = path.join(process.cwd(), 'data/markers.json');
    
    // Datei einlesen
    const fileData = fs.readFileSync(filePath, 'utf8');
    const geojsonData = JSON.parse(fileData);
    
    // Verbindung zur Datenbank herstellen
    const db = await connectToDatabase();
    // Da es sich um ein einmaliges Import-Skript handelt, verwenden wir `any` für die Collection
    const collection = db.collection('places');
    
    // Prüfen, ob die Collection bereits existiert und Daten enthält
    const count = await collection.countDocuments();
    if (count > 0) {
      console.log(`Die Collection 'places' enthält bereits ${count} Dokumente.`);
      const shouldContinue = process.argv.includes('--force');
      
      if (!shouldContinue) {
        console.log('Um bestehende Daten zu überschreiben, starten Sie das Skript mit dem Parameter --force');
        await closeDatabaseConnection();
        return;
      }
      
      console.log('Bestehende Daten werden gelöscht...');
      await collection.deleteMany({});
    }
    
    // Features aus dem GeoJSON extrahieren und in MongoDB importieren
    const features = geojsonData.features as Feature[];
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
    await closeDatabaseConnection();
  }
}

// Skript ausführen
importMarkers()
  .then(() => console.log('Import-Skript beendet.'))
  .catch(err => console.error('Fehler beim Ausführen des Import-Skripts:', err)); 