/* Podcastpagina: alle shows van deze podcast, met kaart.
   Eén speldje per zaal (anders vallen datums in dezelfde zaal over elkaar heen).
   Zweven over een datum licht het bijbehorende speldje op. Leest window.PAGINA. */
(function () {
  "use strict";
  if (!window.PAGINA || !PAGINA.events.length) return;

  var MAAND_KORT = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
  var MAANDEN = ["januari","februari","maart","april","mei","juni",
                 "juli","augustus","september","oktober","november","december"];
  var $ = function (id) { return document.getElementById(id); };

  var zalen = PAGINA.zalen || [];
  var markerPerZaal = {};   // zaal-id -> marker
  var zaalVanEvent = {};    // event-id -> zaal-id
  var kaart = null;

  function veilig(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  if (zalen.length && $("kaart")) {
    kaart = L.map("kaart", { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(kaart);
    var laag = L.layerGroup().addTo(kaart);

    var punten = [];
    zalen.forEach(function (z) {
      var eerste = z.datums[0];
      var label = eerste.dag + " " + MAAND_KORT[eerste.maandnr - 1] +
                  (z.datums.length > 1 ? " +" + (z.datums.length - 1) : "");
      var m = L.marker([z.lat, z.lon], {
        icon: L.divIcon({
          html: '<div class="speld"><span class="stip"></span>' + veilig(label) + "</div>",
          className: "speldwikkel", iconSize: null, iconAnchor: [16, 14], popupAnchor: [0, -12]
        })
      });
      var h = '<div class="popup-zaal">' + veilig(z.naam) + ", " + veilig(z.stad) + "</div>";
      z.datums.forEach(function (dt) {
        h += '<div class="popup-regel">' + dt.dag + " " + MAANDEN[dt.maandnr - 1] + " " + dt.jaar +
             (dt.tijd ? " &middot; " + dt.tijd : "") + "</div>";
        zaalVanEvent[dt.ev] = z.id;
      });
      m.bindPopup(h);
      m.addTo(laag);
      markerPerZaal[z.id] = m;
      punten.push([z.lat, z.lon]);
    });
    kaart.fitBounds(L.latLngBounds(punten).pad(0.25));
    window.addEventListener("resize", function () { kaart.invalidateSize(); });
  }

  function licht(zaalId) {
    Object.keys(markerPerZaal).forEach(function (id) {
      var el = markerPerZaal[id].getElement();
      if (!el) return;
      el.classList.toggle("gedimd", zaalId !== null && String(id) !== String(zaalId));
      el.classList.toggle("uitgelicht", zaalId !== null && String(id) === String(zaalId));
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll(".event[data-ev]"), function (rij) {
    var id = rij.getAttribute("data-ev");
    var zaalId = zaalVanEvent[id];
    rij.addEventListener("mouseenter", function () { if (zaalId !== undefined) licht(zaalId); });
    rij.addEventListener("mouseleave", function () { licht(null); });
    if (zaalId !== undefined) {
      rij.classList.add("klikbaar");
      rij.addEventListener("click", function (ev) {
        if (ev.target.closest("a") || ev.target.closest("button")) return;
        var m = markerPerZaal[zaalId];
        kaart.setView(m.getLatLng(), Math.max(kaart.getZoom(), 11), { animate: true });
        m.openPopup();
      });
    }
    var vak = rij.querySelector(".rechtsblok");
    if (vak && window.FAV) {
      var gegevens = JSON.parse(rij.getAttribute("data-json"));
      vak.insertBefore(FAV.knop(id), vak.firstChild);
      var kal = document.createElement("button");
      kal.type = "button";
      kal.title = "Zet in mijn agenda";
      kal.setAttribute("aria-label", "Zet in mijn agenda");
      kal.textContent = "\u{1F4C5}";
      kal.style.cssText = "border:none;background:none;cursor:pointer;font-size:16px;padding:4px 2px";
      kal.addEventListener("click", function (e2) { e2.stopPropagation(); AGENDA.download(gegevens); });
      vak.insertBefore(kal, vak.querySelector("a.knop") || null);
    }
  });
})();
