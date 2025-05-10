import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
// MarkerDocument ist ein globaler Typ, der in marker.d.ts definiert ist

/**
 * API-Endpunkt zum Entfernen redundanter Koordinatenfelder aus der Datenbank
 * 
 * ACHTUNG: Dieser Endpunkt ist nur für die einmalige Bereinigung der Datenbank gedacht
 * und sollte nach erfolgreicher Ausführung deaktiviert oder entfernt werden.
 */
export async function GET(request: NextRequest) {
  try {
    // MongoDB-Verbindung herstellen
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI ist nicht definiert');
    }
    
    const client = new MongoClient(uri);
    await client.connect();
    
    // Verwende die planB-Datenbank und places-Collection
    const db = client.db('planB');
    const collection = db.collection<MarkerDocument>('places');
    
    // Finde alle Dokumente mit redundanten Koordinatenfeldern
    const documentsToUpdate = await collection.countDocuments({
      $or: [
        { 'properties.Koordinate N': { $exists: true } },
        { 'properties.Koordinate O': { $exists: true } }
      ]
    });
    
    // Entferne die redundanten Felder
    const result = await collection.updateMany(
      {}, // Alle Dokumente aktualisieren
      { 
        $unset: { 
          'properties.Koordinate N': '', 
          'properties.Koordinate O': '' 
        } 
      }
    );
    
    // Verbindung schließen
    await client.close();
    
    // Erfolgsmeldung zurückgeben
    return NextResponse.json({
      success: true,
      message: 'Redundante Koordinatenfelder erfolgreich entfernt',
      documentsFound: documentsToUpdate,
      documentsModified: result.modifiedCount
    });
  
  } catch (error) {
    console.error('Fehler bei der Datenbereinigung:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
} 