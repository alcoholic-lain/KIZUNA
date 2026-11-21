// Local vector extracts keep the demonstration neighborhoods usable offline.
const packs = new Map();
const footprintStyle = {color:'#938775', weight:1, fillColor:'#d3c8b4', fillOpacity:0.9, interactive:false};
const latLng = ([x,y]) => [y,x];
const markerPoint = device => {
  const {x,y} = device.location.roof ?? device.location;
  return [y,x];
};

export function streetView(site, onSelect) {
  const map = L.map('street', {minZoom:2, maxZoom:21, zoomSnap:0.25})
    .setView([site.latitude ?? 34, site.longitude ?? 10], 17);
  const credit = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>';
  map.attributionControl.addAttribution(credit);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxNativeZoom:19, maxZoom:21});
  const homes = new Map();
  const markers = new Map();
  let coverage;
  let closed = false;
  let selected;
  let accuracy;
  let previousRoof;
  let fitted = false;
  let roofClick;

  function updateTiles() {
    // Beyond the bundled neighborhood, use the street map at the actual GPS fix.
    if (!coverage || !coverage.contains(map.getCenter())) tiles.addTo(map);
    else tiles.remove();
  }
  if (site.id !== 'outside') {
    if (!packs.has(site.id)) {
      packs.set(site.id, fetch('/neighborhoods/'+site.id+'.json').then(response => {
        if (!response.ok) throw new Error();
        return response.json();
      }).catch(error => {packs.delete(site.id); throw error;}));
    }
    packs.get(site.id).then(pack => {
      if (closed) return;
      const [west,south,east,north] = pack.bounds;
      coverage = L.latLngBounds([south,west],[north,east]);
      for (const road of pack.streets) {
        L.polyline(road.map(latLng), {color:'#fffdf6', weight:4, interactive:false}).addTo(map);
      }
      L.polygon(pack.buildings.map(poly => poly.map(ring => ring.map(latLng))),
        {...footprintStyle, fillColor:'#dcd4c5', color:'#b5ab98'}).addTo(map);
      for (const home of pack.homes) {
        if (homes.has(home.osm_id)) continue;
        homes.set(home.osm_id, L.polygon(home.rings.map(ring => ring.map(latLng)), footprintStyle).addTo(map));
      }
      if (selected) highlight(selected);
      updateTiles();
      map.on('moveend', updateTiles);
    }).catch(() => {if (!closed) tiles.addTo(map);});
  } else tiles.addTo(map);

  function highlight(device) {
    selected = device;
    previousRoof?.setStyle(footprintStyle);
    previousRoof = homes.get(device.location.building_id);
    previousRoof?.setStyle({color:'#306750', fillColor:'#c9ddaa', weight:2});
    accuracy?.remove();
    accuracy = null;
    if (device.location.source === 'phone_gps') {
      accuracy = L.circle([device.latitude,device.longitude], {radius:device.location.accuracy_m,
        color:'#3867a0', weight:1, dashArray:'4 4', fillOpacity:0.07, interactive:false}).addTo(map);
    }
  }

  return {
    marker(device) {
      const id = device.adaptateur_id;
      const marker = L.marker(markerPoint(device), {
        icon:L.divIcon({className:'roof-pin', iconSize:[13,13], iconAnchor:[6.5,6.5]}),
        title:id, alt:id, riseOnHover:true,
      }).addTo(map).on('click', () => onSelect(id));
      markers.set(id, marker);
      return marker.getElement();
    },
    remove(id) {markers.get(id)?.remove(); markers.delete(id);},
    position(device) {markers.get(device.adaptateur_id).setLatLng(markerPoint(device));},
    pickRoof(callback) {
      if (roofClick) map.off('click',roofClick);
      roofClick = callback ? e => callback(e.latlng) : null;
      map.getContainer().classList.toggle('picking',Boolean(callback));
      if (roofClick) map.on('click',roofClick);
    },
    fit(devices) {
      if (!fitted && devices.length) {
        map.fitBounds(devices.map(markerPoint), {padding:[22,22],maxZoom:18,animate:false});
        fitted = true;
      }
    },
    select(device, zoom) {
      if (selected) markers.get(selected.adaptateur_id)?.setZIndexOffset(0);
      markers.get(device.adaptateur_id)?.setZIndexOffset(1000);
      highlight(device);
      if (zoom) map.setView(markerPoint(device), Math.max(map.getZoom(),19), {animate:false});
    },
    close() {closed = true; map.remove();},
  };
}
