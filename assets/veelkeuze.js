/* Herbruikbare aanvink-dropdown voor filters die meerdere waarden tegelijk
   toestaan (bijvoorbeeld drie maanden of twee provincies tegelijk). Werkt met
   een knop die een paneel met aanvinkvakjes open/dicht klapt. */
var VEELKEUZE = (function () {
  "use strict";

  var ALLE_SLUIT = [];
  function alleSluiten() {
    ALLE_SLUIT.forEach(function (f) { f(); });
  }
  document.addEventListener("click", alleSluiten);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") alleSluiten();
  });

  // knopId: id van de knop, paneelId: id van het paneel waar de vakjes in komen
  // (mag al vakjes bevatten, bijvoorbeeld door de server gerenderd).
  // opties.alles: knoptekst als er niets is aangevinkt.
  // opties.labelVan: functie die een waarde omzet naar leesbare tekst.
  function maak(knopId, paneelId, opties) {
    opties = opties || {};
    var knop = document.getElementById(knopId);
    var paneel = document.getElementById(paneelId);
    var gekozen = [];
    var onChangeFn = null;
    var labelVan = opties.labelVan;

    function label() {
      if (!gekozen.length) return opties.alles || "Alles";
      if (gekozen.length <= 2) {
        return gekozen.map(function (w) { return labelVan ? labelVan(w) : w; }).join(", ");
      }
      return gekozen.length + " gekozen";
    }
    function werkKnopBij() {
      knop.textContent = label();
      knop.classList.toggle("gekozen", gekozen.length > 0);
    }
    function koppel(cb) {
      cb.addEventListener("change", function () {
        var i = gekozen.indexOf(cb.value);
        if (cb.checked && i === -1) gekozen.push(cb.value);
        if (!cb.checked && i !== -1) gekozen.splice(i, 1);
        werkKnopBij();
        if (onChangeFn) onChangeFn(gekozen.slice());
      });
    }
    Array.prototype.forEach.call(paneel.querySelectorAll("input[type=checkbox]"), koppel);

    function sluit() {
      paneel.hidden = true;
      knop.setAttribute("aria-expanded", "false");
    }
    ALLE_SLUIT.push(sluit);

    knop.addEventListener("click", function (e) {
      e.stopPropagation();
      var wasOpen = !paneel.hidden;
      alleSluiten();
      if (!wasOpen) { paneel.hidden = false; knop.setAttribute("aria-expanded", "true"); }
    });
    paneel.addEventListener("click", function (e) { e.stopPropagation(); });

    werkKnopBij();

    return {
      // (opnieuw) vullen met vakjes, bijvoorbeeld nadat de data is ingelezen.
      vul: function (waarden, labelFn) {
        if (labelFn) labelVan = labelFn;
        paneel.innerHTML = "";
        waarden.forEach(function (w) {
          var lab = document.createElement("label");
          lab.className = "veelkeuze-optie";
          var cb = document.createElement("input");
          cb.type = "checkbox";
          cb.value = w;
          koppel(cb);
          lab.appendChild(cb);
          lab.appendChild(document.createTextNode(" " + (labelVan ? labelVan(w) : w)));
          paneel.appendChild(lab);
        });
        werkKnopBij();
      },
      waarden: function () { return gekozen.slice(); },
      zet: function (waarden) {
        gekozen = waarden.slice();
        Array.prototype.forEach.call(paneel.querySelectorAll("input"), function (cb) {
          cb.checked = gekozen.indexOf(cb.value) !== -1;
        });
        werkKnopBij();
      },
      wis: function () { this.zet([]); },
      onChange: function (fn) { onChangeFn = fn; }
    };
  }

  return { maak: maak };
})();
