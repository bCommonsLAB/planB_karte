import osm2geojson from "osm2geojson-lite";
import axios from "axios";
import { GeoJSON, FeatureCollection } from "geojson";

interface OverpassResponse {
  type: string;
  features: any[];
}

export async function overpassToGeojson(query: string): Promise<FeatureCollection> {
  try {
    const url = `https://overpass-api.de/api/interpreter?data=${query}`;

    const response = await axios.get(url);
    const data = response.data;

    const geojson = osm2geojson(data) as FeatureCollection;

    return geojson;
  } catch (err) {
    throw new Error(`${err}`);
  }
}

/**
 * Executes an Overpass query by a list of IDs.
 * @param ids - The list of IDs to query.
 * @returns A promise that resolves to the Overpass response.
 * @throws If an error occurs during the query execution.
 */
export async function overpassQueryByIds(
  ids: number[]
): Promise<FeatureCollection> {
  try {
    const idList = ids.join(",");
    const query = `[out:json][timeout:25];(node(${idList});way(${idList});relation(${idList}););out geom;`;

    return await overpassToGeojson(query);
  } catch (err) {
    throw new Error(`${err}`);
  }
}

export const wellKnowQueries = {
  drinkingWater: `[out:json][timeout:25];area(id:3600047300)->.searchArea;nwr["amenity"="drinking_water"](area.searchArea);out geom;`,
}; 