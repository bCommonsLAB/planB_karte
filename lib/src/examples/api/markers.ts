import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { GeoJSON } from 'geojson';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GeoJSON | { message: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Methode nicht erlaubt' });
  }

  try {
    // Pfad zur Marker-Datei
    const markersPath = path.join(process.cwd(), 'data', 'markers.json');
    
    // Überprüfen, ob die Datei existiert
    if (!fs.existsSync(markersPath)) {
      return res.status(404).json({ message: 'Marker-Datei nicht gefunden' });
    }
    
    // Datei lesen und als JSON parsen
    const markersData = fs.readFileSync(markersPath, 'utf-8');
    const markers = JSON.parse(markersData);
    
    // GeoJSON zurückgeben
    return res.status(200).json(markers);
  } catch (error) {
    console.error('Fehler beim Lesen der Marker-Datei:', error);
    return res.status(500).json({ message: 'Serverfehler beim Lesen der Marker-Datei' });
  }
} 