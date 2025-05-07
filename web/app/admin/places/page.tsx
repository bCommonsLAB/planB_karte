'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Typdefinitionen
interface Marker {
  type: string;
  properties: {
    Name: string;
    Adresse?: string;
    Beschreibung?: string;
    Kategorie?: string;
    [key: string]: any;
  };
  geometry: {
    type: string;
    coordinates: [number, number] | null;
  };
  _id?: string;
}

interface ApiResponse {
  type: string;
  features: Marker[];
}

export default function AdminPlaces() {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [category, setCategory] = useState<string>('');

  // Daten laden
  useEffect(() => {
    const fetchMarkers = async () => {
      try {
        setLoading(true);
        
        // API-Parameter für die Filterung
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        
        // Daten von der API abrufen
        const response = await fetch(`/api/places?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Fehler beim Laden der Daten: ${response.status}`);
        }
        
        const data: ApiResponse = await response.json();
        setMarkers(data.features);
        setError(null);
      } catch (err) {
        console.error('Fehler beim Laden der Marker:', err);
        setError('Die Daten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.');
      } finally {
        setLoading(false);
      }
    };

    fetchMarkers();
  }, [category]);

  // Nach Name filtern
  const filteredMarkers = markers.filter(marker => 
    marker.properties.Name.toLowerCase().includes(filter.toLowerCase())
  );

  // Kategorien für den Filter
  const categories = Array.from(new Set(markers.map(marker => marker.properties.Kategorie || 'Keine Kategorie')));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Orte verwalten</h1>
      
      {/* Filteroptionen */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[250px]">
          <label htmlFor="search" className="block text-sm font-medium mb-1">
            Nach Name suchen
          </label>
          <input
            type="text"
            id="search"
            className="w-full p-2 border rounded"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Name eingeben..."
          />
        </div>
        
        <div className="flex-1 min-w-[250px]">
          <label htmlFor="category" className="block text-sm font-medium mb-1">
            Nach Kategorie filtern
          </label>
          <select
            id="category"
            className="w-full p-2 border rounded"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Alle Kategorien</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Fehlermeldung */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Ladeanzeige */}
      {loading ? (
        <div className="text-center py-10">
          <p className="text-gray-600">Daten werden geladen...</p>
        </div>
      ) : (
        <>
          {/* Ergebniszähler */}
          <p className="text-sm text-gray-600 mb-4">
            {filteredMarkers.length} Orte gefunden
          </p>
          
          {/* Tabelle mit Markern */}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-3 border text-left">Name</th>
                  <th className="py-2 px-3 border text-left">Adresse</th>
                  <th className="py-2 px-3 border text-left">Kategorie</th>
                  <th className="py-2 px-3 border text-left">Koordinaten</th>
                  <th className="py-2 px-3 border text-left">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarkers.map((marker, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-2 px-3 border">
                      {marker.properties.Name || 'Unbekannt'}
                    </td>
                    <td className="py-2 px-3 border">
                      {marker.properties.Adresse || '-'}
                    </td>
                    <td className="py-2 px-3 border">
                      {marker.properties.Kategorie || '-'}
                    </td>
                    <td className="py-2 px-3 border">
                      {marker.geometry.coordinates ? 
                        `${marker.geometry.coordinates[1].toFixed(5)}, ${marker.geometry.coordinates[0].toFixed(5)}` : 
                        'Keine Koordinaten'}
                    </td>
                    <td className="py-2 px-3 border">
                      <div className="flex space-x-2">
                        <button 
                          className="text-blue-500 hover:underline"
                          onClick={() => alert('Details anzeigen (noch nicht implementiert)')}
                        >
                          Details
                        </button>
                        {/* Weitere Aktionen wie Bearbeiten oder Löschen können hier hinzugefügt werden */}
                      </div>
                    </td>
                  </tr>
                ))}
                
                {filteredMarkers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-500">
                      Keine Orte gefunden, die den Filterkriterien entsprechen.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
} 