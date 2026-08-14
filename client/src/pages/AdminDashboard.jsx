import { useState, useEffect } from "react";
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
  const [bins, setBins] = useState([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, medium: 0, clean: 0 });
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
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
    } catch (error) {
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
      return () => {
        socket.off("new_critical_report", handleUpdate);
        socket.off("task_completed", handleUpdate);
      };
    }
  }, [socket]);

  const fetchAll = async () => {
    try {
      const [binsRes, statsRes, reportsRes] = await Promise.all([
        API.get("/bins"),
        API.get("/bins/stats"),
        API.get("/reports"),
      ]);
      setBins(binsRes.data);
      setStats(statsRes.data);
      setReports(reportsRes.data);
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
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


// @route  GET /api/analytics/export-pdf
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
    toast.success("PDF report downloaded!");
  } catch (error) {
    toast.error("Failed to export PDF");
  }
};

  // Chart data — reports by priority
  const chartData = [
    { name: "Critical", count: reports.filter(r => r.priority === "critical").length, color: "#ef4444" },
    { name: "High", count: reports.filter(r => r.priority === "high").length, color: "#f59e0b" },
    { name: "Medium", count: reports.filter(r => r.priority === "medium").length, color: "#3b82f6" },
    { name: "Low", count: reports.filter(r => r.priority === "low").length, color: "#10b981" },
  ];

  if (loading) return (
    <div style={styles.loading}>Loading SmartBin Dashboard...</div>
  );

  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.container}>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          <StatsCard title="Total Bins" value={stats.total} color="#1e40af" icon="🗑️" />
          <StatsCard title="Critical" value={stats.critical} color="#ef4444" icon="🚨" />
          <StatsCard title="Medium" value={stats.medium} color="#f59e0b" icon="⚠️" />
          <StatsCard title="Clean" value={stats.clean} color="#10b981" icon="✅" />
          <StatsCard title="Reports" value={reports.length} color="#6b7280" icon="📋" />
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {["overview", "bins", "reports", "predictions", "add bin"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {}),
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
            
          ))}
          <button onClick={handleExportPDF} style={styles.pdfBtn}>
  📄 Export PDF Report
</button>

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

        {/* Bins Tab */}
        {activeTab === "bins" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🗑️ All Registered Bins</h2>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Bin ID", "Address", "City", "Ward", "Area", "Fill %", "Status", "Type"].map(h => (
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

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📋 All Reports</h2>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Citizen", "Location", "Fill %", "AI Score", "Priority", "Status", "Date"].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r._id} style={styles.tr}>
                      <td style={styles.td}>{r.citizen?.name}</td>
                      <td style={styles.td}>{r.bin?.location?.address}</td>
                      <td style={styles.td}>{r.fillLevel}%</td>
                      <td style={styles.td}>{r.aiScore}%</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusBadge,
                          background: r.priority === "critical" ? "#ef444422"
                            : r.priority === "high" ? "#f59e0b22" : "#3b82f622",
                          color: r.priority === "critical" ? "#ef4444"
                            : r.priority === "high" ? "#d97706" : "#2563eb",
                        }}>
                          {r.priority}
                        </span>
                      </td>
                      <td style={styles.td}>{r.status}</td>
                      <td style={styles.td}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
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
                    .map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button type="submit" style={styles.submitBtn}>
                ➕ Add Bin to City
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

const styles = {
  pdfBtn: {
    padding: "10px 18px", background: "#ffffff",
    border: "1px solid #d1d5db", borderRadius: "8px",
    color: "#166534", fontSize: "13px", cursor: "pointer",
    fontWeight: "500", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
  page: { minHeight: "100vh", background: "#f4f6f9" },
  container: { padding: "24px", maxWidth: "1400px", margin: "0 auto" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center",
    height: "100vh", color: "#166534", fontSize: "18px" },
  statsRow: { display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" },
  tabs: { display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" },
  tab: { padding: "10px 20px", background: "#ffffff", border: "1px solid #e5e7eb",
    borderRadius: "8px", color: "#4b5563", fontSize: "14px", cursor: "pointer", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" },
  tabActive: { background: "#166534", color: "#ffffff", border: "1px solid #166534",
    fontWeight: "600" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  section: { background: "#ffffff", border: "1px solid #e5e7eb",
    borderRadius: "12px", padding: "20px", marginBottom: "24px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" },
  sectionTitle: { fontSize: "16px", fontWeight: "600", color: "#111827",
    marginBottom: "16px" },
  empty: { color: "#6b7280", textAlign: "center", padding: "40px" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "12px", textAlign: "left", fontSize: "12px", color: "#6b7280",
    borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #e5e7eb" },
  td: { padding: "12px", fontSize: "13px", color: "#1f2937" },
  fillBar: { position: "relative", background: "#e5e7eb", borderRadius: "4px",
    height: "20px", width: "80px", overflow: "hidden" },
  fillFill: { position: "absolute", top: 0, left: 0, height: "100%",
    borderRadius: "4px", transition: "width 0.3s" },
  fillText: { position: "absolute", top: 0, left: 0, right: 0,
    textAlign: "center", fontSize: "11px", lineHeight: "20px", color: "#ffffff", textShadow: "0 0 2px rgba(0,0,0,0.5)" },
  statusBadge: { padding: "3px 10px", borderRadius: "20px",
    fontSize: "11px", fontWeight: "600", textTransform: "capitalize" },
  addForm: { display: "flex", flexDirection: "column", gap: "16px" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  formInput: { padding: "12px 14px", background: "#f9fafb",
    border: "1px solid #d1d5db", borderRadius: "8px", color: "#1f2937", fontSize: "14px", transition: "border-color 0.2s" },
  submitBtn: { padding: "13px", background: "#166534", color: "#ffffff",
    border: "none", borderRadius: "8px", fontSize: "15px",
    fontWeight: "600", cursor: "pointer", width: "fit-content", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" },
};