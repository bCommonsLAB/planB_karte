/**
 * Migrationsskript für die Mehrsprachigkeit
 * 
 * Dieses Skript durchläuft alle bestehenden Dokumente in der places-Collection
 * und fügt die italienischen Felder 'Nome' und 'Descrizione' hinzu, falls diese
 * noch nicht vorhanden sind.
 */

// Umgebungsvariablen laden
require('dotenv').config();

const { MongoClient } = require('mongodb');

async function migrateToMultilingual() {
  // MongoDB-Verbindung herstellen
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI ist nicht definiert');
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Mit MongoDB verbunden');
    
    const db = client.db('planB');
    const collection = db.collection('places');
    
    // Alle Dokumente finden, die noch keine italienischen Felder haben
    const placesToUpdate = await collection.find({
      $or: [
        { 'properties.Nome': { $exists: false } },
        { 'properties.Descrizione': { $exists: false } }
      ]
    }).toArray();
    
    console.log(`${placesToUpdate.length} Dokumente gefunden, die aktualisiert werden müssen`);
    
    // Für jedes Dokument die italienischen Felder hinzufügen
    let updatedCount = 0;
    for (const place of placesToUpdate) {
      await collection.updateOne(
        { _id: place._id },
        { 
          $set: {
            'properties.Nome': place.properties.Nome || '',
            'properties.Descrizione': place.properties.Descrizione || ''
          }
        }
      );
      updatedCount++;
      
      if (updatedCount % 10 === 0) {
        console.log(`${updatedCount} von ${placesToUpdate.length} Dokumenten aktualisiert`);
      }
    }
    
    console.log(`Migration abgeschlossen: ${updatedCount} Dokumente aktualisiert`);
  } catch (error) {
    console.error('Fehler bei der Migration:', error);
  } finally {
    await client.close();
    console.log('MongoDB-Verbindung geschlossen');
  }
}

// Skript ausführen
migrateToMultilingual()
  .then(() => console.log('Migration erfolgreich abgeschlossen'))
  .catch(err => console.error('Fehler beim Ausführen der Migration:', err)); 