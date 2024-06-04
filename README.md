# Plan B Web Map

This is a simple web map application using MapLibre GL JS. It shows the locations in the [markers.json](src/markers.json) on a web map.

## Getting Started

To get this code to run on your local machine, follow these steps:
1. Clone this repository
2. Make sure node.js/yarn is installed on your machine
3. Install the dependencies by running `yarn install` or `npm install`
4. Run the development server by running `yarn start` or `npm start`

## Components

This project consist of the following components:
- [index.html](src/index.html): The main HTML file containing the structure of the web page
- [main.ts](src/ts/main.ts): The main TypeScript file containing code to configure the map and load markers   
- [markers.json](src/markers.json): A GeoJSON file containing the locations to be displayed on the map. The file was generated using QGIS from the google sheets data.

This project is packed using Parcel Bundler. Parcel is a web application bundler, this makes sure that the code is bundled and minified for production in a way that all the dependencies are included in the final build, and the typescript code is transpiled to JavaScript. It provides the `yarn start` command to run the development server and the `yarn build` command to build the project for production.

## Structure of the Web Map
MapLibre GL JS is used to create the web map. When setting up a MapLibre GL JS map a style parameter is required to define the source of the geodata to render on the map as well as the style of the map. Currently this project uses the maptiler API to provide the map style. Alternatively it can also use the open source [tileserver-gl](https://github.com/maptiler/tileserver-gl) as the source of the map style and geodata. A reference implementation that automatically sets up a tileserver-gl instance using docker, has some basic styles preconfigured and serves the geodata from a mbtiles file can be found in [this](https://github.com/raul-lezameta/planB_tileserver) tileserver-gl repository.

# Notes 
## Automatic Deployment
Automatic deployment to GitHub Pages is set up for this repository. Check the [publishwebsite.yml](.github/workflows/publishwebsite.yml) file for more information. Every time a commit is pushed to the `main` branch. The website is build to the using the yarn `predeploy` script and the `gh-pages` branch is updated with the new build using the `gh-pages` action.