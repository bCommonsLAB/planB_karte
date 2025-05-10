import React from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { FeatureCollection, Feature, Geometry, GeoJsonProperties } from 'geojson';
import dynamic from 'next/dynamic';
import { MongoClient } from 'mongodb';

// Dynamischer Import der MapExplorer-Komponente
const MapExplorer = dynamic(() => import('../components/MapExplorer'), {
  ssr: false,
  loading: () => <div className="h-[70vh] w-full flex items-center justify-center bg-green-50/50 rounded-lg border border-green-200">Lade Karte...</div>
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
        
        // Logge die Struktur für Debug-Zwecke
        //console.log(`Converting MongoDB document to GeoJSON feature. ID: ${idString}`, marker);
        
        // _id sowohl im Wurzelobjekt als auch in den Properties speichern
        const featureWithId = {
          ...marker,
          _id: idString, // MongoDB ObjectId in String umwandeln
          properties: {
            ...marker.properties,
            _id: idString // _id auch in den Properties speichern
          }
        };
        
        // Logge das konvertierte Feature
        //console.log(`Converted feature:`, featureWithId);
        
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
  return (
    <div className="min-h-screen flex flex-col bg-green-50">
      <Head>
        <title>Plan B Karte | Brixen</title>
        <meta name="description" content="Interaktive Karte von Brixen mit Points of Interest" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex-1 w-full py-6 md:py-8">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <MapExplorer markers={markers} mapHeight="70vh" />
        </div>
      </main>

      <footer className="w-full py-4 border-t border-green-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-600">
          Entwickelt für Plan B Brixen
        </div>
      </footer>
    </div>
  );
};

export default Home; 