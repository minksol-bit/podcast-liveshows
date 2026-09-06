#!/usr/bin/env python3
"""Controleert of shows nog kaarten hebben, door de ticketpagina's na te lopen.

Waarom dit bestaat: de kolom `status` in de xlsx is een momentopname. Shows
raken uitverkocht (en komen soms weer in verkoop) zonder dat wij dat merken.
Dit script leest de ticketpagina's, vergelijkt wat het ziet met wat er in de
xlsx staat, en rapporteert ALLEEN de verschillen. Zo hoeft er nooit iemand
176 pagina's door te lezen.

Draaien vanuit Terminal op de Mac (de Linux-omgeving van Claude heeft geen
internet, dus daar werkt het niet):

    python3 check-beschikbaarheid.py                 # kijken wat er zou veranderen
    python3 check-beschikbaarheid.py --schrijf       # de xlsx echt bijwerken

Handige knoppen:
    --horizon 90      alleen shows binnen zoveel dagen (standaard 90)
    --ouder-dan 7     alleen shows die zo lang niet gecheckt zijn (standaard 7)
    --alles           negeer horizon en ouderdom, check alles met een ticketlink
    --max 25          stop na zoveel pagina's (handig om even te proeven)

Het rapport komt op het scherm en in data/beschikbaarheid-rapport.json.
"""

import argparse, json, re, sys, time, urllib.error, urllib.parse, urllib.request
import urllib.robotparser as robotparser
from datetime import date, datetime, timedelta
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl ontbreekt. Installeer met: pip3 install openpyxl")

HIER = Path(__file__).resolve().parent
XLSX = HIER / "data" / "podcast-liveshows.xlsx"
RAPPORT = HIER / "data" / "beschikbaarheid-rapport.json"

AGENT = ("podcastliveshows.nl-beschikbaarheidscheck/1.0 "
         "(+https://podcastliveshows.nl; controleert of eigen agendaregels nog kloppen)")
PAUZE = 1.5          # seconden tussen twee verzoeken aan dezelfde site
TIMEOUT = 20

# Woorden die zeggen dat er niets meer te koop is.
UITVERKOCHT = [
    "uitverkocht", "sold out", "soldout", "volgeboekt", "vol geboekt",
    "geen kaarten meer", "geen tickets meer", "wachtlijst", "niet meer beschikbaar",
]
# Woorden die zeggen dat je nog kunt kopen.
TE_KOOP = [
    "bestel", "koop tickets", "tickets kopen", "kaarten kopen", "koop kaarten",
    "reserveer", "in de winkelwagen", "selecteer je plaats", "beschikbaar",
    "tickets vanaf", "kaartverkoop",
]

DATUM_IN_TEKST = re.compile(
    r"\b\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|"
    r"september|oktober|november|december)\b", re.I)


# ---------- xlsx lezen ----------

def lees_tabbladen():
    wb = openpyxl.load_workbook(XLSX)
    uit = {}
    for naam in ("events", "shows", "venues"):
        rijen = list(wb[naam].values)
        kop = list(rijen[0])
        uit[naam] = (kop, [dict(zip(kop, r)) for r in rijen[1:]
                           if any(x is not None for x in r)])
    return wb, uit


def datum_van(waarde):
    t = str(waarde or "")[:10]
    try:
        return datetime.strptime(t, "%Y-%m-%d").date()
    except ValueError:
        return None


def te_checken(gegevens, horizon, ouder_dan, alles):
    events, shows, venues = gegevens["events"][1], gegevens["shows"][1], gegevens["venues"][1]
    smap = {s["id"]: s for s in shows}
    vmap = {v["id"]: v for v in venues}
    vandaag = date.today()
    grens_datum = vandaag + timedelta(days=horizon)
    grens_check = vandaag - timedelta(days=ouder_dan)

    lijst = []
    for ev in events:
        url = str(ev.get("ticket_url") or "").strip()
        if not url.startswith("http"):
            continue
        d = datum_van(ev.get("aanvang"))
        if not d or d < vandaag:
            continue
        if not alles:
            if d > grens_datum:
                continue
            gecheckt = datum_van(ev.get("laatst_gecheckt"))
            if gecheckt and gecheckt > grens_check:
                continue
        lijst.append({
            "id": ev["id"], "datum": d.isoformat(), "url": url,
            "status_nu": str(ev.get("status") or "").strip().lower(),
            "titel": str(smap.get(ev.get("show_id"), {}).get("titel", "?")),
            "stad": str(vmap.get(ev.get("venue_id"), {}).get("stad", "?")),
        })
    lijst.sort(key=lambda r: r["datum"])
    return lijst


# ---------- pagina's ophalen ----------

_robots, _laatste_bezoek = {}, {}


def mag_ophalen(url):
    """Respecteert robots.txt. Bij twijfel (geen robots.txt) mag het."""
    deel = urllib.parse.urlparse(url)
    basis = f"{deel.scheme}://{deel.netloc}"
    if basis not in _robots:
        rp = robotparser.RobotFileParser()
        rp.set_url(basis + "/robots.txt")
        try:
            rp.read()
        except Exception:
            rp = None
        _robots[basis] = rp
    rp = _robots[basis]
    if rp is None:
        return True
    try:
        return rp.can_fetch(AGENT, url)
    except Exception:
        return True


def haal_op(url):
    """Geeft (tekst, foutmelding). Pauzeert netjes tussen verzoeken."""
    host = urllib.parse.urlparse(url).netloc
    wacht = PAUZE - (time.time() - _laatste_bezoek.get(host, 0))
    if wacht > 0:
        time.sleep(wacht)
    _laatste_bezoek[host] = time.time()

    verzoek = urllib.request.Request(url, headers={
        "User-Agent": AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "nl-NL,nl;q=0.9",
    })
    try:
        with urllib.request.urlopen(verzoek, timeout=TIMEOUT) as r:
            rauw = r.read(1_500_000)
            soort = r.headers.get_content_charset() or "utf-8"
        return rauw.decode(soort, errors="replace"), None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}"
    except Exception as e:
        return None, type(e).__name__


def naar_tekst(html):
    """Haalt de leesbare tekst uit de html, zonder scripts en stijlen."""
    h = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    h = re.sub(r"(?s)<!--.*?-->", " ", h)
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    h = (h.replace("&nbsp;", " ").replace("&amp;", "&")
          .replace("&eacute;", "e").replace("&euml;", "e"))
    return re.sub(r"\s+", " ", h).strip()


# ---------- oordeel vellen ----------

def beoordeel(tekst):
    """Geeft (oordeel, uitleg). Oordeel: uitverkocht / in verkoop / onzeker / onleesbaar."""
    if tekst is None:
        return "onleesbaar", "pagina niet opgehaald"
    if len(tekst) < 400:
        return "onleesbaar", f"nauwelijks tekst ({len(tekst)} tekens) - waarschijnlijk door JavaScript geladen"

    laag = tekst.lower()
    uit = [w for w in UITVERKOCHT if w in laag]
    koop = [w for w in TE_KOOP if w in laag]
    datums = len(set(m.group(0).lower() for m in DATUM_IN_TEKST.finditer(tekst)))

    if uit:
        # Op een pagina met meerdere speeldata kan "uitverkocht" over een
        # andere voorstelling gaan. Dat durven we niet zelf te beslissen.
        if datums > 1:
            return "onzeker", f"'{uit[0]}' gevonden, maar de pagina noemt {datums} verschillende data"
        return "uitverkocht", f"'{uit[0]}' gevonden"
    if koop:
        return "in verkoop", f"'{koop[0]}' gevonden"
    return "onzeker", "geen van beide signaalwoorden gevonden"


# ---------- hoofdprogramma ----------

def main():
    p = argparse.ArgumentParser(description="Controleert de kaartverkoopstatus van shows.")
    p.add_argument("--schrijf", action="store_true", help="werk de xlsx echt bij")
    p.add_argument("--horizon", type=int, default=90, help="alleen shows binnen zoveel dagen")
    p.add_argument("--ouder-dan", type=int, default=7, help="alleen shows die zo lang niet gecheckt zijn")
    p.add_argument("--alles", action="store_true", help="negeer horizon en ouderdom")
    p.add_argument("--max", type=int, default=0, help="stop na zoveel pagina's")
    a = p.parse_args()

    wb, gegevens = lees_tabbladen()
    lijst = te_checken(gegevens, a.horizon, a.ouder_dan, a.alles)
    if a.max:
        lijst = lijst[:a.max]

    if not lijst:
        print("Niets te checken - alles is recent genoeg nagekeken.")
        print("Toch iets willen zien? Probeer --alles of --ouder-dan 0")
        return

    print(f"{len(lijst)} show(s) na te kijken. Even geduld, er zit een pauze "
          f"van {PAUZE}s tussen de verzoeken.\n")

    resultaten = []
    for i, r in enumerate(lijst, 1):
        print(f"  [{i}/{len(lijst)}] {r['datum']}  {r['titel'][:34]:34s} {r['stad'][:18]:18s} ", end="", flush=True)
        if not mag_ophalen(r["url"]):
            oordeel, uitleg = "onleesbaar", "robots.txt staat dit niet toe"
        else:
            html, fout = haal_op(r["url"])
            if fout:
                oordeel, uitleg = "onleesbaar", fout
            else:
                oordeel, uitleg = beoordeel(naar_tekst(html))
        verandert = oordeel in ("uitverkocht", "in verkoop") and oordeel != r["status_nu"]
        print(f"{oordeel}{'  <-- WIJZIGING' if verandert else ''}")
        resultaten.append({**r, "oordeel": oordeel, "uitleg": uitleg, "verandert": verandert})

    wijzigingen = [r for r in resultaten if r["verandert"]]
    onzeker = [r for r in resultaten if r["oordeel"] == "onzeker"]
    onleesbaar = [r for r in resultaten if r["oordeel"] == "onleesbaar"]

    print("\n" + "=" * 74)
    print(f"{len(resultaten)} gecheckt  |  {len(wijzigingen)} wijziging(en)  |  "
          f"{len(onzeker)} onzeker  |  {len(onleesbaar)} niet te lezen")

    if wijzigingen:
        print("\nWIJZIGINGEN")
        for r in wijzigingen:
            print(f"  {r['datum']}  {r['titel'][:36]:36s} {r['stad'][:16]:16s} "
                  f"{r['status_nu']}  ->  {r['oordeel']}   ({r['uitleg']})")

    if onzeker:
        print("\nONZEKER - even met eigen ogen kijken")
        for r in onzeker:
            print(f"  {r['datum']}  {r['titel'][:36]:36s} {r['stad'][:16]:16s} ({r['uitleg']})")
            print(f"      {r['url']}")

    if onleesbaar:
        print("\nNIET TE LEZEN - meestal een pagina die zijn inhoud pas met JavaScript ophaalt")
        for r in onleesbaar:
            print(f"  {r['datum']}  {r['titel'][:36]:36s} {r['stad'][:16]:16s} ({r['uitleg']})")

    RAPPORT.write_text(json.dumps({
        "gedraaid_op": datetime.now().isoformat(timespec="seconds"),
        "gecheckt": len(resultaten), "wijzigingen": len(wijzigingen),
        "onzeker": len(onzeker), "onleesbaar": len(onleesbaar),
        "regels": resultaten,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nRapport opgeslagen in {RAPPORT.relative_to(HIER)}")

    if not a.schrijf:
        if wijzigingen:
            print("\nDit was een proefronde. Draai met --schrijf om de xlsx bij te werken.")
        return

    ws = wb["events"]
    kop = [c.value for c in ws[1]]
    k_status, k_gecheckt = kop.index("status") + 1, kop.index("laatst_gecheckt") + 1
    k_id = kop.index("id") + 1
    per_id = {r["id"]: r for r in resultaten}
    aangepast = 0
    for rij in range(2, ws.max_row + 1):
        r = per_id.get(ws.cell(rij, k_id).value)
        if not r or r["oordeel"] not in ("uitverkocht", "in verkoop"):
            continue
        ws.cell(rij, k_status).value = r["oordeel"]
        ws.cell(rij, k_gecheckt).value = date.today().isoformat()
        if r["verandert"]:
            aangepast += 1
    wb.save(XLSX)
    print(f"\nxlsx bijgewerkt: {aangepast} status(sen) veranderd, "
          f"datum 'laatst_gecheckt' ververst voor alles wat leesbaar was.")
    print("Draai nu: python3 bouw-site.py")


if __name__ == "__main__":
    main()
