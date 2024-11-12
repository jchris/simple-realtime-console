import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngTuple } from 'leaflet';

function ChangeView({ center, zoom }: { center: LatLngTuple; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export function Map({
  center,
  location = 'My Location',
}: {
  center: LatLngTuple;
  location?: string;
}) {
  return (
    <div data-component="Map" className="absolute w-full h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:h-full">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <ChangeView center={center} zoom={11} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={center}>
          <Popup>{location}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
