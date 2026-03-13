

/* ── Service Worker (PWA offline) ── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}


/* Actualiza el badge de conexión en el header */
function updateNet() {
  const dot = document.getElementById('net-dot');
  const txt = document.getElementById('net-txt');
  if (navigator.onLine) {
    dot.className = 'net-dot online';
    txt.textContent = 'ONLINE';
  } else {
    dot.className = 'net-dot offline';
    txt.textContent = 'OFFLINE';
  }
}

updateNet();
window.addEventListener('online',  updateNet);
window.addEventListener('offline', updateNet);

/* Cambia entre pestañas GPS / Cámara */
function switchTab(id, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  el.classList.add('active');
}

/* Muestra un mensaje flotante temporal */
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/* Devuelve la hora actual en formato HH:MM:SS */
function timestamp() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

let watchId = null;

/* Agrega una entrada al log del GPS */
function gpsLog(msg, type = 'info') {
  const log = document.getElementById('gps-log');
  const div = document.createElement('div');
  div.className = 'le';
  div.innerHTML = `<span class="lt">${timestamp()}</span>
                   <span class="lm-${type}">${msg}</span>`;
  log.prepend(div);
  while (log.children.length > 30) log.removeChild(log.lastChild);
}

/* Cambia el estado visual del módulo GPS */
function gpsPill(type, texto) {
  const pill = document.getElementById('gps-pill');
  pill.className = 'status-pill pill-' + type;
  pill.textContent = texto;
}

/* Actualiza todos los campos de la UI con las coordenadas */
function updateGPSUI(coords) {
  document.getElementById('gps-lat').textContent  = coords.latitude.toFixed(6)  + '°';
  document.getElementById('gps-lng').textContent  = coords.longitude.toFixed(6) + '°';
  document.getElementById('gps-alt').textContent  = (coords.altitude  ?? 0).toFixed(1) + ' m';
  document.getElementById('gps-acc').textContent  = (coords.accuracy  ?? 0).toFixed(0) + ' m';
  document.getElementById('gps-spd').textContent  = (coords.speed     ?? 0).toFixed(2) + ' m/s';
  document.getElementById('gps-head').textContent = coords.heading != null
    ? coords.heading.toFixed(1) + '°' : '—';
  document.getElementById('gps-ts').textContent   = new Date().toLocaleString('es-MX');

  // Mostrar mapa de OpenStreetMap centrado en la ubicación
  const lat = coords.latitude;
  const lng = coords.longitude;
  document.getElementById('map-wrap').innerHTML = `
    <iframe
      src="https://www.openstreetmap.org/export/embed.html?bbox=${lng - .005},${lat - .005},${lng + .005},${lat + .005}&layer=mapnik&marker=${lat},${lng}"
      loading="lazy">
    </iframe>`;
}

/* Obtiene la ubicación actual una sola vez */
function getGPS() {
  if (!navigator.geolocation) {
    toast('❌ GPS no disponible en este navegador');
    return;
  }

  gpsPill('warn', 'Obteniendo...');
  gpsLog('Solicitando ubicación...', 'info');

  navigator.geolocation.getCurrentPosition(
    pos => {
      gpsPill('ok', '✓ Obtenido');
      updateGPSUI(pos.coords);
      gpsLog(`Lat: ${pos.coords.latitude.toFixed(5)} | Lng: ${pos.coords.longitude.toFixed(5)}`, 'ok');
      toast('📍 Ubicación obtenida');
    },
    err => {
      gpsPill('error', 'Error');
      gpsLog('Error: ' + err.message, 'err');
      toast('❌ ' + err.message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/* Activa o detiene el seguimiento continuo de ubicación */
function toggleWatch() {
  const btn = document.getElementById('btn-watch');

  if (watchId !== null) {
    // Detener seguimiento
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    btn.textContent = '▶ Seguimiento';
    btn.className = 'btn btn-green';
    gpsPill('idle', 'Detenido');
    gpsLog('Seguimiento detenido', 'info');
    toast('⏹ Seguimiento detenido');
  } else {
    // Iniciar seguimiento
    if (!navigator.geolocation) {
      toast('❌ GPS no disponible');
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      pos => {
        gpsPill('ok', '● Siguiendo');
        updateGPSUI(pos.coords);
        gpsLog(`Watch → ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`, 'ok');
      },
      err => { gpsLog('Error: ' + err.message, 'err'); },
      { enableHighAccuracy: true }
    );

    btn.textContent = '⏹ Detener';
    btn.className = 'btn btn-danger';
    gpsPill('ok', '● Siguiendo');
    gpsLog('Seguimiento iniciado', 'ok');
    toast('▶ Seguimiento activo');
  }
}


let stream       = null; 
let facingFront  = false;

/* Agrega una entrada al log de la cámara */
function camLog(msg, type = 'info') {
  const log = document.getElementById('cam-log');
  const div = document.createElement('div');
  div.className = 'le';
  div.innerHTML = `<span class="lt">${timestamp()}</span>
                   <span class="lm-${type}">${msg}</span>`;
  log.prepend(div);
  while (log.children.length > 30) log.removeChild(log.lastChild);
}

/* Cambia el estado visual del módulo Cámara */
function camPill(type, texto) {
  const pill = document.getElementById('cam-pill');
  pill.className = 'status-pill pill-' + type;
  pill.textContent = texto;
}

/* Activa o desactiva la cámara */
async function toggleCam() {
  const btn  = document.getElementById('btn-cam');
  const feed = document.getElementById('cam-feed');
  const wrap = document.getElementById('cam-wrap');

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    feed.style.display = 'none';
    wrap.innerHTML = `
      <span class="cam-icon"></span>
      <span>Presiona "Activar cámara"</span>
      <video id="cam-feed" autoplay playsinline muted></video>`;
    btn.textContent = '▶ Activar cámara';
    btn.className   = 'btn btn-green';
    document.getElementById('btn-flip').disabled = true;
    document.getElementById('btn-snap').disabled = true;
    camPill('idle', 'Inactivo');
    document.getElementById('cam-facing').textContent = '—';
    document.getElementById('cam-res').textContent    = '—';
    document.getElementById('cam-fps').textContent    = '—';
    camLog('Cámara desactivada', 'info');
    return;
  }

  // Encender cámara
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingFront ? 'user' : 'environment', width: 640 },
      audio: false
    });

    const f = document.getElementById('cam-feed');
    f.srcObject     = stream;
    f.style.display = 'block';
    wrap.style.padding = '0';

    btn.textContent = '⏹ Cerrar cámara';
    btn.className   = 'btn btn-danger';
    document.getElementById('btn-flip').disabled = false;
    document.getElementById('btn-snap').disabled = false;
    camPill('ok', '✓ Activa');

    document.getElementById('cam-perm').textContent   = 'Concedido ✓';
    document.getElementById('cam-facing').textContent = facingFront ? 'Frontal' : 'Trasera';

    const settings = stream.getVideoTracks()[0].getSettings();
    document.getElementById('cam-res').textContent = `${settings.width ?? '—'}×${settings.height ?? '—'}`;
    document.getElementById('cam-fps').textContent = settings.frameRate ? settings.frameRate + 'fps' : '—';

    camLog(`Cámara ${facingFront ? 'frontal' : 'trasera'} activada`, 'ok');
    toast(' Cámara activa');

  } catch (e) {
    camPill('error', 'Denegado');
    document.getElementById('cam-perm').textContent = 'Denegado ✗';
    camLog('Permiso denegado: ' + e.message, 'err');
    toast('❌ ' + e.message);
  }
}

/* Cambia entre cámara frontal y trasera */
async function flipCam() {
  facingFront = !facingFront;

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  const btn = document.getElementById('btn-cam');
  btn.textContent = '▶ Activar cámara';
  btn.className   = 'btn btn-green';
  document.getElementById('btn-flip').disabled = true;
  document.getElementById('btn-snap').disabled = true;
  document.getElementById('cam-feed').style.display = 'none';

  await toggleCam();
}

/* Captura una foto del stream actual */
function takeSnap() {
  const feed    = document.getElementById('cam-feed');
  const canvas  = document.getElementById('snap-canvas');
  const preview = document.getElementById('snap-preview');

  canvas.width  = feed.videoWidth;
  canvas.height = feed.videoHeight;
  canvas.getContext('2d').drawImage(feed, 0, 0);

  preview.src          = canvas.toDataURL('image/jpeg', 0.85);
  preview.style.display = 'block';

  camLog(`Foto capturada — ${canvas.width}×${canvas.height}`, 'ok');
  toast(' Foto capturada');
}
