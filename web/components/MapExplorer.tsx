import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { FeatureCollection, Feature } from 'geojson';
import { Map, List, Plus, Download, Upload, Filter, Loader2, AlertTriangle, MapPin } from 'lucide-react';
import PlaceDetail from './PlaceDetail';
import DebugOverlay from './DebugOverlay';
import { useMapInteraction } from '../hooks/useMapInteraction';
import { isWithinAllowedArea, fixCoordinatesFeature } from '../utils/coordinateUtils';
import { appState } from '../utils/appState';

// CSS für die Tooltips
const tooltipStyles = `
  .tooltip-container {
    position: relative;
    display: inline-block;
  }
  
  .tooltip-container:hover .tooltip {
    display: block;
  }
  
  .tooltip {
    position: absolute;
    right: 0;
    top: 100%;
    background-color: white;
    padding: 0.5rem;
    border-radius: 0.25rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    font-size: 0.75rem;
    z-index: 50;
    width: 200px;
    display: none;
  }
`;

// Typ-Erweiterung für globale Hilfsvariablen
declare global {
  interface Window {
    _planBPickerModeActive?: boolean;
    _planBLastSelectedCoordinates?: [number, number];
    _planBDetailDialogOpen?: boolean;
    _planBSelectedPlaceName?: string;
    _planBIsEditMode?: boolean;
  }
}

// Interface für MongoDB-Features mit _id
interface MongoDBFeature extends Feature {
  _id?: string;
}

// Interface für flache Datenstruktur für Excel
interface FlatMarkerData {
  _id?: string;
  Name: string;
  Nome?: string;
  Beschreibung: string;
  Descrizione?: string;
  Kategorie: string;
  Categoria: string;
  Adresse?: string;
  Telefonnummer?: string;
  Email?: string;
  "Webseite(n)"?: string;
  Öffnungszeiten?: string;
  Tags?: string;
  "KAUZ Tags"?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}

// Interface für Kategorie-Datensatz
interface CategoryItem {
  kategorie: string;
  anzahl: number;
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
  // State für neue Orte
  const [isCreatingNewPlace, setIsCreatingNewPlace] = useState<boolean>(false);
  // State für den Bearbeitungsmodus
  const [isEditingPlace, setIsEditingPlace] = useState<boolean>(false);
  // State für die Markerliste, initial gesetzt mit den Props
  const [markers, setMarkers] = useState<FeatureCollection>(initialMarkers);
  // Referenz für Import-Dateieingabe
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // State für Kategorien und den aktuellen Filter
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // State für das Laden der Marker
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // State für die Sichtbarkeit der Export/Import-Buttons
  const [showExportImportButtons, setShowExportImportButtons] = useState<boolean>(false);
  
  // Verwende den useMapInteraction-Hook für die Karteninteraktion
  const mapInteraction = useMapInteraction({
    onPlaceSelected: (place) => {
      handlePlaceClick(place as MongoDBFeature);
    },
    onCoordinatesSelected: (coordinates) => {
      if (selectedPlace) {
        updatePlaceWithCoordinates(coordinates);
        setIsDetailOpen(true);
      }
    },
    onPickerModeStarted: () => {
      // Schließe das Detail-Modal, wenn der Picker-Modus startet
      setIsDetailOpen(false);
    },
    onPickerModeEnded: () => {
      // Öffne das Detail-Modal wieder, wenn der Picker-Modus endet
      if (selectedPlace) {
        setIsDetailOpen(true);
      }
    }
  });

  // useEffect zum Aktualisieren des markers-State, wenn sich initialMarkers ändert
  // HINWEIS: Diese initialMarkers kommen direkt von MongoDB, nicht aus markers.json
  React.useEffect(() => {
    setMarkers(initialMarkers);
  }, [initialMarkers]);
  
  // useEffect zum Aktualisieren der globalen Debug-Variablen, wenn sich der Dialog-Status ändert
  React.useEffect(() => {
    // Debug-Infos in globalen Variablen speichern
    window._planBDetailDialogOpen = isDetailOpen;
    
    if (selectedPlace) {
      window._planBSelectedPlaceName = selectedPlace.properties?.Name || '';
    }
    
    window._planBIsEditMode = isEditingPlace || isCreatingNewPlace;
    
    console.log('Dialog-Status aktualisiert:', { 
      isOpen: isDetailOpen, 
      name: selectedPlace?.properties?.Name,
      isEditMode: isEditingPlace || isCreatingNewPlace
    });
  }, [isDetailOpen, selectedPlace, isCreatingNewPlace, isEditingPlace]);
  
  // Lade Kategorien beim ersten Rendern
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Lade Kategorien direkt aus der MongoDB via API
        const response = await fetch('/api/places/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        } else {
          console.error('Fehler beim Laden der Kategorien');
        }
      } catch (error) {
        console.error('Fehler beim Laden der Kategorien:', error);
      }
    };
    
    fetchCategories();
  }, []);
  
  // Funktion zum Ändern des Kategoriefilters
  const handleCategoryChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = event.target.value;
    setSelectedCategory(newCategory);
    await fetchFilteredMarkers(newCategory);
  };
  
  // Funktion zum Laden der gefilterten Marker
  const fetchFilteredMarkers = async (category: string) => {
    setIsLoading(true);
    
    try {
      // Erstelle den URL-Parameter für die Kategorie
      const params = new URLSearchParams();
      if (category && category !== 'all') {
        params.append('category', category);
      }
      
      const response = await fetch(`/api/places?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setMarkers(data);
        
        // Aktualisiere die Karte mit den gefilterten Daten
        const refreshEvent = new CustomEvent('planBMapRefreshMarkers', {
          detail: { 
            fullMarkerList: data,
            forceReregisterEvents: true // Signal, dass Event-Handler neu registriert werden sollen
          }
        });
        document.dispatchEvent(refreshEvent);
        
        // Zusätzlich nach einer kurzen Verzögerung noch einmal die Events neu registrieren
        // um sicherzustellen, dass die Marker nach dem Filtern klickbar bleiben
        setTimeout(() => {
          const delayedRefreshEvent = new CustomEvent('planBMapRefreshMarkers', {
            detail: { 
              fullMarkerList: data,
              forceReregisterEvents: true
            }
          });
          document.dispatchEvent(delayedRefreshEvent);
          console.log('[MapExplorer] Verzögerte Neuregistrierung der Event-Handler nach Kategoriefilterung');
        }, 500);
      } else {
        console.error('Fehler beim Laden der gefilterten Marker');
      }
    } catch (error) {
      console.error('Fehler beim Laden der gefilterten Marker:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
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

  // Event-Listener für Ctrl+I Tastenkombination
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prüfe, ob Ctrl+I gedrückt wurde
      if (event.ctrlKey && event.key === 'i') {
        event.preventDefault(); // Verhindere Standard-Browser-Aktionen
        setShowExportImportButtons(prevState => !prevState); // Toggle Sichtbarkeit
      }
    };
    
    // Event-Listener registrieren
    window.addEventListener('keydown', handleKeyDown);
    
    // Event-Listener entfernen beim Aufräumen
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Funktion zum Exportieren der Marker als CSV für Excel
  const handleExportMarkers = () => {
    try {
      // Konvertiere GeoJSON Features in eine flache Struktur
      const flatData: FlatMarkerData[] = markers.features.map((feature: any) => {
        const properties = feature.properties || {};
        const coordinates = feature.geometry?.coordinates || [0, 0];
        
        // Behandle spezielle Felder mit Zeilenumbrüchen
        let beschreibung = properties.Beschreibung || '';
        let descrizione = properties.Descrizione || '';
        let kategorie = properties.Kategorie || '';
        let categoria = properties.Categoria || '';
        
        // Ersetze Zeilenumbrüche mit einem speziellen Tag für spätere Wiederherstellung
        beschreibung = beschreibung.replace(/\r?\n/g, '[NEWLINE]');
        descrizione = descrizione.replace(/\r?\n/g, '[NEWLINE]');
        
        return {
          _id: feature._id || '',
          Name: properties.Name || '',
          Nome: properties.Nome || '',
          Beschreibung: beschreibung,
          Descrizione: descrizione,
          Kategorie: kategorie,
          Categoria: categoria,
          Adresse: properties.Adresse || '',
          Telefonnummer: properties.Telefonnummer || '',
          Email: properties.Email || '',
          "Webseite(n)": properties["Webseite(n)"] || '',
          Öffnungszeiten: properties.Öffnungszeiten || '',
          Tags: properties.Tags || '',
          "KAUZ Tags": properties["KAUZ Tags"] || '',
          longitude: coordinates[0],
          latitude: coordinates[1]
        };
      });
      
      // Erstelle CSV-Header
      const headers = [
        '_id', 'Name', 'Nome', 'Beschreibung', 'Descrizione', 'Kategorie', 'Categoria',
        'Adresse', 'Telefonnummer', 'Email', 'Webseite(n)', 'Öffnungszeiten', 
        'Tags', 'KAUZ Tags', 'longitude', 'latitude'
      ];
      
      // Funktion zum Escapen von CSV-Werten
      const escapeCSV = (value: any, delimiter: string = ';'): string => {
        if (value === null || value === undefined) return '';
        let stringValue = String(value);
        
        // Zeilenumbrüche durch Leerzeichen ersetzen
        if (stringValue.includes('\n') || stringValue.includes('\r')) {
          stringValue = stringValue.replace(/\r?\n/g, ' ');
        }
        
        // Wenn Delimiter oder Anführungszeichen vorkommen, in Anführungszeichen setzen
        if (stringValue.includes(delimiter) || stringValue.includes('"')) {
          // Anführungszeichen verdoppeln für Escaping
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
      };
      
      // Erstelle CSV-Zeilen mit Semikolon als Trennzeichen
      const delimiter = ';';
      const csvRows = [
        // Header-Zeile
        headers.join(delimiter),
        // Datenzeilen
        ...flatData.map(item => 
          headers.map(header => escapeCSV(item[header as keyof FlatMarkerData], delimiter)).join(delimiter)
        )
      ];
      
      // Verbinde alle Zeilen zu einem CSV-String
      const csvString = csvRows.join('\n');
      
      // Erstelle einen Blob und Download-Link
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Erstelle einen temporären Link und klicke ihn an
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plan_b_orte_export.csv';
      document.body.appendChild(a);
      a.click();
      
      // Bereinige
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Export erfolgreich! Die Datei kann nun in Excel geöffnet werden.');
    } catch (error) {
      console.error('Fehler beim Exportieren:', error);
      alert('Fehler beim Exportieren der Daten. Bitte versuche es erneut.');
    }
  };
  
  // Funktion zum Importieren von Markerdaten aus einer CSV-Datei
  const handleImportMarkersClick = () => {
    // Klicke auf das versteckte Datei-Input-Feld
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Funktion zum Verarbeiten der hochgeladenen CSV-Datei
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      // Lese den Dateiinhalt
      const text = await file.text();

      // Identifiziere das Trennzeichen (Semikolon oder Komma)
      const delimiter = text.includes(';') ? ';' : ',';
      console.log(`Erkanntes Trennzeichen: "${delimiter}"`);
      
      // Bereinige den Text: Normalisiere Zeilenumbrüche
      const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // Teile den Text in Zeilen auf
      let rows = normalizedText.split('\n');
      
      // Entferne leere Zeilen am Ende
      rows = rows.filter(row => row.trim().length > 0);
      
      if (rows.length < 2) {
        throw new Error('CSV-Datei enthält nicht genügend Zeilen');
      }
      
      // Funktion zum Parsen einer CSV-Zeile unter Berücksichtigung von Anführungszeichen
      const parseCSVLine = (line: string, delimiter: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            // Prüfen, ob es ein doppeltes Anführungszeichen ist
            if (i + 1 < line.length && line[i + 1] === '"') {
              current += '"';
              i++; // Überspringe das nächste Anführungszeichen
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        
        // Füge das letzte Element hinzu
        result.push(current);
        
        return result;
      };
      
      // Parse das CSV
      const csvData: string[][] = [];
      for (let i = 0; i < rows.length; i++) {
        try {
          const parsedLine = parseCSVLine(rows[i], delimiter);
          csvData.push(parsedLine);
        } catch (error) {
          console.error(`Fehler beim Parsen der Zeile ${i+1}: ${error}`);
        }
      }
      
      if (csvData.length < 2) {
        throw new Error('CSV-Datei enthält nicht genügend gültige Zeilen');
      }
      
      // Extrahiere Header
      const headers = csvData[0];
      console.log(`CSV-Header erkannt: ${headers.join(', ')}`);
      
      // Bestimme die erwartete Anzahl an Spalten aus dem Header
      const expectedColumns = headers.length;
      console.log(`Erwartete Anzahl an Spalten: ${expectedColumns}`);
      
      // Parse Datenzeilen in Objekte
      const importedData: Record<string, any>[] = [];
      for (let i = 1; i < csvData.length; i++) {
        const rowData = csvData[i];
        
        // Überspringe Zeilen ohne Daten oder mit falscher Spaltenanzahl
        if (rowData.length === 0 || (rowData.length === 1 && !rowData[0])) {
          continue;
        }
        
        // Behandle Zeilen mit zu wenig oder zu vielen Spalten
        if (rowData.length !== expectedColumns) {
          console.warn(`Zeile ${i+1} hat ${rowData.length} Werte statt ${expectedColumns}. Passe die Zeile an...`);
          
          // Bei zu wenig Spalten: Füge leere Werte hinzu
          while (rowData.length < expectedColumns) {
            rowData.push('');
          }
          
          // Bei zu vielen Spalten: Kürze die Zeile
          if (rowData.length > expectedColumns) {
            rowData.splice(expectedColumns);
          }
        }
        
        // Erstelle ein Objekt aus den Daten
        const item: Record<string, any> = {};
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          // Ignoriere leere Header-Namen
          if (header.trim() === '') continue;
          
          // Setze den Wert für das aktuelle Feld
          item[header] = rowData[j] || '';
          
          // Speziell für Beschreibung und Descrizione: [NEWLINE]-Tags wieder in echte Zeilenumbrüche umwandeln
          if ((header === 'Beschreibung' || header === 'Descrizione') && item[header]) {
            item[header] = item[header].replace(/\[NEWLINE\]/g, '\n');
          }
        }
        
        importedData.push(item);
      }
      
      // Zeige eine Zusammenfassung der importierten Daten
      console.log(`${importedData.length} gültige Datensätze gefunden`);
      
      // Dialog mit Import-Optionen anzeigen
      const importMode = window.confirm(
        `${importedData.length} Einträge gefunden. Wie möchten Sie importieren?\n\n` +
        `OK: Bestehende Daten aktualisieren (Upsert)\n` +
        `Abbrechen: Nur in der Benutzeroberfläche anzeigen, nicht in die Datenbank speichern`
      );
      
      if (importMode) {
        // CSV-Daten für die API vorbereiten
        const csvString = rows.join('\n');
        
        // Daten an die API senden, um sie in die Datenbank zu importieren
        const response = await fetch('/api/places/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: csvString,
            delimiter,
            config: {
              mode: 'upsert',
              identifyBy: 'name', // Name als Identifikationsmerkmal verwenden
            }
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Fehler beim Importieren: ${errorData.error || response.statusText}`);
        }
        
        const result = await response.json();
        
        // Erfolgsmeldung anzeigen
        alert(
          `Import erfolgreich!\n\n` +
          `Insgesamt: ${result.result.total}\n` +
          `Neu hinzugefügt: ${result.result.inserted}\n` +
          `Aktualisiert: ${result.result.updated}\n` +
          `Fehler: ${result.result.errors.length}\n\n` +
          `Die Seite wird neu geladen, um die aktualisierten Daten anzuzeigen.`
        );
        
        // Seite neu laden, um die aktualisierten Daten anzuzeigen
        window.location.reload();
        
        return;
      }
      
      // Konvertiere die flachen Daten zurück in GeoJSON Features
      const newFeatures: Feature[] = importedData.map(item => {
        // Extrahiere die Koordinaten und korrigiere das Format
        // Beispiel: 1.165.799 -> 11.65799 (Entferne den Tausenderpunkt und setze den richtigen Dezimalpunkt)
        let longitudeStr = String(item.longitude || '0');
        let latitudeStr = String(item.latitude || '0');
        
        // Formatiere Koordinaten korrekt (Entferne Punkte in Zahlen über 999)
        const formatCoordinate = (coordStr: string): number => {
          // Wenn das Format wie 1.165.799 ist, konvertiere es zu 11.65799
          if (coordStr.split('.').length > 2) {
            // Entferne alle Punkte und setze dann den Dezimalpunkt an der richtigen Stelle
            const cleanStr = coordStr.replace(/\./g, '');
            // Füge den Dezimalpunkt nach der ersten Ziffer ein
            return parseFloat(cleanStr.slice(0, 1) + '.' + cleanStr.slice(1));
          }
          return parseFloat(coordStr || '0');
        };
        
        const longitude = formatCoordinate(longitudeStr);
        const latitude = formatCoordinate(latitudeStr);
        
        console.log(`Koordinaten konvertiert: ${longitudeStr} -> ${longitude}, ${latitudeStr} -> ${latitude}`);
        
        // Erstelle eine Kopie der Properties ohne die Koordinaten
        const { longitude: lon, latitude: lat, _id, ...props } = item;
        
        // Erstelle ein GeoJSON-Feature
        const feature: any = {
          type: 'Feature' as const, 
          properties: props,
          geometry: {
            type: 'Point' as const,
            coordinates: [longitude, latitude]
          }
        };
        
        // Füge _id hinzu, wenn vorhanden
        if (_id && _id.trim() !== '') {
          feature._id = _id;
        }
        
        return feature;
      });
      
      // Erstelle eine neue FeatureCollection
      const newMarkers: FeatureCollection = {
        type: 'FeatureCollection',
        features: newFeatures
      };
      
      // Aktualisiere die Marker
      setMarkers(newMarkers);
      
      // Löse ein Event aus, um die Karte zu aktualisieren
      const refreshEvent = new CustomEvent('planBMapRefreshMarkers', {
        detail: { 
          fullMarkerList: newMarkers
        }
      });
      document.dispatchEvent(refreshEvent);
      
      // Bestätige den erfolgreichen Import
      alert(`${newFeatures.length} Orte erfolgreich in die Benutzeroberfläche importiert.\n(Die Daten wurden NICHT in der Datenbank gespeichert)`);
      
      // Zurücksetzen des Datei-Inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Fehler beim Importieren:', error);
      alert('Fehler beim Importieren der Daten. Bitte überprüfe das Dateiformat.');
    }
  };

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
      
      // Speichere die Koordinaten, falls vorhanden
      if (event.detail?.coordinates && Array.isArray(event.detail.coordinates) && event.detail.coordinates.length === 2) {
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
  }, [isDetailOpen, selectedPlace, updatePlaceWithCoordinates]);

  // Funktion zum Öffnen der Detailansicht
  const handlePlaceClick = async (feature: MongoDBFeature) => {
    try {
      // Hole die neuesten Daten für diesen Ort vom Server
      const featureId = feature._id || (feature.properties && feature.properties._id);
      
      if (featureId) {
        const response = await fetch(`/api/places/${featureId}`);
        
        if (response.ok) {
          const freshPlace = await response.json();
          
          // Überprüfe, ob die Geometrie-Koordinaten und die Properties-Koordinaten unterschiedlich sind
          if (freshPlace.geometry?.type === 'Point' && 
              freshPlace.properties) {
            
            const geometryCoords = freshPlace.geometry.coordinates;
            
            // WICHTIG: Verwende IMMER die Geometrie-Koordinaten als die korrekten
            // Wir löschen bewusst die Properties-Koordinaten, da diese redundant sind
            if ("Koordinate N" in freshPlace.properties) {
              delete freshPlace.properties["Koordinate N"];
            }
            if ("Koordinate O" in freshPlace.properties) {
              delete freshPlace.properties["Koordinate O"];
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
    // Detail-Dialog schließen
    setIsDetailOpen(false);
    
    // Sicherstellen, dass der Picker-Modus beendet wird
    mapInteraction.cancelPickingLocation();
    
    // Sicherstellen, dass wir nicht mehr im Bearbeitungsmodus sind
    setIsCreatingNewPlace(false);
    setIsEditingPlace(false);
    
    // Globalen Zustand aktualisieren
    appState.setDetailDialogOpen(false);
    appState.setEditMode(false);
    
    console.log('Dialog geschlossen');
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
  const handlePickLocation = (callback: (coordinates: [number, number]) => void, initialPosition?: [number, number]) => {
    // Verwende den Hook für die Ortsauswahl
    mapInteraction.startPickingLocation(callback, initialPosition);
  };

  // Funktion zum Überprüfen von problematischen Koordinaten
  const isLocationValid = (feature: Feature): { isValid: boolean; reason?: string } => {
    if (!feature || !feature.geometry || feature.geometry.type !== 'Point') {
      return { isValid: false, reason: 'keine-koordinaten' };
    }
    
    const coords = feature.geometry.coordinates;
    
    // Prüfe auf fehlende Koordinaten
    if (!coords || coords.length !== 2) {
      return { isValid: false, reason: 'ungueltige-koordinaten' };
    }
    
    // Prüfe auf [0,0]-Koordinaten
    if (coords[0] === 0 && coords[1] === 0) {
      return { isValid: false, reason: 'null-koordinaten' };
    }
    
    // Prüfe, ob die Koordinaten im erlaubten Bereich liegen
    const [lon, lat] = coords;
    if (!isWithinAllowedArea(lon, lat)) {
      // Versuche die Koordinaten zu korrigieren
      const correctedFeature = fixCoordinatesFeature(feature);
      
      // Sicherstellen, dass es sich um Point-Geometrie handelt
      if (correctedFeature.geometry && correctedFeature.geometry.type === 'Point') {
        const correctedCoords = correctedFeature.geometry.coordinates;
        
        // Wenn die Koordinaten korrigiert wurden und jetzt im erlaubten Bereich liegen
        if (correctedCoords[0] !== coords[0] || correctedCoords[1] !== coords[1]) {
          if (isWithinAllowedArea(correctedCoords[0], correctedCoords[1])) {
            return { isValid: false, reason: 'korrigierbar' };
          }
        }
      }
      
      return { isValid: false, reason: 'ausserhalb-bereich' };
    }
    
    return { isValid: true };
  };
  
  return (
    <div className="w-full bg-[#e9f0df] rounded-lg shadow-sm border border-green-200 p-4">
      {/* Füge das Tooltip-CSS als Style-Element hinzu */}
      <style dangerouslySetInnerHTML={{ __html: tooltipStyles }} />

      <Tabs defaultValue="map" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex flex-row items-center gap-2">
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

            {/* Export-Button - nur anzeigen, wenn showExportImportButtons true ist */}
            {showExportImportButtons && (
              <button
                onClick={handleExportMarkers}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors duration-200"
              >
                <Download size={16} />
                <span>CSV-Export</span>
              </button>
            )}
            
            {/* Import-Button - nur anzeigen, wenn showExportImportButtons true ist */}
            {showExportImportButtons && (
              <button
                onClick={handleImportMarkersClick}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 transition-colors duration-200"
              >
                <Upload size={16} />
                <span>CSV-Import</span>
              </button>
            )}
            
            {/* Verstecktes Datei-Input-Feld für den Import */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              style={{ display: 'none' }}
            />
            
            {/* Kategoriefilter */}
            <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200">
              <Filter size={16} />
              <select 
                value={selectedCategory}
                onChange={handleCategoryChange}
                className="bg-transparent text-yellow-800 border-none outline-none cursor-pointer"
              >
                <option value="all">Alle Kategorien</option>
                {categories.map(cat => (
                  <option key={cat.kategorie} value={cat.kategorie}>
                    {cat.kategorie} ({cat.anzahl})
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleCreateNewPlace}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors duration-200"
            >
              <Plus size={16} />
              <span>Neuen Ort erfassen</span>
            </button>
          </div>
        </div>

        <TabsContent value="map" className="mt-1 rounded-lg overflow-hidden border border-green-200">
          <div style={{ height: mapHeight, width: mapWidth }}>
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={32} className="animate-spin text-green-600" />
                  <span className="text-green-700 font-medium">Lade Orte...</span>
                </div>
              </div>
            ) : (
              <PlanBMap 
                markers={markers} 
                height={mapHeight} 
                width={mapWidth} 
                onMarkerClick={mapInteraction.handleMarkerClick}
                onMapClick={mapInteraction.handleMapClick}
                isPickingLocation={mapInteraction.isPickingLocation}
              />
            )}
            
            {/* Hinweis für den Ortsauswahl-Modus */}
            {mapInteraction.isPickingLocation && (
              <div className="absolute top-4 left-4 right-4 mx-auto max-w-md bg-blue-100 border border-blue-300 text-blue-800 px-4 py-3 rounded-md shadow-md z-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">Ortsauswahl-Modus aktiv</p>
                    <p className="text-sm">Klicke auf die Karte, um einen Ort auszuwählen</p>
                  </div>
                  <button 
                    onClick={mapInteraction.cancelPickingLocation}
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
          {isLoading ? (
            <div className="h-96 w-full flex items-center justify-center bg-secondary/10 rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={32} className="animate-spin text-green-600" />
                <span className="text-green-700 font-medium">Lade Orte...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {markers.features
                // Sortiere die Features alphabetisch nach dem Namen
                .sort((a, b) => {
                  const nameA = a.properties?.Name?.toLowerCase() || '';
                  const nameB = b.properties?.Name?.toLowerCase() || '';
                  return nameA.localeCompare(nameB, 'de');
                })
                .map((feature, index) => {
                  if (!feature.properties) return null;
                  
                  // Prüfe, ob die Koordinaten problematisch sind
                  const locationStatus = isLocationValid(feature);
                  
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
                  
                  // Zusätzliche Klassen für Orte mit Koordinatenproblemen
                  const errorClass = !locationStatus.isValid ? 'border-2 border-yellow-400' : '';
                  
                  return (
                    <div 
                      key={`marker-${index}`} 
                      className={`border rounded-lg p-4 shadow-sm ${cardColor} ${errorClass} hover:shadow-md transition-all duration-200 cursor-pointer`}
                      onClick={() => handlePlaceClick(feature as MongoDBFeature)}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-semibold text-gray-800">{Name}</h3>
                        <div className="flex items-center gap-1">
                          {!locationStatus.isValid && (
                            <div className="tooltip-container relative" title={getErrorDescription(locationStatus.reason)}>
                              <div className="p-1 bg-yellow-100 rounded-full">
                                <AlertTriangle size={16} className="text-yellow-500" />
                              </div>
                              {/* Tooltip mit Erklärung */}
                              <div className="tooltip absolute right-0 top-6 bg-white p-2 rounded shadow-md text-xs hidden">
                                {getErrorDescription(locationStatus.reason)}
                              </div>
                            </div>
                          )}
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-white shadow-sm">
                            Kategorie {Kategorie}
                          </span>
                        </div>
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

                      {/* Koordinateninformation am unteren Rand der Karte */}
                      {!locationStatus.isValid && (
                        <div className="mt-3 pt-2 border-t border-yellow-200 flex items-center justify-between">
                          <div className="flex items-center text-yellow-700 text-xs">
                            <MapPin size={12} className="mr-1" />
                            <span>{getErrorDescription(locationStatus.reason)}</span>
                          </div>
                          <button 
                            className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-md hover:bg-yellow-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlaceClick(feature as MongoDBFeature);
                            }}
                          >
                            Koordinaten korrigieren
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail-Ansicht */}
      <PlaceDetail 
        place={selectedPlace} 
        isOpen={isDetailOpen} 
        onClose={handleDetailClose} 
        onUpdate={handlePlaceUpdate}
        onPickLocation={handlePickLocation}
        isNewPlace={isCreatingNewPlace}
        onEditingStateChange={setIsEditingPlace}
      />
      
      {/* Debug-Overlay für Entwicklung - kann später entfernt werden 
      <DebugOverlay />
      */}
    </div>
  );
};

// Funktion zur Beschreibung der Koordinatenprobleme
function getErrorDescription(reason?: string): string {
  switch (reason) {
    case 'keine-koordinaten':
      return 'Keine Koordinaten vorhanden';
    case 'ungueltige-koordinaten':
      return 'Ungültige Koordinatenstruktur';
    case 'null-koordinaten':
      return 'Koordinaten sind [0,0]';
    case 'korrigierbar':
      return 'Koordinaten können automatisch korrigiert werden';
    case 'ausserhalb-bereich':
      return 'Koordinaten außerhalb des erlaubten Bereichs';
    default:
      return 'Koordinatenproblem';
  }
}

export default MapExplorer; 