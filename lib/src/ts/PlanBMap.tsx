import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { LngLatLike, Map, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './PlanBMap.css';
import { overpassToGeojson } from './query_overpass';
import { Feature, GeoJSON } from 'geojson';

interface PlanBMapProps {
  markers: GeoJSON;
  mapStyle?: string;
  mapApiKey?: string; 
  center?: LngLatLike;
  zoom?: number;
  categoryColors?: {[key: string]: string};
  showDrinkingWater?: boolean;
  height?: string;
  width?: string;
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
  showDrinkingWater = true,
  height = '100%',
  width = '100%'
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const filterGroupRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const [layerIDs, setLayerIDs] = useState<string[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;
    
    // Falls die Karte bereits initialisiert wurde, return
    if (mapRef.current) return;

    const getMapStyle = async (): Promise<string> => {
      let effectiveStyle = mapStyle;
      
      // Füge den API-Key hinzu, wenn er im URL-String fehlt und vorhanden ist
      if (mapApiKey && !effectiveStyle.includes('key=')) {
        effectiveStyle += effectiveStyle.includes('?') ? `&key=${mapApiKey}` : `?key=${mapApiKey}`;
      }
      
      return effectiveStyle;
    };

    const initializeMap = async () => {
      try {
        const styleUrl = await getMapStyle();
        
        // Initialisiere die Karte
        const map = new maplibregl.Map({
          container: mapContainer.current!,
          style: styleUrl,
          center: center,
          zoom: zoom,
          pitchWithRotate: false, // Disable tilting the map
        });
        
        mapRef.current = map;
        
        // Create a popup, but don't add it to the map yet
        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
        });

        // Nach dem Laden der Karte füge die Marker hinzu
        map.on('load', async () => {
          try {
            // Lade das Marker-Bild
            const image = await map.loadImage(
              "https://maplibre.org/maplibre-gl-js/docs/assets/custom_marker.png"
            );
            map.addImage("custom-marker", image.data);

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

            // Füge für jede Kategorie eine Ebene hinzu
            const newLayerIDs: string[] = [];
            
            Object.entries(categoryColors).forEach(([category, color]) => {
              const layerID = `marker-${category}`;
              newLayerIDs.push(layerID);

              // Filtere die Features nach Kategorie
              const filteredFeatures = markers.features.filter(
                (feature: Feature) => 
                  feature.properties && feature.properties.Kategorie === category
              );

              // Füge eine Quelle für jede Kategorie hinzu
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

              map.on("mouseleave", layerID, () => {
                map.getCanvas().style.cursor = "";
                popup.remove();
              });
            });

            setLayerIDs(newLayerIDs);
            
            // Textfilter-Funktionalität hinzufügen
            if (filterInputRef.current) {
              filterInputRef.current.addEventListener("keyup", (e) => {
                const value = (e.target as HTMLInputElement).value.trim().toLowerCase();

                newLayerIDs.forEach((layerID) => {
                  if (value === "") {
                    map.setFilter(layerID, null);
                    return;
                  }

                  // Filter für jede Ebene erstellen
                  const categoryName = layerID.split("-")[1];
                  const filters: any[] = ["any"];
                  
                  markers.features.forEach((feature) => {
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
              });
            }
          } catch (error) {
            console.error("Fehler beim Laden der Kartendaten:", error);
          }
        });
      } catch (error) {
        console.error("Fehler beim Initialisieren der Karte:", error);
      }
    };

    initializeMap();

    // Cleanup-Funktion
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapContainer, markers, mapStyle, mapApiKey, center, zoom, categoryColors, showDrinkingWater]);

  return (
    <div className="planb-map-container" style={{ width, height }}>
      <div ref={mapContainer} className="planb-map"></div>
      <div ref={filterGroupRef} className="filter-group"></div>
      <div className="filter-ctrl">
        <input
          ref={filterInputRef}
          type="text"
          name="filter"
          placeholder="Filter by name"
        />
      </div>
    </div>
  );
};

export default PlanBMap; 