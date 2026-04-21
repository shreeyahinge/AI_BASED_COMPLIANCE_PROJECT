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

const statusColor = {
  pending: "#ffb703",
  assigned: "#00b4d8",
  resolved: "#06d6a0",
  rejected: "#ef476f",
};

export default function CitizenDashboard() {
  const { user } = useAuth();
  const [bins, setBins] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [activeTab, setActiveTab] = useState("report");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);


  const [uploadingPhoto, setUploadingPhoto] = useState(false);

const handlePhotoUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setUploadingPhoto(true);
  try {
    const formData = new FormData();
    formData.append("photo", file);
    const { data } = await API.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setForm((prev) => ({ ...prev, photoUrl: data.url }));
    toast.success("Photo uploaded!");
  } catch (error) {
    toast.error("Photo upload failed");
  } finally {
    setUploadingPhoto(false);
  }
};


  const [form, setForm] = useState({
    binId: "",
    photoUrl: "",
    aiScore: "",
    fillLevel: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [binsRes, reportsRes] = await Promise.all([
        API.get("/bins"),
        API.get("/reports/my"),
      ]);
      setBins(binsRes.data);
      setMyReports(reportsRes.data);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!form.binId) {
      toast.error("Please select a bin");
      return;
    }
    setSubmitting(true);
    try {
      await API.post("/reports", {
        binId: form.binId,
        photoUrl: form.photoUrl || "https://example.com/bin-photo.jpg",
        aiScore: parseFloat(form.aiScore) || 75,
        aiLabels: ["garbage bin", "waste"],
        fillLevel: parseFloat(form.fillLevel) || 70,
        notes: form.notes,
        latitude: bins.find(b => b._id === form.binId)?.location.coordinates[1],
        longitude: bins.find(b => b._id === form.binId)?.location.coordinates[0],
      });
      toast.success("✅ Report submitted! +10 Green Points earned!");
      setForm({ binId: "", photoUrl: "", aiScore: "", fillLevel: "", notes: "" });
      fetchData();
      setActiveTab("my reports");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={styles.loading}>Loading...</div>
  );

  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.container}>

        {/* Welcome + Points Banner */}
        <div style={styles.banner}>
          <div>
            <h2 style={styles.welcome}>Welcome, {user?.name}! 👋</h2>
            <p style={styles.welcomeSub}>
              Help keep your city clean by reporting overflowing bins
            </p>
          </div>
          <div style={styles.pointsBox}>
            <span style={styles.pointsNum}>{user?.greenPoints || 0}</span>
            <span style={styles.pointsLabel}>⭐ Green Points</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <span style={{ color: "#00b4d8", fontSize: "28px", fontWeight: "700" }}>
              {myReports.length}
            </span>
            <p style={styles.statLabel}>Total Reports</p>
          </div>
          <div style={styles.statCard}>
            <span style={{ color: "#06d6a0", fontSize: "28px", fontWeight: "700" }}>
              {myReports.filter(r => r.status === "resolved").length}
            </span>
            <p style={styles.statLabel}>Resolved</p>
          </div>
          <div style={styles.statCard}>
            <span style={{ color: "#ffb703", fontSize: "28px", fontWeight: "700" }}>
              {myReports.filter(r => r.status === "pending").length}
            </span>
            <p style={styles.statLabel}>Pending</p>
          </div>
          <div style={styles.statCard}>
            <span style={{ color: "#ef476f", fontSize: "28px", fontWeight: "700" }}>
              {myReports.filter(r => r.priority === "critical").length}
            </span>
            <p style={styles.statLabel}>Critical Reports</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {["report", "my reports", "bins map"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {}),
              }}
            >
              {tab === "report" && "📷 "}
              {tab === "my reports" && "📋 "}
              {tab === "bins map" && "🗺️ "}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Report Tab */}
        {activeTab === "report" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📷 Report an Overflowing Bin</h2>
            <p style={styles.sectionSub}>
              Select the bin, add details and submit. You'll earn 10 Green Points!
            </p>
            <form onSubmit={handleSubmitReport} style={styles.form}>

              {/* Bin Selector */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Select Bin *</label>
                <select
                  style={styles.input}
                  value={form.binId}
                  onChange={(e) => setForm({ ...form, binId: e.target.value })}
                  required
                >
                  <option value="">-- Choose a bin --</option>
                  {bins.map((bin) => (
                    <option key={bin._id} value={bin._id}>
                      {bin.binId} — {bin.location.address} ({bin.area})
                    </option>
                  ))}
                </select>
              </div>

              {/* Fill Level */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Estimated Fill Level: {form.fillLevel || 70}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  style={styles.slider}
                  value={form.fillLevel || 70}
                  onChange={(e) => setForm({ ...form, fillLevel: e.target.value })}
                />
                <div style={styles.fillPreview}>
                  <div style={{
                    ...styles.fillBar,
                    width: `${form.fillLevel || 70}%`,
                    background: (form.fillLevel || 70) >= 85 ? "#ef476f"
                      : (form.fillLevel || 70) >= 50 ? "#ffb703" : "#06d6a0",
                  }} />
                </div>
              </div>

              {/* AI Score (simulated for now) */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>AI Confidence Score (0-100)</label>
                <input
                  type="number"
                  placeholder="e.g. 85 (will be auto-detected in production)"
                  style={styles.input}
                  value={form.aiScore}
                  onChange={(e) => setForm({ ...form, aiScore: e.target.value })}
                  min="0"
                  max="100"
                />
              </div>

             {/* Photo Upload */}
<div style={styles.fieldGroup}>
  <label style={styles.label}>📷 Upload Photo *</label>
  <input
    type="file"
    accept="image/*"
    capture="environment"
    style={styles.fileInput}
    onChange={handlePhotoUpload}
  />
  {uploadingPhoto && (
    <p style={styles.uploadStatus}>⏳ Uploading photo...</p>
  )}
  {form.photoUrl && (
    <div style={styles.photoPreview}>
      <img
        src={form.photoUrl}
        alt="Bin preview"
        style={styles.previewImg}
      />
      <p style={styles.uploadStatus}>✅ Photo uploaded!</p>
    </div>
  )}
</div>

              {/* Notes */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Notes (optional)</label>
                <textarea
                  placeholder="Any additional details about the bin condition..."
                  style={{ ...styles.input, height: "90px", resize: "vertical" }}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <button
                type="submit"
                style={submitting ? { ...styles.submitBtn, opacity: 0.7 } : styles.submitBtn}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "📷 Submit Report (+10 pts)"}
              </button>
            </form>
          </div>
        )}

        {/* My Reports Tab */}
        {activeTab === "my reports" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📋 My Reports</h2>
            {myReports.length === 0 ? (
              <div style={styles.empty}>
                <p>No reports yet!</p>
                <p style={{ fontSize: "13px", marginTop: "8px" }}>
                  Submit your first report to earn Green Points 🌱
                </p>
              </div>
            ) : (
              <div style={styles.reportsList}>
                {myReports.map((r) => (
                  <div key={r._id} style={styles.reportCard}>
                    <div style={styles.reportTop}>
                      <div>
                        <p style={styles.reportAddress}>
                          📍 {r.bin?.location?.address}
                        </p>
                        <p style={styles.reportMeta}>
                          {r.bin?.area} · {r.bin?.ward} · {r.bin?.city}
                        </p>
                      </div>
                      <div style={styles.reportBadges}>
                        <span style={{
                          ...styles.badge,
                          background: priorityColor[r.priority] + "22",
                          color: priorityColor[r.priority],
                        }}>
                          {r.priority}
                        </span>
                        <span style={{
                          ...styles.badge,
                          background: statusColor[r.status] + "22",
                          color: statusColor[r.status],
                        }}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                    <div style={styles.reportBottom}>
                      <span style={styles.reportDetail}>
                        🤖 AI Score: {r.aiScore}%
                      </span>
                      <span style={styles.reportDetail}>
                        📊 Fill: {r.fillLevel}%
                      </span>
                      <span style={styles.reportDetail}>
                        📅 {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {r.notes && (
                      <p style={styles.reportNotes}>"{r.notes}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bins Map Tab */}
        {activeTab === "bins map" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🗺️ City Bins Near You</h2>
            <div style={styles.binsList}>
              {bins.map((bin) => (
                <div
                  key={bin._id}
                  style={{
                    ...styles.binCard,
                    borderColor: bin.status === "critical" ? "#ef476f44"
                      : bin.status === "medium" ? "#ffb70344" : "#06d6a044",
                  }}
                  onClick={() => {
                    setForm({ ...form, binId: bin._id });
                    setActiveTab("report");
                    toast.success(`Selected: ${bin.binId}`);
                  }}
                >
                  <div style={styles.binTop}>
                    <span style={styles.binId}>{bin.binId}</span>
                    <span style={{
                      ...styles.badge,
                      background: bin.status === "critical" ? "#ef476f22"
                        : bin.status === "medium" ? "#ffb70322" : "#06d6a022",
                      color: bin.status === "critical" ? "#ef476f"
                        : bin.status === "medium" ? "#ffb703" : "#06d6a0",
                    }}>
                      {bin.status}
                    </span>
                  </div>
                  <p style={styles.binAddress}>{bin.location.address}</p>
                  <p style={styles.binMeta}>{bin.area} · {bin.ward}</p>
                  <div style={styles.binFillWrap}>
                    <div style={styles.binFillBar}>
                      <div style={{
                        height: "100%",
                        width: `${bin.fillLevel}%`,
                        background: bin.fillLevel >= 85 ? "#ef476f"
                          : bin.fillLevel >= 50 ? "#ffb703" : "#06d6a0",
                        borderRadius: "4px",
                        transition: "width 0.3s",
                      }} />
                    </div>
                    <span style={styles.binFillText}>{bin.fillLevel}%</span>
                  </div>
                  <p style={styles.binTap}>Tap to report this bin →</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#0d1b2a" },
  container: { padding: "24px", maxWidth: "1000px", margin: "0 auto" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center",
    height: "100vh", color: "#ffb703", fontSize: "18px" },
  banner: { display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#152539", border: "1px solid #1e3a55", borderRadius: "12px",
    padding: "20px 24px", marginBottom: "20px" },
  welcome: { fontSize: "20px", fontWeight: "700", color: "#ffffff", marginBottom: "4px" },
  welcomeSub: { fontSize: "13px", color: "#8ecae6" },
  pointsBox: { textAlign: "center", background: "#0d1b2a", borderRadius: "12px",
    padding: "12px 20px", border: "1px solid #ffb70344" },
  pointsNum: { display: "block", fontSize: "32px", fontWeight: "700", color: "#ffb703" },
  pointsLabel: { fontSize: "12px", color: "#8ecae6" },
  statsRow: { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  statCard: { flex: 1, minWidth: "120px", background: "#152539",
    border: "1px solid #1e3a55", borderRadius: "10px", padding: "16px",
    textAlign: "center" },
  statLabel: { fontSize: "12px", color: "#8ecae6", marginTop: "4px" },
  tabs: { display: "flex", gap: "8px", marginBottom: "20px" },
  tab: { padding: "10px 18px", background: "#152539", border: "1px solid #1e3a55",
    borderRadius: "8px", color: "#8ecae6", fontSize: "14px", cursor: "pointer" },
  tabActive: { background: "#ffb703", color: "#0d1b2a",
    border: "1px solid #ffb703", fontWeight: "600" },
  section: { background: "#152539", border: "1px solid #1e3a55",
    borderRadius: "12px", padding: "24px" },
  sectionTitle: { fontSize: "16px", fontWeight: "600", color: "#ffffff",
    marginBottom: "6px" },
  sectionSub: { fontSize: "13px", color: "#8ecae6", marginBottom: "20px" },
  form: { display: "flex", flexDirection: "column", gap: "18px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", color: "#8ecae6", fontWeight: "500" },
  input: { padding: "12px 14px", background: "#0d1b2a", border: "1px solid #1e3a55",
    borderRadius: "8px", color: "#ffffff", fontSize: "14px", width: "100%" },
  slider: { width: "100%", accentColor: "#ffb703" },
  fillPreview: { height: "8px", background: "#0d1b2a", borderRadius: "4px",
    overflow: "hidden", marginTop: "6px" },
  fillBar: { height: "100%", borderRadius: "4px", transition: "width 0.3s" },
  submitBtn: { padding: "14px", background: "#ffb703", color: "#0d1b2a",
    border: "none", borderRadius: "8px", fontSize: "15px",
    fontWeight: "700", cursor: "pointer" },
  empty: { textAlign: "center", padding: "40px", color: "#8ecae6" },
  reportsList: { display: "flex", flexDirection: "column", gap: "12px" },
  reportCard: { background: "#0d1b2a", border: "1px solid #1e3a55",
    borderRadius: "10px", padding: "16px" },
  reportTop: { display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: "10px" },
  reportAddress: { fontSize: "14px", fontWeight: "600", color: "#ffffff",
    marginBottom: "3px" },
  reportMeta: { fontSize: "12px", color: "#8ecae6" },
  reportBadges: { display: "flex", gap: "6px", flexShrink: 0 },
  reportBottom: { display: "flex", gap: "16px", flexWrap: "wrap" },
  reportDetail: { fontSize: "12px", color: "#8ecae6" },
  reportNotes: { fontSize: "12px", color: "#8ecae6", fontStyle: "italic",
    marginTop: "8px", borderTop: "1px solid #1e3a55", paddingTop: "8px" },
  badge: { padding: "3px 10px", borderRadius: "20px", fontSize: "11px",
    fontWeight: "600", textTransform: "capitalize" },
  binsList: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "12px" },
  binCard: { background: "#0d1b2a", border: "1px solid", borderRadius: "10px",
    padding: "16px", cursor: "pointer", transition: "transform 0.2s" },
  binTop: { display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "8px" },
  binId: { fontSize: "13px", fontWeight: "700", color: "#00b4d8" },
  binAddress: { fontSize: "13px", color: "#ffffff", marginBottom: "3px" },
  binMeta: { fontSize: "11px", color: "#8ecae6", marginBottom: "10px" },
  binFillWrap: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" },
  binFillBar: { flex: 1, height: "6px", background: "#1e3a55",
    borderRadius: "4px", overflow: "hidden" },
  binFillText: { fontSize: "11px", color: "#8ecae6", minWidth: "30px" },
  binTap: { fontSize: "11px", color: "#8ecae6", marginTop: "4px" },

  fileInput: {
  padding: "10px", background: "#0d1b2a",
  border: "1px solid #1e3a55", borderRadius: "8px",
  color: "#8ecae6", fontSize: "13px", width: "100%",
  cursor: "pointer",
},
uploadStatus: { fontSize: "12px", color: "#8ecae6", marginTop: "6px" },
photoPreview: { marginTop: "10px" },
previewImg: {
  width: "100%", maxHeight: "200px",
  objectFit: "cover", borderRadius: "8px",
  border: "1px solid #1e3a55",
},


};