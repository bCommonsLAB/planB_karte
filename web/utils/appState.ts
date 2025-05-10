/**
 * Zentrales Zustandsmanagement für die Plan B Karte
 * 
 * Diese Datei implementiert einen einfachen, typsicheren Zustandsspeicher
 * für die gesamte Anwendung, um Kommunikation zwischen Komponenten zu erleichtern.
 */

import { EventEmitter } from 'events';

// Definiere Typen für den Anwendungszustand
export interface AppState {
  // Ortsauswahl-Modus
  pickerModeActive: boolean;
  lastSelectedCoordinates: [number, number] | null;
  
  // Detailansicht-Status
  detailDialogOpen: boolean;
  selectedPlaceName: string;
  isEditMode: boolean;
  
  // Karten-Status
  mapZoom: number;
  
  // Debug-Modus
  isDebugMode: boolean;
}

// Initialer Zustand
const initialState: AppState = {
  pickerModeActive: false,
  lastSelectedCoordinates: null,
  
  detailDialogOpen: false,
  selectedPlaceName: '',
  isEditMode: false,
  
  mapZoom: 14,
  
  isDebugMode: process.env.NODE_ENV === 'development'
};

// Event-Namen für Zustandsänderungen
export enum AppStateEvent {
  PICKER_MODE_CHANGED = 'PICKER_MODE_CHANGED',
  COORDINATES_SELECTED = 'COORDINATES_SELECTED',
  DIALOG_STATUS_CHANGED = 'DIALOG_STATUS_CHANGED',
  EDIT_MODE_CHANGED = 'EDIT_MODE_CHANGED',
  MAP_ZOOM_CHANGED = 'MAP_ZOOM_CHANGED',
  DEBUG_MODE_CHANGED = 'DEBUG_MODE_CHANGED',
  STATE_CHANGED = 'STATE_CHANGED' // Allgemeines Event für alle Änderungen
}

/**
 * Klasse für das zentrale Zustandsmanagement
 */
class AppStateManager extends EventEmitter {
  private state: AppState = { ...initialState };
  
  /**
   * Aktuelle Kopie des Zustands abrufen
   */
  getState(): AppState {
    return { ...this.state };
  }
  
  /**
   * Zustand teilweise aktualisieren und Events auslösen
   */
  setState(partialState: Partial<AppState>): void {
    // Prüfe, welche Werte sich ändern
    const changedKeys: (keyof AppState)[] = [];
    
    Object.entries(partialState).forEach(([key, value]) => {
      const typedKey = key as keyof AppState;
      if (this.state[typedKey] !== value) {
        changedKeys.push(typedKey);
      }
    });
    
    // Aktualisiere den Zustand
    this.state = { ...this.state, ...partialState };
    
    // Spezifische Events auslösen
    changedKeys.forEach(key => {
      switch (key) {
        case 'pickerModeActive':
          this.emit(AppStateEvent.PICKER_MODE_CHANGED, this.state.pickerModeActive);
          break;
        case 'lastSelectedCoordinates':
          this.emit(AppStateEvent.COORDINATES_SELECTED, this.state.lastSelectedCoordinates);
          break;
        case 'detailDialogOpen':
          this.emit(AppStateEvent.DIALOG_STATUS_CHANGED, this.state.detailDialogOpen);
          break;
        case 'isEditMode':
          this.emit(AppStateEvent.EDIT_MODE_CHANGED, this.state.isEditMode);
          break;
        case 'mapZoom':
          this.emit(AppStateEvent.MAP_ZOOM_CHANGED, this.state.mapZoom);
          break;
        case 'isDebugMode':
          this.emit(AppStateEvent.DEBUG_MODE_CHANGED, this.state.isDebugMode);
          break;
      }
    });
    
    // Allgemeines Event für jede Änderung
    if (changedKeys.length > 0) {
      this.emit(AppStateEvent.STATE_CHANGED, this.state);
    }
    
    // Für die Übergangszeit: Aktualisiere auch die globalen window-Variablen
    if (typeof window !== 'undefined') {
      if ('pickerModeActive' in partialState) {
        window._planBPickerModeActive = this.state.pickerModeActive;
      }
      if ('lastSelectedCoordinates' in partialState && this.state.lastSelectedCoordinates) {
        window._planBLastSelectedCoordinates = this.state.lastSelectedCoordinates;
      }
      if ('detailDialogOpen' in partialState) {
        window._planBDetailDialogOpen = this.state.detailDialogOpen;
      }
      if ('selectedPlaceName' in partialState) {
        window._planBSelectedPlaceName = this.state.selectedPlaceName;
      }
      if ('isEditMode' in partialState) {
        window._planBIsEditMode = this.state.isEditMode;
      }
    }
  }
  
  // Spezifische Setter für häufig verwendete Zustandsänderungen
  
  /**
   * Ortsauswahl-Modus aktivieren/deaktivieren
   */
  setPickerMode(active: boolean): void {
    this.setState({ pickerModeActive: active });
  }
  
  /**
   * Ausgewählte Koordinaten speichern
   */
  setSelectedCoordinates(coordinates: [number, number] | null): void {
    this.setState({ lastSelectedCoordinates: coordinates });
  }
  
  /**
   * Detail-Dialog Status ändern
   */
  setDetailDialogOpen(open: boolean, placeName: string = ''): void {
    this.setState({ 
      detailDialogOpen: open,
      selectedPlaceName: open ? placeName : ''
    });
  }
  
  /**
   * Bearbeitungsmodus ein-/ausschalten
   */
  setEditMode(editMode: boolean): void {
    this.setState({ isEditMode: editMode });
  }
  
  /**
   * Namen des ausgewählten Ortes setzen
   */
  setSelectedPlaceName(name: string): void {
    this.setState({ selectedPlaceName: name });
  }
  
  /**
   * Debug-Modus ein-/ausschalten
   */
  setDebugMode(active: boolean): void {
    this.setState({ isDebugMode: active });
  }
}

// Singleton-Instanz exportieren
export const appState = new AppStateManager();

// React Hook für einfache Verwendung in Komponenten
export function useAppState<K extends keyof AppState>(key: K): [AppState[K], (value: AppState[K]) => void] {
  const value = appState.getState()[key];
  
  const setValue = (newValue: AppState[K]) => {
    appState.setState({ [key]: newValue } as Partial<AppState>);
  };
  
  return [value, setValue];
} 