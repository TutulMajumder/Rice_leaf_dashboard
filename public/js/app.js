"use strict";
const $ = (id) => document.getElementById(id);
const state = { telemetry: null, file: null, entries: [], charts: { temp: null, moisture: null }, phoneLocationReady: false };
const toast = (message, error = false) => {
    const element = $('toastMessage');
    element.textContent = message;
    element.style.borderColor = error ? 'var(--red-accent)' : 'var(--primary-green)';
    element.classList.add('show');
    window.setTimeout(() => element.classList.remove('show'), 3000);
};
const value = (id, text) => { const element = document.getElementById(id); if (element)
    element.textContent = String(text); };
const field = (id, text) => { const element = document.getElementById(id); if (element)
    element.value = String(text); };
function updateTelemetry(data) {
    state.telemetry = data;
    value('valAirTemp', data.temperature);
    value('valAirHum', data.humidity);
    value('valSoilTemp', data.soil_temperature);
    value('valMoistPct', `${data.soil_moisture_pct}%`);
    value('valMoistRaw', data.soil_moisture);
    value('valVoltage', data.voltage.toFixed(2));
    value('valCurrent', Number(data.current).toFixed(0));
    value('valPower', Number(data.power_mw).toFixed(2));
    value('snapTemp', `${data.temperature}°C`);
    value('snapHum', `${data.humidity}%`);
    value('snapSoilTemp', `${data.soil_temperature}°C`);
    value('snapMoist', `${data.soil_moisture} (${data.soil_moisture_pct}%)`);
    value('snapVolt', `${data.voltage.toFixed(2)}V`);
    value('snapCurr', `${data.current.toFixed(0)}mA`);
    value('hudSensorTag', `${data.temperature}°C | ${data.humidity}% RH | ${data.soil_moisture_pct}% SM`);
    const status = data.diagnostics?.overall ?? 'HEALTHY';
    value('connectionStatusBadge', status === 'CRITICAL' ? 'ESP32 LINK ALERT' : 'ESP32 LINK ONLINE');
}
function clearTelemetry() {
    state.telemetry = null;
    ['valAirTemp', 'valAirHum', 'valSoilTemp', 'valMoistPct', 'valMoistRaw', 'valVoltage', 'valCurrent', 'valPower', 'snapTemp', 'snapHum', 'snapSoilTemp', 'snapMoist', 'snapVolt', 'snapCurr', 'hudSensorTag'].forEach(id => value(id, 'Waiting for hardware data'));
    value('connectionStatusBadge', 'WAITING FOR ESP32');
}
function updateNodeOptions(nodeIds) {
    const select = $('nodeSelect');
    const current = select.value;
    select.innerHTML = nodeIds.length ? '' : '<option value="">No hardware node online</option>';
    nodeIds.forEach(nodeId => { const option = document.createElement('option'); option.value = nodeId; option.textContent = nodeId; select.appendChild(option); });
    if (nodeIds.includes(current))
        select.value = current;
}
function updateCharts(history) {
    const labels = history.map(item => new Date(item.timestamp).toLocaleTimeString());
    const emptyMessage = history.length < 2 ? 'Waiting for real ESP32 data...' : '';
    document.querySelectorAll('.chart-empty-state').forEach(item => item.remove());
    if (history.length < 2) {
        document.querySelectorAll('.chart-canvas-container').forEach(container => { const message = document.createElement('div'); message.className = 'chart-empty-state'; message.textContent = emptyMessage; container.appendChild(message); });
    }
    if (typeof Chart === 'undefined' || history.length < 2)
        return;
    state.charts.temp?.destroy();
    state.charts.moisture?.destroy();
    const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#718096' }, grid: { color: 'rgba(255,255,255,.05)' } }, y: { ticks: { color: '#718096' }, grid: { color: 'rgba(255,255,255,.05)' } } } };
    state.charts.temp = new Chart(document.getElementById('tempChart'), { type: 'line', data: { labels, datasets: [{ label: 'Air Temp', data: history.map(item => Number(item.temperature)), borderColor: '#f59e0b', tension: .35 }, { label: 'Soil Temp', data: history.map(item => item.soil_temperature), borderColor: '#10b981', tension: .35 }] }, options });
    state.charts.moisture = new Chart(document.getElementById('moisturePowerChart'), { type: 'line', data: { labels, datasets: [{ label: 'Humidity', data: history.map(item => Number(item.humidity)), borderColor: '#06b6d4', tension: .35 }, { label: 'Soil Moisture', data: history.map(item => item.soil_moisture_pct), borderColor: '#3b82f6', tension: .35 }, { label: 'Power / 10', data: history.map(item => item.power_mw / 10), borderColor: '#8b5cf6', tension: .35 }] }, options });
}
async function pollTelemetry() {
    try {
        const selectedNode = $('nodeSelect').value;
        const response = await fetch(selectedNode ? `/api/sensor-data?node_id=${encodeURIComponent(selectedNode)}` : '/api/sensor-data');
        const data = await response.json();
        updateNodeOptions((data.active_nodes ?? []).map(node => node.node_id));
        if (data.latest)
            updateTelemetry(data.latest);
        else
            clearTelemetry();
        updateCharts(data.history ?? []);
    }
    catch {
        toast('Telemetry connection unavailable', true);
    }
}
function renderEntries(entries) {
    const body = $('datasetTableBody');
    body.innerHTML = entries.length ? '' : '<tr><td colspan="11">No samples saved yet.</td></tr>';
    entries.forEach(entry => {
        const row = document.createElement('tr');
        const image = String(entry.image_url ?? '');
        row.innerHTML = `<td>${entry.sample_id ?? ''}</td><td><img src="${image}" class="table-thumb" alt="${entry.sample_id ?? 'sample'}"></td><td>${new Date(String(entry.timestamp)).toLocaleString()}</td><td>${entry.node_id ?? ''}</td><td>${entry.crop_type ?? ''}</td><td>${entry.disease_label ?? ''}</td><td>${entry.severity ?? ''}</td><td>${entry.gps_latitude ?? ''}, ${entry.gps_longitude ?? ''}</td><td>${entry.temperature_c ?? ''}°C / ${entry.humidity_pct ?? ''}%</td><td>${entry.soil_temperature_c ?? ''}°C / ${entry.soil_moisture_pct ?? ''}%</td><td>${entry.voltage_v ?? ''}V / ${entry.current_ma ?? ''}mA</td>`;
        body.appendChild(row);
    });
}
async function loadDataset() {
    const response = await fetch('/api/dataset');
    const data = await response.json();
    state.entries = data.entries ?? [];
    renderEntries(state.entries);
}
function initMap() {
    const mapElement = document.getElementById('gpsMapContainer');
    if (!mapElement || typeof L === 'undefined')
        return;
    const latitude = Number($('inputLat').value);
    const longitude = Number($('inputLng').value);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
        return;
    const map = L.map(mapElement).setView([latitude, longitude], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
    marker.on('dragend', () => { const point = marker.getLatLng(); $('inputLat').value = point.lat.toFixed(4); $('inputLng').value = point.lng.toFixed(4); });
}
function updateGpsFromPhone() {
    if (!navigator.geolocation) {
        toast('Phone GPS is not available', true);
        return;
    }
    navigator.geolocation.getCurrentPosition(position => {
        const altitude = position.coords.altitude;
        if (altitude === null || !Number.isFinite(altitude)) {
            toast('Phone did not provide real altitude; enable precise location', true);
            return;
        }
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        $('inputLat').value = latitude;
        $('inputLng').value = longitude;
        $('inputAlt').value = altitude.toFixed(1);
        state.phoneLocationReady = true;
        value('hudGpsTag', `${latitude}°N, ${longitude}°E`);
        value('gpsDisplayBadge', `${latitude}°N, ${longitude}°E`);
        toast('Phone GPS location added');
    }, () => toast('Allow location access to use phone GPS', true), { enableHighAccuracy: true, timeout: 10000 });
}
function init() {
    value('clockTime', new Date().toUTCString().replace('GMT', 'UTC'));
    window.setInterval(() => value('clockTime', new Date().toUTCString().replace('GMT', 'UTC')), 1000);
    document.querySelectorAll('.tab-btn').forEach(button => button.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn, .tab-content').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.tab ?? '')?.classList.add('active');
    }));
    const galleryInput = $('leafFileInput');
    const cameraInput = $('leafCameraInput');
    const handleImage = (input) => { state.file = input.files?.[0] ?? null; if (state.file) {
        const preview = $('leafImagePreview');
        preview.src = URL.createObjectURL(state.file);
        preview.hidden = false;
        $('leafPreviewEmpty').hidden = true;
        toast(`Rice leaf image ready: ${state.file.name}`);
    } };
    $('btnBrowseFile').addEventListener('click', event => { event.stopPropagation(); galleryInput.click(); });
    $('btnOpenCamera').addEventListener('click', event => { event.stopPropagation(); cameraInput.click(); });
    $('dropzoneContainer').addEventListener('click', event => { if (!event.target.closest('button'))
        cameraInput.click(); });
    galleryInput.addEventListener('change', () => handleImage(galleryInput));
    cameraInput.addEventListener('change', () => handleImage(cameraInput));
    updateGpsFromPhone();
    $('nodeSelect').addEventListener('change', () => void pollTelemetry());
    $('datasetRecordForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = new FormData();
        if (!state.telemetry) {
            toast('Wait for live ESP32 telemetry before saving', true);
            return;
        }
        if (!state.phoneLocationReady) {
            toast('Wait for phone GPS latitude, longitude, and altitude', true);
            return;
        }
        form.append('node_id', $('nodeSelect').value);
        ['inputCropType:crop_type', 'inputGrowthStage:growth_stage', 'inputDiseaseLabel:disease_label', 'inputSeverity:severity', 'inputLat:gps_latitude', 'inputLng:gps_longitude', 'inputAlt:gps_altitude', 'inputNotes:notes'].forEach(item => { const [id, key] = item.split(':'); form.append(key, $(id).value); });
        if (state.telemetry) {
            form.append('temperature_c', String(state.telemetry.temperature));
            form.append('humidity_pct', String(state.telemetry.humidity));
            form.append('soil_temperature_c', String(state.telemetry.soil_temperature));
            form.append('soil_moisture_raw', String(state.telemetry.soil_moisture));
            form.append('voltage_v', String(state.telemetry.voltage));
            form.append('current_ma', String(state.telemetry.current));
        }
        if (!state.file) {
            toast('Take or select a rice leaf image first', true);
            return;
        }
        form.append('image', state.file);
        const response = await fetch('/api/dataset/entry', { method: 'POST', body: form });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            toast(error.error ?? 'Could not save sample', true);
            return;
        }
        toast('Sample saved to dataset');
        await loadDataset();
    });
    initMap();
    void pollTelemetry();
    window.setInterval(() => void pollTelemetry(), 5000);
    void loadDataset();
}
document.addEventListener('DOMContentLoaded', init);
