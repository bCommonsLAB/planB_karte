/**
 * API-Route für die Verwaltung einzelner Orte
 * 
 * Diese Route ermöglicht das Abrufen, Aktualisieren und Löschen einzelner Orte
 * über ihre ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { Feature } from 'geojson';

// MongoDB-Dokumenttyp, der ein GeoJSON-Feature erweitert
interface MarkerDocument {
  _id: ObjectId | string;
  type: string;
  properties: {
    Name: string;
    Nome?: string;  // Italienisches Feld für Namen
    Beschreibung: string;
    Descrizione?: string;  // Italienisches Feld für Beschreibung
    Kategorie: string;
    Categoria: string;
    [key: string]: any;  // Weitere dynamische Felder
  };
  geometry: {
    type: string;
    coordinates: number[];
  };
}

/**
 * GET-Handler zum Abrufen eines einzelnen Ortes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
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
    
    // Suche nach der ID (versuche es sowohl als ObjectId als auch als String)
    let marker;
    try {
      marker = await collection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      // Wenn ID kein gültiger ObjectId ist, versuche es als String
      marker = await collection.findOne({ _id: id });
    }
    
    // Verbindung schließen
    await client.close();
    
    if (!marker) {
      return NextResponse.json(
        { error: 'Ort nicht gefunden' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(marker);
  } catch (error) {
    console.error('Fehler beim Abrufen des Ortes:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen des Ortes' },
      { status: 500 }
    );
  }
}

/**
 * PUT-Handler zum Aktualisieren eines Ortes
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const updatedMarker = await request.json();
    
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
    
    // Entferne die _id aus dem Update-Objekt (MongoDB erlaubt keine Änderung der _id)
    if (updatedMarker._id) {
      delete updatedMarker._id;
    }
    
    // Aktualisiere das Dokument
    let result;
    try {
      result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedMarker }
      );
    } catch (error) {
      // Wenn ID kein gültiger ObjectId ist, versuche es als String
      result = await collection.updateOne(
        { _id: id },
        { $set: updatedMarker }
      );
    }
    
    // Verbindung schließen
    await client.close();
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Ort nicht gefunden' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Ort erfolgreich aktualisiert'
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Ortes:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Ortes' },
      { status: 500 }
    );
  }
}

/**
 * DELETE-Handler zum Löschen eines Ortes
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
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
    
    // Lösche das Dokument
    let result;
    try {
      result = await collection.deleteOne({ _id: new ObjectId(id) });
    } catch (error) {
      // Wenn ID kein gültiger ObjectId ist, versuche es als String
      result = await collection.deleteOne({ _id: id });
    }
    
    // Verbindung schließen
    await client.close();
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Ort nicht gefunden' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Ort erfolgreich gelöscht'
    });
  } catch (error) {
    console.error('Fehler beim Löschen des Ortes:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Ortes' },
      { status: 500 }
    );
  }
} 