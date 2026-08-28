import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const roleColor = {
    admin: "#3b82f6",
    officer: "#10b981",
    citizen: "#f59e0b",
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <span style={styles.logo} onClick={() => navigate(`/${user?.role || "login"}`)}>🗑️</span>
        <span style={styles.brand} onClick={() => navigate(`/${user?.role || "login"}`)}>SmartBin</span>
        <span style={styles.cityTag}>City Waste Management</span>
      </div>
      <div style={styles.right}>
        {user?.role === "admin" && (
          <button
            onClick={() => navigate("/camera-station")}
            style={styles.cameraStationBtn}
            title="Open Live Road CCTV & Phone Camera Surveillance"
          >
            📹 Live Road CCTV
          </button>
        )}
        <span style={styles.name}>{user?.name}</span>
        <span
          style={{
            ...styles.role,
            background: roleColor[user?.role] + "22",
            color: roleColor[user?.role],
            border: `1px solid ${roleColor[user?.role]}44`,
          }}
        >
          {user?.role}
        </span>
        {user?.role === "citizen" && (
          <span style={styles.points}>⭐ {user?.greenPoints || 0} pts</span>
        )}
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    position: "sticky",
    top: 0,
    zIndex: 100,
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  logo: { fontSize: "24px" },
  brand: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#166534",
  },
  cityTag: {
    fontSize: "12px",
    color: "#6b7280",
    background: "#f9fafb",
    padding: "3px 10px",
    borderRadius: "20px",
    border: "1px solid #d1d5db",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  name: {
    fontSize: "14px",
    color: "#111827",
    fontWeight: "500",
  },
  role: {
    fontSize: "11px",
    fontWeight: "600",
    padding: "3px 10px",
    borderRadius: "20px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  points: {
    fontSize: "13px",
    color: "#f59e0b",
    fontWeight: "600",
  },
  cameraStationBtn: {
    padding: "7px 14px",
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: "8px",
    color: "#166534",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    transition: "all 0.2s",
  },
  logoutBtn: {
    padding: "7px 16px",
    background: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    color: "#4b5563",
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
};