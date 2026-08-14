import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "citizen",
    city: "",
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await API.post("/auth/register", form);
      login(data);
      toast.success("Account created successfully!");
      if (data.role === "admin") navigate("/admin");
      else if (data.role === "officer") navigate("/officer");
      else navigate("/citizen");
    } catch (error) {
      toast.error(error.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🗑️</div>
        <h1 style={styles.title}>SmartBin</h1>
        <p style={styles.subtitle}>Create your account</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="Full Name"
            style={styles.input}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Email Address"
            style={styles.input}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            style={styles.input}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Your City (e.g. Mumbai)"
            style={styles.input}
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <select
            style={styles.input}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="citizen">Citizen</option>
            <option value="officer">Service Officer</option>
            <option value="admin">Admin</option>
          </select>


          {/* Ward is removed, using city for assignment */}


          <button
            type="submit"
            style={loading ? { ...styles.button, opacity: 0.7 } : styles.button}
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p style={styles.loginText}>
          Already have an account?{" "}
          <span style={styles.link} onClick={() => navigate("/login")}>
            Login
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
    background: "#f4f6f9",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "40px",
    width: "100%",
    maxWidth: "420px",
    textAlign: "center",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  },
  logo: { fontSize: "48px", marginBottom: "12px" },
  title: { fontSize: "28px", fontWeight: "700", color: "#166534", marginBottom: "6px" },
  subtitle: { fontSize: "14px", color: "#6b7280", marginBottom: "32px" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  input: {
    width: "100%",
    padding: "12px 14px",
    background: "#f9fafb",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    color: "#1f2937",
    fontSize: "14px",
    transition: "border-color 0.2s",
  },
  button: {
    padding: "13px",
    background: "#166534",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "600",
    marginTop: "4px",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  loginText: { marginTop: "24px", fontSize: "13px", color: "#4b5563" },
  link: { color: "#166534", cursor: "pointer", fontWeight: "600" },
};