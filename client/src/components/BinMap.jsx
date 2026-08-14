import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const statusColor = {
  clean: "#10b981",
  medium: "#f59e0b",
  critical: "#ef4444",
};

export default function BinMap({ bins }) {
  const center = bins.length > 0
    ? [
        bins[0].location.coordinates[1],
        bins[0].location.coordinates[0],
      ]
    : [19.0760, 72.8777];

  return (
    <div style={styles.wrapper}>
      <MapContainer
        center={center}
        zoom={13}
        style={styles.map}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {bins.map((bin) => (
          <CircleMarker
            key={bin._id}
            center={[
              bin.location.coordinates[1],
              bin.location.coordinates[0],
            ]}
            radius={bin.fillLevel ? Math.max(12, bin.fillLevel / 4) : 12}
            fillColor={statusColor[bin.status] || "#6b7280"}
            color={statusColor[bin.status] || "#6b7280"}
            fillOpacity={0.8}
            weight={1}
            className={`glow-marker-${bin.status}`}
          >
            <Popup>
              <div style={styles.popup}>
                <strong style={{ color: "#111827" }}>{bin.binId}</strong>
                <p>{bin.location.address}</p>
                <p>{bin.area}, {bin.ward}</p>
                <p>Fill: <strong>{bin.fillLevel}%</strong></p>
                <p style={{
                  color: statusColor[bin.status],
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}>
                  {bin.status}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div style={styles.legend}>
        {Object.entries(statusColor).map(([status, color]) => (
          <div key={status} style={styles.legendItem}>
            <div style={{ ...styles.dot, background: color }} />
            <span style={styles.legendText}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },
  map: {
    height: "380px",
    width: "100%",
  },
  popup: {
    fontSize: "13px",
    lineHeight: "1.6",
  },
  legend: {
    position: "absolute",
    bottom: "12px",
    left: "12px",
    zIndex: 999,
    background: "rgba(255, 255, 255, 0.95)",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "8px 12px",
    display: "flex",
    gap: "12px",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  legendText: {
    fontSize: "11px",
    color: "#4b5563",
    textTransform: "capitalize",
    fontWeight: "500",
  },
};