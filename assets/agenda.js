/* De agenda: lijst met filters, gekoppeld aan de kaart. Leest window.DATA. */
(function () {
  "use strict";
  if (!window.DATA) return;

  var MAANDEN = ["januari","februari","maart","april","mei","juni",
                 "juli","augustus","september","oktober","november","december"];
  var MAAND_KORT = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

  var events = DATA.events.slice();
  var $ = function (id) { return document.getElementById(id); };

  // ---------- filters vullen ----------
  var vkMaand = VEELKEUZE.maak("fm-maand-knop", "fm-maand-paneel", { alles: "Alle maanden" });
  var vkProvincie = VEELKEUZE.maak("fm-provincie-knop", "fm-provincie-paneel", { alles: "Alle provincies" });
  var vkThema = VEELKEUZE.maak("fm-thema-knop", "fm-thema-paneel", { alles: "Alle thema's" });

  var maanden = [], provincies = [], themas = [];
  events.forEach(function (ev) {
    if (maanden.indexOf(ev.maand) === -1) maanden.push(ev.maand);
    if (ev.provincie && provincies.indexOf(ev.provincie) === -1) provincies.push(ev.provincie);
    ev.themas.forEach(function (t) { if (themas.indexOf(t) === -1) themas.push(t); });
  });
  vkMaand.vul(maanden.sort(), function (m) {
    var d = m.split("-"); return MAANDEN[+d[1] - 1] + " " + d[0];
  });
  vkProvincie.vul(provincies.sort());
  vkThema.vul(themas.sort());

  // ---------- filterstand, ook in de link ----------
  // maand/provincie/thema zijn lijsten: je kunt er meerdere tegelijk kiezen.
  var stand = { maand: [], provincie: [], thema: [], prijs: "", snel: "", fav: false };

  function uitLink() {
    var p = new URLSearchParams(location.search);
    stand.maand = (p.get("maand") || "").split(",").filter(Boolean);
    stand.provincie = (p.get("provincie") || "").split(",").filter(Boolean);
    stand.thema = (p.get("thema") || "").split(",").filter(Boolean);
    stand.prijs = p.get("prijs") || "";
    stand.snel = p.get("wanneer") || "";
    stand.fav = p.get("favorieten") === "1";
    vkMaand.zet(stand.maand);
    vkProvincie.zet(stand.provincie);
    vkThema.zet(stand.thema);
    $("f-prijs").value = stand.prijs || $("f-prijs").max;
    werkPrijslabelBij();
  }
  function werkPrijslabelBij() {
    var el = $("f-prijs");
    $("f-prijs-label").textContent = (el.value === el.max) ? "Alle prijzen" : "tot \u20AC" + el.value;
  }
  function naarLink() {
    var p = new URLSearchParams();
    if (stand.maand.length) p.set("maand", stand.maand.join(","));
    if (stand.provincie.length) p.set("provincie", stand.provincie.join(","));
    if (stand.thema.length) p.set("thema", stand.thema.join(","));
    if (stand.prijs) p.set("prijs", stand.prijs);
    if (stand.snel) p.set("wanneer", stand.snel);
    if (stand.fav) p.set("favorieten", "1");
    var vraag = p.toString();
    // Bij een pagina die je met dubbelklikken opent (file://) mag de adresbalk
    // niet worden bijgewerkt; de browser weigert dat. Dan slaan we het over.
    if (location.protocol === "file:") return;
    try {
      history.replaceState(null, "", vraag ? "?" + vraag : location.pathname);
    } catch (e) { /* adresbalk bijwerken is een extraatje, geen must */ }
  }

  function vandaagISO() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function weekendReeks() {
    var d = new Date(), dag = d.getDay();            // 0 = zondag
    var naarVrijdag = (5 - dag + 7) % 7;
    var vr = new Date(d); vr.setDate(d.getDate() + naarVrijdag);
    var zo = new Date(vr); zo.setDate(vr.getDate() + 2);
    function f(x) { return x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2) + "-" + ("0" + x.getDate()).slice(-2); }
    return [f(vr), f(zo)];
  }

  function selectie() {
    var vandaag = vandaagISO(), weekend = weekendReeks(), favs = FAV.lees();
    return events.filter(function (ev) {
      if (stand.maand.length && stand.maand.indexOf(ev.maand) === -1) return false;
      if (stand.provincie.length && stand.provincie.indexOf(ev.provincie) === -1) return false;
      if (stand.thema.length && !ev.themas.some(function (t) { return stand.thema.indexOf(t) !== -1; })) return false;
      if (stand.prijs) {
        if (ev.prijs === null || ev.prijs === undefined) return false;
        if (ev.prijs > parseFloat(stand.prijs)) return false;
      }
      if (stand.snel === "vandaag" && ev.iso !== vandaag) return false;
      if (stand.snel === "weekend" && !(ev.iso >= weekend[0] && ev.iso <= weekend[1])) return false;
      if (stand.fav && favs.indexOf(String(ev.id)) === -1) return false;
      return true;
    });
  }

  // ---------- kaart ----------
  var kaart = L.map("kaart", { scrollWheelZoom: false }).setView([52.15, 5.4], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(kaart);
  var clusters = L.markerClusterGroup({
    maxClusterRadius: 45, showCoverageOnHover: false,
    iconCreateFunction: function (c) {
      return L.divIcon({ html: '<div class="tros">' + c.getChildCount() + "</div>",
                         className: "", iconSize: [42, 42], iconAnchor: [21, 21] });
    }
  });
  kaart.addLayer(clusters);
  var markerPerZaal = {};

  window.__coverFout = function (img) {
    var bol = img.parentNode;
    if (bol) bol.textContent = img.getAttribute("data-initialen") || "?";
  };

  function veiligAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function miniCoverHtml(podcasts) {
    var eerste = (podcasts && podcasts[0]) || null;
    var cover = eerste ? String(eerste.cover || "") : "";
    var namen = (podcasts || []).map(function (p) { return p.naam; }).join(", ");
    var init = String((eerste && eerste.naam) || "?").trim().slice(0, 2).toUpperCase();
    var binnen = cover
      ? '<img src="' + veiligAttr(cover) + '" alt="" loading="lazy" onerror="window.__coverFout(this)" data-initialen="' + veiligAttr(init) + '">'
      : veiligAttr(init);
    return '<div class="minicover" title="' + veiligAttr(namen) + '">' + binnen + "</div>";
  }

  function bolIcoon(podcast) {
    var cover = podcast ? String(podcast.cover || "") : "";
    var init = String((podcast && podcast.naam) || "?").trim().slice(0, 2).toUpperCase();
    var binnen = cover
      ? '<img src="' + veiligAttr(cover) + '" alt="" loading="lazy" onerror="window.__coverFout(this)" data-initialen="' + veiligAttr(init) + '">'
      : veiligAttr(init);
    return L.divIcon({ html: '<div class="bol">' + binnen + "</div>",
                       className: "", iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -22] });
  }

  function tekenKaart(lijst) {
    clusters.clearLayers();
    markerPerZaal = {};
    var perZaal = {};
    lijst.forEach(function (ev) {
      if (!ev.zaal.opkaart) return;
      (perZaal[ev.zaal.id] = perZaal[ev.zaal.id] || []).push(ev);
    });
    var punten = [];
    Object.keys(perZaal).forEach(function (zid) {
      var groep = perZaal[zid], zaal = groep[0].zaal;
      var pos = [zaal.lat, zaal.lon];
      var m = L.marker(pos, { icon: bolIcoon(groep[0].podcasts[0]) });
      var h = '<div class="popup-zaal">' + veiligAttr(zaal.naam) + ", " + veiligAttr(zaal.stad) + "</div>";
      groep.slice(0, 8).forEach(function (ev) {
        h += '<div class="popup-regel">' + ev.dag + " " + MAAND_KORT[ev.maandnr - 1] + " " + ev.jaar +
             " &middot; " + veiligAttr(ev.titel) + "</div>";
      });
      if (groep.length > 8) h += '<div class="popup-regel">en nog ' + (groep.length - 8) + " andere</div>";
      m.bindPopup(h);
      clusters.addLayer(m);
      markerPerZaal[zid] = m;
      punten.push(pos);
    });
    if (punten.length) kaart.fitBounds(L.latLngBounds(punten).pad(0.25));
  }

  // ---------- lijst ----------
  function tekenLijst(lijst) {
    var doel = $("lijst");
    doel.innerHTML = "";
    if (!lijst.length) {
      doel.innerHTML = '<p class="leeg">Geen shows gevonden met deze filters.</p>';
      return;
    }
    var vorige = null;
    lijst.forEach(function (ev) {
      if (ev.maand !== vorige) {
        vorige = ev.maand;
        var h = document.createElement("h2");
        h.className = "maand";
        h.textContent = MAANDEN[ev.maandnr - 1] + " " + ev.jaar;
        doel.appendChild(h);
      }
      var rij = document.createElement("div");
      rij.className = "event" + (ev.zaal.opkaart ? " klikbaar" : "");
      var namen = ev.podcasts.map(function (p) { return p.naam; }).join(", ");
      var podcastLink = ev.podcasts.length === 1
        ? '<a href="podcast/' + veiligAttr(ev.podcasts[0].slug) + '.html">' + veiligAttr(namen) + "</a>"
        : veiligAttr(namen);
      rij.innerHTML =
        '<div class="datum"><div class="dag">' + ev.dag + '</div>' +
          '<div class="mnd">' + MAAND_KORT[ev.maandnr - 1] + '</div></div>' +
        miniCoverHtml(ev.podcasts) +
        '<div class="info">' +
          '<div class="titel">' + veiligAttr(ev.titel) + '</div>' +
          '<div class="zaal">' + veiligAttr(ev.zaal.naam) + ", " + veiligAttr(ev.zaal.stad) +
            (ev.provincie ? ' <span style="opacity:.7">(' + veiligAttr(ev.provincie) + ')</span>' : '') + '</div>' +
          '<div class="bij">' + (ev.tijd ? "Aanvang " + ev.tijd + " &middot; " : "") + podcastLink + '</div>' +
        '</div>';
      var rechts = document.createElement("div");
      rechts.className = "rechtsblok";
      var prijstekst = (ev.prijs !== null && ev.prijs !== undefined)
        ? "vanaf €" + String(ev.prijs).replace(".", ",") : "";
      rechts.appendChild(FAV.knop(ev.id, function () { if (stand.fav) ververs(); else werkTellingBij(); }));
      var kal = document.createElement("button");
      kal.type = "button";
      kal.title = "Zet in mijn agenda";
      kal.setAttribute("aria-label", "Zet in mijn agenda");
      kal.textContent = "\u{1F4C5}";
      kal.style.cssText = "border:none;background:none;cursor:pointer;font-size:16px;padding:4px 2px";
      kal.addEventListener("click", function (e2) {
        e2.stopPropagation();
        AGENDA.download({ id: ev.id, iso: ev.iso, tijd: ev.tijd, titel: ev.titel,
                          zaal: ev.zaal.naam, stad: ev.zaal.stad, ticket: ev.ticket });
      });
      rechts.appendChild(kal);
      var onderHtml = prijstekst ? '<span class="knop-onder">' + veiligAttr(prijstekst) + "</span>" : "";
      if (String(ev.status || "").toLowerCase() === "uitverkocht") {
        var uit = document.createElement("span");
        uit.className = "geen knop-vorm";
        uit.innerHTML = '<span class="knop-label">Uitverkocht</span>' + onderHtml;
        rechts.appendChild(uit);
      } else if (ev.ticket) {
        var a = document.createElement("a");
        a.className = "knop"; a.href = ev.ticket; a.target = "_blank"; a.rel = "noopener";
        a.innerHTML = '<span class="knop-label">Tickets</span>' + onderHtml;
        a.addEventListener("click", function (e3) { e3.stopPropagation(); });
        rechts.appendChild(a);
      } else {
        var g = document.createElement("span");
        g.className = "geen knop-vorm";
        g.innerHTML = '<span class="knop-label">geen link</span>' + onderHtml;
        rechts.appendChild(g);
      }
      rij.appendChild(rechts);

      if (ev.zaal.opkaart) {
        rij.addEventListener("click", function () {
          Array.prototype.forEach.call(document.querySelectorAll(".event.actief"),
            function (r) { r.classList.remove("actief"); });
          rij.classList.add("actief");
          var m = markerPerZaal[ev.zaal.id];
          if (m) clusters.zoomToShowLayer(m, function () { m.openPopup(); });
        });
      }
      doel.appendChild(rij);
    });
  }

  function werkTellingBij() {
    var lijst = selectie();
    var zonder = lijst.filter(function (ev) { return !ev.zaal.opkaart; }).length;
    $("telling").textContent = lijst.length + (lijst.length === 1 ? " show" : " shows") +
      (zonder ? " · " + zonder + " nog niet op de kaart" : "") +
      (FAV.aantal() ? " · " + FAV.aantal() + " favoriet" + (FAV.aantal() === 1 ? "" : "en") : "");
  }

  function ververs() {
    var lijst = selectie();
    tekenLijst(lijst);
    tekenKaart(lijst);
    werkTellingBij();
    naarLink();
    ["vandaag", "weekend"].forEach(function (k) {
      $("snel-" + k).className = stand.snel === k ? "aan" : "";
    });
    $("snel-fav").className = stand.fav ? "aan" : "";
    var missend = DATA.venues_zonder_coordinaten;
    var mel = $("melding");
    if (missend) {
      mel.hidden = false;
      mel.innerHTML = "Van de " + DATA.venues_totaal + " zalen hebben er <strong>" + missend +
        "</strong> nog geen coördinaten. Vul <code>lat</code> en <code>lon</code> in op het tabblad " +
        "<code>venues</code> en draai daarna <code>python3 bouw-site.py</code>.";
    } else { mel.hidden = true; }
  }

  vkMaand.onChange(function (w) { stand.maand = w; ververs(); });
  vkProvincie.onChange(function (w) { stand.provincie = w; ververs(); });
  vkThema.onChange(function (w) { stand.thema = w; ververs(); });
  $("f-prijs").addEventListener("input", function () {
    var el = $("f-prijs");
    stand.prijs = (el.value === el.max) ? "" : el.value;
    werkPrijslabelBij();
    ververs();
  });
  $("snel-vandaag").addEventListener("click", function () {
    stand.snel = stand.snel === "vandaag" ? "" : "vandaag"; ververs();
  });
  $("snel-weekend").addEventListener("click", function () {
    stand.snel = stand.snel === "weekend" ? "" : "weekend"; ververs();
  });
  $("snel-fav").addEventListener("click", function () { stand.fav = !stand.fav; ververs(); });
  $("wis").addEventListener("click", function () {
    stand = { maand: [], provincie: [], thema: [], prijs: "", snel: "", fav: false };
    vkMaand.wis(); vkProvincie.wis(); vkThema.wis();
    $("f-prijs").value = $("f-prijs").max;
    werkPrijslabelBij();
    ververs();
  });
  window.addEventListener("resize", function () { kaart.invalidateSize(); });

  uitLink();
  ververs();
})();
