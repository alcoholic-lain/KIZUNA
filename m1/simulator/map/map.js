import {streetView} from './street.js';
import {setupScanner} from './scanner.js';

const element = id => document.getElementById(id);
const time = new Intl.DateTimeFormat('fr-FR', {timeZone:'Africa/Tunis', timeStyle:'medium'});
const number = new Intl.NumberFormat('fr-FR', {maximumFractionDigits:1});
const states = {
  economic: {symbol:'●', label:'Économe'},
  elevated: {symbol:'▲', label:'À surveiller'},
  high: {symbol:'◆', label:'Élevée'},
  offline: {symbol:'○', label:'Inactif'},
};
const controls = new Map();
let stream;
let street;
let region;
let selectedId;
let devices = [];
let regions = [];

function svg(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  return node;
}

function createRow(name, subtitle, choose) {
  const row = document.createElement('button');
  row.className = 'row';
  row.innerHTML = '<b aria-hidden="true"></b><span><strong></strong><small></small></span><span class="watts"></span>';
  row.querySelector('strong').textContent = name;
  row.querySelector('small').textContent = subtitle;
  row.onclick = choose;
  element('devices').append(row);
  return {row, icon:row.firstElementChild, value:row.lastElementChild};
}

function cluster(site, choose) {
  const x = (site.longitude - 3.75) * 54;
  const y = (38.25 - site.latitude) * 64;
  const pin = svg('g', {class:'pin cluster', role:'button', tabindex:0, transform:`translate(${x} ${y})`});
  pin.append(svg('circle',{class:'halo'}), svg('text',{'text-anchor':'middle',dy:'.35em'}), svg('title',{}));
  pin.onclick = choose;
  pin.onkeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); choose();}
  };
  element('pins').append(pin);
  return pin;
}

function prune(liveIds) {
  for (const [id,c] of controls) {
    if (liveIds.has(id)) continue;
    c.row.remove();
    if (street) street.remove(id);
    else c.pin?.remove();
    controls.delete(id);
  }
}

function renderRegions() {
  prune(new Set(regions.map(r => r.id)));
  for (const site of regions) {
    let c = controls.get(site.id);
    if (!c) {
      const choose = () => openView(site.id);
      c = createRow(site.city, '', choose);
      if (Number.isFinite(site.latitude)) c.pin = cluster(site, choose);
      controls.set(site.id,c);
      c.icon.textContent = '●';
    }
    if (c.pin) {
      const radius = 1.3*Math.sqrt(site.count);
      const title = site.city+' · '+site.count+' appareils, '+site.active_count+' actifs';
      c.pin.setAttribute('aria-label',title);
      c.pin.querySelector('title').textContent = title;
      c.pin.querySelector('circle').setAttribute('r',radius);
      const label = c.pin.querySelector('text');
      label.textContent = site.count;
      label.setAttribute('font-size',Math.min(13,radius));
    }
    c.row.querySelector('small').textContent = site.active_count+' actifs';
    c.value.textContent = number.format(site.count);
  }
}

function showSelection(d) {
  element('detail').hidden = !d;
  if (!d) return;
  element('identity').textContent = d.name;
  element('device-id').textContent = d.adaptateur_id+' · '+d.city;
  element('power').textContent = d.active ? number.format(d.watts)+' W' : 'Inactif';
  element('comparison').textContent = d.active ? states[d.state].label : 'Aucune mesure en direct';
  element('comparison').className = d.state;
  element('budget').textContent = 'Référence simulée · '+number.format(d.reference_watts)+' W';
  element('sample').textContent = d.active ? 'Mesure · '+time.format(new Date(d.horodatage)) : '';
  const {x,y,z,source,accuracy_m} = d.location;
  element('coordinates').textContent = 'Lon. '+x.toFixed(6)+'° · Lat. '+y.toFixed(6)+'° · Alt. '+number.format(z)+' m';
  element('fix').textContent = source === 'phone_gps' ? 'GPS du téléphone · précision ± '+number.format(accuracy_m)+' m' : 'Position simulée dans un bâtiment cartographié';
  if (d.location.roof) element('fix').textContent += ' · toit indiqué sur la carte';
  element('mark-roof').hidden = source !== 'phone_gps';
}

function closeRoofPicker() {
  street?.pickRoof(null);
  element('roof-instruction').hidden = true;
}

function select(id, zoom=true) {
  closeRoofPicker();
  const old = controls.get(selectedId);
  if (old) for (const node of [old.row,old.pin]) node.setAttribute('aria-pressed','false');
  selectedId = id;
  const d = devices.find(device => device.adaptateur_id === id);
  if (d) {
    const c = controls.get(id);
    for (const node of [c.row,c.pin]) node.setAttribute('aria-pressed','true');
    street.select(d,zoom);
  }
  showSelection(d);
}

function filterList() {
  const term = element('search').value.trim().toLocaleLowerCase('fr');
  let matches = 0;
  for (const d of devices) {
    const row = controls.get(d.adaptateur_id).row;
    row.hidden = !(d.name+' '+d.adaptateur_id).toLocaleLowerCase('fr').includes(term);
    if (!row.hidden) matches++;
  }
  element('empty').hidden = matches !== 0;
}

function renderDevices(preferredId) {
  prune(new Set(devices.map(d => d.adaptateur_id)));
  for (const d of devices) {
    const id = d.adaptateur_id;
    const state = states[d.state];
    let c = controls.get(id);
    if (!c) {
      c = createRow(d.name,id,() => select(id));
      c.pin = street.marker(d);
      controls.set(id,c);
    }
    const position = d.location.roof ?? d.location;
    if (c.x !== position.x || c.y !== position.y || c.fixTime !== d.location.captured_at) {
      street.position(d);
      if (selectedId === id) street.select(d,false);
      c.x = position.x;
      c.y = position.y;
      c.fixTime = d.location.captured_at;
    }
    if (c.state !== d.state) {
      c.state = d.state;
      c.pin.classList.remove(...Object.keys(states));
      c.pin.classList.add(d.state);
      c.pin.textContent = state.symbol;
      c.icon.className = d.state;
      c.icon.textContent = state.symbol;
    }
    c.value.textContent = d.active ? number.format(d.watts)+' W' : 'Inactif';
    c.pin.setAttribute('aria-label', d.name+' · '+id+' · '+c.value.textContent);
  }
  filterList();
  street.fit(devices);
  if (preferredId && controls.has(preferredId)) select(preferredId);
  else if (!controls.has(selectedId)) select((devices.find(d => d.active) ?? devices[0])?.adaptateur_id,false);
  else showSelection(devices.find(d => d.adaptateur_id === selectedId));
}

function openView(regionId, preferredId) {
  const previousRegion = region;
  closeRoofPicker();
  stream?.close();
  street?.close();
  street = null;
  region = regionId;
  selectedId = null;
  devices = [];
  controls.clear();
  element('pins').replaceChildren();
  element('devices').replaceChildren();
  element('devices').scrollTop = 0;
  element('detail').hidden = true;
  element('empty').hidden = true;
  element('search').value = '';
  for (const id of ['search-box','back','bands','street']) element(id).hidden = !region;
  for (const id of ['scale','atlas','credit']) element(id).hidden = Boolean(region);
  const site = regions.find(r => r.id === region);
  element('map-title').textContent = region ? site?.city ?? 'Hors secteurs' : 'Vue nationale';
  element('list-title').textContent = region ? 'Appareils' : 'Régions';
  element('total').textContent = '';
  element('live').textContent = 'Connexion…';
  if (region) {
    street = streetView(site ?? {id:region},select);
    element('back').focus({preventScroll:true});
  } else {
    renderRegions();
    const previous = controls.get(previousRegion);
    (previous?.pin ?? previous?.row)?.focus({preventScroll:true});
  }

  const connection = new EventSource('/api/v1/countries/TN/stream'+(region ? '?region='+encodeURIComponent(region) : ''));
  stream = connection;
  connection.onmessage = ({data}) => {
    if (connection !== stream) return;
    const frame = JSON.parse(data);
    regions = frame.regions;
    devices = frame.devices;
    const count = regions.reduce((sum,r) => sum+r.count,0);
    const active = regions.reduce((sum,r) => sum+r.active_count,0);
    element('summary').textContent = number.format(count)+' appareils enregistrés · '+number.format(active)+' actifs · '+number.format(count-active)+' inactifs';
    element('live').textContent = frame.running ? 'Mesure · '+time.format(new Date(frame.horodatage)) : 'Simulation en pause';
    if (region) {
      element('total').textContent = number.format(devices.length);
      renderDevices(preferredId);
      preferredId = null;
    } else renderRegions();
  };
  connection.onerror = () => {
    if (connection === stream) element('live').textContent = 'Liaison interrompue · Reconnexion…';
  };
}

element('search').oninput = filterList;
element('mark-roof').onclick = () => {
  const device = devices.find(d => d.adaptateur_id === selectedId);
  street.select(device,true);
  element('roof-instruction').hidden = false;
  element('roof-message').textContent = 'Touchez le toit de ce bâtiment. Le relevé GPS sera conservé.';
  element('street').scrollIntoView({block:'nearest'});
  const view = street;
  view.pickRoof(async ({lat:y,lng:x}) => {
    view.pickRoof(null);
    try {
      const response = await fetch('/adaptateurs/batiment', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({adaptateur_id:device.adaptateur_id, captured_at:device.location.captured_at, x, y})});
      if (!response.ok) throw new Error((await response.json()).error);
      if (street === view && selectedId === device.adaptateur_id) closeRoofPicker();
    } catch (error) {
      if (street === view && selectedId === device.adaptateur_id) element('roof-message').textContent = error.message;
    }
  });
};
element('cancel-roof').onclick = closeRoofPicker;
element('back').onclick = () => openView(null);
setupScanner(device => openView(device.region_id,device.adaptateur_id));
openView(null);
