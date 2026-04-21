import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api/axios";
import toast from "react-hot-toast";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await API.post("/auth/login", form);
      login(data);
      toast.success(`Welcome back, ${data.name}!`);
      // Redirect based on role
      if (data.role === "admin") navigate("/admin");
      else if (data.role === "officer") navigate("/officer");
      else navigate("/citizen");
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🗑️</div>
        <h1 style={styles.title}>SmartBin</h1>
        <p style={styles.subtitle}>City Waste Management Platform</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              style={styles.input}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              style={styles.input}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            style={loading ? { ...styles.button, opacity: 0.7 } : styles.button}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={styles.registerText}>
          Don't have an account?{" "}
          <span
            style={styles.link}
            onClick={() => navigate("/register")}
          >
            Register
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0d1b2a",
  },
  card: {
    background: "#152539",
    border: "1px solid #1e3a55",
    borderRadius: "16px",
    padding: "40px",
    width: "100%",
    maxWidth: "420px",
    textAlign: "center",
  },
  logo: {
    fontSize: "48px",
    marginBottom: "12px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#00b4d8",
    marginBottom: "6px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#8ecae6",
    marginBottom: "32px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  inputGroup: {
    textAlign: "left",
  },
  label: {
    display: "block",
    fontSize: "13px",
    color: "#8ecae6",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    background: "#0d1b2a",
    border: "1px solid #1e3a55",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "14px",
  },
  button: {
    padding: "13px",
    background: "#00b4d8",
    color: "#0d1b2a",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "600",
    marginTop: "8px",
  },
  registerText: {
    marginTop: "24px",
    fontSize: "13px",
    color: "#8ecae6",
  },
  link: {
    color: "#00b4d8",
    cursor: "pointer",
    fontWeight: "600",
  },
};