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
    admin: "#00b4d8",
    officer: "#06d6a0",
    citizen: "#ffb703",
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <span style={styles.logo}>🗑️</span>
        <span style={styles.brand}>SmartBin</span>
        <span style={styles.cityTag}>City Waste Management</span>
      </div>
      <div style={styles.right}>
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
    background: "#152539",
    borderBottom: "1px solid #1e3a55",
    position: "sticky",
    top: 0,
    zIndex: 100,
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
    color: "#00b4d8",
  },
  cityTag: {
    fontSize: "12px",
    color: "#8ecae6",
    background: "#0d1b2a",
    padding: "3px 10px",
    borderRadius: "20px",
    border: "1px solid #1e3a55",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  name: {
    fontSize: "14px",
    color: "#ffffff",
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
    color: "#ffb703",
    fontWeight: "600",
  },
  logoutBtn: {
    padding: "7px 16px",
    background: "transparent",
    border: "1px solid #1e3a55",
    borderRadius: "8px",
    color: "#8ecae6",
    fontSize: "13px",
    cursor: "pointer",
  },
};