/**
 * MongoDB-Service
 * 
 * Stellt Funktionen zur Verbindung mit MongoDB bereit.
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Dotenv explizit laden
dotenv.config();

let client = null;

/**
 * Stellt eine Verbindung zur MongoDB-Datenbank her
 */
async function connectToDatabase() {
  try {
    // Prüfen, ob Client existiert und verbunden ist
    if (client?.connect && client.db('planB')) {
      return client.db('planB');
    }

    // Wenn keine Verbindung besteht, neue aufbauen
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('Umgebungsvariablen Status:', {
        NODE_ENV: process.env.NODE_ENV,
        MONGODB_URI: process.env.MONGODB_URI ? 'Vorhanden' : 'Fehlt',
        MONGODB_DATABASE_NAME: process.env.MONGODB_DATABASE_NAME ? 'Vorhanden' : 'Fehlt',
        MONGODB_COLLECTION_NAME: process.env.MONGODB_COLLECTION_NAME ? 'Vorhanden' : 'Fehlt'
      });
      throw new Error('MONGODB_URI ist nicht definiert');
    }

    console.log(`Verbindung zu MongoDB wird hergestellt... (Datenbank: planB)`);
    
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
    
    // Feste Schreibweise 'planB' verwenden
    const dbName = 'planB';
    
    return client.db(dbName);
  } catch (error) {
    console.error('MongoDB Verbindungsfehler:', error);
    
    // Verbindung bei Fehler zurücksetzen
    if (client) {
      await client.close();
      client = null;
    }
    
    throw new Error(
      `Datenbankverbindung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
    );
  }
}

/**
 * Holt eine Collection aus der Datenbank
 */
async function getCollection(collectionName) {
  try {
    console.log(`Versuche Collection "${collectionName}" zu erhalten...`);
    const db = await connectToDatabase();
    return db.collection(collectionName);
  } catch (error) {
    console.error(`Fehler beim Abrufen der Collection ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Optional: Cleanup-Funktion für die Verbindung
 */
async function closeDatabaseConnection() {
  if (client) {
    await client.close();
    client = null;
  }
}

// Prozess-Beendigung behandeln
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await closeDatabaseConnection();
    process.exit(0);
  });
}

module.exports = {
  connectToDatabase,
  getCollection,
  closeDatabaseConnection
}; 