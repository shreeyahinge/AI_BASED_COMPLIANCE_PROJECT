import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StatsCard from "../components/StatsCard";
import BinMap from "../components/BinMap";
import API from "../api/axios";
import toast from "react-hot-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useSocket } from "../context/SocketContext";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [bins, setBins] = useState([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, medium: 0, clean: 0 });
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Filters & Search
  const [reportSearch, setReportSearch] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("all");
  const [reportPriorityFilter, setReportPriorityFilter] = useState("all");

  // Assign Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  const [assignPriority, setAssignPriority] = useState("medium");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  // Photo Preview Modal
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const [newBin, setNewBin] = useState({
    binId: "", address: "", longitude: "", latitude: "",
    city: "", ward: "", area: "", locationType: "street", capacity: 100,
  });

  const [predictions, setPredictions] = useState([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  const fetchPredictions = async () => {
    setLoadingPredictions(true);
    try {
      const criticalBins = bins.filter(
        (b) => b.status === "critical" || b.status === "medium"
      );
      const predResults = await Promise.all(
        criticalBins.slice(0, 5).map(async (bin) => {
          try {
            const { data } = await API.get(`/bins/${bin._id}/predict`);
            return { ...data, binData: bin };
          } catch {
            return null;
          }
        })
      );
      setPredictions(predResults.filter(Boolean));
    } catch {
      toast.error("Could not load predictions");
    } finally {
      setLoadingPredictions(false);
    }
  };

  const { socket } = useSocket();

  useEffect(() => {
    fetchAll();
    fetchPredictions();
  }, []);

  useEffect(() => {
    if (socket) {
      const handleUpdate = () => fetchAll();
      socket.on("new_critical_report", handleUpdate);
      socket.on("task_completed", handleUpdate);
      socket.on("task_updated", handleUpdate);
      socket.on("new_task_assigned", handleUpdate);
      return () => {
        socket.off("new_critical_report", handleUpdate);
        socket.off("task_completed", handleUpdate);
        socket.off("task_updated", handleUpdate);
        socket.off("new_task_assigned", handleUpdate);
      };
    }
  }, [socket]);

  const fetchAll = async () => {
    try {
      const [binsRes, statsRes, reportsRes, tasksRes, officersRes] = await Promise.all([
        API.get("/bins"),
        API.get("/bins/stats"),
        API.get("/reports"),
        API.get("/tasks"),
        API.get("/auth/officers").catch(() => ({ data: [] })),
      ]);
      setBins(binsRes.data || []);
      setStats(statsRes.data || { total: 0, critical: 0, medium: 0, clean: 0 });
      setReports(reportsRes.data || []);
      setTasks(tasksRes.data || []);
      setOfficers(officersRes.data || []);
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssignModal = (report) => {
    setSelectedReport(report);
    setSelectedOfficerId(report.task?.assignedTo?._id || officers[0]?._id || "");
    setAssignPriority(report.task?.priority || report.priority || "medium");
    setAssignNotes(report.task?.notes || report.notes || "");
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOfficerId) {
      toast.error("Please select an officer");
      return;
    }
    setAssignLoading(true);
    try {
      const res = await API.post("/tasks/assign", {
        reportId: selectedReport._id,
        officerId: selectedOfficerId,
        priority: assignPriority,
        notes: assignNotes,
      });
      toast.success(res.data.message || "Task assigned successfully!");
      setAssignModalOpen(false);
      setSelectedReport(null);
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to assign task");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAddBin = async (e) => {
    e.preventDefault();
    try {
      await API.post("/bins", {
        ...newBin,
        longitude: parseFloat(newBin.longitude),
        latitude: parseFloat(newBin.latitude),
        capacity: parseInt(newBin.capacity),
      });
      toast.success("Bin added successfully!");
      setNewBin({
        binId: "", address: "", longitude: "", latitude: "",
        city: "", ward: "", area: "", locationType: "street", capacity: 100,
      });
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add bin");
    }
  };

  // @route GET /api/analytics/export-pdf
  const handleExportPDF = async () => {
    try {
      const response = await API.get("/analytics/export-pdf", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `SmartBin-Report-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF report downloaded with task & officer assignments!");
    } catch {
      toast.error("Failed to export PDF");
    }
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const matchesStatus = reportStatusFilter === "all" || r.status === reportStatusFilter;
    const matchesPriority = reportPriorityFilter === "all" || r.priority === reportPriorityFilter;
    const searchLower = reportSearch.toLowerCase();
    const citizenName = r.citizen?.name?.toLowerCase() || "";
    const address = r.bin?.location?.address?.toLowerCase() || "";
    const ward = r.bin?.ward?.toLowerCase() || r.ward?.toLowerCase() || "";
    const officerName = r.task?.assignedTo?.name?.toLowerCase() || "";
    const matchesSearch =
      !reportSearch ||
      citizenName.includes(searchLower) ||
      address.includes(searchLower) ||
      ward.includes(searchLower) ||
      officerName.includes(searchLower);

    return matchesStatus && matchesPriority && matchesSearch;
  });

  // Chart data — reports by priority
  const chartData = [
    { name: "Critical", count: reports.filter((r) => r.priority === "critical").length, color: "#ef4444" },
    { name: "High", count: reports.filter((r) => r.priority === "high").length, color: "#f59e0b" },
    { name: "Medium", count: reports.filter((r) => r.priority === "medium").length, color: "#3b82f6" },
    { name: "Low", count: reports.filter((r) => r.priority === "low").length, color: "#10b981" },
  ];

  if (loading) return <div style={styles.loading}>Loading SmartBin Dashboard...</div>;

  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.container}>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          <StatsCard title="Total Bins" value={stats.total} color="#1e40af" icon="🗑️" />
          <StatsCard title="Critical Bins" value={stats.critical} color="#ef4444" icon="🚨" />
          <StatsCard title="Medium Bins" value={stats.medium} color="#f59e0b" icon="⚠️" />
          <StatsCard title="Clean Bins" value={stats.clean} color="#10b981" icon="✅" />
          <StatsCard title="Total Reports" value={reports.length} color="#6b7280" icon="📋" />
          <StatsCard
            title="Active Tasks"
            value={tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length}
            color="#8b5cf6"
            icon="⚡"
          />
          <StatsCard title="Field Officers" value={officers.length} color="#059669" icon="👮" />
        </div>

        {/* Tabs Bar */}
        <div style={styles.tabs}>
          {["overview", "reports", "tasks", "bins", "predictions", "add bin"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {}),
              }}
            >
              {tab === "reports" && `📋 Reports (${reports.length})`}
              {tab === "tasks" && `⚡ Tasks & Officers (${tasks.length})`}
              {tab === "overview" && "🗺️ Overview"}
              {tab === "bins" && `🗑️ Bins (${bins.length})`}
              {tab === "predictions" && "🔮 Predictions"}
              {tab === "add bin" && "➕ Add Bin"}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
            <button
              onClick={() => navigate("/camera-station")}
              style={{ ...styles.pdfBtn, background: "#166534", color: "#ffffff", border: "none" }}
              title="Open Live Surveillance & Automated Dustbin Detection Station"
            >
              📹 Open Live Camera Station
            </button>
            <button onClick={handleExportPDF} style={styles.pdfBtn} title="Download complete PDF summary with task assignments">
              📄 Export PDF Report
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div style={styles.grid2}>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>🗺️ Live City Bin Map</h2>
              {bins.length > 0 ? (
                <BinMap bins={bins} />
              ) : (
                <div style={styles.empty}>No bins registered yet</div>
              )}
            </div>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📊 Reports by Priority</h2>
              <div style={{ height: "380px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        color: "#1f2937",
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab with Task & Officer Assignment Details */}
        {activeTab === "reports" && (
          <div style={styles.section}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={{ ...styles.sectionTitle, marginBottom: "4px" }}>📋 All Waste Reports & Officer Assignments</h2>
                <p style={{ fontSize: "13px", color: "#6b7280" }}>
                  Monitor reports, review AI analysis, and see which tasks are assigned to which field officers.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="🔍 Search citizen, location, officer..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  style={{ ...styles.formInput, width: "240px", padding: "8px 12px", fontSize: "13px" }}
                />
                <select
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  style={{ ...styles.formInput, width: "130px", padding: "8px 10px", fontSize: "13px" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select
                  value={reportPriorityFilter}
                  onChange={(e) => setReportPriorityFilter(e.target.value)}
                  style={{ ...styles.formInput, width: "130px", padding: "8px 10px", fontSize: "13px" }}
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Photo</th>
                    <th style={styles.th}>Citizen</th>
                    <th style={styles.th}>Bin Location</th>
                    <th style={styles.th}>Fill Level</th>
                    <th style={styles.th}>AI Score</th>
                    <th style={styles.th}>Priority</th>
                    <th style={styles.th}>Report Status</th>
                    <th style={{ ...styles.th, minWidth: "220px", background: "#f0fdf4" }}>
                      👮 Assigned Officer & Task
                    </th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ ...styles.td, textAlign: "center", padding: "30px", color: "#9ca3af" }}>
                        No reports matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((r) => {
                      const hasTask = !!r.task;
                      const officer = r.task?.assignedTo;
                      const taskStatus = r.task?.status;

                      return (
                        <tr key={r._id} style={styles.tr}>
                          {/* Photo */}
                          <td style={styles.td}>
                            {r.photoUrl ? (
                              <img
                                src={r.photoUrl}
                                alt="Report Waste"
                                style={styles.thumbImg}
                                onClick={() => setPreviewPhoto({ url: r.photoUrl, title: `Report: ${r.bin?.location?.address || r.city}`, labels: r.aiLabels })}
                                title="Click to view large photo"
                              />
                            ) : (
                              <span style={{ fontSize: "12px", color: "#9ca3af" }}>No Photo</span>
                            )}
                          </td>

                          {/* Citizen */}
                          <td style={styles.td}>
                            <div style={{ fontWeight: "600", color: "#111827" }}>{r.citizen?.name || "Anonymous"}</div>
                            <div style={{ fontSize: "11px", color: "#6b7280" }}>{r.citizen?.email || ""}</div>
                            <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                              {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>

                          {/* Location */}
                          <td style={styles.td}>
                            <div style={{ fontWeight: "500" }}>{r.bin?.location?.address || `${r.city} ${r.ward}`}</div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              {r.bin?.ward ? `${r.bin.ward}, ` : ""}{r.bin?.area || r.area || r.city}
                            </div>
                            {r.bin?.binId && (
                              <span style={styles.binCode}>{r.bin.binId}</span>
                            )}
                          </td>

                          {/* Fill Level */}
                          <td style={styles.td}>
                            <div style={styles.fillBar}>
                              <div
                                style={{
                                  ...styles.fillFill,
                                  width: `${r.fillLevel || 0}%`,
                                  background: (r.fillLevel || 0) >= 85 ? "#ef4444" : (r.fillLevel || 0) >= 50 ? "#f59e0b" : "#10b981",
                                }}
                              />
                              <span style={styles.fillText}>{r.fillLevel || 0}%</span>
                            </div>
                          </td>

                          {/* AI Score */}
                          <td style={styles.td}>
                            <span style={{
                              fontWeight: "700",
                              color: r.aiScore >= 80 ? "#dc2626" : r.aiScore >= 50 ? "#d97706" : "#059669",
                            }}>
                              🤖 {r.aiScore}%
                            </span>
                          </td>

                          {/* Priority */}
                          <td style={styles.td}>
                            <span style={{
                              ...styles.statusBadge,
                              background: r.priority === "critical" ? "#fee2e2"
                                : r.priority === "high" ? "#fef3c7"
                                : r.priority === "medium" ? "#e0f2fe" : "#dcfce7",
                              color: r.priority === "critical" ? "#dc2626"
                                : r.priority === "high" ? "#b45309"
                                : r.priority === "medium" ? "#0369a1" : "#15803d",
                            }}>
                              {r.priority}
                            </span>
                          </td>

                          {/* Report Status */}
                          <td style={styles.td}>
                            <span style={{
                              ...styles.statusBadge,
                              background: r.status === "resolved" ? "#dcfce7"
                                : r.status === "assigned" ? "#e0e7ff"
                                : r.status === "rejected" ? "#fee2e2" : "#fef3c7",
                              color: r.status === "resolved" ? "#166534"
                                : r.status === "assigned" ? "#4338ca"
                                : r.status === "rejected" ? "#991b1b" : "#92400e",
                            }}>
                              {r.status}
                            </span>
                          </td>

                          {/* Assigned Officer & Task */}
                          <td style={{ ...styles.td, background: "#fcfdfc" }}>
                            {hasTask && officer ? (
                              <div style={styles.officerCard}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                                  <span style={{ fontSize: "16px" }}>👮</span>
                                  <span style={{ fontWeight: "600", color: "#15803d", fontSize: "13px" }}>
                                    {officer.name}
                                  </span>
                                </div>
                                <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                                  {officer.assignedWard ? `Ward: ${officer.assignedWard}` : officer.city} • {officer.phone || officer.email}
                                </div>
                                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                                  <span style={{
                                    fontSize: "11px",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontWeight: "600",
                                    background: taskStatus === "completed" ? "#dcfce7"
                                      : taskStatus === "in_progress" ? "#e0f2fe" : "#fef3c7",
                                    color: taskStatus === "completed" ? "#15803d"
                                      : taskStatus === "in_progress" ? "#0284c7" : "#b45309",
                                  }}>
                                    {taskStatus === "completed" ? "✅ Completed" : taskStatus === "in_progress" ? "🔄 In Progress" : "⏳ Pending"}
                                  </span>
                                  {r.task?.aiVerified && (
                                    <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: "600" }}>
                                      ✓ AI-Verified
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{
                                  fontSize: "12px",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  background: "#fef2f2",
                                  color: "#dc2626",
                                  fontWeight: "500",
                                }}>
                                  ⚠️ Unassigned
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Action Button */}
                          <td style={styles.td}>
                            <button
                              onClick={() => handleOpenAssignModal(r)}
                              style={{
                                ...styles.assignBtn,
                                background: hasTask ? "#ffffff" : "#166534",
                                color: hasTask ? "#166534" : "#ffffff",
                                border: hasTask ? "1px solid #166534" : "none",
                              }}
                            >
                              {hasTask ? "🔄 Reassign" : "➕ Assign Officer"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Dedicated Tasks & Officers Tab */}
        {activeTab === "tasks" && (
          <div>
            {/* Task Overview Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
              <div style={styles.miniCard}>
                <span style={{ fontSize: "24px" }}>📋</span>
                <div>
                  <div style={styles.miniVal}>{tasks.length}</div>
                  <div style={styles.miniLabel}>Total Tasks Created</div>
                </div>
              </div>
              <div style={styles.miniCard}>
                <span style={{ fontSize: "24px" }}>🔄</span>
                <div>
                  <div style={{ ...styles.miniVal, color: "#0284c7" }}>
                    {tasks.filter((t) => t.status === "in_progress").length}
                  </div>
                  <div style={styles.miniLabel}>Tasks In Progress</div>
                </div>
              </div>
              <div style={styles.miniCard}>
                <span style={{ fontSize: "24px" }}>✅</span>
                <div>
                  <div style={{ ...styles.miniVal, color: "#16a34a" }}>
                    {tasks.filter((t) => t.status === "completed").length}
                  </div>
                  <div style={styles.miniLabel}>Completed & AI-Verified</div>
                </div>
              </div>
              <div style={styles.miniCard}>
                <span style={{ fontSize: "24px" }}>⏳</span>
                <div>
                  <div style={{ ...styles.miniVal, color: "#d97706" }}>
                    {tasks.filter((t) => t.status === "pending").length}
                  </div>
                  <div style={styles.miniLabel}>Pending Officer Start</div>
                </div>
              </div>
            </div>

            {/* Tasks Table */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>⚡ All Assigned Tasks & Field Officer Status</h2>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Task ID</th>
                      <th style={styles.th}>Assigned Officer</th>
                      <th style={styles.th}>Bin Location</th>
                      <th style={styles.th}>Priority</th>
                      <th style={styles.th}>Task Status</th>
                      <th style={styles.th}>AI Verification</th>
                      <th style={styles.th}>Assigned Date</th>
                      <th style={styles.th}>Photos</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ ...styles.td, textAlign: "center", padding: "30px", color: "#9ca3af" }}>
                          No tasks have been assigned yet. Assign tasks from the Reports tab.
                        </td>
                      </tr>
                    ) : (
                      tasks.map((t) => (
                        <tr key={t._id} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={styles.binCode}>#{String(t._id).slice(-6)}</span>
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "16px" }}>👮</span>
                              <div>
                                <div style={{ fontWeight: "600", color: "#111827" }}>
                                  {t.assignedTo?.name || "Unassigned"}
                                </div>
                                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                                  {t.assignedTo?.phone || t.assignedTo?.email || ""}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={styles.td}>
                            <div style={{ fontWeight: "500" }}>{t.bin?.location?.address || t.city}</div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              {t.bin?.ward ? `${t.bin.ward}, ` : ""}{t.bin?.area || t.ward}
                            </div>
                          </td>
                          <td style={styles.td}>
                            <span style={{
                              ...styles.statusBadge,
                              background: t.priority === "critical" ? "#fee2e2"
                                : t.priority === "high" ? "#fef3c7"
                                : t.priority === "medium" ? "#e0f2fe" : "#dcfce7",
                              color: t.priority === "critical" ? "#dc2626"
                                : t.priority === "high" ? "#b45309"
                                : t.priority === "medium" ? "#0369a1" : "#15803d",
                            }}>
                              {t.priority}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{
                              ...styles.statusBadge,
                              background: t.status === "completed" ? "#dcfce7"
                                : t.status === "in_progress" ? "#e0f2fe" : "#fef3c7",
                              color: t.status === "completed" ? "#15803d"
                                : t.status === "in_progress" ? "#0284c7" : "#b45309",
                            }}>
                              {t.status === "completed" ? "✅ Completed" : t.status === "in_progress" ? "🔄 In Progress" : "⏳ Pending"}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {t.aiVerified ? (
                              <span style={{ color: "#16a34a", fontWeight: "600", fontSize: "12px" }}>
                                ✓ Verified Clean
                              </span>
                            ) : (
                              <span style={{ color: "#6b7280", fontSize: "12px" }}>
                                Pending completion
                              </span>
                            )}
                          </td>
                          <td style={styles.td}>
                            {new Date(t.createdAt).toLocaleDateString()}
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: "flex", gap: "6px" }}>
                              {t.report?.photoUrl && (
                                <img
                                  src={t.report.photoUrl}
                                  alt="Before"
                                  style={styles.thumbImg}
                                  title="Before Cleaning"
                                  onClick={() => setPreviewPhoto({ url: t.report.photoUrl, title: "Before Cleaning Photo" })}
                                />
                              )}
                              {t.afterPhotoUrl && (
                                <img
                                  src={t.afterPhotoUrl}
                                  alt="After"
                                  style={{ ...styles.thumbImg, borderColor: "#16a34a" }}
                                  title="After Cleaning"
                                  onClick={() => setPreviewPhoto({ url: t.afterPhotoUrl, title: "After Cleaning Photo" })}
                                />
                              )}
                            </div>
                          </td>
                          <td style={styles.td}>
                            {t.report && (
                              <button
                                onClick={() => handleOpenAssignModal(t.report)}
                                style={{ ...styles.assignBtn, background: "#ffffff", color: "#166534", border: "1px solid #166534" }}
                              >
                                🔄 Reassign
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Officer Directory Card */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>👮 Active Officers Directory</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                {officers.map((off) => {
                  const officerTasks = tasks.filter((t) => t.assignedTo?._id === off._id);
                  const activeCount = officerTasks.filter((t) => t.status !== "completed").length;
                  const completedCount = officerTasks.filter((t) => t.status === "completed").length;

                  return (
                    <div key={off._id} style={styles.officerProfileCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div>
                          <div style={{ fontWeight: "700", color: "#111827", fontSize: "15px" }}>
                            👮 {off.name}
                          </div>
                          <div style={{ fontSize: "12px", color: "#4b5563" }}>
                            {off.city || "General City"} {off.assignedWard ? `• ${off.assignedWard}` : ""}
                          </div>
                        </div>
                        <span style={{
                          padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600",
                          background: "#dcfce7", color: "#166534",
                        }}>
                          Active
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "12px" }}>
                        📧 {off.email} <br />
                        📞 {off.phone || "No phone listed"}
                      </div>
                      <div style={{ display: "flex", gap: "12px", borderTop: "1px solid #f3f4f6", paddingTop: "10px" }}>
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div style={{ fontWeight: "700", color: "#d97706", fontSize: "16px" }}>{activeCount}</div>
                          <div style={{ fontSize: "11px", color: "#6b7280" }}>Active Tasks</div>
                        </div>
                        <div style={{ flex: 1, textAlign: "center", borderLeft: "1px solid #f3f4f6" }}>
                          <div style={{ fontWeight: "700", color: "#16a34a", fontSize: "16px" }}>{completedCount}</div>
                          <div style={{ fontSize: "11px", color: "#6b7280" }}>Completed</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bins Tab */}
        {activeTab === "bins" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🗑️ All Registered Bins</h2>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Bin ID", "Address", "City", "Ward", "Area", "Fill %", "Status", "Type"].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bins.map((bin) => (
                    <tr key={bin._id} style={styles.tr}>
                      <td style={styles.td}>{bin.binId}</td>
                      <td style={styles.td}>{bin.location.address}</td>
                      <td style={styles.td}>{bin.city}</td>
                      <td style={styles.td}>{bin.ward}</td>
                      <td style={styles.td}>{bin.area}</td>
                      <td style={styles.td}>
                        <div style={styles.fillBar}>
                          <div style={{
                            ...styles.fillFill,
                            width: `${bin.fillLevel}%`,
                            background: bin.fillLevel >= 85 ? "#ef4444"
                              : bin.fillLevel >= 50 ? "#f59e0b" : "#10b981",
                          }} />
                          <span style={styles.fillText}>{bin.fillLevel}%</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusBadge,
                          background: bin.status === "critical" ? "#ef444422"
                            : bin.status === "medium" ? "#f59e0b22" : "#10b98122",
                          color: bin.status === "critical" ? "#ef4444"
                            : bin.status === "medium" ? "#d97706" : "#059669",
                        }}>
                          {bin.status}
                        </span>
                      </td>
                      <td style={styles.td}>{bin.locationType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Predictions Tab */}
        {activeTab === "predictions" && (
          <div style={styles.section}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={styles.sectionTitle}>🔮 Overflow Predictions</h2>
              <button onClick={fetchPredictions} style={styles.submitBtn}>
                {loadingPredictions ? "Analysing..." : "Run Predictions"}
              </button>
            </div>
            {predictions.length === 0 ? (
              <div style={styles.empty}>
                Click "Run Predictions" to analyse at-risk bins
              </div>
            ) : (
              predictions.map((p, i) => (
                <div key={i} style={{
                  background: "#ffffff", border: "1px solid",
                  borderColor: p.urgency === "critical" ? "#ef444444"
                    : p.urgency === "high" ? "#f59e0b44" : "#e5e7eb",
                  borderRadius: "10px", padding: "16px", marginBottom: "10px",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontWeight: "600", color: "#111827", fontSize: "14px", marginBottom: "4px" }}>
                        {p.bin} — {p.location}
                      </p>
                      <p style={{ fontSize: "13px", color: "#4b5563" }}>
                        {p.prediction}
                      </p>
                    </div>
                    {p.urgency && (
                      <span style={{
                        padding: "4px 12px", borderRadius: "20px", fontSize: "11px",
                        fontWeight: "700",
                        background: p.urgency === "critical" ? "#ef444422"
                          : p.urgency === "high" ? "#f59e0b22" : "#3b82f622",
                        color: p.urgency === "critical" ? "#ef4444"
                          : p.urgency === "high" ? "#d97706" : "#2563eb",
                      }}>
                        {p.urgency?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {p.hoursToOverflow !== null && p.hoursToOverflow !== undefined && (
                    <div style={{ display: "flex", gap: "20px", marginTop: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        ⏱️ ~{p.hoursToOverflow} hours to overflow
                      </span>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        📈 Fill rate: {p.currentFillRate}%/hr
                      </span>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        📊 Based on {p.dataPoints} data points
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Add Bin Tab */}
        {activeTab === "add bin" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>➕ Register New Bin</h2>
            <form onSubmit={handleAddBin} style={styles.addForm}>
              <div style={styles.formGrid}>
                {[
                  { key: "binId", placeholder: "Bin ID (e.g. MUM-WARD42-002)" },
                  { key: "address", placeholder: "Full Address" },
                  { key: "city", placeholder: "City (e.g. Mumbai)" },
                  { key: "ward", placeholder: "Ward (e.g. Ward 42)" },
                  { key: "area", placeholder: "Area (e.g. Andheri East)" },
                  { key: "latitude", placeholder: "Latitude (e.g. 19.1197)" },
                  { key: "longitude", placeholder: "Longitude (e.g. 72.8410)" },
                  { key: "capacity", placeholder: "Capacity in litres" },
                ].map(({ key, placeholder }) => (
                  <input
                    key={key}
                    type="text"
                    placeholder={placeholder}
                    style={styles.formInput}
                    value={newBin[key]}
                    onChange={(e) => setNewBin({ ...newBin, [key]: e.target.value })}
                    required
                  />
                ))}
                <select
                  style={styles.formInput}
                  value={newBin.locationType}
                  onChange={(e) => setNewBin({ ...newBin, locationType: e.target.value })}
                >
                  {["street", "market", "park", "hospital", "school",
                    "residential", "commercial", "bus stop", "railway station", "other"]
                    .map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button type="submit" style={styles.submitBtn}>
                ➕ Add Bin to City
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Assign / Reassign Officer Modal */}
      {assignModalOpen && selectedReport && (
        <div style={styles.modalOverlay} onClick={() => setAssignModalOpen(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#111827" }}>
                👮 Assign Task to Field Officer
              </h3>
              <button
                onClick={() => setAssignModalOpen(false)}
                style={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignSubmit}>
              <div style={styles.modalBody}>
                {/* Report Snapshot */}
                <div style={styles.reportSummaryBox}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {selectedReport.photoUrl && (
                      <img
                        src={selectedReport.photoUrl}
                        alt="Report"
                        style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover" }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "14px", color: "#111827" }}>
                        📍 {selectedReport.bin?.location?.address || `${selectedReport.city} ${selectedReport.ward}`}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                        Reported by: <strong>{selectedReport.citizen?.name || "Citizen"}</strong> • AI Score: <strong>{selectedReport.aiScore}%</strong> • Fill: <strong>{selectedReport.fillLevel}%</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Officer Selection */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={styles.label}>Select Field Officer *</label>
                  <select
                    value={selectedOfficerId}
                    onChange={(e) => setSelectedOfficerId(e.target.value)}
                    style={styles.formInput}
                    required
                  >
                    <option value="">-- Choose Officer --</option>
                    {officers.map((off) => (
                      <option key={off._id} value={off._id}>
                        👮 {off.name} ({off.city || "City"} {off.assignedWard ? `• ${off.assignedWard}` : ""})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={styles.label}>Task Priority</label>
                  <select
                    value={assignPriority}
                    onChange={(e) => setAssignPriority(e.target.value)}
                    style={styles.formInput}
                  >
                    <option value="critical">🚨 Critical (Immediate Pickup)</option>
                    <option value="high">⚠️ High</option>
                    <option value="medium">⚡ Medium</option>
                    <option value="low">🌱 Low</option>
                  </select>
                </div>

                {/* Notes / Instructions */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={styles.label}>Instructions for Officer (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Bin overflowing near main gate, verify after cleaning photo with AI..."
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    style={{ ...styles.formInput, resize: "vertical", fontFamily: "inherit" }}
                  />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  style={styles.confirmBtn}
                >
                  {assignLoading ? "Assigning..." : "Confirm & Dispatch Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div style={styles.modalOverlay} onClick={() => setPreviewPhoto(null)}>
          <div style={{ ...styles.modalContent, maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#111827" }}>
                📷 {previewPhoto.title || "Photo Preview"}
              </h3>
              <button onClick={() => setPreviewPhoto(null)} style={styles.closeBtn}>✕</button>
            </div>
            <div style={{ padding: "16px", textAlign: "center" }}>
              <img
                src={previewPhoto.url}
                alt="Enlarged"
                style={{ width: "100%", maxHeight: "400px", objectFit: "contain", borderRadius: "8px" }}
              />
              {previewPhoto.labels && previewPhoto.labels.length > 0 && (
                <div style={{ marginTop: "12px", display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                  {previewPhoto.labels.map((l, i) => (
                    <span key={i} style={{ fontSize: "11px", background: "#f3f4f6", padding: "3px 8px", borderRadius: "12px", color: "#374151" }}>
                      🏷️ {l}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  pdfBtn: {
    padding: "10px 18px", background: "#ffffff",
    border: "1px solid #166534", borderRadius: "8px",
    color: "#166534", fontSize: "13px", cursor: "pointer",
    fontWeight: "600", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    marginLeft: "auto",
  },
  page: { minHeight: "100vh", background: "#f4f6f9" },
  container: { padding: "24px", maxWidth: "1440px", margin: "0 auto" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center",
    height: "100vh", color: "#166534", fontSize: "18px" },
  statsRow: { display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" },
  tabs: { display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap", alignItems: "center" },
  tab: { padding: "10px 18px", background: "#ffffff", border: "1px solid #e5e7eb",
    borderRadius: "8px", color: "#4b5563", fontSize: "14px", cursor: "pointer", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", fontWeight: "500" },
  tabActive: { background: "#166534", color: "#ffffff", border: "1px solid #166534",
    fontWeight: "600" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  section: { background: "#ffffff", border: "1px solid #e5e7eb",
    borderRadius: "12px", padding: "20px", marginBottom: "24px", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)" },
  sectionTitle: { fontSize: "17px", fontWeight: "700", color: "#111827",
    marginBottom: "16px" },
  empty: { color: "#6b7280", textAlign: "center", padding: "40px" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  th: { padding: "12px 14px", textAlign: "left", fontSize: "12px", color: "#4b5563",
    borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.03em" },
  tr: { borderBottom: "1px solid #f3f4f6", transition: "background 0.2s" },
  td: { padding: "12px 14px", fontSize: "13px", color: "#1f2937", verticalAlign: "middle" },
  fillBar: { position: "relative", background: "#e5e7eb", borderRadius: "4px",
    height: "18px", width: "70px", overflow: "hidden" },
  fillFill: { position: "absolute", top: 0, left: 0, height: "100%",
    borderRadius: "4px", transition: "width 0.3s" },
  fillText: { position: "absolute", top: 0, left: 0, right: 0,
    textAlign: "center", fontSize: "10px", lineHeight: "18px", color: "#ffffff", fontWeight: "700", textShadow: "0 0 2px rgba(0,0,0,0.6)" },
  statusBadge: { padding: "3px 10px", borderRadius: "20px",
    fontSize: "11px", fontWeight: "700", textTransform: "capitalize", display: "inline-block" },
  binCode: { fontSize: "11px", background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px", color: "#4b5563", fontFamily: "monospace", display: "inline-block", marginTop: "2px" },
  thumbImg: { width: "42px", height: "42px", borderRadius: "6px", objectFit: "cover", cursor: "pointer", border: "1px solid #e5e7eb" },
  officerCard: { background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 10px", borderRadius: "8px" },
  assignBtn: { padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" },
  addForm: { display: "flex", flexDirection: "column", gap: "16px" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  formInput: { padding: "10px 14px", background: "#f9fafb",
    border: "1px solid #d1d5db", borderRadius: "8px", color: "#1f2937", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  label: { display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" },
  submitBtn: { padding: "12px 24px", background: "#166534", color: "#ffffff",
    border: "none", borderRadius: "8px", fontSize: "14px",
    fontWeight: "600", cursor: "pointer", width: "fit-content", boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)" },
  miniCard: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px", display: "flex", alignItems: "center", gap: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  miniVal: { fontSize: "22px", fontWeight: "700", color: "#111827" },
  miniLabel: { fontSize: "12px", color: "#6b7280" },
  officerProfileCard: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modalContent: { background: "#ffffff", borderRadius: "12px", width: "100%", maxWidth: "520px", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" },
  closeBtn: { background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#6b7280" },
  modalBody: { padding: "20px" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: "10px", padding: "14px 20px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" },
  reportSummaryBox: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", marginBottom: "16px" },
  cancelBtn: { padding: "8px 16px", background: "#ffffff", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px", fontWeight: "500", cursor: "pointer", color: "#374151" },
  confirmBtn: { padding: "8px 18px", background: "#166534", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer", color: "#ffffff" },
};