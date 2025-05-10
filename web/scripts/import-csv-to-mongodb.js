/**
 * Import-Skript für CSV-Daten in MongoDB
 * 
 * Dieses Skript liest CSV-Daten ein und importiert sie in die MongoDB-Datenbank.
 * Es wandelt die flache CSV-Struktur in GeoJSON um und speichert sie in der 'places' Collection.
 * 
 * Verwendung:
 * node import-csv-to-mongodb.js <pfad-zur-csv-datei> [--force]
 * 
 * Der --force Parameter überschreibt bestehende Daten in der Collection.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

// Dotenv explizit laden
dotenv.config();

/**
 * Parst eine CSV-Zeile unter Berücksichtigung von Anführungszeichen
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Prüfen, ob es ein doppeltes Anführungszeichen ist
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // Überspringe das nächste Anführungszeichen
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Füge das letzte Element hinzu
  result.push(current);
  
  return result;
}

/**
 * Konvertiert eine flache CSV-Struktur in GeoJSON-Features
 */
function convertToGeoJSON(csvData) {
  if (!csvData || csvData.length < 2) {
    throw new Error('CSV-Datei enthält nicht genügend Zeilen');
  }
  
  // Extrahiere Header
  const headers = csvData[0];
  
  const features = [];
  
  // Beginne bei Zeile 1 (überspringe Header)
  for (let i = 1; i < csvData.length; i++) {
    const values = csvData[i];
    if (values.length === 0 || (values.length === 1 && !values[0])) {
      // Überspringe leere Zeilen
      continue;
    }
    
    if (values.length !== headers.length) {
      console.warn(`Zeile ${i+1} hat eine ungültige Anzahl an Werten: ${values.length} statt ${headers.length}`);
      continue;
    }
    
    // Erstelle ein Objekt aus Header und Werten
    const item = {};
    for (let j = 0; j < headers.length; j++) {
      item[headers[j]] = values[j];
    }
    
    // Extrahiere die Koordinaten
    const longitude = parseFloat(item.longitude || 0);
    const latitude = parseFloat(item.latitude || 0);
    
    // Erstelle eine Kopie der Properties ohne die Koordinaten
    const { longitude: lon, latitude: lat, _id, ...properties } = item;
    
    // Stelle [NEWLINE] Tags wieder her
    for (const key in properties) {
      if (typeof properties[key] === 'string') {
        properties[key] = properties[key].replace(/\[NEWLINE\]/g, '\n');
      }
    }
    
    // Erstelle ein GeoJSON-Feature
    const feature = {
      type: 'Feature',
      properties: properties,
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    };
    
    // Füge _id hinzu, wenn vorhanden und nicht leer
    if (_id && _id.trim() !== '') {
      feature._id = _id;
    }
    
    features.push(feature);
  }
  
  return features;
}

async function importCSV(filePath, force = false) {
  let client = null;
  
  try {
    console.log('Starte Import der CSV-Daten in MongoDB...');
    
    // Prüfen, ob die Datei existiert
    if (!fs.existsSync(filePath)) {
      console.error(`Datei nicht gefunden: ${filePath}`);
      return;
    }
    
    // Datei einlesen
    const fileData = fs.readFileSync(filePath, 'utf8');
    const rows = fileData.split('\n');
    
    // CSV-Daten parsen
    const csvData = rows.map(parseCSVLine);
    
    // Umwandeln in GeoJSON
    const features = convertToGeoJSON(csvData);
    console.log(`Konvertierte ${features.length} Features aus CSV-Datei.`);
    
    // Datenbankverbindung herstellen
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI ist nicht definiert');
    }
    
    console.log('Versuche, Verbindung zur Datenbank herzustellen...');
    
    client = new MongoClient(uri);
    await client.connect();
    console.log('MongoDB-Verbindung erfolgreich hergestellt');
    
    const db = client.db('planB');
    const collection = db.collection('places');
    
    // Prüfen, ob die Collection bereits existiert und Daten enthält
    const count = await collection.countDocuments();
    if (count > 0) {
      console.log(`Die Collection 'places' enthält bereits ${count} Dokumente.`);
      
      if (!force) {
        console.log('Um bestehende Daten zu überschreiben, starten Sie das Skript mit dem Parameter --force');
        return;
      }
      
      console.log('Bestehende Daten werden gelöscht...');
      await collection.deleteMany({});
    }
    
    console.log(`Importiere ${features.length} Features...`);
    
    // Features importieren
    const result = await collection.insertMany(features);
    
    console.log(`Import abgeschlossen: ${result.insertedCount} Features wurden importiert.`);
    
    // Erstelle einen Index für die geometrischen Daten für effizientere Abfragen
    await collection.createIndex({ geometry: "2dsphere" });
    console.log('Geo-Index wurde erstellt.');
    
  } catch (error) {
    console.error('Fehler beim Importieren der CSV-Daten:', error);
  } finally {
    // Datenbankverbindung schließen
    if (client) {
      await client.close();
      console.log('Datenbankverbindung geschlossen.');
    }
  }
}

// Hauptfunktion
async function main() {
  // Prüfe die Argumente
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Bitte gib den Pfad zur CSV-Datei an.');
    console.log('Verwendung: node import-csv-to-mongodb.js <pfad-zur-csv-datei> [--force]');
    return;
  }
  
  const filePath = args[0];
  const force = args.includes('--force');
  
  await importCSV(filePath, force);
}

// Skript ausführen
main()
  .then(() => console.log('Import-Skript beendet.'))
  .catch(err => console.error('Fehler beim Ausführen des Import-Skripts:', err)); 