import React, { useEffect, useState } from 'react';
import { appState, AppStateEvent, useAppState } from '../utils/appState';
import { formatCoordinates, fixCoordinates } from '../utils/coordinateUtils';

// Verbesserte Debug-Anzeige der relevanten Parameter mit dem zentralen Zustandsmanagement
const DebugOverlay: React.FC = () => {
  // Verwende den zentralen Debug-Modus Status
  const [isDebugMode] = useAppState('isDebugMode');
  
  // Erweiterte Debug-Infos
  const [debugInfo, setDebugInfo] = useState({
    // Globale Zustände
    pickerActive: false,
    lastCoordinates: [0, 0] as [number, number],
    
    // Detailansicht-Status
    detailDialogOpen: false,
    selectedPlaceName: '',
    isEditMode: false,
    
    // Map-Status
    mapZoom: 0,
    lastClickCoordinates: [0, 0] as [number, number],
    
    // Legacy-Status (Window-Variablen)
    legacyPickerActive: false,
    
    // Aktualisierungszeit
    lastUpdate: new Date().toISOString()
  });
  
  // Aktualisiere die Debug-Infos, wenn sich der zentrale Zustand ändert
  useEffect(() => {
    const updateDebugInfo = () => {
      // Alle Werte aus dem zentralen Zustand lesen
      const state = appState.getState();
      
      // Legacy-Status für Vergleich
      const legacyPickerActive = typeof window !== 'undefined' ? !!window._planBPickerModeActive : false;
      
      setDebugInfo({
        // Ortsauswahl
        pickerActive: state.pickerModeActive,
        lastCoordinates: state.lastSelectedCoordinates || [0, 0],
        
        // Dialog-Status
        detailDialogOpen: state.detailDialogOpen,
        selectedPlaceName: state.selectedPlaceName,
        isEditMode: state.isEditMode,
        
        // Map-Zoom
        mapZoom: state.mapZoom,
        lastClickCoordinates: debugInfo.lastClickCoordinates,
        
        // Legacy-Status
        legacyPickerActive,
        
        // Update-Zeit
        lastUpdate: new Date().toISOString()
      });
    };
    
    // Sofort aktualisieren
    updateDebugInfo();
    
    // Auf Zustandsänderungen reagieren
    appState.on(AppStateEvent.STATE_CHANGED, updateDebugInfo);
    
    // Zusätzliche Event-Listener für wichtige Ereignisse (für die UI-Interaktionen)
    const eventTypes = ['mousedown', 'click'];
    const handleUserInteraction = () => {
      // Verzögert aktualisieren, um Zeit für die State-Updates zu geben
      setTimeout(updateDebugInfo, 100);
    };
    
    // Event-Listener für Klicks auf die Karte, um Koordinaten zu speichern
    const handleMapClick = (e: MouseEvent) => {
      // Versuche zu erkennen, ob der Klick auf die Karte erfolgte
      const target = e.target as HTMLElement;
      if (target && (
        target.classList.contains('maplibregl-canvas') ||
        target.closest('.maplibregl-canvas')
      )) {
        // Wir können die Koordinaten nicht direkt aus dem Event bekommen,
        // aber wir können die Mausposition speichern
        setDebugInfo(prev => ({
          ...prev,
          lastClickCoordinates: [e.clientX, e.clientY]
        }));
      }
    };
    
    eventTypes.forEach(type => {
      document.addEventListener(type, handleUserInteraction);
    });
    document.addEventListener('click', handleMapClick);
    
    return () => {
      // Listener entfernen beim Unmount
      appState.off(AppStateEvent.STATE_CHANGED, updateDebugInfo);
      eventTypes.forEach(type => {
        document.removeEventListener(type, handleUserInteraction);
      });
      document.removeEventListener('click', handleMapClick);
    };
  }, [debugInfo.lastClickCoordinates]);
  
  // Funktion zum Testen von Koordinatenumwandlungen
  const testCoordinateTransformation = () => {
    // Test für verschiedene Koordinatenformate
    const testCoordinates = [
      [116.6603, 4.7176], // Falsche Koordinaten (sollten korrigiert werden)
      [11.6603, 46.7176]  // Korrekte Koordinaten
    ];
    
    console.log("========= KOORDINATEN-TEST =========");
    testCoordinates.forEach((coords, index) => {
      const [lon, lat] = coords;
      console.log(`Test #${index+1}: [${lon}, ${lat}]`);
      
      // Verwende die zentrale Koordinatenkorrektur-Funktion
      const [correctedLon, correctedLat] = fixCoordinates(lon, lat);
      
      if (lon !== correctedLon || lat !== correctedLat) {
        console.log(`  Korrigierte Koordinaten: [${correctedLon}, ${correctedLat}]`);
      } else {
        console.log(`  Koordinaten sind bereits korrekt.`);
      }
    });
    console.log("===================================");
  };
  
  // Funktion zum Beenden des Picker-Modus
  const resetPickerMode = () => {
    // Picker-Modus im zentralen Zustand deaktivieren
    appState.setPickerMode(false);
    
    // Legacy: Event auslösen
    const event = new CustomEvent('planBMapCancelLocationPicker');
    document.dispatchEvent(event);
  };
  
  // Button zum Umschalten des Debug-Modus
  const toggleDebugMode = () => {
    appState.setDebugMode(!isDebugMode);
  };
  
  // Wenn der Debug-Modus deaktiviert ist, zeigen wir nur einen kleinen Button an
  if (!isDebugMode) {
    return (
      <button
        onClick={toggleDebugMode}
        style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          padding: '5px 8px',
          borderRadius: '3px',
          fontSize: '10px',
          fontFamily: 'monospace',
          zIndex: 9999,
          border: 'none',
          cursor: 'pointer'
        }}
      >
        Debug
      </button>
    );
  }
  
  // Zeige eine Warnung an, wenn der Zustand inkonsistent ist
  const showInconsistencyWarning = debugInfo.pickerActive !== debugInfo.legacyPickerActive;
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 9999,
        maxWidth: '300px'
      }}
    >
      <div style={{ marginBottom: '8px', borderBottom: '1px solid #555', paddingBottom: '5px' }}>
        <div style={{ fontWeight: 'bold' }}>Global State:</div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          color: debugInfo.pickerActive ? '#ff8a65' : 'white'
        }}>
          <span>pickingLocation: {debugInfo.pickerActive ? 'true' : 'false'}</span>
          {debugInfo.pickerActive && (
            <button
              onClick={resetPickerMode}
              style={{
                marginLeft: '8px',
                background: '#ff5555',
                border: 'none',
                borderRadius: '3px',
                padding: '2px 6px',
                color: 'white',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              Abbrechen
            </button>
          )}
        </div>
        {showInconsistencyWarning && (
          <div style={{ 
            color: '#ff5252', 
            fontSize: '10px',
            fontWeight: 'bold',
            marginTop: '4px'
          }}>
            ACHTUNG: Zustandsinkonsistenz! Legacy: {debugInfo.legacyPickerActive ? 'aktiv' : 'inaktiv'}
          </div>
        )}
        {debugInfo.lastCoordinates && debugInfo.lastCoordinates[0] !== 0 && (
          <div>
            lastCoordinates: [{debugInfo.lastCoordinates[0].toFixed(5)}, {debugInfo.lastCoordinates[1].toFixed(5)}]
          </div>
        )}
      </div>
      
      <div style={{ marginBottom: '8px', borderBottom: '1px solid #555', paddingBottom: '5px' }}>
        <div style={{ fontWeight: 'bold' }}>Detailansicht:</div>
        <div>dialogOpen: {debugInfo.detailDialogOpen ? 'true' : 'false'}</div>
        {debugInfo.selectedPlaceName && (
          <div>selectedPlace: "{debugInfo.selectedPlaceName}"</div>
        )}
        <div>editMode: {debugInfo.isEditMode ? 'true' : 'false'}</div>
      </div>
      
      <div style={{ marginBottom: '8px', borderBottom: '1px solid #555', paddingBottom: '5px' }}>
        <div style={{ fontWeight: 'bold' }}>Map Status:</div>
        <div>zoom: {debugInfo.mapZoom.toFixed(2)}</div>
      </div>
      
      <div style={{ fontSize: '10px', color: '#aaa' }}>
        Last update: {new Date(debugInfo.lastUpdate).toLocaleTimeString()}
      </div>
      
      <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }}>
        <button
          onClick={resetPickerMode}
          style={{
            background: '#ff5555',
            border: 'none',
            borderRadius: '3px',
            padding: '2px 6px',
            color: 'white',
            fontSize: '10px',
            cursor: 'pointer'
          }}
        >
          Reset Picker
        </button>
        
        <button
          onClick={testCoordinateTransformation}
          style={{
            background: '#55aaff',
            border: 'none',
            borderRadius: '3px',
            padding: '2px 6px',
            color: 'white',
            fontSize: '10px',
            cursor: 'pointer'
          }}
        >
          Koordinaten-Test
        </button>
        
        <button
          onClick={toggleDebugMode}
          style={{
            background: '#555555',
            border: 'none',
            borderRadius: '3px',
            padding: '2px 6px',
            color: 'white',
            fontSize: '10px',
            cursor: 'pointer'
          }}
        >
          Ausblenden
        </button>
      </div>
    </div>
  );
};

export default DebugOverlay; 