import maplibregl, {
  convertFilter,
  LngLatLike,
  VectorTileSource,
} from "maplibre-gl";

import { overpassToGeojson } from "./query_overpass.ts";
import { GeoJSON } from "geojson";

const map_options: maplibregl.MapOptions = getMapConfiguration();

// Initialize the map
const map = new maplibregl.Map(map_options);

const filterGroup = document.getElementById("filter-group");

let places = require("../markers.json");

const categoryColors = {
  A: "#FF0000",
  B: "#00FF00",
  C: "#0000FF",
};

// Create a popup, but don't add it to the map yet.
const popup = new maplibregl.Popup({
  closeButton: false,
  closeOnClick: false,
});

let layerIDs: string[] = [];

// Load GeoJSON data
map.on("load", async () => {
  const image = await map.loadImage(
    "https://maplibre.org/maplibre-gl-js/docs/assets/custom_marker.png"
  );
  // Add an image to use as a custom marker
  map.addImage("custom-marker", image.data);

  let query_water = `[out:json][timeout:25];area(id:3600047300)->.searchArea;nwr["amenity"="drinking_water"](area.searchArea);out geom;`;
  let geojson_water = await overpassToGeojson(query_water);

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

  Object.entries(categoryColors).forEach(([category, color]) => {
    const layerID = `marker-${category}`;

    // Add a source for each category

    const filteredPlaces = places.features.filter(
      (feature: GeoJSON.Feature) => feature.properties.Kategorie === category
    );
    map.addSource(layerID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: filteredPlaces,
      },
    });

    // Add layer to the map
    map.addLayer({
      id: layerID,
      source: layerID,
      type: "circle",
      paint: {
        "circle-radius": 6,
        "circle-color": color,
      },
      // filter: ["==", "Kategorie", category],
    });

    layerIDs.push(layerID);

    // Add checkbox and label elements for the layer.
    const input = createCheckbox(layerID, true);
    const label = createLabel(layerID, category);

    filterGroup.appendChild(input);
    filterGroup.appendChild(label);

    // Add event listeners
    input.addEventListener("change", toggleLayerVisibility(layerID));
    map.on("mouseenter", layerID, showPopupOnMapEvent());
    map.on("mouseleave", layerID, removePopupOnMapEvent());
    // map.on("click", layerID, showPopupOnMapEvent());
  });

  const filterInput = document.getElementById(
    "filter-input"
  ) as HTMLInputElement;

  filterInput.addEventListener("keyup", (e) => {
    const value = (e.target as HTMLInputElement).value.trim().toLowerCase();

    for (const layerID of layerIDs) {
      if (value === "") {
        map.setFilter(layerID, null);
        continue;
      }

      // Construct filter for each layer
      let filter = ["any"];
      const filteredPlaces: GeoJSON.Feature[] = places.features.filter(
        (feature: GeoJSON.Feature) =>
          feature.properties.Kategorie === layerID.split("-")[1]
      );
      for (const feature of filteredPlaces) {
        const properties = feature.properties;
        for (const key of ["Name", "Beschreibung"]) {
          const property = properties[key];
          if (
            typeof property === "string" &&
            property.toLowerCase().includes(value)
          ) {
            filter.push(["==", key, property]);
            break;
          }
        }
      }
      map.setFilter(layerID, filter);
      // map.setFilter(layerID, ["has", ["get", "Name"], value]);
    }
  });

  /**
   * Creates a checkbox element with the specified id and checked state.
   *
   * @param id - The id of the checkbox element.
   * @param checked - The initial checked state of the checkbox.
   * @returns The created checkbox element.
   */
  function createCheckbox(id: string, checked: boolean): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.checked = checked;
    return input;
  }

  /**
   * Creates an HTML label element with the specified attributes.
   *
   * @param forId - The value of the "for" attribute for the label.
   * @param textContent - The text content of the label.
   * @returns The created HTML label element.
   */
  function createLabel(forId: string, textContent: string): HTMLLabelElement {
    const label = document.createElement("label");
    label.setAttribute("for", forId);
    label.textContent = textContent;
    return label;
  }

  /**
   * Toggles the visibility of a layer on the map.
   * @param layerID - The ID of the layer to toggle.
   * @returns A function that handles the layer visibility toggle.
   */
  function toggleLayerVisibility(layerID: string): (e: Event) => void {
    return (e) => {
      const target = e.target as HTMLInputElement;
      map.setLayoutProperty(
        layerID,
        "visibility",
        target.checked ? "visible" : "none"
      );
    };
  }
});
async function getMapConfiguration(): Promise<maplibregl.MapOptions> {
  let style = "http://localhost:8080/styles/basic-preview/style.json";
  const style_maptiler =
    "https://api.maptiler.com/maps/basic/style.json?key=Q5QrPJVST2pfBYoNSxOo";

  // Check if the URL is reachable
  try {
    const response = await fetch(style);
    if (!response.ok) {
      style = style_maptiler;
    }
  } catch (error) {
    style = style_maptiler;
  }

  const latLongBrixen: LngLatLike = { lon: 11.6603, lat: 46.7176 };

  const map_options: maplibregl.MapOptions = {
    container: "map",
    style: style,
    center: latLongBrixen,
    zoom: 13.5,
    pitchWithRotate: false, // Disable tilting the map
  };
  return map_options;
}

function removePopupOnMapEvent(): (
  ev: maplibregl.MapMouseEvent & {
    features?: maplibregl.MapGeoJSONFeature[] | undefined;
  } & Object
) => void {
  return () => {
    map.getCanvas().style.cursor = ""; // Reset the cursor style
    popup.remove();
  };
}

function showPopupOnMapEvent(): (
  ev: maplibregl.MapMouseEvent & {
    features?: maplibregl.MapGeoJSONFeature[] | undefined;
  } & Object
) => void {
  return (e) => {
    // Change the cursor style as a UI indicator.
    map.getCanvas().style.cursor = "pointer";

    const coordinates = e.features[0].geometry.coordinates.slice();
    const properties = e.features[0].properties;
    const description = properties.Beschreibung;
    const name = properties.Name;

    const öffnungszeiten = e.features[0].properties.Öffnungszeiten;

    let popup_content = `<h3>${name}</h3>`;
    if (description) {
      popup_content += `<p>${description}</p>`;
    }
    if (true) {
      popup_content += `<p><b>Öffnungszeiten</b>: ${öffnungszeiten}</p>`;
    }
    if (true) {
      popup_content += `
      <details>
        <summary><b>Properties</b></summary>
        <pre>${JSON.stringify(properties, null, 4)}</pre>
      </details>`;
    }

    // Populate the popup and set its coordinates
    // based on the feature found.
    popup.setLngLat(coordinates).setHTML(popup_content).addTo(map);
  };
}
