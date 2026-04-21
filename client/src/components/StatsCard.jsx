export default function StatsCard({ title, value, color, icon }) {
  return (
    <div style={{ ...styles.card, borderColor: color + "44" }}>
      <div style={styles.top}>
        <span style={styles.icon}>{icon}</span>
        <span style={{ ...styles.value, color }}>{value}</span>
      </div>
      <p style={styles.title}>{title}</p>
    </div>
  );
}

const styles = {
  card: {
    background: "#152539",
    border: "1px solid",
    borderRadius: "12px",
    padding: "20px",
    flex: 1,
    minWidth: "140px",
  },
  top: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  icon: { fontSize: "24px" },
  value: {
    fontSize: "32px",
    fontWeight: "700",
  },
  title: {
    fontSize: "13px",
    color: "#8ecae6",
  },
};