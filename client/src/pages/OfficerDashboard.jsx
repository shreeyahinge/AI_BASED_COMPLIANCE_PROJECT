import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import API from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const priorityColor = {
  low: "#10b981",
  medium: "#3b82f6",
  high: "#f59e0b",
  critical: "#ef4444",
};

export default function OfficerDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [activeTab, setActiveTab] = useState("tasks");
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null);

  const [optimisedRoute, setOptimisedRoute] = useState(null);
  const [optimising, setOptimising] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, reportsRes] = await Promise.all([
        API.get("/tasks/my"),
        API.get(`/reports?status=pending${user?.city ? `&city=${user.city}` : ""}`),
      ]);
      setTasks(tasksRes.data);
      setAllReports(reportsRes.data);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (taskId) => {
    try {
      await API.put(`/tasks/${taskId}/start`, {
        beforePhotoUrl: "https://example.com/before.jpg",
      });
      toast.success("Task started!");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to start task");
    }
  };

  const handleComplete = async (taskId, afterPhotoUrl) => {
    setCompleting(taskId);
    try {
      await API.put(`/tasks/${taskId}/complete`, {
        afterPhotoUrl: afterPhotoUrl || "https://example.com/after-clean.jpg",
        notes: "Bin cleaned and emptied",
      });
      toast.success("✅ Task completed! Bin marked as clean.");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to complete task");
    } finally {
      setCompleting(null);
    }
  };

  const handleCompleteUpload = async (taskId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCompleting(taskId);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const { data } = await API.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Photo uploaded! Verifying with AI...");
      await handleComplete(taskId, data.url);
    } catch (error) {
      toast.error("Photo upload failed");
      setCompleting(null);
    }
  };

  const handleOptimiseRoute = async () => {
  setOptimising(true);
  try {
    const { data } = await API.get("/tasks/optimise-route");
    setOptimisedRoute(data);
    if (data.googleMapsUrl) {
      window.open(data.googleMapsUrl, "_blank");
    }
    toast.success(`🗺️ ${data.message}`);
  } catch (error) {
    toast.error("Failed to optimise route");
  } finally {
    setOptimising(false);
  }
};

  const openMaps = (task) => {
    // Use exact traced GPS location from citizen's photo if available
    const lat = task.report?.location?.latitude || task.bin?.location?.coordinates[1];
    const lng = task.report?.location?.longitude || task.bin?.location?.coordinates[0];
    if (lat && lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        "_blank"
      );
    }
  };

  if (loading) return (
    <div style={styles.loading}>Loading Officer Dashboard...</div>
  );

  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.container}>

        {/* Header Banner */}
        <div style={styles.banner}>
          <div>
            <h2 style={styles.welcome}>Officer Panel 👷</h2>
            <p style={styles.welcomeSub}>
              City: {user?.city || "All Cities"}
            </p>
          </div>
          <div style={styles.statsRow}>
            <div style={styles.statBadge}>
              <span style={{ color: "#f59e0b", fontSize: "22px", fontWeight: "700" }}>
                {tasks.filter(t => t.status === "pending").length}
              </span>
              <span style={styles.statLabel}>Pending</span>
            </div>
            <div style={styles.statBadge}>
              <span style={{ color: "#3b82f6", fontSize: "22px", fontWeight: "700" }}>
                {tasks.filter(t => t.status === "in_progress").length}
              </span>
              <span style={styles.statLabel}>In Progress</span>
            </div>
            <div style={styles.statBadge}>
              <span style={{ color: "#ef4444", fontSize: "22px", fontWeight: "700" }}>
                {tasks.filter(t => t.priority === "critical").length}
              </span>
              <span style={styles.statLabel}>Critical</span>
            </div>
          </div>
          <button
            onClick={handleOptimiseRoute}
            style={styles.optimiseBtn}
            disabled={optimising || tasks.length === 0}
          >
            {optimising ? "Optimising..." : `🗺️ Navigate Optimised Path (${tasks.length} bins)`}
          </button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {["tasks", "reports"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {}),
              }}
            >
              {tab === "tasks" ? "🔧 My Tasks" : "📋 All Reports"}
            </button>
          ))}
        </div>

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <div>
            {tasks.length === 0 ? (
              <div style={styles.empty}>
                <p style={{ fontSize: "18px", marginBottom: "8px", color: "#111827" }}>
                  🎉 No pending tasks!
                </p>
                <p style={{ fontSize: "13px", color: "#6b7280" }}>
                  All bins in your city are clean.
                </p>
              </div>
            ) : (
              <div style={styles.taskList}>
                {tasks
                  .sort((a, b) => {
                    const order = { critical: 0, high: 1, medium: 2, low: 3 };
                    return order[a.priority] - order[b.priority];
                  })
                  .map((task) => (
                    <div
                      key={task._id}
                      style={{
                        ...styles.taskCard,
                        borderLeftColor: priorityColor[task.priority],
                      }}
                    >
                      {/* Priority Badge */}
                      <div style={styles.taskHeader}>
                        <span style={{
                          ...styles.priorityBadge,
                          background: priorityColor[task.priority] + "22",
                          color: priorityColor[task.priority],
                        }}>
                          {task.priority === "critical" && "🚨 "}
                          {task.priority === "high" && "⚠️ "}
                          {task.priority.toUpperCase()}
                        </span>
                        <span style={styles.taskStatus}>
                          {task.status === "pending" ? "⏳ Pending"
                            : task.status === "in_progress" ? "🔄 In Progress"
                            : "✅ Completed"}
                        </span>
                        <button
                          onClick={() => openMaps(task)}
                          style={styles.mapBtnTop}
                        >
                          🗺️ Navigate
                        </button>
                      </div>

                      {/* Bin Info */}
                      <div style={styles.taskBody}>
                        <p style={styles.taskAddress}>
                          📍 {task.bin?.location?.address}
                        </p>
                        <p style={styles.taskMeta}>
                          {task.bin?.area} · {task.bin?.ward} · {task.bin?.city}
                        </p>
                        <div style={styles.taskDetails}>
                          <span style={styles.taskDetail}>
                            📊 Fill Level: {task.bin?.fillLevel}%
                          </span>
                          <span style={styles.taskDetail}>
                            🤖 AI Score: {task.report?.aiScore}%
                          </span>
                          <span style={styles.taskDetail}>
                            📅 {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {task.report?.notes && (
                          <p style={styles.taskNotes}>
                            💬 "{task.report.notes}"
                          </p>
                        )}
                      </div>

                      {/* Fill Level Bar */}
                      <div style={styles.fillWrap}>
                        <div style={styles.fillTrack}>
                          <div style={{
                            height: "100%",
                            width: `${task.bin?.fillLevel || 0}%`,
                            background: (task.bin?.fillLevel || 0) >= 85
                              ? "#ef4444"
                              : (task.bin?.fillLevel || 0) >= 50
                              ? "#f59e0b" : "#10b981",
                            borderRadius: "4px",
                          }} />
                        </div>
                        <span style={styles.fillLabel}>
                          {task.bin?.fillLevel || 0}%
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div style={styles.taskActions}>
                        {task.status === "pending" && (
                          <button
                            onClick={() => handleStart(task._id)}
                            style={styles.startBtn}
                          >
                            ▶ Start Task
                          </button>
                        )}
                        {task.status === "in_progress" && (
                          <label
                            style={
                              completing === task._id
                                ? { ...styles.completeBtn, opacity: 0.7, cursor: "not-allowed", display: "inline-block", textAlign: "center" }
                                : { ...styles.completeBtn, cursor: "pointer", display: "inline-block", textAlign: "center" }
                            }
                          >
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              style={{ display: "none" }}
                              onChange={(e) => handleCompleteUpload(task._id, e)}
                              disabled={completing === task._id}
                            />
                            {completing === task._id
                              ? "Completing..."
                              : "📷 Upload & Complete"}
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>
              📋 Pending Reports ({allReports.length})
            </h2>
            {allReports.length === 0 ? (
              <div style={styles.empty}>No pending reports</div>
            ) : (
              <div style={styles.reportsList}>
                {allReports.map((r) => (
                  <div key={r._id} style={styles.reportCard}>
                    <div style={styles.reportTop}>
                      <div>
                        <p style={styles.reportAddress}>
                          📍 {r.bin?.location?.address}
                        </p>
                        <p style={styles.reportMeta}>
                          {r.bin?.area} · {r.bin?.ward} · Reported by{" "}
                          {r.citizen?.name}
                        </p>
                      </div>
                      <span style={{
                        ...styles.priorityBadge,
                        background: priorityColor[r.priority] + "22",
                        color: priorityColor[r.priority],
                      }}>
                        {r.priority}
                      </span>
                    </div>
                    <div style={styles.reportDetails}>
                      <span>🤖 AI: {r.aiScore}%</span>
                      <span>📊 Fill: {r.fillLevel}%</span>
                      <span>
                        📅 {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f4f6f9" },
  container: { padding: "24px", maxWidth: "900px", margin: "0 auto" },
  loading: {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: "100vh", color: "#166534", fontSize: "18px",
  },
  banner: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#ffffff", border: "1px solid #e5e7eb",
    borderRadius: "12px", padding: "20px 24px", marginBottom: "20px",
    flexWrap: "wrap", gap: "16px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  },
  welcome: {
    fontSize: "20px", fontWeight: "700",
    color: "#111827", marginBottom: "4px",
  },
  welcomeSub: { fontSize: "13px", color: "#6b7280" },
  statsRow: { display: "flex", gap: "16px" },
  statBadge: {
    textAlign: "center", background: "#f9fafb",
    borderRadius: "10px", padding: "10px 16px",
    border: "1px solid #e5e7eb", display: "flex",
    flexDirection: "column", alignItems: "center",
  },
  statLabel: { fontSize: "11px", color: "#6b7280", marginTop: "2px" },
  optimiseBtn: {
    padding: "10px 20px", background: "#166534",
    border: "none", borderRadius: "8px",
    color: "#ffffff", fontSize: "14px",
    fontWeight: "600", cursor: "pointer", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  tabs: { display: "flex", gap: "8px", marginBottom: "20px" },
  tab: {
    padding: "10px 20px", background: "#ffffff",
    border: "1px solid #e5e7eb", borderRadius: "8px",
    color: "#6b7280", fontSize: "14px", cursor: "pointer", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  tabActive: {
    background: "#166534", color: "#ffffff",
    border: "1px solid #166534", fontWeight: "600",
  },
  empty: {
    background: "#ffffff", border: "1px solid #e5e7eb",
    borderRadius: "12px", padding: "48px",
    textAlign: "center", color: "#111827", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  taskList: { display: "flex", flexDirection: "column", gap: "14px" },
  taskCard: {
    background: "#ffffff", border: "1px solid #e5e7eb",
    borderLeft: "4px solid", borderRadius: "12px", padding: "18px", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  taskHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "12px",
  },
  priorityBadge: {
    padding: "4px 12px", borderRadius: "20px",
    fontSize: "11px", fontWeight: "700", letterSpacing: "0.05em",
  },
  taskStatus: { fontSize: "12px", color: "#6b7280" },
  taskBody: { marginBottom: "12px" },
  taskAddress: {
    fontSize: "15px", fontWeight: "600",
    color: "#111827", marginBottom: "3px",
  },
  taskMeta: { fontSize: "12px", color: "#6b7280", marginBottom: "8px" },
  taskDetails: { display: "flex", gap: "16px", flexWrap: "wrap" },
  taskDetail: { fontSize: "12px", color: "#6b7280" },
  taskNotes: {
    fontSize: "12px", color: "#6b7280",
    fontStyle: "italic", marginTop: "8px",
  },
  fillWrap: {
    display: "flex", alignItems: "center",
    gap: "10px", marginBottom: "14px",
  },
  fillTrack: {
    flex: 1, height: "8px", background: "#e5e7eb",
    borderRadius: "4px", overflow: "hidden",
  },
  fillLabel: { fontSize: "12px", color: "#6b7280", minWidth: "35px" },
  taskActions: { display: "flex", gap: "10px", flexWrap: "wrap" },
  mapBtnTop: {
    padding: "6px 12px", background: "transparent",
    border: "1px solid #3b82f6", borderRadius: "8px",
    color: "#3b82f6", fontSize: "12px", cursor: "pointer", fontWeight: "600",
  },
  mapBtn: {
    padding: "9px 18px", background: "transparent",
    border: "1px solid #d1d5db", borderRadius: "8px",
    color: "#4b5563", fontSize: "13px", cursor: "pointer",
  },
  startBtn: {
    padding: "9px 18px", background: "#3b82f6",
    border: "none", borderRadius: "8px",
    color: "#ffffff", fontSize: "13px",
    fontWeight: "600", cursor: "pointer", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  completeBtn: {
    padding: "9px 18px", background: "#10b981",
    border: "none", borderRadius: "8px",
    color: "#ffffff", fontSize: "13px",
    fontWeight: "600", cursor: "pointer", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  section: {
    background: "#ffffff", border: "1px solid #e5e7eb",
    borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  },
  sectionTitle: {
    fontSize: "16px", fontWeight: "600",
    color: "#111827", marginBottom: "16px",
  },
  reportsList: { display: "flex", flexDirection: "column", gap: "10px" },
  reportCard: {
    background: "#f9fafb", border: "1px solid #e5e7eb",
    borderRadius: "10px", padding: "14px",
  },
  reportTop: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: "8px",
  },
  reportAddress: {
    fontSize: "14px", fontWeight: "600",
    color: "#111827", marginBottom: "3px",
  },
  reportMeta: { fontSize: "12px", color: "#6b7280" },
  reportDetails: {
    display: "flex", gap: "16px",
    fontSize: "12px", color: "#6b7280",
  },
};