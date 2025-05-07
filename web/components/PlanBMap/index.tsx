import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl, { LngLatLike, Map, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// import { overpassToGeojson } from '../../utils/query_overpass';
import { Feature, FeatureCollection, GeoJSON } from 'geojson';
import styles from './PlanBMap.module.css';

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
  categoryColors = {
    A: "#FF0000",
    B: "#00FF00",
    C: "#0000FF",
  },
  showDrinkingWater = false, // Deaktiviert, da es Probleme mit osm2geojson-lite gibt
  height = '100%',
  width = '100%',
  onMarkerClick,
  onMapClick,
  isPickingLocation = false
}) => {
  // Hilfsfunktion, um die stabile Speicherung von Werten zu ermöglichen
  const useStableValue = <T,>(initialValue: T) => {
    const [stableValue, setStableValue] = useState<T>(initialValue);
    return {
      value: stableValue,
      set: setStableValue,
    };
  };

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const filterGroupRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const [layerIDs, setLayerIDs] = useState<string[]>([]);
  const componentId = useRef(`planb-${Math.random().toString(36).substring(2, 9)}`);
  const renderCount = useRef(0);
  const hasInitialized = useRef(false); // Flag zur Vermeidung mehrfacher Initialisierung
  
  // Ref für den aktuellen Kartenzustand (keine State-Updates auslösen)
  const mapStateRef = useRef({
    center: center,
    zoom: zoom,
    isUserInteraction: false // Flag, um zu erkennen, ob die Änderung vom Benutzer kommt
  });

  // Stabile Speicherung des Filter-Elements
  const filterElement = useStableValue<HTMLInputElement | null>(null);

  // Tracker für bedeutende Änderungen, die ein Re-Rendern auslösen sollten
  const prevDepsRef = useRef({
    markerCount: markers.features.length,
    mapStyle,
    centerLat: typeof center === 'object' && 'lat' in center ? center.lat : null,
    centerLng: typeof center === 'object' && 'lon' in center ? center.lon : null,
    zoom,
  });

  // Memoize markers, um unnötige Re-Renders zu vermeiden
  const memoizedMarkers = useMemo(() => {
    return markers;
  }, [
    // Nur neu memoizieren, wenn sich die Features wirklich geändert haben
    markers.features.length,
    // Man könnte hier auch einen tieferen Vergleich implementieren, wenn nötig
    JSON.stringify(markers.features.map(f => f.properties?.id || f.id))
  ]);

  // Ref für den temporären Marker bei der Ortsauswahl
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Generiere dynamisch kategorie-Farben für alle in den Daten vorhandenen Kategorien
  const dynamicCategoryColors = useMemo(() => {
    // Starte mit den vordefinierten Kategorien
    const colors = { ...categoryColors };
    
    // Extrahiere alle einzigartigen Kategorien aus den Markern
    const uniqueCategories = new Set<string>();
    memoizedMarkers.features.forEach(feature => {
      if (feature.properties && feature.properties.Kategorie) {
        uniqueCategories.add(feature.properties.Kategorie);
      }
    });
    
    // Generiere Farben für nicht vordefinierte Kategorien
    const predefinedCategories = Object.keys(categoryColors);
    Array.from(uniqueCategories).forEach(category => {
      if (!predefinedCategories.includes(category)) {
        // Einfache Farbgenerierung basierend auf dem Kategorienamen
        const hue = Math.abs(category.charCodeAt(0) * 137.5) % 360;
        colors[category] = `hsl(${hue}, 70%, 50%)`;
      }
    });
    
    return colors;
  }, [memoizedMarkers, categoryColors]);

  // Protokolliere beim ersten Rendern und bei Props-Änderungen
  useEffect(() => {
    renderCount.current += 1;
    console.log(`[PlanBMap ${componentId.current}] Komponente gerendert #${renderCount.current}, mapRef.current=${!!mapRef.current}`);
    
    // Protokolliere die wichtigsten Props
    console.log(`[PlanBMap ${componentId.current}] Props:`, {
      markers: `${markers.features.length} Features`,
      mapStyle,
      center,
      zoom
    });
    
    // Bei jedem neuen Render (aber nicht beim Unmount) setzen wir isUserInteraction zurück,
    // es sei denn, wir sind im Picker-Modus
    
    // WICHTIG: Wir setzen isUserInteraction NICHT zurück, wenn ein Dialog geöffnet ist
    // Das verhindert, dass der Zoom zurückgesetzt wird, wenn ein Detail-Dialog geöffnet wird
    
    // Nur in bestimmten Fällen zurücksetzen, z.B. bei grundlegenden Änderungen wie
    // neuem Kartenstil oder komplett neuen Markern
    if (!isPickingLocation && renderCount.current <= 1) {
      console.log(`[PlanBMap ${componentId.current}] Resetting isUserInteraction beim ersten Render`);
      mapStateRef.current.isUserInteraction = false;
    } else {
      console.log(`[PlanBMap ${componentId.current}] Behalte isUserInteraction = ${mapStateRef.current.isUserInteraction}`);
    }
    
    return () => {
      console.log(`[PlanBMap ${componentId.current}] Cleanup-Effekt für Render #${renderCount.current}`);
    };
  }, [markers, mapStyle, center, zoom, isPickingLocation]);

  const getMapStyle = useCallback(async (): Promise<string> => {
    let effectiveStyle = mapStyle;
    
    // Füge den API-Key hinzu, wenn er im URL-String fehlt und vorhanden ist
    if (mapApiKey && !effectiveStyle.includes('key=')) {
      effectiveStyle += effectiveStyle.includes('?') ? `&key=${mapApiKey}` : `?key=${mapApiKey}`;
    }
    
    console.log(`[PlanBMap ${componentId.current}] Verwende Map-Stil: ${effectiveStyle}`);
    return effectiveStyle;
  }, [mapStyle, mapApiKey]);

  // Verbesserte Version des Map-Initialisierungs-Effekts mit Änderungserkennung
  useEffect(() => {
    // Einfache Funktion zum Erkennen von wesentlichen Änderungen, die ein Neuladen erfordern
    const checkForSignificantChanges = () => {
      const currentDeps = {
        markerCount: memoizedMarkers.features.length,
        mapStyle,
        centerLat: typeof center === 'object' && 'lat' in center ? center.lat : null,
        centerLng: typeof center === 'object' && 'lon' in center ? center.lon : null,
        zoom,
      };
      
      // Speichere aktuelle Werte für nächsten Vergleich
      prevDepsRef.current = currentDeps;
    };

    if (!mapContainer.current) {
      console.warn(`[PlanBMap ${componentId.current}] Map-Container nicht gefunden`);
      return;
    }
    
    // Prüfe, ob die Karte bereits initialisiert wurde oder gerade initialisiert wird
    if (hasInitialized.current || mapRef.current) {
      console.log(`[PlanBMap ${componentId.current}] Map bereits initialisiert (${hasInitialized.current}), überspringe Initialisierung`);
      return;
    }
    
    // Setze Flag, dass Initialisierung läuft
    hasInitialized.current = true;

    console.log(`[PlanBMap ${componentId.current}] Starte Karteninitialisierung...`);

    const initializeMap = async () => {
      try {
        const styleUrl = await getMapStyle();
        console.log(`[PlanBMap ${componentId.current}] Map wird initialisiert mit Stil: ${styleUrl}`);
        
        // Initialisiere die Karte
        const map = new maplibregl.Map({
          container: mapContainer.current!,
          style: styleUrl,
          center: center,
          zoom: zoom,
          pitchWithRotate: false, // Disable tilting the map
        });
        
        console.log(`[PlanBMap ${componentId.current}] Map-Objekt erstellt`);
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
            
            console.log(`[PlanBMap ${componentId.current}] Kartenzustand AKTUALISIERT durch Benutzerinteraktion:`, {
              center: mapStateRef.current.center,
              zoom: mapStateRef.current.zoom
            });
          } else {
            // Bei programmatischen Änderungen aktualisieren wir nur die Werte, nicht das Flag
            mapStateRef.current.center = { lat: newCenter.lat, lon: newCenter.lng };
            mapStateRef.current.zoom = newZoom;
            
            console.log(`[PlanBMap ${componentId.current}] Kartenzustand durch PROGRAMM geändert (Flag bleibt):`, {
              center: mapStateRef.current.center,
              zoom: mapStateRef.current.zoom,
              isUserInteraction: mapStateRef.current.isUserInteraction
            });
          }
        });

        // Zeige einen roten temporären Marker, wenn der Ortsauswahl-Modus aktiv ist
        map.on('mousemove', (e) => {
          if (isPickingLocation) {
            // Ändere den Cursor zur Anzeige, dass ein Klick möglich ist
            map.getCanvas().style.cursor = 'crosshair';
            
            // Wenn bereits ein temporärer Marker existiert, bewege ihn zur aktuellen Mausposition
            if (tempMarkerRef.current) {
              tempMarkerRef.current.setLngLat([e.lngLat.lng, e.lngLat.lat]);
            }
          } else {
            // Zurück zum Standardcursor
            if (map.getCanvas().style.cursor === 'crosshair') {
              map.getCanvas().style.cursor = '';
            }
          }
        });
        
        // KRITISCH: Registeriere den Klick-Handler BEVOR die anderen Layer-Handler registriert werden
        // damit er Vorrang hat, wenn im Ortsauswahl-Modus
        map.on('click', (e) => {
          // Wir verwenden drei Wege, um zu erkennen, ob wir im Picker-Modus sind
          const propsPickingMode = isPickingLocation;
          const markerExists = !!tempMarkerRef.current;
          const globalPickingMode = !!window._planBPickerModeActive;
          
          console.log(`[PlanBMap ${componentId.current}] MAP CLICK - Picker-Status:`, {
            propsPickingMode,
            markerExists,
            globalPickingMode
          });
          
          // WICHTIG: Wenn EINER der drei Indikatoren auf Picker-Modus hinweist, nehmen wir an, dass er aktiv ist
          const isInPickerMode = propsPickingMode || markerExists || globalPickingMode;
          
          if (isInPickerMode && onMapClick) {
            console.log(`[PlanBMap ${componentId.current}] Picker-Modus AKTIV - verarbeite Klick`);
            
            // Versuche, Klicks auf andere Elemente zu verhindern
            if (e.originalEvent) {
              e.originalEvent.stopPropagation();
              e.originalEvent.preventDefault();
            }
            
            // Koordinaten extrahieren
            const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
            console.log(`[PlanBMap ${componentId.current}] Koordinaten bei Klick:`, coordinates);
            
            try {
              // Sofort den Marker entfernen
              if (tempMarkerRef.current) {
                console.log(`[PlanBMap ${componentId.current}] Entferne temporären Marker`);
                tempMarkerRef.current.remove();
                tempMarkerRef.current = null;
              }
              
              // Cursor zurücksetzen
              map.getCanvas().style.cursor = '';
              
              // Globalen Status zurücksetzen
              window._planBPickerModeActive = false;
              
              // WICHTIG: Speichere die ausgewählten Koordinaten in einer globalen Variable,
              // damit die übergeordnete Komponente darauf zugreifen kann, falls der Callback verloren geht
              window._planBLastSelectedCoordinates = coordinates;
              
              // Zustand für späteres Zurücksetzen speichern
              mapStateRef.current = {
                center: { lat: map.getCenter().lat, lon: map.getCenter().lng },
                zoom: map.getZoom(),
                isUserInteraction: true
              };
              
              // WICHTIG: Callback aufrufen
              console.log(`[PlanBMap ${componentId.current}] Rufe onMapClick auf mit:`, coordinates);
              onMapClick(coordinates);
              console.log(`[PlanBMap ${componentId.current}] onMapClick Callback ausgeführt`);
              
              // WICHTIG: Zusätzlich ein Event auslösen, um sicherzustellen, dass der Dialog wieder geöffnet wird
              // Dies ist ein Fallback für den Fall, dass der Callback verloren geht
              setTimeout(() => {
                console.log(`[PlanBMap ${componentId.current}] Löse forceReopenDialog-Event aus als Fallback`);
                const reopenEvent = new CustomEvent('forceReopenDialog', {
                  detail: { coordinates }
                });
                document.dispatchEvent(reopenEvent);
              }, 300);
              
              // Da onMapClick den Dialog wieder öffnen sollte, sind wir fertig
              return;
            } catch (error) {
              console.error(`[PlanBMap ${componentId.current}] Fehler bei Koordinatenauswahl:`, error);
              
              // Bei Fehler trotzdem Event auslösen als Fallback
              console.log(`[PlanBMap ${componentId.current}] Löse forceReopenDialog-Event aus bei FEHLER`);
              const reopenEvent = new CustomEvent('forceReopenDialog', {
                detail: { coordinates }
              });
              document.dispatchEvent(reopenEvent);
            }
          } else {
            console.log(`[PlanBMap ${componentId.current}] KEIN Picker-Modus aktiv - ignoriere Klick für Ortsauswahl`);
          }
        });

        // Initialisiere oder entferne den temporären Marker, wenn sich der isPickingLocation-Status ändert
        if (isPickingLocation) {
          console.log(`[PlanBMap ${componentId.current}] Ortsauswahl-Modus aktiviert`);
          
          // Erstelle einen temporären Marker, wenn er noch nicht existiert
          if (!tempMarkerRef.current) {
            const center = map.getCenter();
            tempMarkerRef.current = new maplibregl.Marker({
              color: '#FF0000',
              draggable: false
            }).setLngLat([center.lng, center.lat]).addTo(map);
          }
        } else {
          // Entferne den temporären Marker, wenn der Ortsauswahl-Modus beendet wird
          if (tempMarkerRef.current) {
            console.log(`[PlanBMap ${componentId.current}] Ortsauswahl-Modus deaktiviert, entferne temporären Marker`);
            tempMarkerRef.current.remove();
            tempMarkerRef.current = null;
          }
        }

        // Funktion zum Laden der Marker, die wir sowohl beim ersten Load als auch bei Stil-Updates verwenden
        const loadMarkers = async () => {
          console.log(`[PlanBMap ${componentId.current}] Map geladen, füge Marker hinzu...`);
          
          try {
            // Lade das Marker-Bild
            console.log(`[PlanBMap ${componentId.current}] Lade Marker-Bild...`);
            
            // Füge das Bild nur hinzu, wenn es noch nicht existiert
            if (!map.hasImage("custom-marker")) {
              const image = await map.loadImage(
                "https://maplibre.org/maplibre-gl-js/docs/assets/custom_marker.png"
              );
              map.addImage("custom-marker", image.data);
              console.log(`[PlanBMap ${componentId.current}] Marker-Bild geladen`);
            }

            /* Deaktiviert wegen Problemen mit osm2geojson-lite
            // Lade Drinking Water Points wenn aktiviert
            if (showDrinkingWater) {
              const query_water = `[out:json][timeout:25];area(id:3600047300)->.searchArea;nwr["amenity"="drinking_water"](area.searchArea);out geom;`;
              const geojson_water = await overpassToGeojson(query_water);

              map.addSource("drinking_water", {
                type: "geojson",
                data: geojson_water,
              });

              map.addLayer({
                id: "drinking_water",
                source: "drinking_water",
                type: "circle",
                paint: {
                  "circle-radius": 4,
                  "circle-color": "orange",
                },
              });
            }
            */

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
              const filteredFeatures = memoizedMarkers.features.filter(
                (feature: Feature) => 
                  feature.properties && feature.properties.Kategorie === category
              );

              console.log(`[PlanBMap ${componentId.current}] Füge Kategorie ${category} mit ${filteredFeatures.length} Features hinzu`);

              // Prüfe, ob die Quelle bereits existiert
              if (map.getSource(layerID)) {
                // Aktualisiere die bestehende Quelle mit neuen Daten
                const source = map.getSource(layerID) as maplibregl.GeoJSONSource;
                source.setData({
                  type: 'FeatureCollection',
                  features: filteredFeatures
                });
              } else {
                // Füge eine neue Quelle für jede Kategorie hinzu
                map.addSource(layerID, {
                  type: "geojson",
                  data: {
                    type: "FeatureCollection",
                    features: filteredFeatures,
                  },
                });

                // Füge die Ebene zur Karte hinzu
                map.addLayer({
                  id: layerID,
                  source: layerID,
                  type: "circle",
                  paint: {
                    "circle-radius": 6,
                    "circle-color": color,
                  },
                });

                // Popup events
                map.on("mouseenter", layerID, (e) => {
                  if (!e.features || e.features.length === 0) return;
                  
                  map.getCanvas().style.cursor = "pointer";
                  
                  const feature = e.features[0];
                  // Sicherstellen, dass geometry und properties vorhanden sind
                  if (!feature.geometry || !feature.properties) return;
                  
                  // Für Point-Geometrien
                  if (feature.geometry.type === 'Point' && 'coordinates' in feature.geometry) {
                    const coordinates = [...feature.geometry.coordinates];
                    const properties = feature.properties;
                    const description = properties.Beschreibung;
                    const name = properties.Name;
                    const öffnungszeiten = properties.Öffnungszeiten;

                    let popup_content = `<h3>${name}</h3>`;
                    if (description) {
                      popup_content += `<p>${description}</p>`;
                    }
                    if (öffnungszeiten) {
                      popup_content += `<p><b>Öffnungszeiten</b>: ${öffnungszeiten}</p>`;
                    }
                    popup_content += `
                    <details>
                      <summary><b>Properties</b></summary>
                      <pre>${JSON.stringify(properties, null, 4)}</pre>
                    </details>`;

                    popup.setLngLat(coordinates as [number, number])
                      .setHTML(popup_content)
                      .addTo(map);
                  }
                });

                // Marker-Klick-Event hinzufügen (für die Detailansicht)
                map.on("click", layerID, (e) => {
                  if (!e.features || e.features.length === 0 || !onMarkerClick) return;
                  
                  // KRITISCHER PUNKT: Hier den aktuellen Kartenzustand speichern
                  // Diese Funktion wird VOR dem Öffnen des Dialogs aufgerufen
                  const currentZoom = map.getZoom();
                  const currentCenter = map.getCenter();
                  
                  console.log(`[PlanBMap ${componentId.current}] Marker click event:`, {
                    mapCenter: currentCenter,
                    mapZoom: currentZoom
                  });
                  
                  const feature = e.features[0];
                  
                  // Tiefere Inspektion der Quelldaten für Debug-Zwecke
                  console.log("Angeklicktes Map-Feature:", feature);
                  console.log("Feature ID:", feature.id);
                  console.log("Feature Properties:", feature.properties);
                  
                  // Ermittle die ID aus verschiedenen möglichen Quellen
                  let featureId = feature.id;
                  
                  // Prüfe alle möglichen Stellen, wo die ID sein könnte
                  if (feature.properties) {
                    // Manchmal ist die _id direkt in den Properties
                    if (feature.properties._id) {
                      featureId = feature.properties._id;
                      console.log("ID aus properties._id extrahiert:", featureId);
                    }
                    // Manchmal ist die ID unter einem anderen Namen in den Properties
                    else if (feature.properties.id) {
                      featureId = feature.properties.id;
                      console.log("ID aus properties.id extrahiert:", featureId);
                    }
                    // Manchmal ist die _id in einer verschachtelten Eigenschaft wie properties.properties._id
                    else if (feature.properties.properties && feature.properties.properties._id) {
                      featureId = feature.properties.properties._id;
                      console.log("ID aus properties.properties._id extrahiert:", featureId);
                    }
                  }
                  
                  // Konvertiere das MapLibre-Feature zurück in ein GeoJSON-Feature
                  const geoJsonFeature: MongoDBFeature = {
                    type: "Feature",
                    geometry: feature.geometry,
                    properties: {
                      ...feature.properties,
                      // Stelle sicher, dass die ID auch in den Properties ist
                      _id: featureId !== undefined ? String(featureId) : undefined
                    },
                    // ID im Root-Objekt
                    _id: featureId !== undefined ? String(featureId) : undefined
                  };
                  
                  // Logging für Debugging
                  console.log("Feature mit ID zum Detail-Handler übergeben:", geoJsonFeature);
                  console.log(`[PlanBMap ${componentId.current}] Aktueller Zoom BEVOR onMarkerClick:`, currentZoom);
                  
                  // KRITISCH: Speichere den aktuellen Zustand, um sicherzustellen, dass er erhalten bleibt
                  // und setze isUserInteraction auf true, um zu verhindern, dass die Karte zurückgesetzt wird
                  mapStateRef.current = {
                    center: { lat: currentCenter.lat, lon: currentCenter.lng },
                    zoom: currentZoom,
                    isUserInteraction: true
                  };
                  
                  console.log(`[PlanBMap ${componentId.current}] MARKER CLICK: Speichere Zustand in Ref:`, mapStateRef.current);
                  
                  // Rufe onMarkerClick auf, was den Dialog öffnen wird
                  onMarkerClick(geoJsonFeature);
                  
                  // Überprüfe, ob der Zoom nach dem Aufruf erhalten bleibt
                  console.log(`[PlanBMap ${componentId.current}] Aktueller Zoom NACH onMarkerClick:`, map.getZoom());
                  
                  // EXTRA-SICHERUNG: Nach einer kurzen Verzögerung nochmals prüfen und ggf. korrigieren
                  setTimeout(() => {
                    const newZoom = map.getZoom();
                    if (Math.abs(newZoom - currentZoom) > 0.01) {
                      console.log(`[PlanBMap ${componentId.current}] ZOOM KORREKTUR: von ${newZoom} zurück zu ${currentZoom}`);
                      map.setZoom(currentZoom);
                    }
                  }, 100);
                });

                map.on("mouseleave", layerID, () => {
                  map.getCanvas().style.cursor = "";
                  popup.remove();
                });
              }

              // Nur Checkboxen erstellen, wenn filterGroupRef existiert
              if (filterGroupRef.current) {
                // Checkbox und Label für die Ebene erstellen
                const input = document.createElement("input");
                input.type = "checkbox";
                input.id = layerID;
                input.checked = true;

                const label = document.createElement("label");
                label.setAttribute("for", layerID);
                label.textContent = category;

                filterGroupRef.current.appendChild(input);
                filterGroupRef.current.appendChild(label);

                // Event-Listener hinzufügen
                input.addEventListener("change", (e) => {
                  const target = e.target as HTMLInputElement;
                  map.setLayoutProperty(
                    layerID,
                    "visibility",
                    target.checked ? "visible" : "none"
                  );
                });
              }
            });

            setLayerIDs(newLayerIDs);
            console.log(`[PlanBMap ${componentId.current}] Layer IDs gesetzt:`, newLayerIDs);
            
            // Textfilter-Funktionalität hinzufügen
            if (filterInputRef.current) {
              console.log(`[PlanBMap ${componentId.current}] Filter-Input gefunden, füge Event-Listener hinzu`);
              
              // Statt das Element zu klonen, speichere das aktuelle Element
              const currentFilterInput = filterInputRef.current;
              
              // Definiere die Filter-Funktion
              const filterFunction = (e: Event) => {
                const value = (e.target as HTMLInputElement).value.trim().toLowerCase();
                console.log(`[PlanBMap ${componentId.current}] Filter aktualisiert: "${value}"`);

                newLayerIDs.forEach((layerID) => {
                  if (value === "") {
                    map.setFilter(layerID, null);
                    return;
                  }

                  // Filter für jede Ebene erstellen
                  const categoryName = layerID.split("-")[1];
                  const filters: any[] = ["any"];
                  
                  memoizedMarkers.features.forEach((feature: Feature) => {
                    if (feature.properties && feature.properties.Kategorie === categoryName) {
                      const properties = feature.properties;
                      for (const key of ["Name", "Beschreibung"]) {
                        const property = properties[key as keyof typeof properties];
                        if (
                          typeof property === "string" &&
                          property.toLowerCase().includes(value)
                        ) {
                          // Wir müssen den Filter korrekt aufbauen - in MapLibre GL ist das ein bestimmtes Format
                          filters.push(["==", ["get", key], property]);
                          break;
                        }
                      }
                    }
                  });

                  // Filter anwenden, wenn Elemente gefunden wurden
                  if (filters.length > 1) {
                    map.setFilter(layerID, filters as any);
                  } else {
                    // Wenn nichts gefunden wurde, alle Marker dieser Kategorie ausblenden
                    map.setFilter(layerID, ["==", ["get", "Name"], "NO_MATCH"]);
                  }
                });
              };
              
              // Entferne alle vorherigen Event-Listener (funktioniert zwar nicht perfekt, ist aber besser als nichts)
              currentFilterInput.removeEventListener("keyup", filterFunction);
              
              // Registriere den neuen Event-Listener
              currentFilterInput.addEventListener("keyup", filterFunction);
            }
          } catch (error) {
            console.error(`[PlanBMap ${componentId.current}] Fehler beim Laden der Kartendaten:`, error);
          }
        };

        // Lade Marker beim ersten Load
        map.on('load', loadMarkers);
        
        // Wichtig: Auch bei Stil-Änderungen die Marker neu laden
        map.on('style.load', () => {
          console.log(`[PlanBMap ${componentId.current}] Stil neu geladen, aktualisiere Marker...`);
          loadMarkers();
        });
      } catch (error) {
        console.error(`[PlanBMap ${componentId.current}] Fehler beim Initialisieren der Karte:`, error);
      }
    };

    initializeMap();

    // Aktualisiere den Änderungstracker nach erfolgreicher Initialisierung
    checkForSignificantChanges();

    // Globaler Cleanup - wird nur beim Unmounten der Komponente ausgeführt
    return () => {
      // Vermeide flüchtige Entfernung der Karte während normaler Re-Renders
      console.log(`[PlanBMap ${componentId.current}] Komponente wird unmounted - entferne Map`);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // Wichtig: leere Abhängigkeitsliste, um sicherzustellen, dass die Karte nur einmal erstellt wird
  }, []);

  // Separater Effekt für Map-Updates ohne Neuinitialisierung
  useEffect(() => {
    // Nur ausführen, wenn die Map bereits existiert
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    console.log(`[PlanBMap ${componentId.current}] Aktualisiere bestehende Karte mit neuen Props`);
    console.log(`[PlanBMap ${componentId.current}] Current map state:`, 
      { 
        currentCenter: map.getCenter(), 
        currentZoom: map.getZoom(), 
        userInteraction: mapStateRef.current.isUserInteraction,
        isPickingLocation
      });
    console.log(`[PlanBMap ${componentId.current}] Props passed:`, { center, zoom });
    console.log(`[PlanBMap ${componentId.current}] State ref:`, mapStateRef.current);
    
    // Prüfen, ob wir die Kartendaten aktualisieren müssen
    // WICHTIG: Nach einem Markerklick soll der Zoom beibehalten werden
    const shouldRespectUserZoom = mapStateRef.current.isUserInteraction;
    const shouldUpdateMapPosition = !isPickingLocation && !shouldRespectUserZoom;
    
    // Entscheidung loggen
    console.log(`[PlanBMap ${componentId.current}] shouldRespectUserZoom: ${shouldRespectUserZoom}, shouldUpdateMapPosition: ${shouldUpdateMapPosition}`);
    
    // Nur die Kartenposition ändern, wenn wir nicht im Picker-Modus sind 
    // und keine Benutzerinteraktion stattgefunden hat
    if (shouldUpdateMapPosition) {
      console.log(`[PlanBMap ${componentId.current}] UPDATING map position to props:`, { center, zoom });
    map.setCenter(center);
    map.setZoom(zoom);
    } else {
      // Im Picker-Modus oder nach Benutzerinteraktion behalten wir den aktuellen Zustand bei
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      console.log(`[PlanBMap ${componentId.current}] KEEPING current map position:`, {
        center: currentCenter,
        zoom: currentZoom
      });
      
      // Nach einem Markerklick nicht zoomen, aber Center ggf. anpassen (optional)
      // map.setCenter(mapStateRef.current.center);
      // map.setZoom(mapStateRef.current.zoom);
    }
    
    // Aktualisiere die Marker-Daten für jede Kategorie, falls die Map vollständig geladen ist
    if (map.isStyleLoaded()) {
      console.log(`[PlanBMap ${componentId.current}] Aktualisiere Marker-Daten`);
      
      // Aktualisiere die Datenquellen für jede Kategorie, ohne sie neu zu erstellen
      Object.entries(dynamicCategoryColors).forEach(([category, color]) => {
        const layerID = `marker-${category}`;
        
        // Filtere die Features nach Kategorie
        const filteredFeatures = memoizedMarkers.features.filter(
          (feature: Feature) => 
            feature.properties && feature.properties.Kategorie === category
        );
        
        // Prüfe, ob die Quelle bereits existiert
        if (map.getSource(layerID)) {
          console.log(`[PlanBMap ${componentId.current}] Aktualisiere Quelle für ${category} mit ${filteredFeatures.length} Features`);
          
          // Aktualisiere die bestehende Quelle mit neuen Daten
          const source = map.getSource(layerID) as maplibregl.GeoJSONSource;
          source.setData({
            type: 'FeatureCollection',
            features: filteredFeatures
          });
        }
      });
    }
  }, [center, zoom, memoizedMarkers, dynamicCategoryColors, componentId, isPickingLocation]);

  // Separater Effekt für den temporären Marker im Ortsauswahl-Modus
  useEffect(() => {
    // Nur ausführen, wenn die Map bereits existiert
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    
    console.log(`[PlanBMap ${componentId.current}] Ortsauswahl-Status geändert:`, isPickingLocation);
    
    // Globaler State zum Speichern des aktuellen Modus
    // Wird in einer konsolidierten Ref gespeichert, auf die von Event-Handlern zugegriffen werden kann
    window._planBPickerModeActive = isPickingLocation;
    
    if (isPickingLocation) {
      // Aktiviere den Ortsauswahl-Modus
      console.log(`[PlanBMap ${componentId.current}] Ortsauswahl-Modus AKTIVIERT`);
      
      // Zuerst Marker entfernen, falls er noch existiert (für den Fall, dass er nicht richtig entfernt wurde)
      if (tempMarkerRef.current) {
        console.log(`[PlanBMap ${componentId.current}] Entferne vorherigen Marker vor Erstellung eines neuen`);
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }
      
      // Erstelle einen temporären Marker an der aktuellen Mausposition oder Kartenmitte
      const center = map.getCenter();
      const newMarker = new maplibregl.Marker({
        color: '#FF0000',
        draggable: false
      }).setLngLat([center.lng, center.lat]).addTo(map);
      
      tempMarkerRef.current = newMarker;
      
      // Ändere den Cursor zum Anzeigen, dass man klicken kann
      map.getCanvas().style.cursor = 'crosshair';
      
      // Event-Handler für die Mausbewegung hinzufügen
      const mouseMoveHandler = (e: maplibregl.MapMouseEvent) => {
        if (tempMarkerRef.current) {
          tempMarkerRef.current.setLngLat([e.lngLat.lng, e.lngLat.lat]);
        }
      };
      
      // Event-Handler registrieren
      map.on('mousemove', mouseMoveHandler);
      
      // Cleanup-Funktion
      return () => {
        // Event-Handler entfernen
        map.off('mousemove', mouseMoveHandler);
        
        // Temporären Marker entfernen, falls er noch existiert
        if (tempMarkerRef.current) {
          console.log(`[PlanBMap ${componentId.current}] CLEANUP: Entferne Marker beim Beenden des Auswahlmodus`);
          tempMarkerRef.current.remove();
          tempMarkerRef.current = null;
        }
        
        // Cursor zurücksetzen
        map.getCanvas().style.cursor = '';
        
        // Globalen Status zurücksetzen
        window._planBPickerModeActive = false;
        
        console.log(`[PlanBMap ${componentId.current}] Ortsauswahl-Modus DEAKTIVIERT (Cleanup)`);
        
        // WICHTIG: Event auslösen, um sicherzustellen, dass der Dialog wieder angezeigt wird
        // (nur wenn das Komponenten-Cleanup durch Moduswechsel ausgelöst wurde)
        if (window._planBLastSelectedCoordinates) {
          console.log(`[PlanBMap ${componentId.current}] Löse forceReopenDialog-Event aus bei CLEANUP`);
          const reopenEvent = new CustomEvent('forceReopenDialog', {
            detail: { coordinates: window._planBLastSelectedCoordinates }
          });
          document.dispatchEvent(reopenEvent);
        }
      };
    } else {
      // Wenn wir aus dem Picker-Modus kommen und noch einen temporären Marker haben,
      // entfernen wir ihn manuell
      if (tempMarkerRef.current) {
        console.log(`[PlanBMap ${componentId.current}] MANUELL: Entferne Marker bei Modus-Deaktivierung`);
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
        
        // Setze Cursor zurück
        map.getCanvas().style.cursor = '';
      }
      
      // Globalen Status zurücksetzen
      window._planBPickerModeActive = false;
      
      // WICHTIG: Event auslösen, um sicherzustellen, dass der Dialog wieder angezeigt wird
      // (nur wenn Koordinaten ausgewählt wurden)
      if (window._planBLastSelectedCoordinates) {
        console.log(`[PlanBMap ${componentId.current}] Löse forceReopenDialog-Event aus bei MODUS-DEAKTIVIERUNG`);
        const reopenEvent = new CustomEvent('forceReopenDialog', {
          detail: { coordinates: window._planBLastSelectedCoordinates }
        });
        document.dispatchEvent(reopenEvent);
      }
    }
    
    // Keine Cleanup-Funktion nötig, wenn isPickingLocation false ist
    return undefined;
  }, [isPickingLocation, componentId.current]);
  
  // Effekt für die Aktualisierung der Marker nach dem Speichern
  useEffect(() => {
    // Nur ausführen, wenn die Map bereits existiert
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    
    // Handler für das planBMapRefreshMarkers-Event
    const handleRefreshMarkers = async (event: CustomEvent) => {
      console.log(`[PlanBMap ${componentId.current}] Aktualisiere Marker nach Speichern:`, event.detail);
      
      if (!map.isStyleLoaded()) {
        console.log(`[PlanBMap ${componentId.current}] Karte noch nicht geladen, überspringe Aktualisierung`);
        return;
      }
      
      try {
        // Wenn eine vollständige Markerliste im Event bereitgestellt wird, verwende diese direkt
        if (event.detail?.fullMarkerList && event.detail.fullMarkerList.features) {
          console.log(`[PlanBMap ${componentId.current}] Verwende bereitgestellte Markerliste für sofortige Aktualisierung`);
          
          const updatedMarkers = event.detail.fullMarkerList;
          
          // Gruppiere Features nach Kategorien
          const featuresByCategory: Record<string, Feature[]> = {};
          
          // Verarbeite alle Features aus den bereitgestellten Daten
          updatedMarkers.features.forEach((feature: Feature) => {
            if (feature.properties && feature.properties.Kategorie) {
              const category = feature.properties.Kategorie;
              if (!featuresByCategory[category]) {
                featuresByCategory[category] = [];
              }
              featuresByCategory[category].push(feature);
            }
          });
          
          // Überprüfe, ob neue Kategorien hinzugekommen sind, die ein UI-Update erfordern
          const currentCategories = Object.keys(dynamicCategoryColors);
          const newCategories = Object.keys(featuresByCategory).filter(
            category => !currentCategories.includes(category)
          );
          
          if (newCategories.length > 0) {
            console.log(`[PlanBMap ${componentId.current}] Neue Kategorien erkannt, füge sie hinzu:`, newCategories);
            
            // Aktualisiere das dynamicCategoryColors-Objekt mit den neuen Kategorien
            newCategories.forEach(category => {
              if (!dynamicCategoryColors[category]) {
                // Einfache Farbgenerierung basierend auf dem Kategorienamen
                const hue = Math.abs(category.charCodeAt(0) * 137.5) % 360;
                dynamicCategoryColors[category] = `hsl(${hue}, 70%, 50%)`;
                
                console.log(`[PlanBMap ${componentId.current}] Neue Kategorie erkannt und Farbe zugewiesen:`, 
                            category, dynamicCategoryColors[category]);
              }
            });
            
            // Füge für jede neue Kategorie einen Layer hinzu
            if (map.isStyleLoaded()) {
              // Füge für jede neue Kategorie eine Ebene hinzu
              newCategories.forEach(category => {
                const layerID = `marker-${category}`;
                
                // Filtere die Features nach Kategorie
                const filteredFeatures = updatedMarkers.features.filter(
                  (feature: Feature) => 
                    feature.properties && feature.properties.Kategorie === category
                );
                
                console.log(`[PlanBMap ${componentId.current}] Füge neue Kategorie ${category} mit ${filteredFeatures.length} Features hinzu`);
                
                try {
                  // Quelle hinzufügen
                  map.addSource(layerID, {
                    type: "geojson",
                    data: {
                      type: "FeatureCollection",
                      features: filteredFeatures,
                    },
                  });
                  
                  // Layer hinzufügen
                  map.addLayer({
                    id: layerID,
                    source: layerID,
                    type: "circle",
                    paint: {
                      "circle-radius": 6,
                      "circle-color": dynamicCategoryColors[category],
                    },
                  });
                  
                  console.log(`[PlanBMap ${componentId.current}] Neue Kategorie ${category} erfolgreich hinzugefügt`);
                  
                  // Nach einer kurzen Verzögerung style.load auslösen, um die Event-Handler zu registrieren
                  setTimeout(() => {
                    console.log(`[PlanBMap ${componentId.current}] Löse style.load aus für vollständiges Update`);
                    map.fire('style.load');
                  }, 100);
                  
                } catch (error) {
                  console.error(`[PlanBMap ${componentId.current}] Fehler beim Hinzufügen der Kategorie ${category}:`, error);
                }
              });
            } else {
              // Wenn der Stil nicht geladen ist, verzögere das Hinzufügen
              console.log(`[PlanBMap ${componentId.current}] Stil nicht geladen, verzögere Hinzufügen neuer Kategorien`);
              
              // Führe ein vollständiges Update durch
              setTimeout(() => {
                console.log(`[PlanBMap ${componentId.current}] Verzögertes Update mit neuen Kategorien`);
                map.fire('style.load');
              }, 100);
            }
            
            // Fortfahren mit normaler Aktualisierung
          }
          
          // Aktualisiere jede Kategorie mit den neuen Daten
          Object.entries(featuresByCategory).forEach(([category, features]) => {
            const layerID = `marker-${category}`;
            
            if (map.getSource(layerID)) {
              console.log(`[PlanBMap ${componentId.current}] Aktualisiere Kategorie ${category} direkt mit ${features.length} Features`);
              const source = map.getSource(layerID) as maplibregl.GeoJSONSource;
              
              try {
                source.setData({
                  type: 'FeatureCollection',
                  features: features
                });
              } catch (error) {
                console.error(`[PlanBMap ${componentId.current}] Fehler beim Aktualisieren von ${layerID}:`, error);
              }
            } else {
              console.log(`[PlanBMap ${componentId.current}] Kategorie ${category} existiert nicht, erstelle Layer`);
              
              try {
                // Quelle erst hinzufügen, wenn sie nicht existiert
                map.addSource(layerID, {
                  type: "geojson",
                  data: {
                    type: "FeatureCollection",
                    features: features,
                  },
                });

                // Füge die Ebene zur Karte hinzu
                map.addLayer({
                  id: layerID,
                  source: layerID,
                  type: "circle",
                  paint: {
                    "circle-radius": 6,
                    "circle-color": dynamicCategoryColors[category] || "#888888",
                  },
                });
                
                console.log(`[PlanBMap ${componentId.current}] Neuer Layer für Kategorie ${category} erstellt`);
                
                // WICHTIG: Hier müssten wir eigentlich alle Event-Handler für den neuen Layer hinzufügen
                // Das ist kompliziert und würde Code-Duplizierung bedeuten
                // Stattdessen führen wir ein vollständiges UI-Update durch
                setTimeout(() => {
                  console.log(`[PlanBMap ${componentId.current}] Vollständiges Update der Karte für neue Layer`);
                  map.fire('style.load');
                }, 100);
              } catch (error) {
                console.error(`[PlanBMap ${componentId.current}] Fehler beim Erstellen von Layer ${layerID}:`, error);
              }
            }
          });
        } else {
          // DIREKTE AKTUALISIERUNG: Hole die neuesten Daten vom Server
          console.log(`[PlanBMap ${componentId.current}] Lade frische Daten vom Server...`);
          
          const response = await fetch('/api/places');
          if (!response.ok) {
            throw new Error(`Fehler beim Laden der aktuellen Daten: ${response.status}`);
          }
          
          const freshData = await response.json();
          console.log(`[PlanBMap ${componentId.current}] Frische Daten vom Server geladen:`, freshData);
          
          if (freshData && freshData.features && Array.isArray(freshData.features)) {
            console.log(`[PlanBMap ${componentId.current}] Aktualisiere alle Kategorien mit ${freshData.features.length} Features`);
            
            // Gruppiere Features nach Kategorien
            const featuresByCategory: Record<string, Feature[]> = {};
            
            // Verarbeite alle Features aus den frischen Daten
            freshData.features.forEach((feature: Feature) => {
              if (feature.properties && feature.properties.Kategorie) {
                const category = feature.properties.Kategorie;
                if (!featuresByCategory[category]) {
                  featuresByCategory[category] = [];
                }
                featuresByCategory[category].push(feature);
              }
            });
            
            // Aktualisiere jede Kategorie mit den frischen Daten
            Object.entries(featuresByCategory).forEach(([category, features]) => {
              const layerID = `marker-${category}`;
              
              if (map.getSource(layerID)) {
                console.log(`[PlanBMap ${componentId.current}] Aktualisiere Kategorie ${category} mit ${features.length} Features`);
                const source = map.getSource(layerID) as maplibregl.GeoJSONSource;
                source.setData({
                  type: 'FeatureCollection',
                  features: features
                });
              }
            });
            
            // Wenn eine spezifische Feature-ID aktualisiert wurde, gib Debug-Informationen aus
            if (event.detail?.updatedFeature) {
              const updatedFeature = event.detail.updatedFeature as MongoDBFeature;
              console.log(`[PlanBMap ${componentId.current}] Prüfe, ob Feature ID ${updatedFeature._id} in frischen Daten enthalten ist`);
              
              const foundInFreshData = freshData.features.some((f: any) => 
                f._id === updatedFeature._id || 
                (f.properties && f.properties._id === updatedFeature._id)
              );
              
              console.log(`[PlanBMap ${componentId.current}] Feature ID ${updatedFeature._id} in frischen Daten gefunden: ${foundInFreshData}`);
            }
          }
        }
      } catch (error) {
        console.error(`[PlanBMap ${componentId.current}] Fehler bei der Aktualisierung:`, error);
        
        // FALLBACK: Bei einem Fehler versuchen wir, die Marker mit den vorhandenen Daten zu aktualisieren
        console.log(`[PlanBMap ${componentId.current}] Fallback: Aktualisiere alle Marker mit lokalen Daten`);
        
        Object.entries(dynamicCategoryColors).forEach(([category, color]) => {
          const layerID = `marker-${category}`;
          
          // Filtere die Features nach Kategorie
          const filteredFeatures = memoizedMarkers.features.filter(
            (feature: Feature) => 
              feature.properties && feature.properties.Kategorie === category
          );
          
          // Prüfe, ob die Quelle bereits existiert
          if (map.getSource(layerID)) {
            console.log(`[PlanBMap ${componentId.current}] Aktualisiere Quelle für ${category} mit ${filteredFeatures.length} Features`);
            
            // Aktualisiere die bestehende Quelle mit neuen Daten
            const source = map.getSource(layerID) as maplibregl.GeoJSONSource;
            source.setData({
              type: 'FeatureCollection',
              features: filteredFeatures
            });
          }
        });
      }
    };
    
    // Event-Listener registrieren
    document.addEventListener('planBMapRefreshMarkers', handleRefreshMarkers as unknown as EventListener);
    
    // Cleanup-Funktion
    return () => {
      document.removeEventListener('planBMapRefreshMarkers', handleRefreshMarkers as unknown as EventListener);
    };
  }, [mapRef.current, memoizedMarkers, dynamicCategoryColors, componentId]);

  return (
    <div className={styles.container} style={{ width, height }}>
      <div ref={mapContainer} className={styles.map}></div>
      <div ref={filterGroupRef} className={styles.filterGroup}></div>
      <div className={styles.filterCtrl}>
        <input
          ref={filterInputRef}
          type="text"
          name="filter"
          placeholder="Filter by name"
          className={styles.filterInput}
        />
      </div>
    </div>
  );
};

export default PlanBMap; 