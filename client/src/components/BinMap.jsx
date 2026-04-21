import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const statusColor = {
  clean: "#06d6a0",
  medium: "#ffb703",
  critical: "#ef476f",
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
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bins.map((bin) => (
          <CircleMarker
            key={bin._id}
            center={[
              bin.location.coordinates[1],
              bin.location.coordinates[0],
            ]}
            radius={bin.fillLevel ? Math.max(8, bin.fillLevel / 8) : 8}
            fillColor={statusColor[bin.status] || "#8ecae6"}
            color={statusColor[bin.status] || "#8ecae6"}
            fillOpacity={0.7}
            weight={2}
          >
            <Popup>
              <div style={styles.popup}>
                <strong style={{ color: "#0d1b2a" }}>{bin.binId}</strong>
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
    border: "1px solid #1e3a55",
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
    background: "rgba(21,37,57,0.95)",
    border: "1px solid #1e3a55",
    borderRadius: "8px",
    padding: "8px 12px",
    display: "flex",
    gap: "12px",
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
    color: "#8ecae6",
    textTransform: "capitalize",
  },
};