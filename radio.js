const stations = [
  { name: "Clarín", frequency: "580", category: "AM Uruguay", url: "https://radioclarin-zikoxweb.radioca.st/stream" },
  { name: "Rural", frequency: "610", category: "AM Uruguay", url: "https://radiolatina.live/9206/stream" },
  { name: "Sodre Clásica", frequency: "650", category: "AM Uruguay", url: "https://radios.iwstreaming.uy/8032/stream" },
  { name: "Sarandí", frequency: "690", category: "AM Uruguay", url: "https://radiolatina.live:10977/sarandi" },
  { name: "Oriental", frequency: "770", category: "AM Uruguay", url: "http://radiolatina.live:7906/1" },
  { name: "El Espectador", frequency: "810", category: "AM Uruguay", url: "https://espectador-1.nty.uy" },
  { name: "Carve", frequency: "850", category: "AM Uruguay", url: "https://streamingcasazorrilla.innovanexo.com:8000/radiocarve850.mp3" },
  { name: "Sport 890", frequency: "890", category: "AM Uruguay", url: "https://alba-uy-sport890-sport890.stream.mediatiquestream.com/index.m3u8" },
  { name: "Montecarlo", frequency: "930", category: "AM Uruguay", url: "https://streamingcasazorrilla.innovanexo.com:8000/montecarlo.mp3" },
  { name: "Universal", frequency: "970", category: "AM Uruguay", url: "https://970universal-3.nty.uy/stream" },
  { name: "CHUI FM", frequency: "87.9", category: "FM Uruguay", url: "https://stm11.xcast.com.br:11288/stream" },
  { name: "Cadena de la Costa", frequency: "88.3", category: "FM Uruguay", url: "https://s3.netradiofm.com/p/6112/stream" },
  { name: "Atlántica", frequency: "89.3", category: "FM Uruguay", url: "https://atlanticafm.radioca.st/stream" },
  { name: "Activa Rivera", frequency: "89.9", category: "FM Uruguay", url: "https://radios.iwstreaming.uy/8010/stream" },
  { name: "Futura", frequency: "91.1", category: "FM Uruguay", url: "http://radios-uy.cdn.nedmedia.io/radios/uy/futura.m3u8" },
  { name: "Urbana", frequency: "92.5", category: "FM Uruguay", url: "http://streamingsc.urbana.com.uy:8000/" },
  { name: "Océano", frequency: "93.9", category: "FM Uruguay", url: "https://oceano-2.nty.uy/netradio/listen.mp3:8000/" },
  { name: "Acuario", frequency: "94.9", category: "FM Uruguay", url: "https://radio25-zikoxstream.radioca.st/stream" },
  { name: "Azul", frequency: "101.9", category: "FM Uruguay", url: "https://azul-3.nty.uy/" },
  { name: "Radiocero", frequency: "104.3", category: "FM Uruguay", url: "https://radiolatina.live:10966/stream" },
  { name: "Continental", frequency: "AM 590", category: "Internacional", url: "https://edge02.radiohdvivo.com/stream/continental" },
  { name: "Radio 10", frequency: "AM 710", category: "Internacional", url: "https://radio10.stweb.tv/radio10/live/playlist.m3u8" },
  { name: "Mitre", frequency: "AM 790", category: "Internacional", url: "https://24443.live.streamtheworld.com/AM790_56.mp3" },
  { name: "RNE España", frequency: "ONLINE", category: "Internacional", url: "https://rtvelivestream.akamaized.net/rtvesec/rne/rne_re_main.m3u8" },
  { name: "Francia Internacional", frequency: "ONLINE", category: "Internacional", url: "https://rfienespagnol64k.ice.infomaniak.ch/rfienespagnol-64.mp3" }
].map((station, index) => ({ ...station, id: index, favorite: false }));

const audio = document.getElementById("radio-audio");
const $ = id => document.getElementById(id);
let activeStation = null;
let activeCategory = "Todas";
let playing = false;
const favorites = new Set(JSON.parse(localStorage.getItem("futbol-uy-radio-favorites") || "[]"));

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

function categories() {
  return ["Todas", ...new Set(stations.map(station => station.category)), "Favoritas"];
}

function renderTabs() {
  $("radio-tabs").replaceChildren();
  categories().forEach(category => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `radio-tab${activeCategory === category ? " active" : ""}`;
    tab.textContent = category;
    tab.addEventListener("click", () => { activeCategory = category; renderTabs(); renderStations(); });
    $("radio-tabs").appendChild(tab);
  });
}

function renderStations() {
  const query = $("radio-search").value.toLocaleLowerCase().trim();
  const visible = stations.filter(station => {
    const categoryMatch = activeCategory === "Todas" || (activeCategory === "Favoritas" ? favorites.has(station.id) : station.category === activeCategory);
    return categoryMatch && `${station.name} ${station.frequency}`.toLocaleLowerCase().includes(query);
  });
  const grid = $("station-grid");
  grid.replaceChildren();
  visible.forEach(station => {
    const item = document.createElement("article");
    item.className = `station-card${activeStation?.id === station.id ? " playing" : ""}`;
    item.innerHTML = `<button class="station-main" type="button"><span class="station-badge">${initials(station.name)}</span><span class="station-details"><strong></strong><small></small><em></em></span><span class="station-signal">${activeStation?.id === station.id && playing ? "▮▮" : "▶"}</span></button><button class="station-favorite" type="button" aria-label="Favorita">${favorites.has(station.id) ? "★" : "☆"}</button>`;
    item.querySelector("strong").textContent = station.name;
    item.querySelector("small").textContent = `${station.category} · ${station.frequency}`;
    item.querySelector("em").textContent = activeStation?.id === station.id && playing ? "AL AIRE" : "SELECCIONAR";
    item.querySelector(".station-main").addEventListener("click", () => playStation(station));
    item.querySelector(".station-favorite").addEventListener("click", () => toggleFavorite(station));
    grid.appendChild(item);
  });
  if (!visible.length) grid.innerHTML = '<p class="radio-empty">No hay emisoras para esta sintonía.</p>';
}

function playStation(station) {
  if (activeStation?.id === station.id && playing) return pauseRadio();
  activeStation = station;
  audio.src = station.url;
  audio.load();
  audio.play().then(() => { playing = true; updatePlayer(); renderStations(); }).catch(() => {
    playing = false;
    $("radio-status").textContent = "SEÑAL NO DISPONIBLE";
    $("radio-title").textContent = "Probá otra emisora";
    updatePlayer();
    renderStations();
  });
  updatePlayer();
  renderStations();
}

function pauseRadio() { audio.pause(); playing = false; updatePlayer(); renderStations(); }
function toggleFavorite(station) { favorites.has(station.id) ? favorites.delete(station.id) : favorites.add(station.id); localStorage.setItem("futbol-uy-radio-favorites", JSON.stringify([...favorites])); renderStations(); }
function updatePlayer() {
  $("radio-title").textContent = activeStation ? activeStation.name.toUpperCase() : "RADIO EN ESPERA";
  $("radio-status").textContent = activeStation ? (playing ? `AL AIRE · ${activeStation.category}` : "EN PAUSA") : "SELECCIONÁ UNA EMISORA";
  $("radio-frequency").textContent = activeStation?.frequency || "--.--";
  $("radio-play").textContent = playing ? "❚❚" : "▶";
}

$("radio-search").addEventListener("input", renderStations);
$("radio-play").addEventListener("click", () => activeStation && (playing ? pauseRadio() : playStation(activeStation)));
$("radio-volume").addEventListener("input", event => { audio.volume = Number(event.target.value); });
audio.volume = .8;
audio.addEventListener("ended", () => { playing = false; updatePlayer(); renderStations(); });
setInterval(() => { $("radio-clock").textContent = new Date().toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }); }, 1000);
renderTabs();
renderStations();
