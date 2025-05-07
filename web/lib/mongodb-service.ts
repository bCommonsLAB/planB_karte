import { MongoClient, Db, Collection, Document } from 'mongodb';
import * as dotenv from 'dotenv';

// Dotenv explizit laden
dotenv.config();

// Module-Export deklarieren
export {};

let client: MongoClient | null = null;

/**
 * Stellt eine Verbindung zur MongoDB-Datenbank her
 */
export async function connectToDatabase(): Promise<Db> {
  try {
    // Prüfen, ob Client existiert und verbunden ist
    if (client?.connect && client.db(process.env.MONGODB_DATABASE_NAME)) {
      return client.db(process.env.MONGODB_DATABASE_NAME);
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

    console.log(`Verbindung zu MongoDB wird hergestellt... (Datenbank: ${process.env.MONGODB_DATABASE_NAME})`);
    
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
    
    const dbName = process.env.MONGODB_DATABASE_NAME;
    if (!dbName) {
      throw new Error('MONGODB_DATABASE_NAME ist nicht definiert');
    }
    
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
export async function getCollection<T extends Document = Document>(collectionName: string): Promise<Collection<T>> {
  try {
    console.log(`Versuche Collection "${collectionName}" zu erhalten...`);
    const db = await connectToDatabase();
    return db.collection<T>(collectionName);
  } catch (error) {
    console.error(`Fehler beim Abrufen der Collection ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Optional: Cleanup-Funktion für die Verbindung
 */
export async function closeDatabaseConnection(): Promise<void> {
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