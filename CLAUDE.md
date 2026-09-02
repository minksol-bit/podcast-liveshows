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
  omschrijving_lang, apple_id, apple_rang, bannerkleur_links, bannerkleur_rechts
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

## Data toevoegen

Nieuwe bronnen gaan via een JSON-bestand in `data/bronnen/`, niet met de hand in
het Excel-bestand. Daarna:

    python3 importeer.py data/bronnen/<bestand>.json            # laat zien wat er zou gebeuren
    python3 importeer.py data/bronnen/<bestand>.json --schrijf  # voert het door
    python3 bouw-site.py

De inleesroutine herkent een event aan show + zaal + datum, dus dezelfde bron twee
keer inlezen levert geen dubbelingen op. Een zaal wordt herkend aan zijn naam of
aan een alias in de kolom `aliassen`; komt er een nieuwe schrijfwijze langs, zet
die er dan bij in plaats van een tweede zaalrij te laten ontstaan.

Dezelfde show krijgt van de ene bron soms een titel zonder "Live" en van de
andere met "Live" of "LIVE" erachter (bijvoorbeeld "Best of 'Help, ik heb een
puber!'" versus "Best of 'Help, ik heb een puber!' LIVE"). Het woord "live" wordt
daarom net als de lidwoorden uit de matchsleutel gehaald, anders ontstaat er een
dubbele podcast + show + events. Dit is precies zo misgegaan bij het inladen van
Corti Media (augustus 2026) en toen met de hand hersteld; de sleutel-functie is
sindsdien aangepast zodat het niet opnieuw gebeurt.

## Wanneer telt een show mee?

De show hoeft niet de podcast zelf te zijn. Hij telt mee als de makers van de
podcast op het podium staan en de voorstelling enigszins raakt aan het onderwerp of
de toon van de podcast. De kolom `verwantschap` op het tabblad `shows` legt vast hoe
nauw dat verband is:

- `podcast live` - de podcast wordt live opgenomen of gespeeld (Hagelslag).
- `thema-verwant` - andere voorstelling, zelfde onderwerp (Napleiten Live, Veldheren,
  Boekestijn & De Wijk).
- `zelfde makers` - de makers staan er, in dezelfde toon maar met een programma dat
  los van de podcast bestaat (Plien & Bianca met Harrekidee, Aaf en Lies met Over de
  liefde).

Telt niet mee: de maker staat op het podium in een rol die niets met de podcast te
maken heeft - een presentator die in een toneelstuk speelt, een muzikant die een
concert geeft, iemand die een gala van een ander presenteert.

Omdat het verband in de data staat en niet in een wel-of-niet-beslissing, kunnen we
later alsnog besluiten om alleen `podcast live` en `thema-verwant` te tonen.

## Bekende beperking: twee voorstellingen op een dag

Een event wordt herkend aan show + zaal + datum. Speelt een voorstelling twee keer
op dezelfde dag in dezelfde zaal - een matinee en een avondvoorstelling - dan past
alleen de tweede erin. Dat gebeurt bijvoorbeeld bij Over de liefde in DeLaMar op
12 september 2026. Wil je die allebei kunnen tonen, dan moet de tijd deel worden
van de sleutel. Dat is een bewuste openstaande keuze, geen vergeten detail.

## Afspraak over verrijken

Aanvangstijd en beginprijs staan niet bij de producent, die moeten per event bij
het theater opgehaald worden. Vraag daarbij expliciet naar het gewone tarief:
theaters tonen vaak een jongeren- of studentenprijs als laagste bedrag, en
"vanaf 10 euro" terwijl volwassenen 31 euro betalen is misleidend. Dat doen we alleen voor shows die binnen negentig
dagen spelen, en die verversen we maandelijks. Alles daarna krijgt voorlopig
alleen datum, zaal en ticketlink. Reden: één ophaalactie per event schaalt niet
naar honderden shows, en een prijs van over een jaar klopt straks toch niet meer.
`bouw-site.py` toont onderaan welke shows binnen die negentig dagen nog een tijd
of prijs missen.

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


## Bannerkleuren op de podcastpagina

De brede banner bovenaan een podcastpagina toont de cover scherp (als logo) en
vult de rest van de band met de kleur(en) van de buitenrand van die cover:
effen als de rand een achtergrondkleur is, een links/rechts-verloop als de
cover zelf al tweekleurig is (zoals Boekestijn en De Wijk: zwart/geel).

Deze kleuren staan als hex-codes in `bannerkleur_links` en `bannerkleur_rechts`
in het podcasts-tabblad en worden niet automatisch bepaald tijdens het bouwen
— `bouw-site.py` leest ze alleen uit. Reden: `device_bash` heeft geen
netwerktoegang tot de Apple-CDN (mzstatic.com) waar de covers op staan, dus
ze kunnen niet zomaar met een Python-scriptje gedownload worden. De browser
(Claude_Browser) kan de afbeelding wel laden; daarmee wordt de kleur bepaald.

Voor een nieuwe podcast met cover, dit stappenplan volgen:
1. Navigeer in de browser naar de cover_url zelf (dus rechtstreeks naar de
   afbeelding, niet naar een pagina die 'm toont) — evt. eerst
   `request_access` voor dat domein.
2. Voer in de browser (javascript_tool) een script uit dat de afbeelding op
   een canvas tekent en de dominante kleur bemonstert in een linker- en
   rechterstrook (zo'n 5% van de breedte), met kleuren gegroepeerd in
   grovere emmers zodat een paar rand-pixels de uitkomst niet verstoren.
   Bij een echt uniforme achtergrond komt links en rechts (bijna) hetzelfde
   uit; bij een bewust tweekleurig ontwerp niet.
3. Zet de uitkomst in `bannerkleur_links` / `bannerkleur_rechts` voor die
   podcast in de xlsx, en draai `bouw-site.py` opnieuw.


## De site staat live

De site draait sinds 2 september 2026 op GitHub Pages:
**https://minksol-bit.github.io/podcast-liveshows/**

- GitHub-repo: `github.com/minksol-bit/podcast-liveshows` (publiek, branch
  `master`, Pages-bron ingesteld op "Deploy from a branch" / master / root).
- Verbinding verloopt via SSH met een los sleutelpaar dat alleen op het
  Mac-account van Mink staat (`~/.ssh/id_ed25519_github` in de device_bash-
  omgeving, toegevoegd aan Mink's GitHub-account). Er is geen wachtwoord of
  token ooit door Claude ingevoerd.
- Om een wijziging live te zetten: na `bouw-site.py` en de tests, gewoon
  `git add`, `git commit`, `git push origin master` zoals gebruikelijk (zie
  hieronder voor een bekend addertje). GitHub Pages publiceert een paar
  minuten na elke push naar master automatisch.
- SSH werkt alleen via git zelf (dat gebruikt `GIT_SSH_COMMAND`, een socat-
  tunnel over de bestaande proxy); een kale `ssh -T git@github.com` werkt
  niet vanuit deze sandbox (DNS-resolutie faalt), dus test connectiviteit
  met `git ls-remote` in plaats daarvan.

### Bekend probleem: hardnekkige .git/index.lock

In deze device_bash-omgeving kan een git-proces soms een `.git/index.lock`
(of `.git/objects/*/tmp_obj_*`) achterlaten die niet meer weg te krijgen is
— `rm`/`find -delete` geeft `Operation not permitted`, en ook
`device_request_delete_permission` heeft dit niet altijd opgelost. Normale
`git add`/`git commit` lopen daar dan op vast.

Workaround die wel werkt (raakt nooit het standaard-indexbestand of het
lock-bestand zelf, dus permissies zijn geen probleem):

```bash
export GIT_INDEX_FILE=/tmp/newindex_$$
git read-tree HEAD
git add -A
TREE=$(git write-tree)
COMMIT=$(git commit-tree "$TREE" -p HEAD -m "commit-boodschap")
git update-ref refs/heads/master "$COMMIT"
unset GIT_INDEX_FILE
```

Dit maakt een nieuwe commit los van het geblokkeerde indexbestand. Waarschuwingen
over `unable to unlink tmp_obj_*` tijdens dit proces zijn onschuldig zolang de
`TREE`/`COMMIT`-hashes wel worden geprint en `git log` de nieuwe commit erna
laat zien — controleer met `git status` (hoort "clean" te zijn) en `git fsck`.
Probeer eerst gewoon `git commit`; grijp pas naar deze omweg als die vastloopt
op het lock-bestand.
