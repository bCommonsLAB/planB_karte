/**
 * Koordinaten-Utilities für die Plan B Karte
 * 
 * Diese Datei enthält zentrale Funktionen für die Validierung, Korrektur und 
 * Umwandlung von Koordinaten, um Konsistenz im gesamten Projekt zu gewährleisten.
 */

import { Feature } from 'geojson';

// Referenzkoordinaten von Brixen
export const BRIXEN_COORDINATES = {
  lat: 46.7165,
  lon: 11.5660
};

// Maximale Entfernung für gültige Orte (in km)
export const MAX_DISTANCE_KM = 10;

/**
 * Korrigiert fehlerhafte Koordinaten
 * 
 * Erkennt häufige Formate von fehlerhaften Koordinaten und korrigiert sie:
 * - Längengrad > 20 und < 200: Teile durch 10 (z.B. 116.566 -> 11.6566)
 * - Breitengrad > 0 und < 10: Multipliziere mit 10 (z.B. 4.6716 -> 46.716)
 * 
 * @param lon Längengrad (longitude)
 * @param lat Breitengrad (latitude)
 * @returns Korrigierte Koordinaten als [lon, lat]
 */
export function fixCoordinates(lon: number, lat: number): [number, number] {
  let correctedLon = lon;
  let correctedLat = lat;
  let hasBeenCorrected = false;
  
  // Fall 1: Fehlender Dezimalpunkt in Längengrad (z.B. 116.503 statt 11.6503)
  if (lon > 20 && lon < 200) {
    correctedLon = lon / 10;
    hasBeenCorrected = true;
  }
  
  // Fall 2: Fehlender Dezimalpunkt in Breitengrad (z.B. 4.671688 statt 46.71688)
  if (lat > 0 && lat < 10) {
    correctedLat = lat * 10;
    hasBeenCorrected = true;
  }
  
  return [correctedLon, correctedLat];
}

/**
 * Berechnet die Entfernung zwischen zwei Punkten (Haversine-Formel)
 * 
 * @param lat1 Breitengrad des ersten Punkts
 * @param lon1 Längengrad des ersten Punkts
 * @param lat2 Breitengrad des zweiten Punkts
 * @param lon2 Längengrad des zweiten Punkts
 * @returns Entfernung in Kilometern
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Erdradius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Entfernung in km
  return distance;
}

/**
 * Prüft, ob Koordinaten innerhalb des erlaubten Bereichs liegen
 * 
 * @param lon Längengrad
 * @param lat Breitengrad
 * @returns true, wenn innerhalb des erlaubten Bereichs
 */
export function isWithinAllowedArea(lon: number, lat: number): boolean {
  // Berechne die Entfernung zum Referenzpunkt (Brixen)
  const distance = calculateDistance(lat, lon, BRIXEN_COORDINATES.lat, BRIXEN_COORDINATES.lon);
  
  // True, wenn die Entfernung kleiner oder gleich der maximalen Entfernung ist
  return distance <= MAX_DISTANCE_KM;
}

/**
 * Konvertiert Koordinaten zwischen verschiedenen Formaten
 * 
 * @param coords Koordinaten im Format [lon, lat] oder [lat, lon]
 * @param format Format der Eingabekoordinaten ('lonlat' oder 'latlon')
 * @param targetFormat Zielformat ('lonlat' oder 'latlon')
 * @returns Koordinaten im Zielformat
 */
export function convertCoordinateFormat(
  coords: [number, number], 
  format: 'lonlat' | 'latlon', 
  targetFormat: 'lonlat' | 'latlon'
): [number, number] {
  if (format === targetFormat) return coords;
  return [coords[1], coords[0]];
}

/**
 * Formatiert Koordinaten als lesbaren String
 * 
 * @param lon Längengrad
 * @param lat Breitengrad
 * @param precision Anzahl der Nachkommastellen (Standard: 5)
 * @returns Formatierter String
 */
export function formatCoordinates(lon: number, lat: number, precision: number = 5): string {
  return `[${lon.toFixed(precision)}, ${lat.toFixed(precision)}]`;
}

/**
 * Korrigiere falsche Koordinaten in einem Feature
 */
export const fixCoordinatesFeature = (feature: Feature): Feature => {
  // Überprüfe, ob Feature und Geometrie existieren
  if (!feature || !feature.geometry) return feature;
  
  // Überprüfe, ob Geometrie vom Typ Point ist
  if (feature.geometry.type !== 'Point') return feature;
  
  // Überprüfe, ob Koordinaten existieren
  const coords = feature.geometry.coordinates;
  if (!coords || coords.length !== 2) return feature;
  
  let [lon, lat] = coords;
  let hasBeenCorrected = false;
  const featureName = feature.properties?.Name || "Unbenannt";
  
  // Fall 1: Koordinaten sind [0,0] - Ungültige Koordinaten
  if (lon === 0 && lat === 0) {
    // Setze Nullkoordinaten auf Standard-Brixen-Position mit zufälligem Versatz
    const brixenLat = 46.7165;
    const brixenLon = 11.566;
    const randomOffset = (Math.random() - 0.5) * 0.01; // ca. 0.5-1km Versatz
    
    feature.geometry.coordinates = [brixenLon + randomOffset, brixenLat + randomOffset];
    
    return feature;
  }
  
  // Referenzpunkt für Brixen/Südtirol
  const brixenLat = 46.7165;
  const brixenLon = 11.566;
  
  // ERWEITERTE KORREKTUR: Wir gehen davon aus, dass alle echten Punkte in einem 10km-Radius um Brixen liegen
  // Berechne Entfernung zu Brixen
  const distanceToBrixen = calculateDistance(lat, lon, brixenLat, brixenLon);
  
  // Wenn der Punkt außerhalb von 10km um Brixen liegt, wenden wir verschiedene Korrekturmethoden an
  if (distanceToBrixen > 10) {
    // KORREKTURMETHODE 1: Dezimalpunkt-Korrektur für Längengrad
    if (lon > 20 && lon < 200) {
      const correctedLon = lon / 10;
      const newDistance = calculateDistance(lat, correctedLon, brixenLat, brixenLon);
      
      if (newDistance < 10) {
        lon = correctedLon;
        feature.geometry.coordinates[0] = correctedLon;
        hasBeenCorrected = true;
      }
    }
    
    // KORREKTURMETHODE 2: Dezimalpunkt-Korrektur für Breitengrad
    if (!hasBeenCorrected && lat > 0 && lat < 10) {
      const correctedLat = lat * 10;
      const newDistance = calculateDistance(correctedLat, lon, brixenLat, brixenLon);
      
      if (newDistance < 10) {
        lat = correctedLat;
        feature.geometry.coordinates[1] = correctedLat;
        hasBeenCorrected = true;
      }
    }
    
    // KORREKTURMETHODE 3: Vertauschte Koordinaten
    if (!hasBeenCorrected) {
      const distanceWithSwappedCoords = calculateDistance(lon, lat, brixenLat, brixenLon);
      
      if (distanceWithSwappedCoords < 10) {
        feature.geometry.coordinates = [lat, lon];
        hasBeenCorrected = true;
      }
    }
    
    // KORREKTURMETHODE 4: Spezielle Annahme - Manche Punkte im Ausland könnten durch falsche Dezimalpunkt-Verschiebung entstanden sein
    if (!hasBeenCorrected) {
      // Versuche verschiedene Multiplikatoren/Divisoren für komplexere Fälle
      const potentialCorrections = [
        { mult_lat: 1, mult_lon: 0.1 },    // Längengrad um eine Stelle zu weit rechts
        { mult_lat: 10, mult_lon: 1 },     // Breitengrad um eine Stelle zu weit links
        { mult_lat: 0.1, mult_lon: 1 },    // Breitengrad um eine Stelle zu weit rechts
        { mult_lat: 1, mult_lon: 10 },     // Längengrad um eine Stelle zu weit links
        { mult_lat: 10, mult_lon: 0.1 },   // Beide um je eine Stelle verschoben
        { mult_lat: 0.1, mult_lon: 10 }    // Beide um je eine Stelle in andere Richtung verschoben
      ];
      
      for (const correction of potentialCorrections) {
        const correctedLat = lat * correction.mult_lat;
        const correctedLon = lon * correction.mult_lon;
        const newDistance = calculateDistance(correctedLat, correctedLon, brixenLat, brixenLon);
        
        if (newDistance < 10) {
          feature.geometry.coordinates = [correctedLon, correctedLat];
          hasBeenCorrected = true;
          break;
        }
      }
    }
    
    // LETZTE RETTUNG: Wenn keine Korrektur funktioniert hat, setzen wir den Punkt nahe Brixen
    if (!hasBeenCorrected) {
      // Setze auf einen Punkt nahe Brixen mit leichtem Versatz für bessere Sichtbarkeit
      const randomOffset = (Math.random() - 0.5) * 0.005; // etwa 250-500m Versatz
      feature.geometry.coordinates = [brixenLon + randomOffset, brixenLat + randomOffset];
    }
  }
  
  return feature;
}; 