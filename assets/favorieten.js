/* Favorieten en agenda-export.
   Favorieten staan in de browser van de bezoeker zelf (localStorage).
   Ze gaan dus niet mee naar een ander apparaat en zijn weg als iemand
   zijn browsergegevens wist. Daar is bewust voor gekozen: het werkt
   meteen, zonder account en zonder server. */
window.FAV = (function () {
  var SLEUTEL = "podcast-liveshows-favorieten";

  function lees() {
    try {
      var r = window.localStorage.getItem(SLEUTEL);
      return r ? JSON.parse(r) : [];
    } catch (e) { return []; }
  }
  function schrijf(lijst) {
    try { window.localStorage.setItem(SLEUTEL, JSON.stringify(lijst)); } catch (e) {}
  }
  function aan(id) { return lees().indexOf(String(id)) !== -1; }
  function wissel(id) {
    var l = lees(), i = l.indexOf(String(id));
    if (i === -1) l.push(String(id)); else l.splice(i, 1);
    schrijf(l);
    return i === -1;
  }
  function aantal() { return lees().length; }

  function knop(id, bijWijziging) {
    var b = document.createElement("button");
    b.className = "hart" + (aan(id) ? " aan" : "");
    b.type = "button";
    b.innerHTML = aan(id) ? "&#9829;" : "&#9825;";
    b.title = aan(id) ? "Uit favorieten halen" : "Bewaar als favoriet";
    b.setAttribute("aria-label", b.title);
    b.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var nu = wissel(id);
      b.className = "hart" + (nu ? " aan" : "");
      b.innerHTML = nu ? "&#9829;" : "&#9825;";
      b.title = nu ? "Uit favorieten halen" : "Bewaar als favoriet";
      if (bijWijziging) bijWijziging(nu);
    });
    return b;
  }
  return { lees: lees, aan: aan, wissel: wissel, aantal: aantal, knop: knop };
})();

/* Zet een show in je eigen agenda (Apple Agenda, Google Agenda, Outlook). */
window.AGENDA = (function () {
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function opvolgendeDag(iso) {
    var d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }
  function schoon(s) {
    return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;")
                          .replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }
  function bestand(ev) {
    var kaal = ev.iso.replace(/-/g, "");
    var start, eind;
    if (ev.tijd) {
      var u = ev.tijd.split(":");
      start = "DTSTART:" + kaal + "T" + u[0] + u[1] + "00";
      var eindUur = (parseInt(u[0], 10) + 2) % 24;
      eind = "DTEND:" + kaal + "T" + pad(eindUur) + u[1] + "00";
    } else {
      start = "DTSTART;VALUE=DATE:" + kaal;
      eind = "DTEND;VALUE=DATE:" + opvolgendeDag(ev.iso);
    }
    var regels = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Podcast Liveshows//NL",
      "BEGIN:VEVENT",
      "UID:podcast-liveshows-" + ev.id + "@podcast-liveshows.nl",
      start, eind,
      "SUMMARY:" + schoon(ev.titel),
      "LOCATION:" + schoon(ev.zaal + ", " + ev.stad),
      ev.ticket ? "URL:" + schoon(ev.ticket) : "",
      "DESCRIPTION:" + schoon(ev.ticket ? "Tickets: " + ev.ticket : ""),
      "END:VEVENT", "END:VCALENDAR"
    ].filter(Boolean);
    return regels.join("\r\n");
  }
  function download(ev) {
    var blob = new Blob([bestand(ev)], { type: "text/calendar;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (ev.titel || "show").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-" + ev.iso + ".ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  return { download: download, bestand: bestand };
})();
