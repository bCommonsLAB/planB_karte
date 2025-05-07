import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { FeatureCollection, Feature } from 'geojson';
import { Map, List, Plus } from 'lucide-react';
import PlaceDetail from './PlaceDetail';

// Typ-Erweiterung für globale Hilfsvariablen
declare global {
  interface Window {
    _planBPickerModeActive?: boolean;
    _planBLastSelectedCoordinates?: [number, number];
  }
}

// Interface für MongoDB-Features mit _id
interface MongoDBFeature extends Feature {
  _id?: string;
}

// Dynamischer Import der Kartenkomponente, da sie nur clientseitig funktioniert
const PlanBMap = dynamic(() => import('./PlanBMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-secondary/30">Lade Karte...</div>
});

interface MapExplorerProps {
  markers: FeatureCollection;
  mapHeight?: string;
  mapWidth?: string;
}

const MapExplorer: React.FC<MapExplorerProps> = ({
  markers: initialMarkers,
  mapHeight = '600px',
  mapWidth = '100%'
}) => {
  const [activeTab, setActiveTab] = useState<string>('map');
  // Staat für den ausgewählten Ort und die Anzeige der Detailansicht
  const [selectedPlace, setSelectedPlace] = useState<MongoDBFeature | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  // State für den Ortsauswahl-Modus
  const [isPickingLocation, setIsPickingLocation] = useState<boolean>(false);
  const [locationPickerCallback, setLocationPickerCallback] = useState<((coordinates: [number, number]) => void) | null>(null);
  // State für neue Orte
  const [isCreatingNewPlace, setIsCreatingNewPlace] = useState<boolean>(false);
  // State für die Markerliste, initial gesetzt mit den Props
  const [markers, setMarkers] = useState<FeatureCollection>(initialMarkers);
  
  // useEffect zum Aktualisieren des markers-State, wenn sich initialMarkers ändert
  React.useEffect(() => {
    setMarkers(initialMarkers);
  }, [initialMarkers]);
  
  // Event-Listener für den Tab-Wechsel zur Kartenansicht
  React.useEffect(() => {
    const handleSwitchToMapView = () => {
      // Prüfe, ob wir bereits in der Kartenansicht sind
      if (activeTab !== 'map') {
        setActiveTab('map');
      }
    };
    
    // Event-Listener registrieren
    document.addEventListener('planBSwitchToMapView', handleSwitchToMapView);
    
    // Event-Listener entfernen beim Aufräumen
    return () => {
      document.removeEventListener('planBSwitchToMapView', handleSwitchToMapView);
    };
  }, [activeTab]);

  // Zentrale Funktion zum Aktualisieren eines Ortes mit neuen Koordinaten
  const updatePlaceWithCoordinates = (coordinates: [number, number]) => {
    if (selectedPlace) {
      // Erstelle ein aktualisiertes Feature mit den neuen Koordinaten
      const updatedPlace: MongoDBFeature = {
        ...selectedPlace,
        geometry: {
          ...selectedPlace.geometry,
          type: 'Point',
          coordinates: [coordinates[0], coordinates[1]] // Format [lon, lat]
        }
      };
      
      // Aktualisiere den selectedPlace
      setSelectedPlace(updatedPlace);
      
      return true;
    }
    return false;
  };

  // Listener für das forceReopenDialog-Event
  React.useEffect(() => {
    const handleForceReopen = (event: CustomEvent) => {
      // Öffne den Dialog, wenn er geschlossen ist
      if (!isDetailOpen) {
        setIsDetailOpen(true);
      }
      
      // Beende den Picker-Modus, unabhängig vom aktuellen Zustand
      if (isPickingLocation) {
        setIsPickingLocation(false);
        setLocationPickerCallback(null);
        window._planBPickerModeActive = false;
      }
      
      // Speichere die Koordinaten, falls vorhanden
      if (event.detail?.coordinates && Array.isArray(event.detail.coordinates) && event.detail.coordinates.length === 2) {
        window._planBLastSelectedCoordinates = event.detail.coordinates;
        
        // Wenn wir einen selectedPlace haben, aktualisiere seine Koordinaten
        if (selectedPlace) {
          updatePlaceWithCoordinates(event.detail.coordinates);
        }
      }
    };
    
    // TypeScript-Hilfe für CustomEvent
    document.addEventListener('forceReopenDialog', handleForceReopen as EventListener);
    
    return () => {
      document.removeEventListener('forceReopenDialog', handleForceReopen as EventListener);
    };
  }, [isDetailOpen, isPickingLocation, selectedPlace, updatePlaceWithCoordinates]);

  // Funktion zum Öffnen der Detailansicht
  const handlePlaceClick = async (feature: MongoDBFeature) => {
    // Wenn wir im Location-Picker-Modus sind, verwenden wir die Koordinaten des angeklickten Ortes
    if (isPickingLocation && locationPickerCallback && feature.geometry.type === 'Point') {
      const coordinates = feature.geometry.coordinates as [number, number];
      locationPickerCallback(coordinates);
      
      // Picker-Modus beenden, aber Zoom-Level und Position beibehalten
      setIsPickingLocation(false);
      setLocationPickerCallback(null);
      return;
    }

    // Normaler Modus: Feature anzeigen, ohne Zoom zu ändern
    try {
      // Hole die neuesten Daten für diesen Ort vom Server
      const featureId = feature._id || (feature.properties && feature.properties._id);
      
      if (featureId) {
        const response = await fetch(`/api/places/${featureId}`);
        
        if (response.ok) {
          const freshPlace = await response.json();
          
          // Überprüfe, ob die Geometrie-Koordinaten und die Properties-Koordinaten unterschiedlich sind
          if (freshPlace.geometry?.type === 'Point' && 
              freshPlace.properties && 
              ("Koordinate N" in freshPlace.properties || "Koordinate O" in freshPlace.properties)) {
            
            const geometryCoords = freshPlace.geometry.coordinates;
            const propsLat = freshPlace.properties["Koordinate N"];
            const propsLon = freshPlace.properties["Koordinate O"];
            
            // WICHTIG: Verwende IMMER die Geometrie-Koordinaten als die korrekten
            // und aktualisiere die Properties-Koordinaten, falls sie abweichen
            if (propsLat !== geometryCoords[1] || propsLon !== geometryCoords[0]) {
              freshPlace.properties["Koordinate N"] = geometryCoords[1]; // lat
              freshPlace.properties["Koordinate O"] = geometryCoords[0]; // lon
            }
          }
          
          // Verwende die neuesten Daten für den ausgewählten Ort
          setSelectedPlace(freshPlace);
        } else {
          // Fallback: Verwende die vorhandenen Daten
          setSelectedPlace(feature);
        }
      } else {
        // Fallback: Verwende die vorhandenen Daten
        setSelectedPlace(feature);
      }
    } catch (error) {
      // Fallback: Verwende die vorhandenen Daten
      setSelectedPlace(feature);
    }
    
    // Detail-Dialog anzeigen
    setIsDetailOpen(true);
  };

  // Funktion zum Schließen der Detailansicht
  const handleDetailClose = () => {
    setIsDetailOpen(false);
  };

  // Funktion zum Erstellen eines neuen Ortes
  const handleCreateNewPlace = () => {
    // Erstelle ein leeres Feature für den neuen Ort
    const emptyPlace: MongoDBFeature = {
      type: 'Feature',
      properties: {
        Name: 'Neuer Ort', // Gib einen temporären Namen statt eines leeren Strings
        Beschreibung: 'Beschreibung hinzufügen', // Gib eine temporäre Beschreibung
        Kategorie: 'A',
      },
      geometry: {
        type: 'Point',
        coordinates: [11.6603, 46.7176] // Standard-Koordinaten für Bozen
      }
    };
    
    // Setze den ausgewählten Ort auf das Feature mit Standardwerten
    setSelectedPlace(emptyPlace);
    
    // Kennzeichnen, dass wir einen neuen Ort erstellen
    setIsCreatingNewPlace(true);
    
    // Öffne die Detailansicht im Bearbeitungsmodus
    setIsDetailOpen(true);
  };

  // Funktion zum Aktualisieren des ausgewählten Ortes nach Speicherung
  const handlePlaceUpdate = (updatedPlace: MongoDBFeature) => {
    // Aktualisiere den ausgewählten Ort mit dem neuen Ort
    setSelectedPlace(updatedPlace);
    
    // Erstelle eine Kopie der aktuellen markers-Liste
    let updatedMarkers;
    
    // Prüfe, ob wir einen neuen Ort erstellen
    if (isCreatingNewPlace) {
      // Beende den Erstellungsmodus
      setIsCreatingNewPlace(false);
      
      // Erstelle eine Kopie des aktuellen markers-Objekts mit dem neuen Feature
      updatedMarkers = {
        ...markers,
        features: [...markers.features, updatedPlace]
      };
    } else {
      // Tiefe Kopie für Referenzprobleme
      const deepCopyPlace = JSON.parse(JSON.stringify(updatedPlace));
      
      // Aktualisiere das entsprechende Feature in der markers-Liste
      updatedMarkers = {
        ...markers,
        features: markers.features.map((feature) => {
          // Wenn die ID übereinstimmt, ersetze das Feature
          if ((feature as MongoDBFeature)._id === updatedPlace._id) {
            return deepCopyPlace;
          }
          return feature;
        })
      };
    }
    
    // Wichtig: Aktualisiere den markers-State, um ein Re-Rendering zu erzwingen
    // @ts-ignore - TypeScript könnte Probleme mit FeatureCollection-Typen haben
    setMarkers(updatedMarkers);
    
    // Löse ein Event aus, um die Karte zu aktualisieren
    const refreshEvent = new CustomEvent('planBMapRefreshMarkers', {
      detail: { 
        updatedFeature: updatedPlace,
        fullMarkerList: updatedMarkers
      }
    });
    document.dispatchEvent(refreshEvent);
    
    // Bei neuen Orten zusätzlich einen verzögerten Refresh auslösen
    if (isCreatingNewPlace) {
      setTimeout(() => {
        const delayedRefreshEvent = new CustomEvent('planBMapRefreshMarkers', {
          detail: { 
            updatedFeature: updatedPlace,
            fullMarkerList: updatedMarkers
          }
        });
        document.dispatchEvent(delayedRefreshEvent);
      }, 500);
    }
  };

  // Funktion für die Ortsauswahl auf der Karte
  const handlePickLocation = (callback: (coordinates: [number, number]) => void) => {
    // Aktiviere den Location-Picker-Modus
    setIsPickingLocation(true);
    setLocationPickerCallback(() => callback);
    
    // Stelle sicher, dass der Dialog geschlossen wird, damit die Karte sichtbar ist
    setIsDetailOpen(false);
  };
  
  // Funktion für den Map-Click-Handler
  const handleMapClick = (coordinates: [number, number]) => {
    // WICHTIG: Speichere die Koordinaten direkt global
    window._planBLastSelectedCoordinates = coordinates;
    
    // Prüfe, ob wir im Picker-Modus sind - berücksichtige sowohl lokalen als auch globalen Zustand
    const isInPickerMode = isPickingLocation || window._planBPickerModeActive;
    
    // FALL 1: Regulärer Fall - Callback ist vorhanden und wir sind im Picker-Modus
    if (isInPickerMode && locationPickerCallback) {
      try {
        // Speichere die aktuellen Properties, um sie nach der Koordinatenauswahl zu behalten
        const currentProperties = selectedPlace?.properties || {};
        
        // Rufe den gespeicherten Callback mit den Koordinaten auf
        locationPickerCallback(coordinates);
        
        // Picker-Modus beenden (sowohl lokal als auch global)
        setIsPickingLocation(false);
        setLocationPickerCallback(null);
        window._planBPickerModeActive = false;
        
        // DIREKT den Ort mit neuen Koordinaten aktualisieren, aber Properties behalten
        if (selectedPlace) {
          // Erstelle eine aktualisierte Kopie mit den neuen Koordinaten, 
          // aber behalte alle anderen Properties bei
          const updatedPlace: MongoDBFeature = {
            ...selectedPlace,
            properties: {
              ...currentProperties
            },
            geometry: {
              type: 'Point',
              coordinates: [coordinates[0], coordinates[1]] // [lon, lat]
            }
          };
          
          setSelectedPlace(updatedPlace);
        } else {
          // Falls kein selectedPlace vorhanden ist (unwahrscheinlich)
          updatePlaceWithCoordinates(coordinates);
        }
        
        // Detail-Dialog wieder öffnen
        setIsDetailOpen(true);
      } catch (error) {
        // Bei einem Fehler trotzdem in den normalen Modus zurückkehren
        setIsPickingLocation(false);
        setLocationPickerCallback(null);
        window._planBPickerModeActive = false;
        
        // DIREKT den Ort mit neuen Koordinaten aktualisieren
        updatePlaceWithCoordinates(coordinates);
        
        // Dialog wieder öffnen mit einer Fehlermeldung
        setIsDetailOpen(true);
        
        // Optional: Fehlermeldung anzeigen
        alert("Fehler bei der Ortsauswahl. Bitte versuche es erneut.");
      }
    } 
    // FALL 2: Globaler Picker-Modus ist aktiv, aber kein Callback - Race-Condition
    else if (isInPickerMode) {
      // Zurücksetzen beider Zustände
      setIsPickingLocation(false);
      setLocationPickerCallback(null);
      window._planBPickerModeActive = false;
      
      // DIREKT den Ort mit neuen Koordinaten aktualisieren
      const wasUpdated = updatePlaceWithCoordinates(coordinates);
      
      // Der benutzerfreundlichste Ansatz ist, den Dialog einfach wieder zu öffnen
      setIsDetailOpen(true);
      
      // Force-Reopen-Event für Notfälle auslösen
      setTimeout(() => {
        if (!isDetailOpen) {
          const triggerEvent = new CustomEvent('forceReopenDialog', {
            detail: { coordinates }
          });
          document.dispatchEvent(triggerEvent);
        }
      }, 200);
    }
    // FALL 3: Kein Picker-Modus aktiv, normaler Klick auf die Karte
    else {
      // Sicherstellen, dass der globale Picker-Modus definitiv ausgeschaltet ist
      window._planBPickerModeActive = false;
    }
  };

  return (
    <div className="w-full bg-[#e9f0df] rounded-lg shadow-sm border border-green-200 p-4">
      <Tabs defaultValue="map" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Plan B Karte</h2>
          <div className="flex flex-row items-center gap-2">
            <button
              onClick={handleCreateNewPlace}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors duration-200"
            >
              <Plus size={16} />
              <span>Neuen Ort erfassen</span>
            </button>
            <TabsList className="bg-gray-200 p-1 shadow-sm">
              <TabsTrigger 
                value="map" 
                className="flex items-center gap-2 text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                <Map size={16} />
                <span>Karte</span>
              </TabsTrigger>
              <TabsTrigger 
                value="gallery" 
                className="flex items-center gap-2 text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                <List size={16} />
                <span>Galerie</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="map" className="mt-1 rounded-lg overflow-hidden border border-green-200">
          <div style={{ height: mapHeight, width: mapWidth }}>
            <PlanBMap 
              markers={markers} 
              height={mapHeight} 
              width={mapWidth} 
              onMarkerClick={handlePlaceClick}
              onMapClick={handleMapClick}
              isPickingLocation={isPickingLocation}
            />
            
            {/* Hinweis für den Ortsauswahl-Modus */}
            {isPickingLocation && (
              <div className="absolute top-4 left-4 right-4 mx-auto max-w-md bg-blue-100 border border-blue-300 text-blue-800 px-4 py-3 rounded-md shadow-md z-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">Ortsauswahl-Modus aktiv</p>
                    <p className="text-sm">Klicke auf die Karte, um einen Ort auszuwählen</p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsPickingLocation(false);
                      setLocationPickerCallback(null);
                      setIsDetailOpen(true);
                    }}
                    className="bg-white text-blue-600 px-2 py-1 rounded hover:bg-blue-50 text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gallery" className="mt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {markers.features.map((feature, index) => {
              if (!feature.properties) return null;
              
              // Hole die relevanten Eigenschaften aus den Properties
              const { 
                Name, 
                Beschreibung, 
                Adresse, 
                Kategorie, 
                Öffnungszeiten, 
                "Webseite(n)": Webseite 
              } = feature.properties;
              
              // Bestimme die Kartenfarbe basierend auf der Kategorie
              const categoryColors: Record<string, string> = {
                'A': 'bg-red-50 border-red-200',
                'B': 'bg-green-50 border-green-200',
                'C': 'bg-blue-50 border-blue-200'
              };
              const cardColor = (Kategorie && categoryColors[Kategorie]) || 'bg-gray-50 border-gray-200';
              
              return (
                <div 
                  key={`marker-${index}`} 
                  className={`border rounded-lg p-4 shadow-sm ${cardColor} hover:shadow-md transition-all duration-200 cursor-pointer`}
                  onClick={() => handlePlaceClick(feature as MongoDBFeature)}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">{Name}</h3>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-white shadow-sm">
                      Kategorie {Kategorie}
                    </span>
                  </div>
                  
                  {Beschreibung && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-3">{Beschreibung}</p>
                  )}
                  
                  <div className="mt-4 space-y-1 text-xs text-gray-600">
                    {Adresse && <p><span className="font-medium">Adresse:</span> {Adresse}</p>}
                    {Öffnungszeiten && <p><span className="font-medium">Öffnungszeiten:</span> {Öffnungszeiten}</p>}
                    {Webseite && (
                      <p>
                        <span className="font-medium">Website:</span> 
                        <a 
                          href={Webseite as string} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-green-600 hover:text-green-800 hover:underline ml-1 transition-colors"
                          onClick={(e) => e.stopPropagation()} // Verhindert, dass die Detailansicht auch geöffnet wird
                        >
                          {Webseite}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail-Ansicht */}
      {/* isCreatingNewPlace wird als isNewPlace an PlaceDetail übergeben */}
      <PlaceDetail 
        place={selectedPlace} 
        isOpen={isDetailOpen} 
        onClose={handleDetailClose} 
        onUpdate={handlePlaceUpdate}
        onPickLocation={handlePickLocation}
        isNewPlace={isCreatingNewPlace}
      />
    </div>
  );
};

export default MapExplorer; 