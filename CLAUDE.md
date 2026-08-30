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

Vier tabellen. De koppeltabel is er omdat op een podcastfestival meerdere podcasts
in één event zitten.

- `podcasts` — id, naam, cover_url, spotify_id, website
- `shows` — id, titel, type, organisator
  (type = theatershow / festivaloptreden / opname met publiek / besloten)
- `show_podcasts` — koppeltabel tussen shows en podcasts
- `events` — id, show_id, venue_id, aanvang, ticket_url, status, bron_url,
  laatst_gecheckt
- `venues` — id, naam, stad, provincie, lat, lon

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

Prioriteit:

1. Theateragenda's met een eigen podcast-categorie — TivoliVredenburg heeft
   `/studio/podcast/`. Ongeveer vijftien zalen dekt het grootste deel van
   Nederland.
2. Ticketmaster Discovery API — gratis key, 5000 calls per dag.
3. Podcastbedrijven, als lijst van titels om op te zoeken bij de theaters.
4. Later: eigen sites van podcasts, Spotify API (alleen voor cover-afbeeldingen,
   niet voor datums), en een "tip een show"-formulier.

Bewust niet doen: transcripten doorzoeken, mailinglijsten volgen. Veel werk, weinig
bruikbare data.

## Fasering

Fase 1 (nu): Google Sheet met de vier tabbladen, met de hand gevuld met ongeveer
dertig events van TivoliVredenburg en Corti Media. Daarbovenop een simpele statische
site met een lijst en een Leaflet-kaart die de sheet uitleest.

Fase 2: het schema is dan stabiel — pas dan bronnen automatiseren, één voor één.
Eerst de Ticketmaster-API, daarna een scraper per theater.

Fase 3: zoeken op podcastnaam, met een "hou me op de hoogte"-mailveld als er geen
shows zijn.

Bouw niets van fase 2 of 3 voordat fase 1 draait.

## Technische keuzes

- Kaart: Leaflet, met marker-clustering (in Amsterdam en Utrecht gaan de bolletjes
  anders over elkaar heen vallen).
- Frontend: zo simpel mogelijk beginnen. Geen framework tenzij er een concrete
  reden voor is, en leg die reden dan uit.
- Geen betaalde diensten zonder dat we het er eerst over hebben gehad.

## Scrapen

- Respecteer robots.txt en bouw een pauze in tussen requests.
- Sla nooit cover-afbeeldingen op maar link ernaar, tenzij we het er expliciet
  over hebben gehad.
- Elke scraper moet loggen wat hij gevonden heeft en wat hij niet kon parsen. Ik
  wil kunnen zien wanneer een site is veranderd.
