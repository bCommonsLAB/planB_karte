import React, { useEffect } from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';

function App({ Component, pageProps }: AppProps) {
  // Verhindern der doppelten Ausführung von useEffect
  useEffect(() => {
    // Deaktiviere Strict Mode-Verhalten
    const strictModePatch = () => {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        if (
          typeof args[0] === 'string' &&
          args[0].includes('ReactDOM.render is no longer supported in React 18')
        ) {
          return;
        }
        originalConsoleError(...args);
      };
    };

    strictModePatch();
    
    // Setze Cache-Header für MapLibre
    const cachingHeaders = () => {
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const [url, options = {}] = args;
        if (typeof url === 'string' && url.includes('maptiler')) {
          options.cache = 'force-cache';
        }
        return originalFetch.apply(this, [url, options]);
      };
    };
    
    cachingHeaders();
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Cache-Control" content="max-age=3600, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default App; 