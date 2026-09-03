/* Catalogus: zoeken en filteren op thema, zonder de pagina te herladen. */
(function () {
  "use strict";
  var zoek = document.getElementById("zoek");
  var blokken = Array.prototype.slice.call(document.querySelectorAll(".blok"));
  var koppen = Array.prototype.slice.call(document.querySelectorAll(".letterkop"));
  var telling = document.getElementById("telling");
  if (!blokken.length) return;

  var vkThema = VEELKEUZE.maak("fm-thema-knop", "fm-thema-paneel", { alles: "Alle thema's" });

  function ververs() {
    var q = (zoek.value || "").trim().toLowerCase();
    var gekozen = vkThema.waarden();
    var zichtbaar = 0;
    blokken.forEach(function (b) {
      var naam = (b.getAttribute("data-naam") || "").toLowerCase();
      var maker = (b.getAttribute("data-maker") || "").toLowerCase();
      var bt = b.getAttribute("data-thema") || "";
      var ok = (!q || naam.indexOf(q) !== -1 || maker.indexOf(q) !== -1) &&
        (!gekozen.length || gekozen.indexOf(bt) !== -1);
      b.classList.toggle("verborgen", !ok);
      if (ok) zichtbaar++;
    });
    // letterkoppen verbergen als er niets meer onder staat
    koppen.forEach(function (k) {
      var n = 0, el = k.nextElementSibling;
      while (el && !el.classList.contains("letterkop")) {
        if (el.classList.contains("blok") && !el.classList.contains("verborgen")) n++;
        el = el.nextElementSibling;
      }
      k.classList.toggle("verborgen", n === 0);
    });
    telling.textContent = zichtbaar + (zichtbaar === 1 ? " podcast" : " podcasts");
  }
  zoek.addEventListener("input", ververs);
  vkThema.onChange(ververs);
  ververs();
})();
