import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl, { LngLatLike, Map, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Feature, FeatureCollection } from 'geojson';
import styles from './PlanBMap.module.css';
import { appState } from '../../utils/appState';

// Set für bereits registrierte Event-Handler-Layer
const registeredEventLayers = new Set<string>();

// Debug-Einstellungen
const DEBUG_MODE = true; // Auf true setzen, um erweiterte Debug-Informationen zu sehen

// Typ-Erweiterung für globale Hilfsvariablen
declare global {
  interface Window {
    _planBPickerModeActive?: boolean;
    _planBLastSelectedCoordinates?: [number, number];
  }
}

// Erweitere das Feature-Interface für MongoDB-Features, die eine _id haben können
interface MongoDBFeature extends Feature {
  _id?: string;
}

interface PlanBMapProps {
  markers: FeatureCollection;
  mapStyle?: string;
  mapApiKey?: string; 
  center?: LngLatLike;
  zoom?: number;
  categoryColors?: {[key: string]: string};
  showDrinkingWater?: boolean;
  height?: string;
  width?: string;
  onMarkerClick?: (feature: MongoDBFeature) => void;
  onMapClick?: (coordinates: [number, number]) => void;
  isPickingLocation?: boolean;
}

const PlanBMap: React.FC<PlanBMapProps> = ({
  markers,
  mapStyle = 'https://api.maptiler.com/maps/basic/style.json',
  mapApiKey = 'Q5QrPJVST2pfBYoNSxOo',
  center = { lon: 11.6603, lat: 46.7176 },
  zoom = 13.5,
  categoryColors = {},
  showDrinkingWater = false,
  height = '100%',
  width = '100%',
  onMarkerClick,
  onMapClick,
  isPickingLocation = false
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const filterGroupRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const componentId = useRef(`planb-${Math.random().toString(36).substring(2, 9)}`);
  
  // Referenz für den aktuellen Kartenzustand
  const mapStateRef = useRef({
    center,
    zoom,
    isUserInteraction: false
  });

  // Referenz für temporären Marker bei Ortsauswahl
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Memoize Marker, um unnötige Re-Renders zu vermeiden
  const memoizedMarkers = useMemo(() => markers, [
    markers.features.length,
    JSON.stringify(markers.features.map(f => f.properties?.id || f.id))
  ]);

  // Funktion zum Korrigieren falscher Koordinaten
  const fixCoordinates = (feature: Feature): Feature => {
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
      console.log(`[PlanBMap] Ungültige Koordinaten [0,0] für "${featureName}" gefunden`);
      
      // Setze Nullkoordinaten auf Standard-Brixen-Position mit zufälligem Versatz
      const brixenLat = 46.7165;
      const brixenLon = 11.566;
      const randomOffset = (Math.random() - 0.5) * 0.01; // ca. 0.5-1km Versatz
      
      feature.geometry.coordinates = [brixenLon + randomOffset, brixenLat + randomOffset];
      console.log(`[PlanBMap] Nullkoordinaten für "${featureName}" auf Brixen-Position gesetzt: [${feature.geometry.coordinates[0]}, ${feature.geometry.coordinates[1]}]`);
      
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
      console.log(`[PlanBMap] Marker "${featureName}" liegt ${distanceToBrixen.toFixed(2)}km von Brixen entfernt - zu weit!`);
      
      // KORREKTURMETHODE 1: Dezimalpunkt-Korrektur für Längengrad
      if (lon > 20 && lon < 200) {
        const correctedLon = lon / 10;
        const newDistance = calculateDistance(lat, correctedLon, brixenLat, brixenLon);
        
        if (newDistance < 10) {
          console.log(`[PlanBMap] Korrigiere Längengrad für "${featureName}": ${lon} -> ${correctedLon} (neue Distanz: ${newDistance.toFixed(2)}km)`);
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
          console.log(`[PlanBMap] Korrigiere Breitengrad für "${featureName}": ${lat} -> ${correctedLat} (neue Distanz: ${newDistance.toFixed(2)}km)`);
          lat = correctedLat;
          feature.geometry.coordinates[1] = correctedLat;
          hasBeenCorrected = true;
        }
      }
      
      // KORREKTURMETHODE 3: Vertauschte Koordinaten
      if (!hasBeenCorrected) {
        const distanceWithSwappedCoords = calculateDistance(lon, lat, brixenLat, brixenLon);
        
        if (distanceWithSwappedCoords < 10) {
          console.log(`[PlanBMap] Vertauschte Koordinaten für "${featureName}": [${lon}, ${lat}] -> [${lat}, ${lon}] (neue Distanz: ${distanceWithSwappedCoords.toFixed(2)}km)`);
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
            console.log(`[PlanBMap] Komplexe Korrektur für "${featureName}": [${lon}, ${lat}] -> [${correctedLon}, ${correctedLat}] (neue Distanz: ${newDistance.toFixed(2)}km)`);
            feature.geometry.coordinates = [correctedLon, correctedLat];
            hasBeenCorrected = true;
            break;
          }
        }
      }
      
      // LETZTE RETTUNG: Wenn keine Korrektur funktioniert hat, setzen wir den Punkt nahe Brixen
      if (!hasBeenCorrected) {
        console.log(`[PlanBMap] Keine passende Korrektur für "${featureName}" gefunden. Setze auf Standardposition in Brixen.`);
        
        // Setze auf einen Punkt nahe Brixen mit leichtem Versatz für bessere Sichtbarkeit
        const randomOffset = (Math.random() - 0.5) * 0.005; // etwa 250-500m Versatz
        feature.geometry.coordinates = [brixenLon + randomOffset, brixenLat + randomOffset];
      }
    }
    
    return feature;
  };

  // Funktion zur Berechnung der Entfernung zwischen zwei Punkten (Haversine-Formel)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
  };

  // Funktion zum Prüfen, ob Koordinaten innerhalb des erlaubten Bereichs liegen
  const isWithinAllowedArea = (lon: number, lat: number): boolean => {
    // Referenzpunkt für Brixen/Südtirol (korrigierte Werte)
    const centerLat = 46.7165;  // Korrigiert von 4.67165
    const centerLon = 11.566;   // Korrigiert von 116.566
    
    // Maximale Entfernung in km
    const maxDistance = 10;
    
    // Berechne die Entfernung
    const distance = calculateDistance(lat, lon, centerLat, centerLon);
    
    // Gib die Entfernung für Debugging-Zwecke aus
    // console.log(`Entfernung von [${lon}, ${lat}] zum Zentrum: ${distance.toFixed(2)} km`);
    
    // True, wenn die Entfernung kleiner als maxDistance ist
    return distance <= maxDistance;
  };

  // Generiere dynamisch Farben für alle Kategorien
  const dynamicCategoryColors = useMemo(() => {
    const colors = { ...categoryColors };
    const uniqueCategories = new Set<string>();
    
    // Sammle alle Kategorien aus den Markern
    memoizedMarkers.features.forEach(feature => {
      // Sicherheitsprüfung für ungültige Features
      if (!feature || !feature.properties) return;
      
      // Wenn keine Kategorie vorhanden ist, eine Default-Kategorie "unbekannt" setzen
      const kategorie = feature.properties.Kategorie || "unbekannt";
      uniqueCategories.add(kategorie);
    });
    
    // Generiere Farben für nicht vordefinierte Kategorien
    Array.from(uniqueCategories).forEach(category => {
      if (!colors[category]) {
        const hue = Math.abs(category.charCodeAt(0) * 137.5) % 360;
        colors[category] = `hsl(${hue}, 70%, 50%)`;
      }
    });
    
    return colors;
  }, [memoizedMarkers, categoryColors]);

  // URL für den Kartenstil mit API-Key zusammenbauen
  const getMapStyle = async (): Promise<string> => {
    let effectiveStyle = mapStyle;
    
    if (mapApiKey && !effectiveStyle.includes('key=')) {
      effectiveStyle += effectiveStyle.includes('?') ? `&key=${mapApiKey}` : `?key=${mapApiKey}`;
    }
    
    return effectiveStyle;
  };

  // Initialisiere die Karte einmalig
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initializeMap = async () => {
      try {
        // Erfasse Marker ohne Kategorie
        const markersWithoutCategory = memoizedMarkers.features.filter(
          feature => !feature.properties?.Kategorie
        );
        
        console.log(`[PlanBMap] ${markersWithoutCategory.length} Marker ohne Kategorie gefunden, werden als "unbekannt" kategorisiert:`);
        markersWithoutCategory.forEach((feature, index) => {
          if (index < 10) { // Zeige nur die ersten 10 an
            const coords = feature.geometry.type === 'Point' && 'coordinates' in feature.geometry ? 
              feature.geometry.coordinates : null;
            console.log(`  - Marker ohne Kategorie #${index}: Name=${feature.properties?.Name}, Koordinaten=${coords}`);
          }
        });
        if (markersWithoutCategory.length > 10) {
          console.log(`  ... und ${markersWithoutCategory.length - 10} weitere Marker ohne Kategorie`);
        }
        
        // Erfasse Marker mit Null-Koordinaten
        const markersWithZeroCoordinates = memoizedMarkers.features.filter(
          feature => {
            if (feature.geometry?.type !== 'Point') return false;
            const [lon, lat] = feature.geometry.coordinates;
            return lon === 0 && lat === 0;
          }
        );
        
        console.log(`[PlanBMap] ${markersWithZeroCoordinates.length} Marker mit Koordinaten [0,0] gefunden:`);
        markersWithZeroCoordinates.forEach((feature, index) => {
          if (index < 10) {
            console.log(`  - Marker mit Nullkoordinaten #${index}: Name=${feature.properties?.Name}, Kategorie=${feature.properties?.Kategorie || 'unbekannt'}`);
          }
        });
        if (markersWithZeroCoordinates.length > 10) {
          console.log(`  ... und ${markersWithZeroCoordinates.length - 10} weitere Marker mit Nullkoordinaten`);
        }
        
        // Erfasse Marker außerhalb des erlaubten Bereichs
        const markersOutsideAllowedArea = memoizedMarkers.features.filter(
          feature => {
            // Prüfe zuerst, ob die Geometrie existiert
            if (!feature.geometry || feature.geometry.type !== 'Point') return false;
            
            // Koordinaten korrigieren (falls nötig)
            let [lon, lat] = feature.geometry.coordinates || [0, 0];
            if (lon > 20 && lon < 200) lon = lon / 10;
            if (lat > 0 && lat < 10) lat = lat * 10;
            
            // Prüfen, ob sie innerhalb des erlaubten Bereichs liegen
            return !isWithinAllowedArea(lon, lat);
          }
        );
        
        console.log(`[PlanBMap] ${markersOutsideAllowedArea.length} Marker außerhalb des 10km-Radius um Brixen gefunden:`);
        markersOutsideAllowedArea.forEach((feature, index) => {
          if (index < 10) {
            let [lon, lat] = feature.geometry.type === 'Point' && 'coordinates' in feature.geometry ? 
              feature.geometry.coordinates : [0, 0];
            if (lon > 20 && lon < 200) lon = lon / 10;
            if (lat > 0 && lat < 10) lat = lat * 10;
            
            console.log(`  - Marker außerhalb #${index}: Name=${feature.properties?.Name}, Kategorie=${feature.properties?.Kategorie || 'unbekannt'}, Koordinaten=[${lon}, ${lat}]`);
          }
        });
        if (markersOutsideAllowedArea.length > 10) {
          console.log(`  ... und ${markersOutsideAllowedArea.length - 10} weitere Marker außerhalb des erlaubten Bereichs`);
        }
        
        const styleUrl = await getMapStyle();
        console.log(`[PlanBMap] Map wird initialisiert mit Stil: ${styleUrl}`);
        
        // Initialisiere die Karte
        const map = new maplibregl.Map({
          container: mapContainer.current!,
          style: styleUrl,
          center: center,
          zoom: zoom,
          pitchWithRotate: false, // Disable tilting the map
        });
        
        console.log(`[PlanBMap] Map-Objekt erstellt`);
        mapRef.current = map;
        
        // Create a popup, but don't add it to the map yet
        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
        });

        // Protokolliere allgemeine Map-Events
        ['load', 'error', 'styledata', 'sourcedataloading', 'sourcedataabort'].forEach(event => {
          map.on(event, (e) => {
            console.log(`[PlanBMap ${componentId.current}] Map-Event: ${event}`, e?.type ? e : '');
          });
        });

        // Speichere den aktuellen Zustand der Karte, wenn der Benutzer zoomt oder verschiebt
        map.on('moveend', (e) => {
          // Aktualisiere nur, wenn es sich um eine Benutzerinteraktion handelt und nicht um programmatische Änderungen
          // WICHTIG: e.originalEvent gibt es nur, wenn der Benutzer interagiert hat
          const isUserAction = !!e.originalEvent;
          
          const newCenter = map.getCenter();
          const newZoom = map.getZoom();
          
          // Wenn es eine Benutzerinteraktion war, setzen wir das Flag
          if (isUserAction) {
            // Speichere den neuen Zustand in der Ref
            mapStateRef.current = {
              center: { lat: newCenter.lat, lon: newCenter.lng },
              zoom: newZoom,
              isUserInteraction: true
            };
          }
        });

        // Funktion zum Laden der Marker, die wir sowohl beim ersten Load als auch bei Stil-Updates verwenden
        const loadMarkers = async () => {
          console.log(`[PlanBMap] Map geladen, füge Marker hinzu...`);
          
          try {
            // Lade das Marker-Bild
            console.log(`[PlanBMap] Lade Marker-Bild...`);
            
            // Füge das Bild nur hinzu, wenn es noch nicht existiert
            if (!map.hasImage("custom-marker")) {
              const image = await map.loadImage(
                "https://maplibre.org/maplibre-gl-js/docs/assets/custom_marker.png"
              );
              map.addImage("custom-marker", image.data);
              console.log(`[PlanBMap] Marker-Bild geladen`);
            }

            // Füge für jede Kategorie eine Ebene hinzu
            const newLayerIDs: string[] = [];
            console.log(`[PlanBMap ${componentId.current}] Kategorien zum Hinzufügen:`, Object.keys(dynamicCategoryColors));
            
            // Leere alle vorherigen Checkboxen VOR der Schleife
            if (filterGroupRef.current && filterGroupRef.current.children.length > 0) {
              filterGroupRef.current.innerHTML = '';
            }
            
            Object.entries(dynamicCategoryColors).forEach(([category, color]) => {
              const layerID = `marker-${category}`;
              newLayerIDs.push(layerID);

              // Filtere die Features nach Kategorie
              const filteredFeatures = memoizedMarkers.features
                .filter(feature => {
                  // Kategorie des Features ermitteln
                  const featureKategorie = feature.properties?.Kategorie || "unbekannt";
                  
                  // Prüfen, ob das Feature zur aktuellen Kategorie gehört
                  return featureKategorie === category;
                })
                .map((feature: Feature) => {
                  // Debug-Informationen für jedes Feature ausgeben
                  if (DEBUG_MODE && feature.geometry?.type === 'Point') {
                    const coords = (feature.geometry as any).coordinates;
                    const featureName = feature.properties?.Name || 'Unbenannt';
                    console.log(`[PlanBMap-DEBUG] Feature vor Korrektur: "${featureName}" | Kategorie: ${category} | Koordinaten: [${coords[0]}, ${coords[1]}]`);
                  }
                  
                  // Korrigiere falsche Koordinaten
                  const correctedFeature = fixCoordinates(feature);
                  
                  // Debug-Informationen für korrigierte Features ausgeben
                  if (DEBUG_MODE && feature.geometry?.type === 'Point') {
                    // Typprüfung für beide Features
                    const originalFeatureWithCoords = feature.geometry as any;
                    const correctedFeatureWithCoords = correctedFeature.geometry as any;
                    
                    // Nur weiter prüfen, wenn sich die Koordinaten geändert haben
                    if (correctedFeatureWithCoords.coordinates[0] !== originalFeatureWithCoords.coordinates[0] ||
                        correctedFeatureWithCoords.coordinates[1] !== originalFeatureWithCoords.coordinates[1]) {
                      
                      const originalCoords = originalFeatureWithCoords.coordinates;
                      const correctedCoords = correctedFeatureWithCoords.coordinates;
                      console.log(`[PlanBMap-DEBUG] Feature KORRIGIERT: "${correctedFeature.properties?.Name}" | Original: [${originalCoords[0]}, ${originalCoords[1]}] | Korrigiert: [${correctedCoords[0]}, ${correctedCoords[1]}]`);
                    }
                  }
                  
                  return correctedFeature;
                });

              console.log(`[PlanBMap ${componentId.current}] Füge Kategorie ${category} mit ${filteredFeatures.length} Features hinzu`);
              
              // Detaillierte Marker-Informationen für Debugging
              filteredFeatures.forEach((feature: Feature, index) => {
                if (index < 5) { // Limitiere Ausgabe auf die ersten 5 Marker pro Kategorie
                  const coords = feature.geometry.type === 'Point' ? feature.geometry.coordinates : null;
                  console.log(`  - Marker #${index}: Name=${feature.properties?.Name}, Koordinaten=${coords}, Properties:`, feature.properties);
                }
              });
              if (filteredFeatures.length > 5) {
                console.log(`  ... und ${filteredFeatures.length - 5} weitere Marker`);
              }

              // Quelle und Layer hinzufügen
              if (!map.getSource(layerID)) {
                map.addSource(layerID, {
                  type: "geojson",
                  data: {
                    type: "FeatureCollection",
                    features: filteredFeatures,
                  },
                });

                map.addLayer({
                  id: layerID,
                  source: layerID,
                  type: "circle",
                  paint: {
                    "circle-radius": 6,
                    "circle-color": color,
                  },
                });

                console.log(`[PlanBMap] Layer "${layerID}" erfolgreich erstellt mit ${filteredFeatures.length} Markern`);

                // Event-Handler nur hinzufügen, wenn sie noch nicht registriert wurden
                if (!registeredEventLayers.has(layerID)) {
                  // Event-Handler für Hover
                  map.on("mouseenter", layerID, (e) => {
                    if (!e.features?.length) return;
                    
                    map.getCanvas().style.cursor = "pointer";
                    
                    const feature = e.features[0];
                    if (!feature.geometry || !feature.properties) return;
                    
                    if (feature.geometry.type === 'Point' && 'coordinates' in feature.geometry) {
                      const coordinates = [...feature.geometry.coordinates];
                      const { Name, Beschreibung, Öffnungszeiten } = feature.properties;

                      let popupContent = `<h3>${Name}</h3>`;
                      if (Beschreibung) popupContent += `<p>${Beschreibung}</p>`;
                      if (Öffnungszeiten) popupContent += `<p><b>Öffnungszeiten</b>: ${Öffnungszeiten}</p>`;

                      popup.setLngLat(coordinates as [number, number])
                        .setHTML(popupContent)
                        .addTo(map);
                    }
                  });

                  // Event-Handler für Marker-Klicks
                  map.on("click", layerID, (e) => {
                    if (!e.features?.length || !onMarkerClick) return;
                    
                    const feature = e.features[0];
                    
                    // Feature-ID ermitteln
                    let featureId = feature.id;
                    if (feature.properties?._id) {
                      featureId = feature.properties._id;
                    } else if (feature.properties?.id) {
                      featureId = feature.properties.id;
                    }
                    
                    // In geeignetes Format für Handler umwandeln
                    const geoJsonFeature: MongoDBFeature = {
                      type: "Feature",
                      geometry: feature.geometry,
                      properties: {
                        ...feature.properties,
                        _id: featureId !== undefined ? String(featureId) : undefined
                      },
                      _id: featureId !== undefined ? String(featureId) : undefined
                    };
                    
                    // Aktuellen Zustand speichern und Handler aufrufen
                    const currentCenter = map.getCenter();
                    const currentZoom = map.getZoom();
                    
                    mapStateRef.current = {
                      center: { lat: currentCenter.lat, lon: currentCenter.lng },
                      zoom: currentZoom,
                      isUserInteraction: true
                    };
                    
                    onMarkerClick(geoJsonFeature);
                  });

                  // Event-Handler für Mouse-Leave
                  map.on("mouseleave", layerID, () => {
                    map.getCanvas().style.cursor = "";
                    popup.remove();
                  });
                  
                  // Merke, dass Event-Handler für diesen Layer registriert wurden
                  registeredEventLayers.add(layerID);
                }

                // Nur Checkboxen erstellen, wenn filterGroupRef existiert
                if (filterGroupRef.current) {
                  const input = document.createElement("input");
                  input.type = "checkbox";
                  input.id = layerID;
                  input.checked = true;

                  const label = document.createElement("label");
                  label.setAttribute("for", layerID);
                  label.textContent = category;

                  filterGroupRef.current.appendChild(input);
                  filterGroupRef.current.appendChild(label);

                  input.addEventListener("change", (e) => {
                    const target = e.target as HTMLInputElement;
                    map.setLayoutProperty(
                      layerID,
                      "visibility",
                      target.checked ? "visible" : "none"
                    );
                  });
                }
              } else {
                // Quelle existiert bereits, aktualisiere nur die Daten
                const source = map.getSource(layerID) as maplibregl.GeoJSONSource;
                source.setData({
                  type: "FeatureCollection",
                  features: filteredFeatures,
                });
                console.log(`[PlanBMap] Existierende Quelle "${layerID}" aktualisiert mit ${filteredFeatures.length} Markern`);
              }
            });

            // Filter-Funktionalität hinzufügen
            if (filterInputRef.current) {
              filterInputRef.current.addEventListener("keyup", (e) => {
                const value = (e.target as HTMLInputElement).value.trim().toLowerCase();

                newLayerIDs.forEach((layerID) => {
                  if (value === "") {
                    map.setFilter(layerID, null);
                    return;
                  }

                  const categoryName = layerID.split("-")[1];
                  const filters: any[] = ["any"];
                  
                  memoizedMarkers.features.forEach((feature) => {
                    if (feature.properties?.Kategorie === categoryName) {
                      for (const key of ["Name", "Beschreibung"]) {
                        const property = feature.properties[key as keyof typeof feature.properties];
                        if (typeof property === "string" && property.toLowerCase().includes(value)) {
                          filters.push(["==", ["get", key], property]);
                          break;
                        }
                      }
                    }
                  });

                  if (filters.length > 1) {
                    map.setFilter(layerID, filters as any);
                  } else {
                    map.setFilter(layerID, ["==", ["get", "Name"], "NO_MATCH"]);
                  }
                });
              });
            }

            // NEUE FUNKTIONALITÄT: Fehlerhafte Marker auf einen Referenzpunkt setzen
            // Sammle Marker außerhalb des erlaubten Bereichs für die Warndreieck-Darstellung
            const errorFeatures = memoizedMarkers.features.filter(feature => {
              // Prüfe zuerst, ob die Geometrie existiert und vom Typ 'Point' ist
              if (!feature || !feature.geometry || feature.geometry.type !== 'Point' || !feature.geometry.coordinates) {
                return false;
              }
              
              // Koordinaten korrigieren (falls nötig)
              let [lon, lat] = feature.geometry.coordinates;
              if (lon > 20 && lon < 200) lon = lon / 10;
              if (lat > 0 && lat < 10) lat = lat * 10;
              
              // Speichere die Originalkoordinaten im Feature für das Popup
              if (feature.properties) {
                feature.properties.originalCoordinates = `[${feature.geometry.coordinates[0]}, ${feature.geometry.coordinates[1]}]`;
              }
              
              // Prüfen, ob die Koordinaten außerhalb des erlaubten Bereichs liegen
              return !isWithinAllowedArea(lon, lat);
            });
            
            // Erstelle die spezielle Ebene für fehlerhafte Marker
            if (errorFeatures.length > 0) {
              console.log(`[PlanBMap] Erstelle spezielle Ebene für ${errorFeatures.length} fehlerhafte Marker`);
              createErrorMarkersLayer(map, errorFeatures);
            }
          } catch (error) {
            console.error(`[PlanBMap] Fehler beim Laden der Kartendaten:`, error);
          }
        };

        // Handler für Klicks auf die Karte im Ortsauswahl-Modus
        map.on('click', (e) => {
          const isInPickerMode = isPickingLocation || !!tempMarkerRef.current || !!window._planBPickerModeActive;
          
          if (isInPickerMode && onMapClick) {
            // Verarbeite Klick im Ortsauswahl-Modus
            const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
            
            // Marker entfernen und Globale Variablen zurücksetzen
            if (tempMarkerRef.current) {
              tempMarkerRef.current.remove();
              tempMarkerRef.current = null;
            }
            
            map.getCanvas().style.cursor = '';
            window._planBPickerModeActive = false;
            window._planBLastSelectedCoordinates = coordinates;
            
            // Callback aufrufen
            onMapClick(coordinates);
          }
        });

        // Lade Marker beim ersten Load
        map.on('load', loadMarkers);
        
        // Wichtig: Auch bei Stil-Änderungen die Marker neu laden
        map.on('style.load', loadMarkers);
      } catch (error) {
        console.error(`Fehler beim Initialisieren der Karte:`, error);
      }
    };

    initializeMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Effekt für das Aktualisieren der Karte mit neuen Daten
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    
    const map = mapRef.current;
    
    // Nur Position aktualisieren, wenn keine Benutzerinteraktion stattgefunden hat
    const shouldUpdatePosition = !isPickingLocation && !mapStateRef.current.isUserInteraction;
    
    if (shouldUpdatePosition) {
      map.setCenter(center);
      map.setZoom(zoom);
    }
    
    // Markerdaten aktualisieren
    Object.entries(dynamicCategoryColors).forEach(([category]) => {
      const layerID = `marker-${category}`;
      const source = map.getSource(layerID) as maplibregl.GeoJSONSource;
      
      if (source) {
        const filteredFeatures = memoizedMarkers.features
          .filter(feature => {
            // Prüfe zunächst, ob Feature und properties existieren
            if (!feature || !feature.properties) return false;
            
            // Kategorie des Features ermitteln
            const featureKategorie = feature.properties?.Kategorie || "unbekannt";
            
            // Prüfen, ob das Feature zur aktuellen Kategorie gehört
            return featureKategorie === category;
          })
          .map(feature => {
            // Debug-Informationen für jedes Feature ausgeben
            if (DEBUG_MODE && feature.geometry?.type === 'Point') {
              const coords = (feature.geometry as any).coordinates;
              const featureName = feature.properties?.Name || 'Unbenannt';
              console.log(`[PlanBMap-DEBUG] Feature vor Korrektur: "${featureName}" | Kategorie: ${category} | Koordinaten: [${coords[0]}, ${coords[1]}]`);
            }
            
            // Korrigiere falsche Koordinaten
            const correctedFeature = fixCoordinates(feature);
            
            // Debug-Informationen für korrigierte Features ausgeben
            if (DEBUG_MODE && feature.geometry?.type === 'Point') {
              // Typprüfung für beide Features
              const originalFeatureWithCoords = feature.geometry as any;
              const correctedFeatureWithCoords = correctedFeature.geometry as any;
              
              // Nur weiter prüfen, wenn sich die Koordinaten geändert haben
              if (correctedFeatureWithCoords.coordinates[0] !== originalFeatureWithCoords.coordinates[0] ||
                  correctedFeatureWithCoords.coordinates[1] !== originalFeatureWithCoords.coordinates[1]) {
                
                const originalCoords = originalFeatureWithCoords.coordinates;
                const correctedCoords = correctedFeatureWithCoords.coordinates;
                console.log(`[PlanBMap-DEBUG] Feature KORRIGIERT: "${correctedFeature.properties?.Name}" | Original: [${originalCoords[0]}, ${originalCoords[1]}] | Korrigiert: [${correctedCoords[0]}, ${correctedCoords[1]}]`);
              }
            }
            
            return correctedFeature;
          });
        
        source.setData({
          type: 'FeatureCollection',
          features: filteredFeatures
        });
      }
    });
  }, [memoizedMarkers, dynamicCategoryColors, center, zoom, isPickingLocation]);

  // Effekt für den Ortsauswahl-Modus
  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    
    // Setze sowohl die lokale als auch die globale Zustandsvariable
    const currentPickerState = appState.getState().pickerModeActive;
    
    // Legacy: Aktualisiere auch die globale Variable
    window._planBPickerModeActive = isPickingLocation;
    
    // Marker hinzufügen oder entfernen, je nach Modus
    if (isPickingLocation) {
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
      }
      
      // Position bestimmen:
      // 1. Versuche die Koordinaten aus dem globalen Zustand zu verwenden
      // 2. Fallback auf window._planBLastSelectedCoordinates
      // 3. Fallback auf Kartenmitte
      let markerPosition: [number, number];
      const lastSelectedCoordinates = appState.getState().lastSelectedCoordinates;
      
      if (lastSelectedCoordinates) {
        markerPosition = lastSelectedCoordinates;
        // Karte zur Position bewegen, falls weit entfernt
        map.flyTo({
          center: markerPosition,
          zoom: Math.max(map.getZoom(), 15) // Zoom nicht verringern, nur erhöhen
        });
      } else if (window._planBLastSelectedCoordinates) {
        markerPosition = window._planBLastSelectedCoordinates;
        // Karte zur Position bewegen, falls weit entfernt
        map.flyTo({
          center: markerPosition,
          zoom: Math.max(map.getZoom(), 15) // Zoom nicht verringern, nur erhöhen
        });
      } else {
        // Fallback auf Kartenmitte
        const center = map.getCenter();
        markerPosition = [center.lng, center.lat];
      }
      
      // Marker erstellen und an der richtigen Position platzieren
      tempMarkerRef.current = new maplibregl.Marker({
        color: '#FF0000',
        draggable: false
      }).setLngLat(markerPosition).addTo(map);
      
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }
      
      map.getCanvas().style.cursor = '';
    }
    
    return () => {
      if (tempMarkerRef.current && !isPickingLocation) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
        map.getCanvas().style.cursor = '';
      }
    };
  }, [isPickingLocation]);

  // Handler für Map-Click-Events
  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    
    // Handler für Klicks auf die Karte im Ortsauswahl-Modus
    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const isInPickerMode = isPickingLocation || appState.getState().pickerModeActive;
      
      if (isInPickerMode && onMapClick) {
        // Koordinaten im Format [lon, lat] für den Callback
        const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        
        // Speichere die Koordinaten im globalen Zustand
        appState.setSelectedCoordinates(coordinates);
        
        // Legacy: Für kompatibilität mit vorhandenen Komponenten
        window._planBLastSelectedCoordinates = coordinates;
        
        // Marker entfernen
        if (tempMarkerRef.current) {
          tempMarkerRef.current.remove();
          tempMarkerRef.current = null;
        }
        
        // Cursor zurücksetzen
        map.getCanvas().style.cursor = '';
        
        // Callback aufrufen
        onMapClick(coordinates);
      }
    };
    
    // Event-Handler registrieren
    map.on('click', handleMapClick);
    
    // Aufraeumen
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPickingLocation, onMapClick]);

  // Event-Handler für Map-Refresh und Ortsauswahl-Abbruch
  useEffect(() => {
    // Handler für Marker-Updates
    const handleRefreshMarkers = (event: CustomEvent) => {
      if (!mapRef.current) return;
      
      if (event.detail?.fullMarkerList) {
        const markerList = event.detail.fullMarkerList;
        const forceReregisterEvents = event.detail?.forceReregisterEvents === true;
        
        console.log(`[PlanBMap] Aktualisiere Marker mit ${markerList.features.length} Features insgesamt${forceReregisterEvents ? ' (mit Neuregistrierung der Events)' : ''}`);
        
        // Wenn Event-Handler neu registriert werden sollen, leere die registrierten Layer
        if (forceReregisterEvents) {
          registeredEventLayers.clear();
          
          // Setze den Cursor zurück
          mapRef.current.getCanvas().style.cursor = '';
        }
        
        Object.keys(dynamicCategoryColors).forEach(category => {
          const sourceId = `marker-${category}`;
          const source = mapRef.current?.getSource(sourceId) as maplibregl.GeoJSONSource;
          
          if (source) {
            const filteredFeatures = markerList.features
              .filter((feature: Feature) => {
                // Prüfe zunächst, ob Feature und properties existieren
                if (!feature || !feature.properties) return false;
                
                // Kategorie des Features ermitteln
                const featureKategorie = feature.properties?.Kategorie || "unbekannt";
                
                // Prüfen, ob das Feature zur aktuellen Kategorie gehört
                return featureKategorie === category;
              })
              .map((feature: Feature) => {
                // Debug-Informationen für jedes Feature ausgeben
                if (DEBUG_MODE && feature.geometry?.type === 'Point') {
                  const coords = (feature.geometry as any).coordinates;
                  const featureName = feature.properties?.Name || 'Unbenannt';
                  console.log(`[PlanBMap-DEBUG] Feature vor Korrektur: "${featureName}" | Kategorie: ${category} | Koordinaten: [${coords[0]}, ${coords[1]}]`);
                }
                
                // Korrigiere falsche Koordinaten
                const correctedFeature = fixCoordinates(feature);
                
                // Debug-Informationen für korrigierte Features ausgeben
                if (DEBUG_MODE && feature.geometry?.type === 'Point') {
                  // Typprüfung für beide Features
                  const originalFeatureWithCoords = feature.geometry as any;
                  const correctedFeatureWithCoords = correctedFeature.geometry as any;
                  
                  // Nur weiter prüfen, wenn sich die Koordinaten geändert haben
                  if (correctedFeatureWithCoords.coordinates[0] !== originalFeatureWithCoords.coordinates[0] ||
                      correctedFeatureWithCoords.coordinates[1] !== originalFeatureWithCoords.coordinates[1]) {
                    
                    const originalCoords = originalFeatureWithCoords.coordinates;
                    const correctedCoords = correctedFeatureWithCoords.coordinates;
                    console.log(`[PlanBMap-DEBUG] Feature KORRIGIERT: "${correctedFeature.properties?.Name}" | Original: [${originalCoords[0]}, ${originalCoords[1]}] | Korrigiert: [${correctedCoords[0]}, ${correctedCoords[1]}]`);
                  }
                }
                
                return correctedFeature;
              });
            
            console.log(`[PlanBMap] Update - Kategorie "${category}": ${filteredFeatures.length} Marker`);
            
            source.setData({
              type: 'FeatureCollection',
              features: filteredFeatures
            });
            
            // Wenn Event-Handler neu registriert werden sollen und dieser Layer existiert
            if (forceReregisterEvents) {
              const layerID = `marker-${category}`;
              
              if (mapRef.current && mapRef.current.getLayer(layerID)) {
                // Entferne den Layer aus der registrierten Liste
                registeredEventLayers.delete(layerID);
                
                // Entferne alle Event-Handler
                // Sicherer Ansatz zur Entfernung der Event-Handler
                try {
                  // Typ-sicheres Entfernen der Handler durch Verwendung von any
                  (mapRef.current as any).off('mouseenter', layerID);
                  (mapRef.current as any).off('mouseleave', layerID);
                  (mapRef.current as any).off('click', layerID);
                } catch (err) {
                  console.error(`[PlanBMap] Fehler beim Entfernen der Event-Handler für Layer "${layerID}":`, err);
                }
                
                // Event-Handler für Hover neu registrieren
                mapRef.current.on("mouseenter", layerID, (e) => {
                  if (!e.features?.length) return;
                  
                  if (mapRef.current) {
                    mapRef.current.getCanvas().style.cursor = "pointer";
                  
                    const feature = e.features[0];
                    if (!feature.geometry || !feature.properties) return;
                    
                    if (feature.geometry.type === 'Point' && 'coordinates' in feature.geometry) {
                      const coordinates = [...feature.geometry.coordinates];
                      const { Name, Beschreibung, Öffnungszeiten } = feature.properties;

                      let popupContent = `<h3>${Name}</h3>`;
                      if (Beschreibung) popupContent += `<p>${Beschreibung}</p>`;
                      if (Öffnungszeiten) popupContent += `<p><b>Öffnungszeiten</b>: ${Öffnungszeiten}</p>`;

                      const popup = new maplibregl.Popup({
                        closeButton: false,
                        closeOnClick: false,
                      });
                      
                      popup.setLngLat(coordinates as [number, number])
                        .setHTML(popupContent)
                        .addTo(mapRef.current);
                    }
                  }
                });

                // Event-Handler für Marker-Klicks neu registrieren
                mapRef.current.on("click", layerID, (e) => {
                  if (!e.features?.length || !onMarkerClick || !mapRef.current) return;
                  
                  const feature = e.features[0];
                  
                  // Feature-ID ermitteln
                  let featureId = feature.id;
                  if (feature.properties?._id) {
                    featureId = feature.properties._id;
                  } else if (feature.properties?.id) {
                    featureId = feature.properties.id;
                  }
                  
                  // In geeignetes Format für Handler umwandeln
                  const geoJsonFeature: MongoDBFeature = {
                    type: "Feature",
                    geometry: feature.geometry,
                    properties: {
                      ...feature.properties,
                      _id: featureId !== undefined ? String(featureId) : undefined
                    },
                    _id: featureId !== undefined ? String(featureId) : undefined
                  };
                  
                  // Aktuellen Zustand speichern und Handler aufrufen
                  const currentCenter = mapRef.current.getCenter();
                  const currentZoom = mapRef.current.getZoom();
                  
                  mapStateRef.current = {
                    center: { lat: currentCenter.lat, lon: currentCenter.lng },
                    zoom: currentZoom,
                    isUserInteraction: true
                  };
                  
                  onMarkerClick(geoJsonFeature);
                });

                // Event-Handler für Mouse-Leave neu registrieren
                mapRef.current.on("mouseleave", layerID, () => {
                  if (mapRef.current) {
                    mapRef.current.getCanvas().style.cursor = "";
                    // Entferne alle Popups
                    const popups = document.querySelectorAll('.maplibregl-popup');
                    popups.forEach(popup => popup.remove());
                  }
                });
                
                // Merke, dass Event-Handler für diesen Layer registriert wurden
                registeredEventLayers.add(layerID);
                
                console.log(`[PlanBMap] Events für Layer "${layerID}" neu registriert`);
              }
            }
          }
        });
      }
    };
    
    // Handler für Ortsauswahl-Abbruch
    const handleCancelLocationPicker = () => {
      if (!mapRef.current) return;
      
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }
      
      mapRef.current.getCanvas().style.cursor = '';
      window._planBPickerModeActive = false;
    };
    
    document.addEventListener('planBMapRefreshMarkers', handleRefreshMarkers as unknown as EventListener);
    document.addEventListener('planBMapCancelLocationPicker', handleCancelLocationPicker as unknown as EventListener);
    
    return () => {
      document.removeEventListener('planBMapRefreshMarkers', handleRefreshMarkers as unknown as EventListener);
      document.removeEventListener('planBMapCancelLocationPicker', handleCancelLocationPicker as unknown as EventListener);
    };
  }, [dynamicCategoryColors, onMarkerClick]);

  // Funktion zum Erstellen einer neuen Ebene für fehlerhafte Marker
  const createErrorMarkersLayer = (map: Map, errorFeatures: Feature[]): void => {
    // Prüfe, ob es fehlerhafte Marker gibt
    if (errorFeatures.length === 0) return;
    
    console.log(`[PlanBMap] Erstelle spezielle Ebene für ${errorFeatures.length} fehlerhafte Marker mit Warndreieck`);
    
    // Referenzpunkt für fehlerhafte Marker (nahe Brixen)
    const errorLon = 11.56610;  // Korrigiert von 116.566
    const errorLat = 46.67185;  // Korrigiert von 4.671
    
    // Versetze die fehlerhaften Marker leicht, damit sie sich nicht überlagern
    const errorFeatureCollection: FeatureCollection = {
      type: 'FeatureCollection',
      features: errorFeatures
        .filter(feature => feature && feature.geometry && feature.geometry.type === 'Point')
        .map((feature, index) => {
          // Kopiere das Feature und ändere nur die Koordinaten
          const copyFeature = { ...feature };
          if (copyFeature.geometry.type === 'Point') {
            // Versetze die Marker leicht kreisförmig um den Referenzpunkt
            const angle = (index % 12) * (Math.PI * 2 / 12);
            const radius = 0.0005 * (1 + Math.floor(index / 12) * 0.5); // ca. 50m Radius, wachsend für mehr Marker
            
            copyFeature.geometry = {
              ...copyFeature.geometry,
              coordinates: [
                errorLon + Math.cos(angle) * radius,
                errorLat + Math.sin(angle) * radius
              ]
            };
          }
          return copyFeature;
        })
    };
    
    try {
      // Erstelle eine Warndreieck-SVG für fehlerhafte Marker
      const warningTriangleSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
          <path fill="yellow" stroke="black" stroke-width="1" d="M12 2 L22 20 L2 20 Z"/>
          <text x="12" y="16" font-size="12" text-anchor="middle" fill="black">!</text>
        </svg>
      `;
      
      // Konvertiere SVG zu Base64
      const base64Svg = btoa(warningTriangleSvg);
      const warningIconUrl = `data:image/svg+xml;base64,${base64Svg}`;
      
      // Verwende einen Workaround für loadImage, da die API unterschiedlich sein kann
      const img = new Image();
      img.onload = () => {
        // Erstelle ein Canvas, um das Bild zu zeichnen
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          // Konvertiere das Canvas zu einer ImageData
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Füge das Bild zur Karte hinzu
          try {
            // Prüfe, ob das Bild bereits existiert
            if (!map.hasImage('warning-triangle')) {
              map.addImage('warning-triangle', { width: img.width, height: img.height, data: new Uint8Array(imageData.data.buffer) }, { pixelRatio: 1 });
            }
            
            // Prüfe, ob die Quelle bereits existiert
            if (!map.getSource('error-markers')) {
              // Quelle für fehlerhafte Marker hinzufügen
              map.addSource('error-markers', {
                type: 'geojson',
                data: errorFeatureCollection
              });
              
              // Layer für fehlerhafte Marker mit Warndreieck hinzufügen
              map.addLayer({
                id: 'error-markers-layer',
                type: 'symbol',
                source: 'error-markers',
                layout: {
                  'icon-image': 'warning-triangle',
                  'icon-size': 0.5,
                  'icon-allow-overlap': true,
                  'text-field': ['get', 'Name'],
                  'text-size': 12,
                  'text-offset': [0, 1.5],
                  'text-anchor': 'top'
                },
                paint: {
                  'text-color': '#333',
                  'text-halo-color': '#fff',
                  'text-halo-width': 1
                }
              });
            } else {
              // Quelle existiert bereits, aktualisiere nur die Daten
              const source = map.getSource('error-markers') as maplibregl.GeoJSONSource;
              source.setData(errorFeatureCollection);
              console.log(`[PlanBMap] Existierende Quelle "error-markers" aktualisiert mit ${errorFeatureCollection.features.length} fehlerhaften Markern`);
            }
            
            // Event-Handler nur hinzufügen, wenn sie noch nicht registriert wurden
            if (!registeredEventLayers.has('error-markers-layer')) {
              // Event-Handler für Hover
              map.on('mouseenter', 'error-markers-layer', (e) => {
                if (!e.features?.length) return;
                map.getCanvas().style.cursor = 'pointer';
                
                const feature = e.features[0];
                if (!feature.properties) return;
                
                const coordinates = (feature.geometry as any).coordinates.slice();
                const name = feature.properties.Name || 'Unbenannter Ort';
                const originalCoords = feature.properties.originalCoordinates || 'unbekannt';
                
                const popupContent = `
                  <h3>${name}</h3>
                  <p><strong>FEHLERHAFTE KOORDINATEN!</strong></p>
                  <p>Ursprüngliche Koordinaten: ${originalCoords}</p>
                  <p>Bitte öffnen und speichern Sie diesen Ort, um die Koordinaten zu korrigieren.</p>
                `;
                
                const popup = new maplibregl.Popup()
                  .setLngLat(coordinates)
                  .setHTML(popupContent)
                  .addTo(map);
              });
              
              // Event-Handler für Mouseleave
              map.on('mouseleave', 'error-markers-layer', () => {
                map.getCanvas().style.cursor = '';
              });
              
              // Event-Handler für Klick
              map.on('click', 'error-markers-layer', (e) => {
                if (!e.features?.length || !onMarkerClick) return;
                
                const feature = e.features[0];
                if (!feature.properties) return;
                
                // In geeignetes Format für Handler umwandeln
                const geoJsonFeature: MongoDBFeature = {
                  type: "Feature",
                  geometry: feature.geometry as any,
                  properties: feature.properties,
                  _id: feature.properties._id
                };
                
                // Handler aufrufen
                onMarkerClick(geoJsonFeature);
              });
              
              // Merke, dass Event-Handler für diesen Layer registriert wurden
              registeredEventLayers.add('error-markers-layer');
            }
          } catch (error) {
            console.error(`[PlanBMap] Fehler beim Hinzufügen der fehlerhaften Marker:`, error);
          }
        }
      };
      img.src = warningIconUrl;
    } catch (error) {
      console.error(`[PlanBMap] Fehler beim Erstellen der fehlerhaften Marker:`, error);
    }
  };

  return (
    <div className={`${styles['planb-map-container']} w-full h-full`} style={{ width, height }}>
      <div ref={mapContainer} className={`${styles['planb-map']} planb-map w-full h-full`}></div>
      <div ref={filterGroupRef} className={styles['filter-group']}></div>
      <div className={styles['filter-ctrl']}>
        <input
          ref={filterInputRef}
          type="text"
          name="filter"
          placeholder="Filter by name"
        />
      </div>
      
      {/* Temporer Marker für Location Picking */}
      {isPickingLocation && (
        <div className="absolute inset-x-0 bottom-4 mx-auto max-w-md bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-md shadow-md z-50 text-center">
          <p className="font-medium">Klicke auf die Karte, um einen Ort auszuwählen</p>
        </div>
      )}
    </div>
  );
};

export default PlanBMap; 