import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { GetServerSideProps } from 'next';
import fs from 'fs';
import path from 'path';
import { GeoJSON } from 'geojson';

// Da MapLibre GL nur im Browser funktioniert und nicht auf dem Server,
// müssen wir die Komponente dynamisch laden und SSR deaktivieren
const PlanBMap = dynamic(() => import('../components/PlanBMap'), {
  ssr: false,
  loading: () => <div className="map-loading">Karte wird geladen...</div>
});

interface DynamicMapPageProps {
  initialMarkers?: GeoJSON;
}

// Beispiel für eine Server-Side Props-Funktion, die die Marker-Daten lädt
export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Lade die Marker aus einer lokalen Datei
    const markersPath = path.join(process.cwd(), 'data', 'markers.json');
    const markersData = fs.readFileSync(markersPath, 'utf-8');
    const markers = JSON.parse(markersData);
    
    return {
      props: {
        initialMarkers: markers
      }
    };
  } catch (error) {
    console.error('Fehler beim Laden der Marker-Daten:', error);
    return {
      props: {
        initialMarkers: null
      }
    };
  }
};

// Alternativ: Client-seitiges Laden der Daten
const DynamicMapPage: React.FC<DynamicMapPageProps> = ({ initialMarkers }) => {
  const [markers, setMarkers] = useState<GeoJSON | null>(initialMarkers || null);
  const [loading, setLoading] = useState<boolean>(!initialMarkers);
  const [error, setError] = useState<string | null>(null);

  // Lade die Marker, wenn sie nicht vom Server bereitgestellt wurden
  useEffect(() => {
    if (!initialMarkers) {
      const fetchMarkers = async () => {
        try {
          setLoading(true);
          const response = await fetch('/api/markers');
          
          if (!response.ok) {
            throw new Error(`Fehler beim Laden der Marker: ${response.status}`);
          }
          
          const data = await response.json();
          setMarkers(data);
          setLoading(false);
        } catch (err) {
          console.error('Fehler beim Laden der Marker:', err);
          setError('Marker konnten nicht geladen werden. Bitte versuche es später erneut.');
          setLoading(false);
        }
      };
      
      fetchMarkers();
    }
  }, [initialMarkers]);

  // Beispiel für das Hinzufügen eines neuen Markers
  const addNewMarker = () => {
    if (!markers) return;
    
    // Kopiere die vorhandenen Marker
    const updatedMarkers = { ...markers };
    
    // Erstelle einen neuen Marker
    const newFeature = {
      type: "Feature",
      properties: {
        Name: "Neuer Ort",
        Beschreibung: "Ein neuer Ort, der dynamisch hinzugefügt wurde",
        Öffnungszeiten: "Mo-Fr 9-18 Uhr",
        Kategorie: "A"
      },
      geometry: { 
        type: "Point", 
        coordinates: [11.6603, 46.7276] // Leicht versetzt vom Zentrum
      }
    };
    
    // Füge den neuen Marker hinzu
    updatedMarkers.features = [...updatedMarkers.features, newFeature];
    
    // Aktualisiere den State
    setMarkers(updatedMarkers);
  };

  if (loading) {
    return <div className="loading">Marker werden geladen...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!markers) {
    return <div className="error">Keine Marker-Daten verfügbar.</div>;
  }

  return (
    <div className="container">
      <h1>Dynamische Plan B Karte</h1>
      
      <div className="map-container">
        <PlanBMap markers={markers} />
      </div>
      
      <div className="controls">
        <button onClick={addNewMarker}>Neuen Marker hinzufügen</button>
      </div>
      
      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        h1 {
          margin-bottom: 1rem;
        }
        .map-container {
          height: 600px;
          width: 100%;
          margin-bottom: 2rem;
        }
        .controls {
          margin-top: 1rem;
        }
        button {
          padding: 0.5rem 1rem;
          background-color: #3386c0;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        }
        button:hover {
          background-color: #4ea0da;
        }
        .loading, .error {
          padding: 2rem;
          text-align: center;
          font-size: 1.2rem;
        }
        .error {
          color: #e74c3c;
        }
      `}</style>
    </div>
  );
};

export default DynamicMapPage; 