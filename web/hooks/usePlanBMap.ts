import { useEffect, useState, useRef } from 'react';
import maplibregl, { Map as MaplibreMap } from 'maplibre-gl';

interface UsePlanBMapOptions {
  containerId: string;
  styleUrl: string;
  center: maplibregl.LngLatLike;
  zoom: number;
}

export default function usePlanBMap({
  containerId,
  styleUrl,
  center,
  zoom
}: UsePlanBMapOptions) {
  const mapInstance = useRef<MaplibreMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const styleLoaded = useRef(false);
  
  // Diese Referenz stellt sicher, dass wir nicht mehrmals initialisieren
  const hasInitialized = useRef(false);
  const renderCount = useRef(0);
  const instanceId = useRef(`map-${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    // Zähle jede Renderung
    renderCount.current += 1;
    console.log(`[PlanBMap ${instanceId.current}] Render #${renderCount.current}, hasInitialized=${hasInitialized.current}`);

    // Stellen Sie sicher, dass der Code nicht im Server-Rendering ausgeführt wird
    if (typeof window === 'undefined') {
      console.log(`[PlanBMap ${instanceId.current}] Kein Client-seitiges Rendering, überspringe Initialisierung`);
      return;
    }

    // Nur einmal initialisieren
    if (hasInitialized.current) {
      console.log(`[PlanBMap ${instanceId.current}] Bereits initialisiert, überspringe Neuinitialisierung`);
      return;
    }
    
    console.log(`[PlanBMap ${instanceId.current}] Initialisiere Map...`);
    hasInitialized.current = true;

    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[PlanBMap ${instanceId.current}] Container #${containerId} nicht gefunden!`);
      return;
    }

    // Stelle sicher, dass wir keine doppelte Initialisierung haben
    if (mapInstance.current) {
      console.warn(`[PlanBMap ${instanceId.current}] Map-Instanz existiert bereits trotz hasInitialized=false!`);
      return;
    }

    try {
      console.log(`[PlanBMap ${instanceId.current}] Erstelle neue MapLibre-Instanz mit Stil: ${styleUrl}`);
      const map = new maplibregl.Map({
        container,
        style: styleUrl,
        center,
        zoom,
        pitchWithRotate: false,
        attributionControl: false,
        antialias: true,
        preserveDrawingBuffer: true,
        renderWorldCopies: true
      });

      map.once('load', () => {
        console.log(`[PlanBMap ${instanceId.current}] Map vollständig geladen`);
        setIsLoaded(true);
        styleLoaded.current = true;
      });

      // Logge alle relevanten Map-Events
      const events = ['styledata', 'render', 'idle', 'styledataloading', 'sourcedata'];
      events.forEach(event => {
        map.on(event, () => {
          console.log(`[PlanBMap ${instanceId.current}] Event: ${event}`);
        });
      });

      // Event-Listener für Fehler hinzufügen
      map.on('error', (e) => {
        console.error(`[PlanBMap ${instanceId.current}] Maplibre-Fehler:`, e);
      });

      // Deaktiviere häufiges Neuladen
      map.on('styleimagemissing', (e) => {
        console.log(`[PlanBMap ${instanceId.current}] Fehlende Stil-Bild: ${e.id}`);
        if (styleLoaded.current) {
          console.log(`[PlanBMap ${instanceId.current}] Stil bereits geladen, ignoriere missing image`);
          return;
        }
      });

      mapInstance.current = map;
      console.log(`[PlanBMap ${instanceId.current}] Map-Instanz erfolgreich erstellt`);
    } catch (error) {
      console.error(`[PlanBMap ${instanceId.current}] Fehler bei der Karteninitialisierung:`, error);
    }

    // Aufräumen
    return () => {
      if (mapInstance.current) {
        console.log(`[PlanBMap ${instanceId.current}] Entferne Map-Instanz beim Cleanup`);
        mapInstance.current.remove();
        mapInstance.current = null;
        hasInitialized.current = false;
      }
    };
  }, [containerId, styleUrl, center, zoom]);

  return {
    map: mapInstance.current,
    isLoaded
  };
} 