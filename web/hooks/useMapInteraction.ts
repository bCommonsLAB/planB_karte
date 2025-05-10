import { useState, useEffect, useCallback } from 'react';
import { Feature } from 'geojson';
import { appState, AppStateEvent } from '../utils/appState';

/**
 * Interface für die Optionen des MapInteraction-Hooks
 */
interface MapInteractionOptions {
  // Callback, wenn ein Ort ausgewählt wurde
  onPlaceSelected?: (place: Feature) => void;
  
  // Callback, wenn die Koordinaten im Picker-Modus ausgewählt wurden
  onCoordinatesSelected?: (coordinates: [number, number]) => void;
  
  // Callback, wenn der Picker-Modus gestartet wird
  onPickerModeStarted?: () => void;
  
  // Callback, wenn der Picker-Modus beendet wird
  onPickerModeEnded?: () => void;
}

/**
 * Der MapInteraction-Hook stellt Funktionen für die Karteninteraktion zur Verfügung
 * und synchronisiert den Zustand zwischen Karte und UI.
 * 
 * Korrekter Workflow für die Ortsauswahl:
 * 1. Rufe `startPickingLocation(callback)` mit einem Callback auf, der die ausgewählten Koordinaten verarbeitet
 * 2. Der Hook setzt den globalen Picker-Modus und informiert alle Komponenten
 * 3. Wenn ein Klick auf die Karte erfolgt, wird `handleMapClick` aufgerufen
 * 4. Der Hook ruft das Callback mit den Koordinaten auf und beendet den Picker-Modus
 * 5. Falls nötig, kann der Picker-Modus auch mit `cancelPickingLocation` abgebrochen werden
 */
export function useMapInteraction(options: MapInteractionOptions = {}) {
  // Lokaler State für Callbacks und Modi
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [locationPickerCallback, setLocationPickerCallback] = useState<
    ((coordinates: [number, number]) => void) | null
  >(null);
  
  // Synchronisiere lokalen State mit globalem State
  useEffect(() => {
    const updateFromGlobalState = () => {
      const state = appState.getState();
      setIsPickingLocation(state.pickerModeActive);
    };
    
    // Initial synchronisieren
    updateFromGlobalState();
    
    // Auf globale Zustandsänderungen hören
    appState.on(AppStateEvent.STATE_CHANGED, updateFromGlobalState);
    
    return () => {
      appState.off(AppStateEvent.STATE_CHANGED, updateFromGlobalState);
    };
  }, []);

  // Synchronisiere beim Mounten einmalig auch die globalen Window-Variablen (Legacy-Unterstützung)
  useEffect(() => {
    // Legacy: Synchronisiere mit window-Variablen (nur einmalig beim Mounten)
    if (typeof window !== 'undefined') {
      // Initialer Status von window
      if (window._planBPickerModeActive) {
        appState.setPickerMode(true);
      }
      
      // WICHTIG: Für Legacy-Support die Window-Variablen aktualisieren
      window._planBPickerModeActive = appState.getState().pickerModeActive;
    }
  }, []);
  
  // Koordinatenauswahl-Modus starten
  const startPickingLocation = useCallback((callback?: (coordinates: [number, number]) => void, initialPosition?: [number, number]) => {
    console.log('[useMapInteraction] Starte Ortsauswahl-Modus');
    
    // Callback setzen, wenn übergeben
    if (callback) {
      setLocationPickerCallback(() => callback);
    }
    
    // Initiale Position setzen, wenn übergeben
    if (initialPosition) {
      appState.setSelectedCoordinates(initialPosition);
      console.log('[useMapInteraction] Setze initiale Position:', initialPosition);
      
      // Legacy: Für kompatibilität mit vorhandenen Komponenten
      if (typeof window !== 'undefined') {
        window._planBLastSelectedCoordinates = initialPosition;
      }
    }
    
    // Picker-Modus im globalen Zustand aktivieren
    appState.setPickerMode(true);
    
    // Legacy: Globale Variable aktualisieren
    if (typeof window !== 'undefined') {
      window._planBPickerModeActive = true;
    }
    
    // Optionalen Callback aufrufen
    if (options.onPickerModeStarted) {
      options.onPickerModeStarted();
    }
    
    // Falls wir kein Callback haben, aber einen Default-Callback in den Optionen,
    // verwenden wir diesen
    if (!callback && options.onCoordinatesSelected) {
      setLocationPickerCallback(() => (coordinates: [number, number]) => {
        options.onCoordinatesSelected!(coordinates);
      });
    }
    
    // Detailansicht schließen, um die Karte anzuzeigen (falls nötig)
    appState.setDetailDialogOpen(false);
    
    // Event zur Benachrichtigung anderer Komponenten auslösen
    const event = new CustomEvent('planBSwitchToMapView');
    document.dispatchEvent(event);
  }, [options]);
  
  // Koordinatenauswahl-Modus beenden
  const cancelPickingLocation = useCallback(() => {
    console.log('[useMapInteraction] Breche Ortsauswahl-Modus ab');
    
    // Überprüfe zuerst, ob der Picker-Modus überhaupt aktiv ist
    if (!appState.getState().pickerModeActive && !locationPickerCallback) {
      console.log('[useMapInteraction] Picker-Modus bereits inaktiv, nichts zu tun');
      return;
    }
    
    // Picker-Modus im globalen Zustand deaktivieren
    appState.setPickerMode(false);
    
    // Legacy: Globale Variable aktualisieren
    if (typeof window !== 'undefined') {
      window._planBPickerModeActive = false;
    }
    
    // Callback zurücksetzen
    setLocationPickerCallback(null);
    
    // Optionalen Callback aufrufen
    if (options.onPickerModeEnded) {
      options.onPickerModeEnded();
    }
    
    // Legacy-Event für bestehende Komponenten auslösen
    const event = new CustomEvent('planBMapCancelLocationPicker');
    document.dispatchEvent(event);
    
    // Aktualisiere auch den lokalen Zustand
    setIsPickingLocation(false);
  }, [options, setIsPickingLocation, locationPickerCallback]);
  
  // Handler für Klicks auf die Karte
  const handleMapClick = useCallback((coordinates: [number, number]) => {
    console.log('[useMapInteraction] Kartenklick bei Koordinaten:', coordinates);
    
    // Koordinaten im globalen Zustand speichern
    appState.setSelectedCoordinates(coordinates);
    
    // Legacy: Für kompatibilität mit vorhandenen Komponenten
    if (typeof window !== 'undefined') {
      window._planBLastSelectedCoordinates = coordinates;
    }
    
    // Überprüfe, ob wir im Picker-Modus sind
    const isInPickerMode = appState.getState().pickerModeActive;
    
    if (isInPickerMode) {
      console.log('[useMapInteraction] Ortsauswahl-Modus aktiv, verarbeite Koordinaten');
      
      // Picker-Modus beenden
      appState.setPickerMode(false);
      
      // Legacy: Globale Variable aktualisieren
      if (typeof window !== 'undefined') {
        window._planBPickerModeActive = false;
      }
      
      // Callback mit den Koordinaten aufrufen, falls vorhanden
      if (locationPickerCallback) {
        locationPickerCallback(coordinates);
        setLocationPickerCallback(null);
      } else if (options.onCoordinatesSelected) {
        // Fallback auf die Option
        options.onCoordinatesSelected(coordinates);
      }
      
      // Event zur Wiederherstellung des UI-Zustands auslösen
      const forceReopenEvent = new CustomEvent('forceReopenDialog', {
        detail: { coordinates }
      });
      document.dispatchEvent(forceReopenEvent);
      
      // Optionalen Callback aufrufen
      if (options.onPickerModeEnded) {
        options.onPickerModeEnded();
      }
    }
  }, [locationPickerCallback, options]);
  
  // Handler für Klicks auf Marker
  const handleMarkerClick = useCallback((place: Feature) => {
    console.log('[useMapInteraction] Marker angeklickt:', place.properties?.Name);
    
    // Wenn wir im Picker-Modus sind und es sich um ein Point-Feature handelt,
    // verwenden wir die Koordinaten des Markers
    if (appState.getState().pickerModeActive && place.geometry?.type === 'Point') {
      // Extrahiere die Koordinaten aus dem Feature
      const coordinates = place.geometry.coordinates as [number, number];
      
      // Koordinaten im globalen Zustand speichern
      appState.setSelectedCoordinates(coordinates);
      
      // Picker-Modus beenden
      appState.setPickerMode(false);
      
      // Legacy: Globale Variable aktualisieren
      if (typeof window !== 'undefined') {
        window._planBPickerModeActive = false;
        window._planBLastSelectedCoordinates = coordinates;
      }
      
      // Callback mit den Koordinaten aufrufen, falls vorhanden
      if (locationPickerCallback) {
        locationPickerCallback(coordinates);
        setLocationPickerCallback(null);
      } else if (options.onCoordinatesSelected) {
        // Fallback auf die Option
        options.onCoordinatesSelected(coordinates);
      }
      
      // Optionalen Callback aufrufen
      if (options.onPickerModeEnded) {
        options.onPickerModeEnded();
      }
      
      return;
    }
    
    // Normalmodus: Optionalen Callback aufrufen
    if (options.onPlaceSelected) {
      options.onPlaceSelected(place);
    }
  }, [locationPickerCallback, options]);
  
  // Event-Listener für externe Picker-Abbrüche (z.B. vom Debug-Overlay)
  useEffect(() => {
    const handlePickerCancel = () => {
      console.log('[useMapInteraction] Externes Abbruch-Event empfangen');
      setLocationPickerCallback(null);
    };
    
    document.addEventListener('planBMapCancelLocationPicker', handlePickerCancel);
    
    return () => {
      document.removeEventListener('planBMapCancelLocationPicker', handlePickerCancel);
    };
  }, []);
  
  return {
    // Status des Picker-Modus direkt aus dem globalen Zustand
    isPickingLocation: appState.getState().pickerModeActive,
    
    // Funktionen
    startPickingLocation,
    cancelPickingLocation,
    handleMapClick,
    handleMarkerClick
  };
} 