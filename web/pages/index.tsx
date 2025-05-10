import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { FeatureCollection, Feature, Geometry, GeoJsonProperties } from 'geojson';
import dynamic from 'next/dynamic';
import { MongoClient } from 'mongodb';
import { Maximize, Minimize } from 'lucide-react';

// Dynamischer Import der MapExplorer-Komponente
const MapExplorer = dynamic(() => import('../components/MapExplorer'), {
  ssr: false,
  loading: () => <div className="h-[90vh] w-full flex items-center justify-center bg-green-50/50 rounded-lg border border-green-200">Lade Karte...</div>
});

interface HomeProps {
  markers: FeatureCollection;
}

// MongoDB-Dokumenttyp, der ein GeoJSON-Feature erweitert
interface MarkerDocument extends Omit<Feature, '_id'> {
  _id: any;
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

// Wir ändern zu GetServerSideProps, um die Daten dynamisch von MongoDB zu laden
export const getServerSideProps: GetServerSideProps<HomeProps> = async () => {
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
    
    // Lade alle Marker aus der Collection
    const markersFromDB = await collection.find({}).toArray();
    
    // Wandle die MongoDB-Dokumente in GeoJSON-Format um
    const markersGeoJSON: FeatureCollection & { features: Array<Feature & { _id?: string }> } = {
      type: 'FeatureCollection',
      features: markersFromDB.map(marker => {
        // Konvertiere MongoDB ObjectId in String für bessere Kompatibilität
        const idString = getIdAsString(marker._id);
        
        // _id sowohl im Wurzelobjekt als auch in den Properties speichern
        const featureWithId = {
          ...marker,
          _id: idString, // MongoDB ObjectId in String umwandeln
          properties: {
            ...marker.properties,
            _id: idString // _id auch in den Properties speichern
          }
        };
        
        // Wir behalten die _id bei, obwohl sie nicht Teil des GeoJSON-Standards ist
        return featureWithId as Feature & { _id: string };
      })
    };
    
    // Verbindung schließen
    await client.close();
    
    return {
      props: {
        markers: markersGeoJSON
      }
    };
  } catch (error) {
    console.error('Fehler beim Laden der Marker aus MongoDB:', error);
    
    // Im Fehlerfall leere Feature-Collection zurückgeben
    return {
      props: {
        markers: {
          type: 'FeatureCollection',
          features: []
        }
      }
    };
  }
};

const Home: React.FC<HomeProps> = ({ markers }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    
    // Bei Aktivierung des Vollbildmodus auch den Browser-Vollbildmodus aktivieren
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className={`min-h-screen flex flex-col bg-green-50 ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      <Head>
        <title>Plan B Karte | Brixen</title>
        <meta name="description" content="Interaktive Karte von Brixen mit Points of Interest" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={`flex-1 w-full ${isFullscreen ? 'p-0' : 'py-2'}`}>
        <div className="w-full relative">
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-50 bg-white p-2 rounded-full shadow-md hover:bg-gray-100 focus:outline-none fullscreen-button"
            title={isFullscreen ? "Vollbildmodus beenden" : "Vollbildmodus"}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          
          <MapExplorer 
            markers={markers} 
            mapHeight={isFullscreen ? "100vh" : "90vh"} 
            mapWidth="100%" 
          />
        </div>
      </main>

      {!isFullscreen && (
        <footer className="w-full py-2 border-t border-green-200">
          <div className="text-center text-sm text-gray-600">
            Entwickelt für Plan B Brixen
          </div>
        </footer>
      )}
    </div>
  );
};

export default Home; 