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

  useEffect(() => {
    fetchAll();
  }, []);

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

  // Chart data — reports by priority
  const chartData = [
    { name: "Critical", count: reports.filter(r => r.priority === "critical").length, color: "#ef476f" },
    { name: "High", count: reports.filter(r => r.priority === "high").length, color: "#ffb703" },
    { name: "Medium", count: reports.filter(r => r.priority === "medium").length, color: "#00b4d8" },
    { name: "Low", count: reports.filter(r => r.priority === "low").length, color: "#06d6a0" },
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
          <StatsCard title="Total Bins" value={stats.total} color="#00b4d8" icon="🗑️" />
          <StatsCard title="Critical" value={stats.critical} color="#ef476f" icon="🚨" />
          <StatsCard title="Medium" value={stats.medium} color="#ffb703" icon="⚠️" />
          <StatsCard title="Clean" value={stats.clean} color="#06d6a0" icon="✅" />
          <StatsCard title="Reports" value={reports.length} color="#8ecae6" icon="📋" />
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {["overview", "bins", "reports", "add bin"].map((tab) => (
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a55" />
                    <XAxis dataKey="name" stroke="#8ecae6" fontSize={12} />
                    <YAxis stroke="#8ecae6" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "#152539",
                        border: "1px solid #1e3a55",
                        borderRadius: "8px",
                        color: "#fff",
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
                            background: bin.fillLevel >= 85 ? "#ef476f"
                              : bin.fillLevel >= 50 ? "#ffb703" : "#06d6a0",
                          }} />
                          <span style={styles.fillText}>{bin.fillLevel}%</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusBadge,
                          background: bin.status === "critical" ? "#ef476f22"
                            : bin.status === "medium" ? "#ffb70322" : "#06d6a022",
                          color: bin.status === "critical" ? "#ef476f"
                            : bin.status === "medium" ? "#ffb703" : "#06d6a0",
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
                          background: r.priority === "critical" ? "#ef476f22"
                            : r.priority === "high" ? "#ffb70322" : "#00b4d822",
                          color: r.priority === "critical" ? "#ef476f"
                            : r.priority === "high" ? "#ffb703" : "#00b4d8",
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
  page: { minHeight: "100vh", background: "#0d1b2a" },
  container: { padding: "24px", maxWidth: "1400px", margin: "0 auto" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center",
    height: "100vh", color: "#00b4d8", fontSize: "18px" },
  statsRow: { display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" },
  tabs: { display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" },
  tab: { padding: "10px 20px", background: "#152539", border: "1px solid #1e3a55",
    borderRadius: "8px", color: "#8ecae6", fontSize: "14px", cursor: "pointer" },
  tabActive: { background: "#00b4d8", color: "#0d1b2a", border: "1px solid #00b4d8",
    fontWeight: "600" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  section: { background: "#152539", border: "1px solid #1e3a55",
    borderRadius: "12px", padding: "20px", marginBottom: "24px" },
  sectionTitle: { fontSize: "16px", fontWeight: "600", color: "#ffffff",
    marginBottom: "16px" },
  empty: { color: "#8ecae6", textAlign: "center", padding: "40px" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "12px", textAlign: "left", fontSize: "12px", color: "#8ecae6",
    borderBottom: "1px solid #1e3a55", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #1e3a5533" },
  td: { padding: "12px", fontSize: "13px", color: "#ffffff" },
  fillBar: { position: "relative", background: "#0d1b2a", borderRadius: "4px",
    height: "20px", width: "80px", overflow: "hidden" },
  fillFill: { position: "absolute", top: 0, left: 0, height: "100%",
    borderRadius: "4px", transition: "width 0.3s" },
  fillText: { position: "absolute", top: 0, left: 0, right: 0,
    textAlign: "center", fontSize: "11px", lineHeight: "20px", color: "#fff" },
  statusBadge: { padding: "3px 10px", borderRadius: "20px",
    fontSize: "11px", fontWeight: "600", textTransform: "capitalize" },
  addForm: { display: "flex", flexDirection: "column", gap: "16px" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  formInput: { padding: "12px 14px", background: "#0d1b2a",
    border: "1px solid #1e3a55", borderRadius: "8px", color: "#ffffff", fontSize: "14px" },
  submitBtn: { padding: "13px", background: "#00b4d8", color: "#0d1b2a",
    border: "none", borderRadius: "8px", fontSize: "15px",
    fontWeight: "600", cursor: "pointer", width: "fit-content" },
};