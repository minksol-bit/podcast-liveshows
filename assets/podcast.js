/* Podcastpagina: alle shows van deze podcast, met kaart.
   Zweven over een datum licht het bijbehorende bolletje op. Leest window.PAGINA. */
(function () {
  "use strict";
  if (!window.PAGINA || !PAGINA.events.length) return;

  var MAAND_KORT = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
  var MAANDEN = ["januari","februari","maart","april","mei","juni",
                 "juli","augustus","september","oktober","november","december"];
  var $ = function (id) { return document.getElementById(id); };

  var opKaart = PAGINA.events.filter(function (ev) { return ev.zaal.opkaart; });
  var markers = {};
  var kaart = null, laag = null;

  if (opKaart.length && $("kaart")) {
    kaart = L.map("kaart", { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(kaart);
    laag = L.layerGroup().addTo(kaart);

    var punten = [];
    opKaart.forEach(function (ev) {
      var icoon = L.divIcon({
        html: '<div class="speld"><span class="stip"></span>' +
              ev.dag + " " + MAAND_KORT[ev.maandnr - 1] + "</div>",
        className: "speldwikkel", iconSize: null, iconAnchor: [16, 14], popupAnchor: [0, -12]
      });
      var m = L.marker([ev.zaal.lat, ev.zaal.lon], { icon: icoon });
      m.bindPopup('<div class="popup-zaal">' + ev.zaal.naam + ", " + ev.zaal.stad + "</div>" +
                  '<div class="popup-regel">' + ev.dag + " " + MAANDEN[ev.maandnr - 1] + " " + ev.jaar +
                  (ev.tijd ? " &middot; " + ev.tijd : "") + "</div>");
      m.addTo(laag);
      markers[ev.id] = m;
      punten.push([ev.zaal.lat, ev.zaal.lon]);
    });
    kaart.fitBounds(L.latLngBounds(punten).pad(0.25));
    window.addEventListener("resize", function () { kaart.invalidateSize(); });
  }

  function dim(actiefId) {
    Object.keys(markers).forEach(function (id) {
      var el = markers[id].getElement();
      if (!el) return;
      el.classList.toggle("gedimd", actiefId !== null && String(id) !== String(actiefId));
      el.classList.toggle("uitgelicht", String(id) === String(actiefId));
    });
  }

  // rijen koppelen aan de kaart
  Array.prototype.forEach.call(document.querySelectorAll(".event[data-ev]"), function (rij) {
    var id = rij.getAttribute("data-ev");
    var m = markers[id];
    rij.addEventListener("mouseenter", function () { if (Object.keys(markers).length) dim(id); });
    rij.addEventListener("mouseleave", function () { dim(null); });
    if (m) {
      rij.classList.add("klikbaar");
      rij.addEventListener("click", function (ev) {
        if (ev.target.closest("a") || ev.target.closest("button")) return;
        kaart.setView(m.getLatLng(), Math.max(kaart.getZoom(), 11), { animate: true });
        m.openPopup();
      });
    }
    // hartje en agendaknop bijplaatsen
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
