import { ObjectId } from 'mongodb';
import { Feature, FeatureCollection, Geometry } from 'geojson';

/**
 * Erweitert GeoJSON Feature um MongoDB-spezifische Felder
 */
declare global {
  /**
   * MongoDB-Dokumenttyp, der ein GeoJSON-Feature erweitert
   */
  interface MarkerDocument {
    _id?: ObjectId | string;
    type: 'Feature';
    properties: MarkerProperties;
    geometry: MarkerGeometry;
  }

  /**
   * Typisierte Properties für MongoDB-Marker
   */
  interface MarkerProperties {
    Name: string;
    Nome?: string;  // Italienisches Feld für Namen
    Beschreibung: string;
    Descrizione?: string;  // Italienisches Feld für Beschreibung
    Kategorie: string;
    Categoria?: string;  // Italienisches Feld für Kategorie
    Adresse?: string;
    Telefonnummer?: string;
    Email?: string;
    "Webseite(n)"?: string;
    Öffnungszeiten?: string;
    Tags?: string;
    "KAUZ Tags"?: string;
    [key: string]: any;  // Weitere dynamische Felder
  }

  /**
   * Geometrie-Typ für Marker (nur Point unterstützt)
   */
  interface MarkerGeometry {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  }

  /**
   * Feature-Collection von Markern
   */
  interface MarkerCollection extends FeatureCollection {
    features: MarkerDocument[];
  }

  /**
   * Flache Datenstruktur für CSV-Import/-Export
   */
  interface FlatMarkerData {
    _id?: string;
    Name: string;
    Nome?: string;
    Beschreibung: string;
    Descrizione?: string;
    Kategorie: string;
    Categoria?: string;
    Adresse?: string;
    Telefonnummer?: string;
    Email?: string;
    "Webseite(n)"?: string;
    Öffnungszeiten?: string;
    Tags?: string;
    "KAUZ Tags"?: string;
    longitude: number | string;
    latitude: number | string;
    [key: string]: any; // Beliebige weitere Felder
  }

  /**
   * Import-Konfiguration
   */
  interface ImportConfig {
    mode: 'insert' | 'update' | 'upsert';
    identifyBy?: 'id' | 'name' | 'coordinates';
    deleteExisting?: boolean;
  }

  /**
   * Import-Ergebnis
   */
  interface ImportResult {
    total: number;
    inserted: number;
    updated: number;
    errors: string[];
  }
} 