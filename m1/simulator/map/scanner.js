export function setupScanner(onPaired) {
  const el = id => document.getElementById(id);
  const dialog = el('scanner');
  const video = el('camera');
  const button = el('start-camera');
  const photo = el('qr-photo');
  const status = el('scan-status');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', {willReadFrequently:true});
  let camera, frame, watch, deadline, request, adapterId;
  let generation = 0;

  function stopCamera() {
    clearTimeout(frame);
    camera?.getTracks().forEach(track => track.stop());
    camera = null;
    video.srcObject = null;
    video.hidden = true;
  }

  function stopGps() {
    clearTimeout(deadline);
    if (watch != null) navigator.geolocation.clearWatch(watch);
    watch = null;
  }

  function reset() {
    generation++;
    stopCamera();
    stopGps();
    request?.abort();
    adapterId = null;
    button.textContent = 'Ouvrir la caméra';
    button.disabled = false;
    photo.disabled = false;
    photo.value = '';
  }

  function retryGps(message) {
    stopGps();
    status.textContent = message;
    button.textContent = 'Réessayer le GPS';
    button.disabled = false;
    photo.disabled = false;
  }

  function captureLocation() {
    const attempt = ++generation;
    stopCamera();
    status.textContent = adapterId+' reconnu · Recherche de la position et de l’altitude GPS…';
    if (!navigator.geolocation) return retryGps('Le GPS nécessite une connexion HTTPS ou localhost.');
    button.disabled = true;
    photo.disabled = true;
    deadline = setTimeout(() => retryGps('Position 3D indisponible. Rapprochez-vous d’une fenêtre ou réessayez à l’extérieur.'), 30000);
    watch = navigator.geolocation.watchPosition(async position => {
      if (generation !== attempt || watch == null) return;
      const {longitude:x, latitude:y, altitude:z, accuracy:accuracy_m} = position.coords;
      if (!Number.isFinite(z)) {
        status.textContent = adapterId+' reconnu · Position obtenue. En attente de l’altitude GPS…';
        return;
      }
      stopGps();
      status.textContent = 'Enregistrement de '+adapterId+'…';
      request = new AbortController();
      try {
        const response = await fetch('/adaptateurs/associer', {method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({adaptateur_id:adapterId, x, y, z, accuracy_m, captured_at:new Date(position.timestamp).toISOString()}),
          signal:request.signal});
        const device = await response.json();
        if (generation !== attempt) return;
        if (!response.ok) throw new Error(device.error || 'Échec de l’association.');
        dialog.close();
        onPaired(device);
      } catch (error) {
        if (generation === attempt) retryGps(error.message || 'Connexion interrompue.');
      }
    }, error => {
      if (generation !== attempt || watch == null) return;
      retryGps(error.code === 1 ? 'Autorisez la localisation pour enregistrer cet adaptateur.' : 'Position GPS indisponible. Réessayez sur place.');
    }, {enableHighAccuracy:true, maximumAge:0, timeout:30000});
  }

  function decode(image,width,height) {
    const scale = Math.min(1,1280/Math.max(width,height));
    canvas.width = Math.max(1,Math.round(width*scale));
    canvas.height = Math.max(1,Math.round(height*scale));
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const pixels = context.getImageData(0,0,canvas.width,canvas.height);
    return window.jsQR(pixels.data,canvas.width,canvas.height)?.data.trim();
  }

  function found(code) {
    if (!/^NABD-\d{4}$/.test(code)) {
      status.textContent = 'Ce QR ne contient pas un identifiant NABD valide.';
      return false;
    }
    adapterId = code;
    captureLocation();
    return true;
  }

  async function startCamera() {
    reset();
    const attempt = generation;
    button.disabled = true;
    status.textContent = 'Autorisez la caméra puis cadrez le QR de l’adaptateur.';
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const media = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      if (generation !== attempt) {media.getTracks().forEach(track => track.stop()); return;}
      camera = media;
      video.srcObject = camera;
      video.hidden = false;
      await video.play();
      function read() {
        if (generation !== attempt) return;
        if (video.readyState >= 2) {
          const code = decode(video,video.videoWidth,video.videoHeight);
          if (code && found(code)) return;
        }
        frame = setTimeout(read,180);
      }
      read();
    } catch {
      if (generation !== attempt) return;
      stopCamera();
      status.textContent = 'Caméra indisponible. Autorisez son accès ou choisissez une photo du QR.';
      button.disabled = false;
    }
  }

  photo.onchange = async () => {
    const file = photo.files[0];
    if (!file) return;
    reset();
    const attempt = generation;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (generation !== attempt) return;
      const code = decode(image,image.naturalWidth,image.naturalHeight);
      if (code) found(code);
      else status.textContent = 'Aucun QR lisible dans cette photo.';
    } catch {
      if (generation === attempt) status.textContent = 'Impossible de lire cette image.';
    } finally {URL.revokeObjectURL(url);}
  };
  button.onclick = () => adapterId ? captureLocation() : startCamera();
  el('scan').onclick = () => {
    status.textContent = '';
    dialog.showModal();
  };
  el('close-scan').onclick = () => dialog.close();
  dialog.addEventListener('close',reset);
  window.addEventListener('pagehide',reset);
}
