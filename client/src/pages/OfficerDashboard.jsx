import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import API from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const priorityColor = {
  low: "#8ecae6",
  medium: "#00b4d8",
  high: "#ffb703",
  critical: "#ef476f",
};

export default function OfficerDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [activeTab, setActiveTab] = useState("tasks");
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, reportsRes] = await Promise.all([
        API.get("/tasks/my"),
        API.get("/reports?status=pending"),
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

  const handleComplete = async (taskId) => {
    setCompleting(taskId);
    try {
      await API.put(`/tasks/${taskId}/complete`, {
        afterPhotoUrl: "https://example.com/after-clean.jpg",
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

  const openMaps = (bin) => {
    const lat = bin?.location?.coordinates[1];
    const lng = bin?.location?.coordinates[0];
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
              Ward: {user?.assignedWard || "All Wards"} ·
              Zone: {user?.assignedZone || "All Zones"}
            </p>
          </div>
          <div style={styles.statsRow}>
            <div style={styles.statBadge}>
              <span style={{ color: "#ffb703", fontSize: "22px", fontWeight: "700" }}>
                {tasks.filter(t => t.status === "pending").length}
              </span>
              <span style={styles.statLabel}>Pending</span>
            </div>
            <div style={styles.statBadge}>
              <span style={{ color: "#00b4d8", fontSize: "22px", fontWeight: "700" }}>
                {tasks.filter(t => t.status === "in_progress").length}
              </span>
              <span style={styles.statLabel}>In Progress</span>
            </div>
            <div style={styles.statBadge}>
              <span style={{ color: "#ef476f", fontSize: "22px", fontWeight: "700" }}>
                {tasks.filter(t => t.priority === "critical").length}
              </span>
              <span style={styles.statLabel}>Critical</span>
            </div>
          </div>
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
                <p style={{ fontSize: "18px", marginBottom: "8px" }}>
                  🎉 No pending tasks!
                </p>
                <p style={{ fontSize: "13px", color: "#8ecae6" }}>
                  All bins in your ward are clean.
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
                              ? "#ef476f"
                              : (task.bin?.fillLevel || 0) >= 50
                              ? "#ffb703" : "#06d6a0",
                            borderRadius: "4px",
                          }} />
                        </div>
                        <span style={styles.fillLabel}>
                          {task.bin?.fillLevel || 0}%
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div style={styles.taskActions}>
                        <button
                          onClick={() => openMaps(task.bin)}
                          style={styles.mapBtn}
                        >
                          🗺️ Navigate
                        </button>
                        {task.status === "pending" && (
                          <button
                            onClick={() => handleStart(task._id)}
                            style={styles.startBtn}
                          >
                            ▶ Start Task
                          </button>
                        )}
                        {task.status === "in_progress" && (
                          <button
                            onClick={() => handleComplete(task._id)}
                            style={
                              completing === task._id
                                ? { ...styles.completeBtn, opacity: 0.7 }
                                : styles.completeBtn
                            }
                            disabled={completing === task._id}
                          >
                            {completing === task._id
                              ? "Completing..."
                              : "✅ Mark Complete"}
                          </button>
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
  page: { minHeight: "100vh", background: "#0d1b2a" },
  container: { padding: "24px", maxWidth: "900px", margin: "0 auto" },
  loading: {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: "100vh", color: "#06d6a0", fontSize: "18px",
  },
  banner: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#152539", border: "1px solid #1e3a55",
    borderRadius: "12px", padding: "20px 24px", marginBottom: "20px",
    flexWrap: "wrap", gap: "16px",
  },
  welcome: {
    fontSize: "20px", fontWeight: "700",
    color: "#ffffff", marginBottom: "4px",
  },
  welcomeSub: { fontSize: "13px", color: "#8ecae6" },
  statsRow: { display: "flex", gap: "16px" },
  statBadge: {
    textAlign: "center", background: "#0d1b2a",
    borderRadius: "10px", padding: "10px 16px",
    border: "1px solid #1e3a55", display: "flex",
    flexDirection: "column", alignItems: "center",
  },
  statLabel: { fontSize: "11px", color: "#8ecae6", marginTop: "2px" },
  tabs: { display: "flex", gap: "8px", marginBottom: "20px" },
  tab: {
    padding: "10px 20px", background: "#152539",
    border: "1px solid #1e3a55", borderRadius: "8px",
    color: "#8ecae6", fontSize: "14px", cursor: "pointer",
  },
  tabActive: {
    background: "#06d6a0", color: "#0d1b2a",
    border: "1px solid #06d6a0", fontWeight: "600",
  },
  empty: {
    background: "#152539", border: "1px solid #1e3a55",
    borderRadius: "12px", padding: "48px",
    textAlign: "center", color: "#ffffff",
  },
  taskList: { display: "flex", flexDirection: "column", gap: "14px" },
  taskCard: {
    background: "#152539", border: "1px solid #1e3a55",
    borderLeft: "4px solid", borderRadius: "12px", padding: "18px",
  },
  taskHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "12px",
  },
  priorityBadge: {
    padding: "4px 12px", borderRadius: "20px",
    fontSize: "11px", fontWeight: "700", letterSpacing: "0.05em",
  },
  taskStatus: { fontSize: "12px", color: "#8ecae6" },
  taskBody: { marginBottom: "12px" },
  taskAddress: {
    fontSize: "15px", fontWeight: "600",
    color: "#ffffff", marginBottom: "3px",
  },
  taskMeta: { fontSize: "12px", color: "#8ecae6", marginBottom: "8px" },
  taskDetails: { display: "flex", gap: "16px", flexWrap: "wrap" },
  taskDetail: { fontSize: "12px", color: "#8ecae6" },
  taskNotes: {
    fontSize: "12px", color: "#8ecae6",
    fontStyle: "italic", marginTop: "8px",
  },
  fillWrap: {
    display: "flex", alignItems: "center",
    gap: "10px", marginBottom: "14px",
  },
  fillTrack: {
    flex: 1, height: "8px", background: "#0d1b2a",
    borderRadius: "4px", overflow: "hidden",
  },
  fillLabel: { fontSize: "12px", color: "#8ecae6", minWidth: "35px" },
  taskActions: { display: "flex", gap: "10px", flexWrap: "wrap" },
  mapBtn: {
    padding: "9px 18px", background: "transparent",
    border: "1px solid #1e3a55", borderRadius: "8px",
    color: "#8ecae6", fontSize: "13px", cursor: "pointer",
  },
  startBtn: {
    padding: "9px 18px", background: "#00b4d8",
    border: "none", borderRadius: "8px",
    color: "#0d1b2a", fontSize: "13px",
    fontWeight: "600", cursor: "pointer",
  },
  completeBtn: {
    padding: "9px 18px", background: "#06d6a0",
    border: "none", borderRadius: "8px",
    color: "#0d1b2a", fontSize: "13px",
    fontWeight: "600", cursor: "pointer",
  },
  section: {
    background: "#152539", border: "1px solid #1e3a55",
    borderRadius: "12px", padding: "20px",
  },
  sectionTitle: {
    fontSize: "16px", fontWeight: "600",
    color: "#ffffff", marginBottom: "16px",
  },
  reportsList: { display: "flex", flexDirection: "column", gap: "10px" },
  reportCard: {
    background: "#0d1b2a", border: "1px solid #1e3a55",
    borderRadius: "10px", padding: "14px",
  },
  reportTop: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: "8px",
  },
  reportAddress: {
    fontSize: "14px", fontWeight: "600",
    color: "#ffffff", marginBottom: "3px",
  },
  reportMeta: { fontSize: "12px", color: "#8ecae6" },
  reportDetails: {
    display: "flex", gap: "16px",
    fontSize: "12px", color: "#8ecae6",
  },
};