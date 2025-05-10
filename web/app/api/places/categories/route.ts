/**
 * API-Route für Kategorien
 * 
 * Diese Route holt alle eindeutigen Kategorien aus der places-Collection
 * mit einer MongoDB-Aggregation (group by).
 */

import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function GET(request: Request) {
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
    const collection = db.collection('places');
    
    // Aggregation: Gruppiere nach Kategorie und zähle die Anzahl der Dokumente
    const categoriesAggregation = await collection.aggregate([
      // Nur Dokumente mit definierter Kategorie auswählen
      { $match: { 'properties.Kategorie': { $exists: true, $ne: '' } } },
      // Nach Kategorie gruppieren
      { $group: { 
        _id: '$properties.Kategorie', 
        count: { $sum: 1 } 
      }},
      // Sortieren nach Kategorie
      { $sort: { _id: 1 } },
      // Umbenennen der Felder für bessere Lesbarkeit
      { $project: { 
        kategorie: '$_id', 
        anzahl: '$count',
        _id: 0 
      }}
    ]).toArray();
    
    // Verbindung schließen
    await client.close();
    
    // Response zurückgeben
    return NextResponse.json({
      categories: categoriesAggregation
    });
  
  } catch (error) {
    console.error('Fehler beim Abrufen der Kategorien:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Kategorien' },
      { status: 500 }
    );
  }
} 