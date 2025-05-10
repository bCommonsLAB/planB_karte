/**
 * API-Route für den Import von CSV-Daten
 * 
 * Diese Route ermöglicht das Hochladen und Importieren von CSV-Daten in die MongoDB-Datenbank.
 * Die Daten werden analysiert, validiert und als GeoJSON-Features gespeichert.
 */

import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import { Feature } from 'geojson';

// Interface-Definitionen
interface FlatMarkerData {
  _id?: string;
  Name: string;
  Nome?: string;
  Beschreibung: string;
  Descrizione?: string;
  Kategorie: string;
  Categoria: string;
  Adresse?: string;
  Telefonnummer?: string;
  Email?: string;
  "Webseite(n)"?: string;
  Öffnungszeiten?: string;
  Tags?: string;
  "KAUZ Tags"?: string;
  latitude?: number | string;
  longitude?: number | string;
  [key: string]: any;
}

interface MarkerDocument extends Feature {
  _id?: string | ObjectId;
}

interface ImportConfig {
  mode: 'insert' | 'update' | 'upsert';
  identifyBy: 'id' | 'name' | 'coordinates';
  deleteExisting?: boolean;
}

interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  errors: string[];
}

/**
 * Konvertiert CSV-Import-Daten in GeoJSON-Features
 */
function convertToGeoJSON(data: FlatMarkerData[]): Feature[] {
  return data.map(item => {
    // Formatiere Koordinaten korrekt (Entferne Punkte in Zahlen über 999)
    const formatCoordinate = (coordStr: string): number => {
      // Wenn das Format wie 1.165.799 ist, konvertiere es zu 11.65799
      if (coordStr.split('.').length > 2) {
        // Entferne alle Punkte und setze dann den Dezimalpunkt an der richtigen Stelle
        const cleanStr = coordStr.replace(/\./g, '');
        // Füge den Dezimalpunkt nach der ersten Ziffer ein
        return parseFloat(cleanStr.slice(0, 1) + '.' + cleanStr.slice(1));
      }
      return parseFloat(coordStr || '0');
    };
    
    // Extrahiere und konvertiere Koordinaten
    const longitudeStr = typeof item.longitude === 'string' ? item.longitude : String(item.longitude || '0');
    const latitudeStr = typeof item.latitude === 'string' ? item.latitude : String(item.latitude || '0');
    
    const longitude = formatCoordinate(longitudeStr);
    const latitude = formatCoordinate(latitudeStr);
    
    // Entferne Koordinaten- und ID-Felder aus den Properties
    const { longitude: lon, latitude: lat, _id, ...properties } = item;
    
    // Konvertiere [NEWLINE] Tags zurück zu echten Zeilenumbrüchen
    for (const key in properties) {
      if (typeof properties[key] === 'string') {
        properties[key] = properties[key].replace(/\[NEWLINE\]/g, '\n');
      }
    }
    
    // Erzeuge GeoJSON-Feature
    const feature: any = {
      type: 'Feature',
      properties,
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    };
    
    // Füge ID hinzu, wenn vorhanden
    if (_id && _id.trim() !== '') {
      feature._id = _id;
    }
    
    return feature;
  });
}

/**
 * Parst eine CSV-Zeile unter Berücksichtigung von Anführungszeichen
 */
function parseCSVLine(line: string, delimiter: string = ';'): string[] {
  const result: string[] = [];
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
    } else if (char === delimiter && !inQuotes) {
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
 * POST-Handler zum Importieren von CSV-Daten
 */
export async function POST(request: NextRequest) {
  try {
    // Parse den Request-Body
    const body = await request.json();
    
    // Prüfe, ob die erforderlichen Daten vorhanden sind
    if (!body.data) {
      return NextResponse.json(
        { error: 'Keine gültigen Daten zum Importieren gefunden' },
        { status: 400 }
      );
    }
    
    // Prüfe, ob es sich um ein CSV-Format oder bereits geparste Daten handelt
    let importData: FlatMarkerData[] = [];
    
    if (typeof body.data === 'string') {
      // CSV-Format
      const rows = body.data.split('\n');
      if (rows.length < 2) {
        return NextResponse.json(
          { error: 'CSV-Datei enthält nicht genügend Zeilen' },
          { status: 400 }
        );
      }
      
      // Extrahiere Header
      const delimiter = body.delimiter || ';';
      const headers = parseCSVLine(rows[0], delimiter);
      
      // Parse Datenzeilen in Objekte
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue; // Überspringe leere Zeilen
        
        const values = parseCSVLine(rows[i], delimiter);
        if (values.length !== headers.length) {
          console.warn(`Zeile ${i+1} hat eine ungültige Anzahl an Werten: ${values.length} statt ${headers.length}`);
          continue;
        }
        
        const item: Record<string, any> = {};
        for (let j = 0; j < headers.length; j++) {
          item[headers[j]] = values[j];
        }
        
        importData.push(item as FlatMarkerData);
      }
    } else if (Array.isArray(body.data)) {
      // Bereits als Array von Objekten
      importData = body.data;
    } else {
      return NextResponse.json(
        { error: 'Ungültiges Datenformat. Erwartet wird ein CSV-String oder ein Array von Objekten.' },
        { status: 400 }
      );
    }
    
    // Prüfe, ob Daten vorhanden sind
    if (importData.length === 0) {
      return NextResponse.json(
        { error: 'Keine gültigen Daten zum Importieren gefunden' },
        { status: 400 }
      );
    }
    
    // Import-Konfiguration (mit Standardwerten)
    const config: ImportConfig = {
      mode: body.config?.mode || 'insert',
      identifyBy: body.config?.identifyBy || 'id',
      deleteExisting: body.config?.deleteExisting || false
    };
    
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
    
    // Import-Ergebnis initialisieren
    const result: ImportResult = {
      total: importData.length,
      inserted: 0,
      updated: 0,
      errors: []
    };
    
    // Konvertiere CSV-Daten zu GeoJSON-Features
    const features = convertToGeoJSON(importData);
    
    // Bei "insert" mit deleteExisting: true - bestehende Daten löschen
    if (config.mode === 'insert' && config.deleteExisting) {
      await collection.deleteMany({});
    }
    
    // Import basierend auf dem gewählten Modus
    if (config.mode === 'insert') {
      // Einfacher Insert aller Daten
      const insertResult = await collection.insertMany(features as any[]);
      result.inserted = insertResult.insertedCount;
    } 
    else if (config.mode === 'update' || config.mode === 'upsert') {
      // Update oder Upsert basierend auf einem Identifikationsmerkmal
      for (const feature of features) {
        try {
          let query = {};
          
          // Bestimme die Query basierend auf der Identifikationsmethode
          if (config.identifyBy === 'id' && (feature as any)._id) {
            // Versuch, eine ObjectId zu erstellen, falls es sich um eine gültige ID handelt
            try {
              query = { _id: new ObjectId((feature as any)._id.toString()) };
            } catch (e) {
              // Wenn keine gültige ObjectId, versuche es als String
              query = { _id: (feature as any)._id };
            }
          } 
          else if (config.identifyBy === 'name' && feature.properties?.Name) {
            query = { "properties.Name": feature.properties.Name };
          }
          else if (config.identifyBy === 'coordinates' && feature.geometry) {
            // Sicherstellen, dass es ein Point-Geometry ist
            if (feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
              query = { 
                "geometry.coordinates": feature.geometry.coordinates 
              };
            } else {
              result.errors.push(`Ungültige Geometrie: Nur Point-Geometrien werden unterstützt`);
              continue;
            }
          }
          else {
            // Wenn kein Identifikationsmerkmal gefunden wurde, Fehler melden
            result.errors.push(`Kein gültiges Identifikationsmerkmal für Feature gefunden: ${JSON.stringify(feature.properties?.Name || 'Unbenannt')}`);
            continue;
          }
          
          // ID entfernen, da MongoDB diese nicht aktualisieren kann
          const updateFeature = { ...feature };
          if ((updateFeature as any)._id) delete (updateFeature as any)._id;
          
          // Update oder Upsert durchführen
          const updateResult = await collection.updateOne(
            query,
            { $set: updateFeature as any },
            { upsert: config.mode === 'upsert' }
          );
          
          if (updateResult.modifiedCount > 0) {
            result.updated++;
          } else if (updateResult.upsertedCount > 0) {
            result.inserted++;
          }
        } catch (error) {
          // Fehler beim Aktualisieren dieses Features protokollieren
          result.errors.push(`Fehler beim Aktualisieren von Feature ${feature.properties?.Name || 'Unbenannt'}: ${error}`);
        }
      }
    }
    
    // Sicherstellen, dass der räumliche Index existiert
    await collection.createIndex({ geometry: "2dsphere" });
    
    // Verbindung schließen
    await client.close();
    
    // Erfolgreiche Antwort mit Import-Ergebnis
    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Fehler beim CSV-Import:', error);
    return NextResponse.json(
      { error: 'Fehler beim Importieren der CSV-Daten' },
      { status: 500 }
    );
  }
} 