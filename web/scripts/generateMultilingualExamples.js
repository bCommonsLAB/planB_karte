/**
 * Beispiel-Generator für mehrsprachige (Deutsch/Italienisch) Orte
 * 
 * Dieses Skript erzeugt Beispiel-Dokumente mit deutschen und italienischen Inhalten
 * und kann zum Testen der mehrsprachigen Funktionen verwendet werden.
 */

const examples = [
  {
    type: "Feature",
    properties: {
      Name: "Stadtbibliothek Brixen",
      Nome: "Biblioteca Civica di Bressanone",
      Beschreibung: "Die Stadtbibliothek Brixen bietet ein vielfältiges Angebot an Büchern, Zeitschriften und digitalen Medien für alle Altersgruppen.",
      Descrizione: "La Biblioteca Civica di Bressanone offre una vasta gamma di libri, riviste e media digitali per tutte le età.",
      Kategorie: "B",
      Adresse: "Domplatz 1, 39042 Brixen",
      Telefonnummer: "0472 123456",
      Email: "bibliothek@brixen.it",
      "Öffnungszeiten": "Mo-Fr 9-19 Uhr, Sa 9-12 Uhr"
    },
    geometry: {
      type: "Point",
      coordinates: [11.65739, 46.71602]
    }
  },
  {
    type: "Feature",
    properties: {
      Name: "Gemeinschaftsgarten Rosslauf",
      Nome: "Orto comunitario Rosslauf",
      Beschreibung: "Ein gemeinschaftlich bewirtschafteter Garten im Stadtteil Rosslauf. Hier können Interessierte ein Stück Land bewirtschaften und Gemüse anbauen.",
      Descrizione: "Un giardino gestito dalla comunità nel quartiere Rosslauf. Qui le persone interessate possono coltivare un pezzo di terra e piantare verdure.",
      Kategorie: "A",
      Adresse: "Am Rosslauf 5, 39042 Brixen",
      Telefonnummer: "0472 234567",
      Email: "garten@bcoop.bz",
      "Öffnungszeiten": "Täglich von Sonnenaufgang bis Sonnenuntergang"
    },
    geometry: {
      type: "Point",
      coordinates: [11.65403, 46.72232]
    }
  },
  {
    type: "Feature",
    properties: {
      Name: "Kulturcafé Dekadenz",
      Nome: "Caffè culturale Dekadenz",
      Beschreibung: "Das Kulturcafé Dekadenz ist ein beliebter Treffpunkt für Kulturinteressierte. Hier finden regelmäßig Konzerte, Lesungen und andere kulturelle Veranstaltungen statt.",
      Descrizione: "Il Caffè culturale Dekadenz è un popolare punto d'incontro per gli appassionati di cultura. Qui si svolgono regolarmente concerti, letture e altri eventi culturali.",
      Kategorie: "C",
      Adresse: "Obere Schutzengelgasse 3B, 39042 Brixen",
      Telefonnummer: "0472 836393",
      Email: "info@dekadenz.it",
      "Öffnungszeiten": "Mi-So 18-24 Uhr"
    },
    geometry: {
      type: "Point",
      coordinates: [11.66014, 46.71682]
    }
  }
];

// Wenn dieses Skript direkt ausgeführt wird, gib die Beispiele aus
if (require.main === module) {
  console.log(JSON.stringify(examples, null, 2));
  console.log('\nDiese Beispiele können in die MongoDB importiert werden.');
  console.log('Beispiel-Befehl für MongoDB Shell:');
  console.log('db.places.insertMany(<Beispieldaten>)');
}

module.exports = examples; 