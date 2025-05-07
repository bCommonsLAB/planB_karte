/**
 * Überprüfungsskript für importierte Marker-Daten
 * 
 * Dieses Skript liest die Daten aus der MongoDB-Collection 'places' und 
 * zeigt Informationen zur Collection sowie einige Beispieldaten an.
 */

import { connectToDatabase, closeDatabaseConnection } from '../lib/mongodb-service';

async function checkMarkers() {
  try {
    console.log('Verbinde zur Datenbank und lese Marker-Daten...');
    
    // Verbindung zur Datenbank herstellen
    const db = await connectToDatabase();
    const collection = db.collection('places');
    
    // Anzahl der Dokumente in der Collection ermitteln
    const count = await collection.countDocuments();
    console.log(`\nDie Collection 'places' enthält ${count} Dokumente.\n`);
    
    if (count === 0) {
      console.log('Die Collection ist leer. Bitte führen Sie zuerst das Import-Skript aus.');
      return;
    }
    
    // Beispieldaten anzeigen
    console.log('Hier sind einige Beispieldaten:');
    const examples = await collection.find().limit(3).toArray();
    
    examples.forEach((example, index) => {
      console.log(`\n--- Beispiel ${index + 1} ---`);
      console.log(`Name: ${example.properties?.Name || 'Unbekannt'}`);
      console.log(`Adresse: ${example.properties?.Adresse || 'Keine Adresse angegeben'}`);
      console.log(`Kategorie: ${example.properties?.Kategorie || 'Keine Kategorie'}`);
      console.log(`Koordinaten: ${example.geometry?.coordinates ? example.geometry.coordinates.join(', ') : 'Keine Koordinaten'}`);
    });
    
    // Überprüfen, ob der GeoIndex vorhanden ist
    const indexes = await collection.indexes();
    const hasGeoIndex = indexes.some(index => 
      index.key && index.key.geometry === '2dsphere'
    );
    
    console.log(`\nGeo-Index für schnelle räumliche Abfragen: ${hasGeoIndex ? 'Vorhanden' : 'Nicht vorhanden'}`);
    
    // Beispiel einer räumlichen Abfrage (nahe Brixen Zentrum)
    if (hasGeoIndex) {
      const brixenCenter = [11.65692, 46.71604]; // Koordinaten des Stadtzentrums von Brixen
      console.log(`\nBeispiel einer räumlichen Abfrage (nahe des Stadtzentrums von Brixen):`);
      
      const nearby = await collection.find({
        geometry: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: brixenCenter
            },
            $maxDistance: 500 // 500 Meter
          }
        }
      }).limit(5).toArray();
      
      console.log(`${nearby.length} Marker im Umkreis von 500 Metern gefunden:`);
      nearby.forEach(marker => {
        console.log(`- ${marker.properties?.Name || 'Unbekannt'} (${marker.properties?.Kategorie || '?'})`);
      });
    }
    
  } catch (error) {
    console.error('Fehler beim Überprüfen der Marker-Daten:', error);
  } finally {
    // Datenbankverbindung schließen
    await closeDatabaseConnection();
  }
}

// Skript ausführen
checkMarkers()
  .then(() => console.log('\nÜberprüfung abgeschlossen.'))
  .catch(err => console.error('Fehler beim Ausführen des Überprüfungsskripts:', err)); 