import React from 'react';
import dynamic from 'next/dynamic';
import markersData from '../markers.json';

// Da MapLibre GL nur im Browser funktioniert und nicht auf dem Server,
// müssen wir die Komponente dynamisch laden und SSR deaktivieren
const PlanBMap = dynamic(() => import('../ts/PlanBMap'), {
  ssr: false
});

// Eigene Farbschemen definieren
const customCategoryColors = {
  A: "#8B0000", // Dunkelrot
  B: "#006400", // Dunkelgrün
  C: "#00008B", // Dunkelblau
};

const MapPage = () => {
  return (
    <div className="container">
      <h1>Plan B Karte</h1>
      
      <div style={{ height: '600px', width: '100%', marginBottom: '2rem' }}>
        {/* Standardversion mit Standardparametern */}
        <PlanBMap markers={markersData} />
      </div>
      
      <h2>Angepasste Version</h2>
      <div style={{ height: '400px', width: '100%' }}>
        {/* Angepasste Version mit eigenen Parametern */}
        <PlanBMap 
          markers={markersData}
          mapStyle="https://api.maptiler.com/maps/streets/style.json"
          center={{ lon: 11.6603, lat: 46.7176 }}
          zoom={14}
          categoryColors={customCategoryColors}
          showDrinkingWater={false}
        />
      </div>
      
      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        h1, h2 {
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
};

export default MapPage; 