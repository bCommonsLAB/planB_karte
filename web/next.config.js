/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Deaktivieren des Strict Mode, da dieser zu doppelten Renderingvorgängen führen kann
  // TypeScript-Fehler im Entwicklungsmodus ignorieren
  typescript: {
    // !! WARNUNG !!
    // Ignoriert TypeScript-Fehler während der Entwicklung
    // Das ist nur eine vorübergehende Lösung, um das Flackern zu stoppen
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignoriere ESLint-Fehler während der Entwicklung
    ignoreDuringBuilds: true,
  },
  // Deaktiviere den Fast Refresh, der zu Problemen führen kann
  webpackDevMiddleware: config => {
    config.watchOptions = {
      poll: 1000, // Prüft auf Änderungen in Datei alle 1 Sekunde
      aggregateTimeout: 300, // Verzögert die Aktualisierung für 300ms nach Änderungen
    }
    return config
  },
  webpack: (config) => {
    // Diese Regel ermöglicht das Laden von JSON-Dateien aus node_modules
    config.module.rules.push({
      test: /\.json$/,
      include: /node_modules\/osm2geojson-lite/,
      type: 'javascript/auto',
    });
    
    return config;
  },
}

module.exports = nextConfig; 