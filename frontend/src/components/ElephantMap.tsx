import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { ElephantGps, HistoryPoint } from '../types';

// Pin Posisi Aktif / Akhir (🐘 Electric Blue Gradient)
const elephantIcon = L.divIcon({
  html: `<div style="background: linear-gradient(135deg, #1ea7fd 0%, #2b2eff 100%); border: 3px solid #FFFFFF; border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 18px rgba(37, 99, 235, 0.55); font-size: 20px;">🐘</div>`,
  className: 'custom-elephant-pin',
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -21],
});

// Pin Titik Keberangkatan Awal (Start - Hijau)
const startIcon = L.divIcon({
  html: `<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 2.5px solid #FFFFFF; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5); color: #fff; font-weight: 700; font-size: 12px;">S</div>`,
  className: 'custom-start-pin',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});

// Pin Animasi Playback (Ketika memutar ulang rute perjalanan)
const playbackIcon = L.divIcon({
  html: `<div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border: 3px solid #FFFFFF; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(234, 88, 12, 0.65); font-size: 19px;">🐘</div>`,
  className: 'custom-playback-pin',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

interface ElephantMapProps {
  elephant: ElephantGps | null;
  history: HistoryPoint[];
  darkMode?: boolean;
  focusCoord?: [number, number] | null;
  playbackPoint?: HistoryPoint | null;
  selectedDate?: string;
}

const MapController: React.FC<{
  focusCoord: [number, number] | null;
  playbackPoint: HistoryPoint | null;
  history: HistoryPoint[];
  selectedDate?: string;
}> = ({ focusCoord, playbackPoint, history, selectedDate }) => {
  const map = useMap();

  useEffect(() => {
    if (focusCoord && focusCoord[0] !== 0 && focusCoord[1] !== 0) {
      map.setView(focusCoord, Math.max(map.getZoom(), 16));
    }
  }, [focusCoord, map]);

  useEffect(() => {
    if (playbackPoint && playbackPoint.latitude !== 0 && playbackPoint.longitude !== 0) {
      map.panTo([playbackPoint.latitude, playbackPoint.longitude]);
    }
  }, [playbackPoint, map]);

  useEffect(() => {
    const validPts = history.filter((p) => p.latitude !== 0 && p.longitude !== 0);
    if (validPts.length > 1) {
      const bounds = L.latLngBounds(validPts.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    } else if (validPts.length === 1) {
      map.setView([validPts[0].latitude, validPts[0].longitude], 15);
    }
  }, [selectedDate, history.length, map]);

  return null;
};

export const ElephantMap: React.FC<ElephantMapProps> = ({
  elephant,
  history,
  darkMode = false,
  focusCoord = null,
  playbackPoint = null,
  selectedDate = 'all',
}) => {
  const validHistory = history.filter((pt) => pt.latitude !== 0 && pt.longitude !== 0);
  const hasValidElephantCoord =
    elephant && elephant.latitude !== 0 && elephant.longitude !== 0;

  const defaultCenter: [number, number] = hasValidElephantCoord
    ? [elephant!.latitude, elephant!.longitude]
    : validHistory.length > 0
      ? [
          validHistory[validHistory.length - 1].latitude,
          validHistory[validHistory.length - 1].longitude,
        ]
      : [-6.946412, 107.654245];

  const polylineCoords: [number, number][] = validHistory.map((pt) => [
    pt.latitude,
    pt.longitude,
  ]);

  const startPoint = validHistory.length > 0 ? validHistory[0] : null;
  const endPoint =
    validHistory.length > 0 ? validHistory[validHistory.length - 1] : null;

  // Sampling waypoints sepanjang rute agar peta tetap ringan namun informatif
  const stepStride = Math.max(1, Math.floor(validHistory.length / 40));
  const sampledWaypoints = validHistory.filter((_, idx) => idx % stepStride === 0);

  const tileUrl = darkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={defaultCenter}
        zoom={14}
        scrollWheelZoom={true}
        attributionControl={false}
        className="w-full h-full"
      >
        <TileLayer
          key={darkMode ? 'dark-tiles' : 'light-tiles'}
          url={tileUrl}
        />

        {/* Garis Jejak Perjalanan (Polyline Rute) */}
        {polylineCoords.length > 1 && (
          <>
            {/* Glow outline polyline */}
            <Polyline
              positions={polylineCoords}
              pathOptions={{
                color: darkMode ? '#1e40af' : '#93c5fd',
                weight: 8,
                opacity: 0.45,
              }}
            />
            {/* Main route polyline */}
            <Polyline
              positions={polylineCoords}
              pathOptions={{
                color: '#2563eb',
                weight: 4,
                opacity: 0.95,
              }}
            />
          </>
        )}

        {/* Titik-titik Waypoint Sepanjang Rute (Biru = Bergerak, Oranye = Kecepatan Tinggi) */}
        {sampledWaypoints.map((pt, idx) => (
          <CircleMarker
            key={pt._id || idx}
            center={[pt.latitude, pt.longitude]}
            radius={pt.speed > 25 ? 5 : 3.5}
            pathOptions={{
              color: '#ffffff',
              weight: 1.5,
              fillColor: pt.speed > 25 ? '#f59e0b' : '#1ea7fd',
              fillOpacity: 0.9,
            }}
          >
            <Popup className="text-slate-800 font-sans">
              <div className="text-xs space-y-1">
                <div className="font-bold text-blue-600">
                  Titik Rute #{idx * stepStride + 1}
                </div>
                <div>
                  <strong>Waktu:</strong> {new Date(pt.fixTime).toLocaleString('id-ID')}
                </div>
                <div>
                  <strong>Kecepatan:</strong> {pt.speed} km/jam ({pt.course}°)
                </div>
                <div>
                  <strong>Sinyal:</strong>{' '}
                  {pt.dataType === 2 ? 'LBS BTS Seluler' : 'Satelit GPS Murni'}
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  {pt.latitude.toFixed(6)}, {pt.longitude.toFixed(6)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Marker Titik Awal Keberangkatan (Start Pin - S) */}
        {startPoint && (
          <Marker
            position={[startPoint.latitude, startPoint.longitude]}
            icon={startIcon}
          >
            <Popup className="text-slate-800 font-sans">
              <div className="text-xs space-y-1">
                <div className="font-bold text-emerald-600">
                  🏁 Titik Awal Perjalanan (Start)
                </div>
                <div>
                  <strong>Waktu Mulai:</strong>{' '}
                  {new Date(startPoint.fixTime).toLocaleString('id-ID')}
                </div>
                <div>
                  <strong>Kecepatan Awal:</strong> {startPoint.speed} km/jam
                </div>
                <div className="font-mono text-[11px]">
                  {startPoint.latitude.toFixed(6)}, {startPoint.longitude.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marker Posisi Akhir / Posisi Alat Saat Ini */}
        {(endPoint || hasValidElephantCoord) && (
          <Marker
            position={
              endPoint
                ? [endPoint.latitude, endPoint.longitude]
                : [elephant!.latitude, elephant!.longitude]
            }
            icon={elephantIcon}
          >
            <Popup className="text-slate-800 font-sans">
              <div className="p-1 text-xs space-y-1">
                <h3 className="font-bold text-sm text-blue-600">
                  🐘 {elephant?.name || 'Posisi Akhir Rute'}
                </h3>
                <div>
                  <strong>Waktu:</strong>{' '}
                  {endPoint
                    ? new Date(endPoint.fixTime).toLocaleString('id-ID')
                    : elephant?.lastFixTime
                      ? new Date(elephant.lastFixTime).toLocaleString('id-ID')
                      : '-'}
                </div>
                <div>
                  <strong>Kecepatan:</strong>{' '}
                  {endPoint ? endPoint.speed : elephant?.speed ?? 0} km/jam
                </div>
                <div className="font-mono text-[11px]">
                  {endPoint
                    ? `${endPoint.latitude.toFixed(6)}, ${endPoint.longitude.toFixed(6)}`
                    : `${elephant!.latitude.toFixed(6)}, ${elephant!.longitude.toFixed(6)}`}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marker Animasi Playback Saat Pengguna Memutar Ulang Perjalanan */}
        {playbackPoint && (
          <Marker
            position={[playbackPoint.latitude, playbackPoint.longitude]}
            icon={playbackIcon}
          >
            <Popup className="text-slate-800 font-sans">
              <div className="text-xs space-y-1">
                <div className="font-bold text-orange-600">▶️ Posisi Playback</div>
                <div>
                  <strong>Waktu:</strong>{' '}
                  {new Date(playbackPoint.fixTime).toLocaleString('id-ID')}
                </div>
                <div>
                  <strong>Kecepatan:</strong> {playbackPoint.speed} km/jam
                </div>
                <div>
                  <strong>Arah:</strong> {playbackPoint.course}°
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        <MapController
          focusCoord={focusCoord}
          playbackPoint={playbackPoint}
          history={validHistory}
          selectedDate={selectedDate}
        />
      </MapContainer>
    </div>
  );
};
