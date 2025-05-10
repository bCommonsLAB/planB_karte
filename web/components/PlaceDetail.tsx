"use client"

import React, { useState, useEffect } from 'react'
import { Sheet } from './ui/sheet'
import { Feature } from 'geojson'
import { ExternalLink, Clock, MapPin, Phone, Mail, User, Tag, Info, Edit, Save, X } from 'lucide-react'
import { appState, AppStateEvent } from '../utils/appState'

// Typ-Erweiterung für globale Hilfsvariablen
declare global {
  interface Window {
    _planBPickerModeActive?: boolean;
    _planBLastSelectedCoordinates?: [number, number];
    _planBIsEditMode?: boolean;
    _planBDetailDialogOpen?: boolean;
    _planBSelectedPlaceName?: string;
  }
}

// Ergänze die Interface-Definition, um die _id für MongoDB zu berücksichtigen
interface MongoDBFeature extends Feature {
  _id?: string;
}

interface PlaceDetailProps {
  place: MongoDBFeature | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedPlace: MongoDBFeature) => void
  onPickLocation: (callback: (coordinates: [number, number]) => void, initialPosition?: [number, number]) => void
  isNewPlace?: boolean
  onEditingStateChange?: (isEditing: boolean) => void
}

const PlaceDetail: React.FC<PlaceDetailProps> = ({ place, isOpen, onClose, onUpdate, onPickLocation, isNewPlace = false, onEditingStateChange }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<any>({})
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isPickingLocation, setIsPickingLocation] = useState(false)
  const [categories, setCategories] = useState<{kategorie: string, anzahl: number}[]>([])
  const [isCustomCategory, setIsCustomCategory] = useState(false)

  // Lade bestehende Kategorien beim ersten Öffnen
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/places/categories');
        if (response.ok) {
          const data = await response.json();
          if (data && data.categories) {
            setCategories(data.categories);
          }
        }
      } catch (error) {
        console.error('Fehler beim Laden der Kategorien:', error);
      }
    };

    fetchCategories();
  }, []);

  // Synchronisiere lokalen isPickingLocation mit globalem Zustand
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

  // Aktiviere den Bearbeitungsmodus automatisch, wenn es sich um einen neuen Ort handelt
  React.useEffect(() => {
    if (isNewPlace && place) {
      setIsEditing(true);
    }
  }, [isNewPlace, place]);

  // Wenn sich der ausgewählte Ort ändert, aktualisiere das Formular
  React.useEffect(() => {
    if (place && place.properties) {
      // Hole die Koordinaten aus dem Place-Objekt oder verwende die global gespeicherten
      let coordinates: [number, number] = [0, 0];
      
      // Verwende zuerst den zentralen Zustandsmanager, dann Fallback auf das Window-Objekt
      const selectedCoordinates = appState.getState().lastSelectedCoordinates;
      
      if (place.geometry && place.geometry.type === 'Point') {
        // Standard-Fall: Verwende die Koordinaten aus dem Geometrie-Objekt
        coordinates = [place.geometry.coordinates[1], place.geometry.coordinates[0]];
      } 
      else if (selectedCoordinates && selectedCoordinates.length === 2) {
        // Fall-Back: Verwende die zentral gespeicherten Koordinaten
        coordinates = [selectedCoordinates[1], selectedCoordinates[0]]; // Umwandlung von [lon, lat] zu [lat, lon]
      }
      else if (window._planBLastSelectedCoordinates) {
        // Legacy-Fallback: Verwende die global gespeicherten Koordinaten
        coordinates = [window._planBLastSelectedCoordinates[1], window._planBLastSelectedCoordinates[0]];
      }
      
      // Wenn wir im Bearbeitungsmodus sind und einen neuen Ort erstellen,
      // dann behalte die vorhandenen Formulardaten bei und aktualisiere nur die Koordinaten
      if (isEditing && isNewPlace && Object.keys(formData).length > 0) {
        setFormData((currentFormData: Record<string, any>) => ({
          ...currentFormData,
          coordinates: coordinates
        }));
      } else {
        // Standardfall: Setze das Formular komplett neu
        setFormData({
          ...place.properties,
          coordinates: coordinates
        });
      }
      
      // Überprüfe, ob die Kategorie in den bestehenden Kategorien existiert
      // Falls nicht und die Kategorie ist gesetzt, aktiviere das benutzerdefinierte Feld
      const properties = place.properties; // Sichere Referenz für TypeScript
      const kategorie = properties.Kategorie;
      
      if (kategorie) {
        const categoryExists = categories.some(cat => cat.kategorie === kategorie);
        setIsCustomCategory(!categoryExists && !!kategorie);
      } else {
        setIsCustomCategory(false);
      }
    }
  }, [place, isEditing, isNewPlace, categories])
  
  // Überwache Änderungen an isOpen und synchronisiere mit globalem Zustand
  React.useEffect(() => {
    console.log('Dialog-Status aktualisiert:', {
      isOpen,
      isPickingLocation,
      place: place ? place.properties?.Name : 'kein Ort',
      globalPickerActive: appState.getState().pickerModeActive
    });
    
    // Setze den Dialog-Status im globalen Zustand
    appState.setDetailDialogOpen(isOpen);
    
    // Wenn der Dialog geöffnet wird und wir im Ortsauswahl-Modus sind, beenden wir diesen
    if (isOpen && isPickingLocation) {
      console.log('Dialog geöffnet im Ortsauswahl-Modus - beende Modus');
      appState.setPickerMode(false);
    }
    
    // Legacy: Synchronisiere mit window-Variablen
    window._planBDetailDialogOpen = isOpen;
    
    // Wenn der Dialog einen Ort anzeigt, speichere den Namen
    if (isOpen && place && place.properties?.Name) {
      appState.setSelectedPlaceName(place.properties.Name);
      // Legacy
      window._planBSelectedPlaceName = place.properties.Name;
    }
  }, [isOpen, isPickingLocation, place]);

  // Effect, um Änderungen am isEditing-Status zu melden
  useEffect(() => {
    // Informiere die übergeordnete Komponente über den Bearbeitungszustand
    if (onEditingStateChange) {
      onEditingStateChange(isEditing);
    }
    
    // Setze den Bearbeitungsmodus im globalen Zustand
    appState.setEditMode(isEditing);
    
    // Legacy: Setze auch die globale Variable
    window._planBIsEditMode = isEditing;
  }, [isEditing, onEditingStateChange]);

  // Notfall-Listener für das forceReopenDialog-Event
  React.useEffect(() => {
    const handleForceReopen = (event: CustomEvent) => {
      // Lokalen Zustand für isPickingLocation zurücksetzen
      if (isPickingLocation) {
        setIsPickingLocation(false);
      }
      
      // WICHTIG: Globale Variable zurücksetzen, um Race-Conditions zu vermeiden
      appState.setPickerMode(false);
      window._planBPickerModeActive = false;
      
      // Verwende die Koordinaten aus dem Event, falls vorhanden
      if (event.detail?.coordinates && Array.isArray(event.detail.coordinates) && event.detail.coordinates.length === 2) {
        // Die Koordinaten sind im [lon, lat] Format, also wandeln wir sie in [lat, lon] um
        const coordinates: [number, number] = [event.detail.coordinates[1], event.detail.coordinates[0]];
        
        // Speichere die Koordinaten im zentralen Zustand
        appState.setSelectedCoordinates(event.detail.coordinates);
        
        // WICHTIG: Speichere auch im Legacy-Format
        window._planBLastSelectedCoordinates = event.detail.coordinates;
        
        // Formular aktualisieren
        setFormData((prev: Record<string, any>) => ({
          ...prev,
          coordinates: coordinates
        }));
      }
    };
    
    // Typumwandlung, da TypeScript nicht weiß, dass CustomEvent verwendet wird
    document.addEventListener('forceReopenDialog', handleForceReopen as EventListener);
    
    return () => {
      document.removeEventListener('forceReopenDialog', handleForceReopen as EventListener);
    };
  }, [isPickingLocation, setFormData]);

  if (!place) return null

  const properties = place.properties || {}
  const {
    Name,
    Beschreibung,
    Adresse,
    Öffnungszeiten,
    Telefonnummer,
    Email,
    Ansprechperson,
    Kategorie,
    Tags,
    'Webseite(n)': Webseite
  } = properties

  // Bestimme die Farbe basierend auf der Kategorie
  const categoryColors: Record<string, string> = {
    'A': 'bg-red-100 text-red-800 border-red-200',
    'B': 'bg-green-100 text-green-800 border-green-200',
    'C': 'bg-blue-100 text-blue-800 border-blue-200'
  }
  const categoryColor = categoryColors[Kategorie as string] || 'bg-gray-100 text-gray-800 border-gray-200'

  // Handler für Formularänderungen
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    // Wenn es sich um das Kategoriefeld handelt und der Wert "custom" ist,
    // aktiviere das benutzerdefinierte Eingabefeld
    if (name === 'Kategorie' && value === 'custom') {
      setIsCustomCategory(true);
      // Wir setzen den Wert hier nicht, da der Benutzer ihn im benutzerdefinierten Feld eingeben wird
      return;
    } else if (name === 'Kategorie') {
      setIsCustomCategory(false);
    }
    
    setFormData({
      ...formData,
      [name]: value
    })
  }

  // Spezieller Handler für benutzerdefinierte Kategorien
  const handleCustomCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      Kategorie: e.target.value
    });
  }

  // Handler für Koordinatenänderungen mit zusätzlichem Logging
  const handleCoordinateChange = (index: number, value: string) => {
    const newCoordinates = [...formData.coordinates]
    newCoordinates[index] = parseFloat(value) || 0
    
    setFormData({
      ...formData,
      coordinates: newCoordinates
    })
  }
  
  // Handler für die Auswahl eines Ortes auf der Karte
  const handlePickLocation = () => {
    if (!onPickLocation) {
      setError("Ortsauswahl auf der Karte wird nicht unterstützt.");
      return;
    }
    
    // Speichere die aktuellen Formular-Daten für spätere Verwendung
    const currentFormData = {...formData};
    
    // Extrahiere aktuelle Koordinaten, falls vorhanden
    let initialPosition: [number, number] | undefined;
    
    // Wenn ein Ort mit Geometrie vorhanden ist, verwende dessen Koordinaten
    if (place?.geometry?.type === 'Point' && Array.isArray(place.geometry.coordinates)) {
      // Hier brauchen wir [lon, lat] Format
      initialPosition = [place.geometry.coordinates[0], place.geometry.coordinates[1]]; 
    }
    // Alternativ aus dem Formular (im [lat, lon] Format)
    else if (formData.coordinates && formData.coordinates.length === 2) {
      // Umwandlung von [lat, lon] zu [lon, lat]
      initialPosition = [formData.coordinates[1], formData.coordinates[0]];
    }
    
    // Ortsauswahl-Modus im zentralen Zustand aktivieren
    appState.setPickerMode(true);
    
    // Legacy: Globale Variable aktualisieren
    window._planBPickerModeActive = true;
    
    // Wenn initiale Position vorhanden, auch im globalen Zustand speichern
    if (initialPosition) {
      appState.setSelectedCoordinates(initialPosition);
      // Legacy: Global speichern
      window._planBLastSelectedCoordinates = initialPosition;
    }
    
    // Event auslösen, um zur Map-Ansicht zu wechseln
    const switchToMapEvent = new CustomEvent('planBSwitchToMapView');
    document.dispatchEvent(switchToMapEvent);
    
    // Callback-Funktion für die Kartenkomponente, um die ausgewählten Koordinaten zu erhalten
    onPickLocation((coordinates: [number, number]) => {
      // WICHTIG: Zu diesem Zeitpunkt sind die Koordinaten im Format [lon, lat] von der Karte
      console.log('Ausgewählte Koordinaten von Karte (lon, lat):', coordinates);
      
      // Koordinaten umwandeln: [lon, lat] zu [lat, lon] für das Formular
      const updatedCoordinates = [coordinates[1], coordinates[0]];
      console.log('Umgewandelte Koordinaten für Formular (lat, lon):', updatedCoordinates);
      
      // Speichere die Koordinaten im zentralen Zustand
      appState.setSelectedCoordinates(coordinates);
      appState.setPickerMode(false);
      
      // Legacy: Für kompatibilität mit vorhandenen Komponenten
      window._planBPickerModeActive = false;
      window._planBLastSelectedCoordinates = coordinates;
      
      // WICHTIG: Merge der gesicherten Formulardaten mit den neuen Koordinaten
      setFormData({
        ...currentFormData,
        coordinates: updatedCoordinates
      });
    }, initialPosition); // Übergebe die initiale Position an den Callback
  }

  // Handler zum Speichern der Änderungen
  const handleSave = async () => {
    if (formData.coordinates) {
      // Debug-Information
      console.log('Speichere Koordinaten:', formData.coordinates);
    }
    
    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)
    
    try {
      // Koordinatenkorrektur vor dem Speichern anwenden, ähnlich wie in PlanBMap
      let correctedLat = formData.coordinates ? formData.coordinates[0] : 0;
      let correctedLon = formData.coordinates ? formData.coordinates[1] : 0;
      
      // Korrigiere Breitengrad (sollte etwa zwischen 45 und 48 für Südtirol sein)
      if (correctedLat > 0 && correctedLat < 10) {
        correctedLat = correctedLat * 10;
        console.log(`Korrigiere Breitengrad: ${formData.coordinates[0]} -> ${correctedLat}`);
      }
      
      // Korrigiere Längengrad (sollte etwa zwischen 10 und 13 für Südtirol sein)
      if (correctedLon > 20 && correctedLon < 200) {
        correctedLon = correctedLon / 10;
        console.log(`Korrigiere Längengrad: ${formData.coordinates[1]} -> ${correctedLon}`);
      }
      
      // Erstelle ein aktualisiertes Feature mit korrigierten Koordinaten
      const updatedFeature = {
        ...place,
        properties: {
          ...formData,
          // Entferne die Koordinaten aus den Properties
          coordinates: undefined
        },
        geometry: {
          type: 'Point',
          coordinates: [correctedLon, correctedLat] // [lon, lat] für Geometrie-Format
        }
      }
      
      // VEREINFACHTE LOGIK: Wenn keine ID vorhanden ist, behandle es als neuen Ort
      // Dies ist ein direkterer Ansatz als die komplexere automatische Erkennung
      const hasNoId = !updatedFeature._id;
      const treatAsNew = isNewPlace || hasNoId;
      
      // DIREKTE ENTSCHEIDUNG: Wenn keine ID, dann neuer Ort (POST), sonst Update (PUT)
      if (treatAsNew) {
        // NEUER ORT - POST REQUEST
        
        // Validiere die Pflichtfelder
        if (!formData.Name || formData.Name.trim() === '' || 
            !formData.Beschreibung || formData.Beschreibung.trim() === '' || 
            !formData.Kategorie || formData.Kategorie.trim() === '' || 
            !formData.coordinates) {
          // Detailliertere Fehlermeldung, die genau angibt, welches Feld fehlt
          const missingFields = [];
          if (!formData.Name || formData.Name.trim() === '') missingFields.push('Name');
          if (!formData.Beschreibung || formData.Beschreibung.trim() === '') missingFields.push('Beschreibung');
          if (!formData.Kategorie || formData.Kategorie.trim() === '') missingFields.push('Kategorie');
          if (!formData.coordinates) missingFields.push('Koordinaten');
          
          throw new Error(`Bitte fülle alle Pflichtfelder aus: ${missingFields.join(', ')}`);
        }
        
        // Bei neuen Orten brauchen wir keine ID, da die Datenbank eine neue ID generiert
        
        try {
          const response = await fetch('/api/places', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedFeature)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Fehler beim Erstellen: ${response.status} - ${errorText}`);
          }
          
          const newPlace = await response.json();
          
          // Bearbeitungsmodus beenden
          setIsEditing(false);
          
          // Erfolgsindikator setzen
          setSaveSuccess(true);
          
          // Nach 3 Sekunden den Erfolgsindikator zurücksetzen
          setTimeout(() => {
            setSaveSuccess(false);
          }, 3000);
          
          // Aktualisierungsfunktion aufrufen
          if (onUpdate) {
            onUpdate(newPlace);
          }
          
          // KORRIGIERT: Füge einen kurzen Timeout hinzu, bevor wir den Dialog schließen
          setTimeout(() => {
            // Stelle sicher, dass wir nicht im Picker-Modus sind
            appState.setPickerMode(false);
            if (onClose) {
              onClose();
            }
          }, 500);
          
          return;
        } catch (error: any) {
          throw new Error(`Netzwerkfehler beim Erstellen: ${error.message}`);
        }
      } else {
        // BESTEHENDER ORT - PUT REQUEST
        
        // FÜR BESTEHENDE ORTE: Versuche, die ID aus verschiedenen möglichen Quellen zu ermitteln
        let placeId = updatedFeature._id;
        
        // Wenn keine ID direkt im Feature gefunden wurde, prüfe in den Properties
        if (!placeId && updatedFeature.properties && updatedFeature.properties._id) {
          placeId = updatedFeature.properties._id;
        }
        
        // Versuche, die ID direkt aus dem API zu holen, falls sie nicht gefunden wurde
        if (!placeId && updatedFeature.geometry?.type === 'Point') {
          try {
            const coords = updatedFeature.geometry.coordinates;
            
            // Hole alle Orte und suche nach passenden Koordinaten
            const response = await fetch('/api/places');
            const data = await response.json();
            
            if (data && data.features && Array.isArray(data.features)) {
              const matchingFeature = data.features.find((f: any) => 
                f.geometry && 
                f.geometry.type === 'Point' && 
                f.geometry.coordinates[0] === coords[0] && 
                f.geometry.coordinates[1] === coords[1]
              );
              
              if (matchingFeature && matchingFeature._id) {
                placeId = matchingFeature._id;
              }
            }
          } catch (err) {
            // Fehler ignorieren und weitermachen
          }
        }
        
        if (!placeId) {
          throw new Error('Keine ID für diesen Ort gefunden. Bitte Seite neu laden und erneut versuchen.');
        }
        
        // Sende die Aktualisierung an den korrekten API-Endpunkt mit der ID
        const response = await fetch(`/api/places/${placeId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedFeature)
        })

        if (!response.ok) {
          throw new Error(`Fehler beim Speichern: ${response.status}`);
        }
        
        // Versuche die Antwort zu lesen, um die tatsächlich gespeicherten Daten zu sehen
        try {
          const savedData = await response.json();
          // Erfolgreich gespeichert
        } catch (e) {
          // Keine JSON-Antwort vom Server
        }

        // Bearbeitungsmodus beenden
        setIsEditing(false)
        
        // Erfolgsindikator setzen statt alert
        setSaveSuccess(true)
        
        // Nach 3 Sekunden den Erfolgsindikator zurücksetzen
        setTimeout(() => {
          setSaveSuccess(false)
        }, 3000)
        
        // Aktualisierungsfunktion aufrufen, wenn vorhanden, um die Daten im übergeordneten Element zu aktualisieren
        const updatedPlaceWithId: MongoDBFeature = {
          ...place,
          _id: placeId,
          properties: {
            ...formData,
            // Entferne die Koordinaten aus den Properties
            coordinates: undefined
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [correctedLon, correctedLat]
          }
        };
        
        if (onUpdate) {
          onUpdate(updatedPlaceWithId);
          
          // Trigger ein benutzerdefiniertes Event, um alle Komponenten über die Änderung zu informieren
          const refreshEvent = new CustomEvent('planBMapRefreshMarkers', {
            detail: { updatedFeature: updatedPlaceWithId }
          });
          document.dispatchEvent(refreshEvent);
          
          // KORRIGIERT: Füge einen kurzen Timeout hinzu, bevor wir den Dialog schließen
          setTimeout(() => {
            // Stelle sicher, dass wir nicht im Picker-Modus sind
            appState.setPickerMode(false);
            if (onClose) {
              onClose();
            }
          }, 500);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Speichern')
    } finally {
      setIsSaving(false)
    }
  }

  // Handler zum Aktivieren des Bearbeitungsmodus
  const handleEdit = async () => {
    try {
      // Hole die neuesten Daten direkt vom Server für diesen Ort
      if (place && place._id) {
        const response = await fetch(`/api/places/${place._id}`);
        
        if (response.ok) {
          const freshPlace = await response.json();
          
          // Verwende die neuesten Daten für das Formular
          if (freshPlace && freshPlace.properties) {
            // WICHTIG: Um das Problem mit springenden Koordinaten zu beheben,
            // behalten wir die aktuellen Koordinaten bei und übernehmen nur die anderen Daten
            const currentCoordinates = formData.coordinates || 
              (freshPlace.geometry?.type === 'Point' ? 
                [freshPlace.geometry.coordinates[1], freshPlace.geometry.coordinates[0]] : // [lat, lon]
                [0, 0]);
            
            const updatedFormData = {
              ...freshPlace.properties,
              // Verwende die aktuellen Koordinaten statt der vom Server
              coordinates: currentCoordinates
            };
            
            setFormData(updatedFormData);
            
            // Aktualisiere auch das Hintergrund-Objekt mit den beibehaltenen Koordinaten
            const updatedPlace = {
              ...freshPlace,
              geometry: {
                type: 'Point',
                coordinates: [currentCoordinates[1], currentCoordinates[0]] // [lon, lat] für Geometrie
              }
            };
            
            // Informiere den übergeordneten MapExplorer über die neuesten Daten mit beibehaltenen Koordinaten
            if (onUpdate) {
              onUpdate(updatedPlace);
            }
          }
        } else {
          // Verwende bestehende Daten für Bearbeitungsmodus
        }
      }
    } catch (error) {
      // Verwende bestehende Daten aufgrund eines Fehlers
    }
    
    // Aktiviere den Bearbeitungsmodus
    setIsEditing(true);
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Hinweis, wenn im Ortsauswahlmodus */}
        {isPickingLocation && (
          <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg" data-testid="location-picker-message">
            Klicke auf die Karte, um den Ort auszuwählen
          </div>
        )}

        {/* Header mit Kategorie aber ohne Buttons */}
        <div className="border-b pb-4">
          <div className="flex items-center justify-between">
            {isEditing ? (
              <input
                type="text"
                name="Name"
                value={formData.Name || ''}
                onChange={handleChange}
                className="text-2xl font-bold text-gray-900 border-b border-gray-300 focus:border-blue-500 focus:outline-none w-full"
                placeholder="Name des Ortes"
              />
            ) : (
              <h2 className="text-2xl font-bold text-gray-900">{Name || 'Unbekannter Ort'}</h2>
            )}
            
            <div className="flex items-center gap-2">
              {!isEditing && saveSuccess && (
                <span className="text-sm text-green-600 animate-fade-in-out">
                  ✓ Gespeichert
                </span>
              )}
              
              {isEditing ? (
                <div className="flex flex-col gap-1 w-40">
                  <select
                    name="Kategorie"
                    value={isCustomCategory ? 'custom' : (formData.Kategorie || '')}
                    onChange={handleChange}
                    className="px-2 py-1 rounded-md text-xs font-medium bg-white border border-gray-300"
                  >
                    <option value="">Keine Kategorie</option>
                    {categories.map(cat => (
                      <option key={cat.kategorie} value={cat.kategorie}>
                        {cat.kategorie} ({cat.anzahl})
                      </option>
                    ))}
                    <option value="custom">Neue Kategorie...</option>
                  </select>
                  
                  {isCustomCategory && (
                    <input
                      type="text"
                      value={formData.Kategorie || ''}
                      onChange={handleCustomCategoryChange}
                      className="px-2 py-1 rounded-md text-xs font-medium bg-white border border-gray-300"
                      placeholder="Neue Kategorie eingeben"
                      autoFocus
                    />
                  )}
                </div>
              ) : Kategorie ? (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
                  Kategorie {Kategorie}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Fehlermeldung */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mt-4">
            {error}
          </div>
        )}

        {/* Inhalt mit Scrollbereich */}
        <div className="flex-1 overflow-y-auto py-4">
          {isEditing ? (
            /* Bearbeitungsformular */
            <div className="space-y-4">
              {/* Beschreibung */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                <textarea
                  name="Beschreibung"
                  value={formData.Beschreibung || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Beschreibung des Ortes"
                />
              </div>

              {/* Adresse */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Adresse</label>
                <input
                  type="text"
                  name="Adresse"
                  value={formData.Adresse || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Straße, Hausnummer, PLZ, Ort"
                />
              </div>

              {/* Öffnungszeiten */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Öffnungszeiten</label>
                <textarea
                  name="Öffnungszeiten"
                  value={formData.Öffnungszeiten || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Montag - Freitag: 9-17 Uhr"
                />
              </div>

              {/* Telefonnummer */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Telefonnummer</label>
                <input
                  type="text"
                  name="Telefonnummer"
                  value={formData.Telefonnummer || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+43 123 456789"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                <input
                  type="email"
                  name="Email"
                  value={formData.Email || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="info@beispiel.de"
                />
              </div>

              {/* Ansprechperson */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Ansprechperson</label>
                <input
                  type="text"
                  name="Ansprechperson"
                  value={formData.Ansprechperson || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Max Mustermann"
                />
              </div>

              {/* Webseite */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Webseite</label>
                <input
                  type="text"
                  name="Webseite(n)"
                  value={formData['Webseite(n)'] || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://www.beispiel.de"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Tags (ein Tag pro Zeile)</label>
                <textarea
                  name="Tags"
                  value={formData.Tags || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Tag 1&#10;Tag 2&#10;Tag 3"
                />
              </div>

              {/* Koordinaten */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700">Koordinaten</label>
                  <button
                    type="button"
                    onClick={handlePickLocation}
                    disabled={!onPickLocation || isPickingLocation}
                    className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 ${
                      isPickingLocation 
                        ? 'bg-blue-100 text-blue-700 animate-pulse' 
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                  >
                    <MapPin className="h-3 w-3" />
                    {isPickingLocation ? 'Wähle auf der Karte...' : 'Auf Karte wählen'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500">Breitengrad (Lat)</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={formData.coordinates?.[0] || 0}
                      onChange={(e) => handleCoordinateChange(0, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="46.7176"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500">Längengrad (Lon)</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={formData.coordinates?.[1] || 0}
                      onChange={(e) => handleCoordinateChange(1, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="11.6603"
                    />
                  </div>
                </div>
                {isPickingLocation && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-600 font-medium">Ortsauswahl aktiv</p>
                    <p className="text-xs text-blue-500">Klicke auf die Karte, um einen Ort auszuwählen. Der rote Marker folgt deiner Maus. Die Detailansicht wird nach der Auswahl automatisch wieder geöffnet.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Anzeigemodus */
            <div className="space-y-6">
              {/* Beschreibung */}
              {Beschreibung && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
                    <Info className="h-4 w-4" />
                    Beschreibung
                  </h3>
                  <p className="text-gray-700 whitespace-pre-line text-sm">{Beschreibung}</p>
                </div>
              )}

              {/* Weiteren Details */}
              <div className="space-y-4">
                {/* Adresse */}
                {Adresse && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Adresse</h4>
                      <p className="text-sm text-gray-600">{Adresse}</p>
                    </div>
                  </div>
                )}

                {/* Öffnungszeiten */}
                {Öffnungszeiten && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Öffnungszeiten</h4>
                      <p className="text-sm text-gray-600 whitespace-pre-line">{Öffnungszeiten}</p>
                    </div>
                  </div>
                )}

                {/* Telefonnummer */}
                {Telefonnummer && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Telefon</h4>
                      <p className="text-sm text-gray-600">{Telefonnummer}</p>
                    </div>
                  </div>
                )}

                {/* Email */}
                {Email && (
                  <div className="flex items-start gap-2">
                    <Mail className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">E-Mail</h4>
                      <a href={`mailto:${Email}`} className="text-sm text-blue-600 hover:underline">
                        {Email}
                      </a>
                    </div>
                  </div>
                )}

                {/* Ansprechperson */}
                {Ansprechperson && (
                  <div className="flex items-start gap-2">
                    <User className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Ansprechperson</h4>
                      <p className="text-sm text-gray-600">{Ansprechperson}</p>
                    </div>
                  </div>
                )}

                {/* Webseite */}
                {Webseite && (
                  <div className="flex items-start gap-2">
                    <ExternalLink className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Webseite</h4>
                      <a
                        href={Webseite.startsWith('http') ? Webseite : `https://${Webseite}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {Webseite}
                      </a>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {Tags && (
                  <div className="flex items-start gap-2">
                    <Tag className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Tags</h4>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {Tags.split('\n').map((tag: string, index: number) => (
                          <span
                            key={index}
                            className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Koordinaten */}
              {place.geometry && place.geometry.type === 'Point' && (
                <div className="text-xs text-gray-500 pt-4 border-t mt-6">
                  <p>Koordinaten: {place.geometry.coordinates[1].toFixed(5)}, {place.geometry.coordinates[0].toFixed(5)}</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Fußzeile mit Buttons */}
        {!isEditing ? (
          <div className="border-t pt-4 mt-auto">
            <div className="flex justify-end">
              <button
                onClick={handleEdit}
                className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
              >
                <Edit className="h-4 w-4" />
                <span>Ändern</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t pt-4 mt-auto">
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
                <span>Abbrechen</span>
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-md hover:bg-green-200"
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Wird gespeichert...' : 'Speichern'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

export default PlaceDetail 