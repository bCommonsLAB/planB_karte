/**
 * API-Route für Marker-Daten
 * 
 * Diese Route stellt die GeoJSON-Daten der importierten Marker aus der MongoDB-Datenbank
 * zur Verfügung.
 */

import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { Feature, Geometry, GeoJsonProperties } from 'geojson';

// MongoDB-Dokumenttyp, der ein GeoJSON-Feature erweitert
interface MarkerDocument {
  _id: any;
  type: string;
  properties: {
    Name: string;
    Nome?: string;  // Italienisches Feld für Namen
    Beschreibung: string;
    Descrizione?: string;  // Italienisches Feld für Beschreibung
    Kategorie: string;
    Categoria?: string;
    [key: string]: any;  // Weitere dynamische Felder
  };
  geometry: {
    type: string;
    coordinates: number[];
  };
}

// Konvertiere eine MongoID zu einem String
function getIdAsString(id: any): string {
  if (id && typeof id.toString === 'function') {
    return id.toString();
  }
  if (id && typeof id === 'object') {
    return JSON.stringify(id);
  }
  return String(id || '');
}

export async function GET(request: Request) {
  try {
    // URL-Parameter auslesen (für Filteroptionen)
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    
    // Suchfilter erstellen
    const filter: Record<string, any> = {};
    
    // Kategoriefilter anwenden, wenn eine Kategorie ausgewählt wurde und nicht "all" ist
    if (category && category !== 'all') {
      filter['properties.Kategorie'] = category;
    }
    
    // Wenn eine Suche durchgeführt wird, in beiden Sprachversionen suchen
    if (search) {
      filter['$or'] = [
        { 'properties.Name': { $regex: search, $options: 'i' } },
        { 'properties.Nome': { $regex: search, $options: 'i' } },
        { 'properties.Beschreibung': { $regex: search, $options: 'i' } },
        { 'properties.Descrizione': { $regex: search, $options: 'i' } }
      ];
    }
    
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
    
    // Daten aus der Datenbank abrufen
    const markers = await collection.find(filter).toArray();
    
    // Verbindung schließen
    await client.close();
    
    // GeoJSON-Feature-Collection erstellen mit _id für jedes Feature
    const featureCollection = {
      type: 'FeatureCollection',
      features: markers.map(marker => {
        // Feature mit _id zurückgeben
        return {
          ...marker,
          _id: getIdAsString(marker._id)
        };
      })
    };
    
    // Response zurückgeben
    return NextResponse.json(featureCollection);
  
  } catch (error) {
    console.error('Fehler beim Abrufen der Marker-Daten:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Daten' },
      { status: 500 }
    );
  }
}

/**
 * POST-Handler zum Erstellen eines neuen Ortes
 */
export async function POST(request: Request) {
  try {
    // Lese den neuen Ort aus dem Request-Body
    const newPlace = await request.json();
    
    // Stelle sicher, dass das Feature die richtigen Felder hat
    if (!newPlace.type || !newPlace.properties || !newPlace.geometry) {
      return NextResponse.json(
        { error: 'Ungültiges Feature-Format' },
        { status: 400 }
      );
    }
    
    // Stelle sicher, dass die Pflichtfelder vorhanden sind
    if (!newPlace.properties.Name || !newPlace.properties.Kategorie || 
        !newPlace.properties.Beschreibung || 
        !newPlace.geometry.coordinates || newPlace.geometry.coordinates.length !== 2) {
      return NextResponse.json(
        { error: 'Pflichtfelder fehlen (Name, Kategorie, Beschreibung, Koordinaten)' },
        { status: 400 }
      );
    }
    
    // Leere italienische Felder initialisieren, falls nicht vorhanden
    if (!newPlace.properties.Nome) {
      newPlace.properties.Nome = "";
    }
    
    if (!newPlace.properties.Descrizione) {
      newPlace.properties.Descrizione = "";
    }
    
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
    
    // Setze den Typ des Features auf 'Feature', falls nicht gesetzt
    if (newPlace.type !== 'Feature') {
      newPlace.type = 'Feature';
    }
    
    // Stelle sicher, dass die Geometrie vom Typ 'Point' ist
    if (newPlace.geometry.type !== 'Point') {
      newPlace.geometry.type = 'Point';
    }
    
    // Füge den neuen Ort hinzu
    const result = await collection.insertOne(newPlace);
    
    // Verbindung schließen
    await client.close();
    
    // Gib das erstellte Feature mit der ID zurück
    return NextResponse.json({
      ...newPlace,
      _id: getIdAsString(result.insertedId)
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Ortes:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Ortes' },
      { status: 500 }
    );
  }
}

/**
 * Hilfsfunktion zur Erstellung einer Suchfilter-Anfrage
 * Kann später erweitert werden, z.B. für Textsuche oder räumliche Suche
 */
function createFilterQuery(params: URLSearchParams) {
  const query: Record<string, any> = {};
  
  // Nach Kategorie filtern
  const category = params.get('category');
  if (category) {
    query['properties.Kategorie'] = category;
  }
  
  // Nach Suchbegriff filtern (in beiden Sprachversionen)
  const search = params.get('search');
  if (search) {
    query['$or'] = [
      { 'properties.Name': { $regex: search, $options: 'i' } },
      { 'properties.Nome': { $regex: search, $options: 'i' } },
      { 'properties.Beschreibung': { $regex: search, $options: 'i' } },
      { 'properties.Descrizione': { $regex: search, $options: 'i' } }
    ];
  }
  
  // Nahe einer bestimmten Position suchen
  const lat = params.get('lat');
  const lng = params.get('lng');
  const radius = params.get('radius');
  
  if (lat && lng && radius) {
    query.geometry = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)]
        },
        $maxDistance: parseInt(radius)
      }
    };
  }
  
  return query;
} 