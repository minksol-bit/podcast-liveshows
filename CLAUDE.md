# Podcast Liveshow Platform

## Wat dit project is

Een website die laat zien welke podcasts een liveshow hebben, wanneer en waar, met
een link naar de kaartverkoop. Kern-features: een filterbare agenda, een kaart met
bolletjes waarin de podcast-cover staat, en filters op maand en provincie.

Doelgroep: podcastluisteraars in Nederland die willen weten wat er de komende
maanden in hun regio te zien is.

## Over mij

Ik heb nooit geprogrammeerd. Ik ken de basis van HTML en CSS, ik snap de logica van
databases, en ik weet globaal wat een API is maar niet hoe je er een gebruikt.

Werkafspraken:

- Leg uit wat je doet en waarom, in gewone taal. Vermijd jargon, of leg het uit als
  je het gebruikt.
- Neem kleine stappen. Liever één ding dat werkt dan vijf dingen tegelijk.
- Als ik iets vraag dat een slecht idee is, zeg dat dan en leg uit waarom.
- Vertel me na elke wijziging hoe ik zelf kan controleren of het werkt.

## Datamodel

Vijf tabbladen in `data/podcast-liveshows.xlsx`. De koppeltabel is er omdat op een
podcastfestival meerdere podcasts in één event zitten.

- `podcasts` — id, naam, cover_url, spotify_id, website, thema, omschrijving,
  omschrijving_lang, apple_id, apple_rang
- `shows` — id, titel, type, organisator
  (type = theatershow / festivaloptreden / opname met publiek / besloten)
- `show_podcasts` — koppeltabel tussen shows en podcasts
- `events` — id, show_id, venue_id, aanvang, ticket_url, status, bron_url,
  laatst_gecheckt, prijs_vanaf, tijd_bron
- `venues` — id, naam, stad, provincie, lat, lon

`aanvang` is tekst in de vorm `2026-11-03` of `2026-11-03 20:30`.
`status` is `in verkoop` of `uitverkocht`. `thema` komt uit de Apple-genres en is
teruggebracht tot een handvol waarden voor het filter.

Twee regels die belangrijk zijn:

- Elk event bewaart `bron_url` en `laatst_gecheckt`, zodat ik altijd kan zien waar
  data vandaan komt en hoe oud die is.
- Zalen krijgen hun lat/lon één keer handmatig ingevuld. Er zijn er maar ongeveer
  honderd relevant in Nederland en ze verhuizen niet, dus er is geen
  geocoding-API nodig.

## Bronnen

Twee soorten bronnen met verschillende rollen:

- Podcastbedrijven (Corti Media, Dag en Nacht, Tonny, Podimo) vertellen **welke**
  podcasts touren. Ze hebben meestal geen datums op hun overzichtspagina's.
- Theaters en ticketplatforms vertellen **wanneer en waar**.

Prioriteit (omgedraaid na de eerste ronde, zie hieronder):

1. Podcastproducenten. Die zetten een hele tour op één pagina, met datum, stad,
   zaal en ticketlink. Corti Media leverde in één keer 43 van de eerste 44 events.
2. Apple Podcasts marketing-feed voor de top 100 van Nederland:
   `https://rss.marketingtools.apple.com/api/v2/nl/podcasts/top/100/podcasts.json`
   Geen sleutel nodig. Levert vierkante covers, genres en de ranglijst.
3. Theaterpagina's, per event, voor aanvangstijd en beginprijs. Die staan niet bij
   de producent.
4. Ticketmaster Discovery API — gratis key, 5000 calls per dag.
5. Later: eigen sites van podcasts en een "tip een show"-formulier.

Wat niet werkte: TivoliVredenburg `/studio/podcast/` is geen agenda maar een lijst
van hun eigen podcasts om te beluisteren. Hun agenda kent geen genre "podcast";
podcast-events vind je daar alleen via de zoekfunctie. Spotify heeft geen API voor
podcast-charts. De podcast-directory van Apple (`itunes.apple.com/search`) verbiedt
geautomatiseerd ophalen in robots.txt — de marketing-feed hierboven mag wel.

Bewust niet doen: transcripten doorzoeken, mailinglijsten volgen. Veel werk, weinig
bruikbare data.

## Fasering

Fase 1 (af): Excel-bestand met de vijf tabbladen, met de hand gevuld met 44 events
van Corti Media en TivoliVredenburg. Daarbovenop een statische site met agenda,
kaart, catalogus, pagina per podcast en de Apple-toplijst.

Fase 2: het schema is dan stabiel — pas dan bronnen automatiseren, één voor één.
Eerst de Ticketmaster-API, daarna een scraper per theater.

Fase 3: zoeken op podcastnaam, met een "hou me op de hoogte"-mailveld als er geen
shows zijn.

Bouw niets van fase 2 of 3 voordat fase 1 draait.

## Hoe de site gebouwd wordt

`python3 bouw-site.py` leest het Excel-bestand en schrijft alle pagina's opnieuw:
`index.html`, `catalogus.html`, `toplijst.html`, `podcast/<naam>.html`,
`data/site-data.js` en `sitemap.xml`. Pas die bestanden dus niet met de hand aan,
ze worden overschreven. De vormgeving staat in `assets/stijl.css` en de scripts in
`assets/*.js`; die blijven met rust.

Draai het script na elke wijziging in het Excel-bestand.

## Technische keuzes

- Kaart: Leaflet, met marker-clustering (in Amsterdam en Utrecht gaan de bolletjes
  anders over elkaar heen vallen). Leaflet staat in `assets/leaflet/`, niet op een
  CDN: dan werkt de site ook zonder internet en is er geen afhankelijkheid van een
  derde partij.
- Frontend: zo simpel mogelijk beginnen. Geen framework tenzij er een concrete
  reden voor is, en leg die reden dan uit.
- Favorieten staan in de browser van de bezoeker (localStorage). Geen account,
  geen server. Ze gaan dus niet mee naar een ander apparaat.
- Versiebeheer met git. Elke stap is een aparte opslag, zodat alles terug te
  draaien is.
- Geen betaalde diensten zonder dat we het er eerst over hebben gehad.

## Scrapen

- Respecteer robots.txt en bouw een pauze in tussen requests.
- Sla nooit cover-afbeeldingen op maar link ernaar, tenzij we het er expliciet
  over hebben gehad.
- Elke scraper moet loggen wat hij gevonden heeft en wat hij niet kon parsen. Ik
  wil kunnen zien wanneer een site is veranderd.
- Neem geen teksten over van theatersites of producenten: die zijn auteursrechtelijk
  beschermd. Omschrijvingen op deze site zijn zelf geschreven.
