import { overpassToGeojson, wellKnowQueries } from "./query_overpass";

// Load GeoJSON data
async function merge() {
  let drinking_water = await overpassToGeojson(wellKnowQueries.drinkingWater);

  let markers = require("../markers.json");

  markers.features.forEach((feature: any) => {
    const properties = feature.properties;
    const osm_id = properties.osm_id;

    console.log(osm_id);
  });
  console.log(markers);
}

merge();
