import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import API from "../api/axios";
import toast from "react-hot-toast";
import { useSocket } from "../context/SocketContext";

export default function CameraStation() {
  const [bins, setBins] = useState([]);
  const [selectedBinId, setSelectedBinId] = useState("");
  
  // Connection Mode: "phone" | "ip_stream" | "webcam" | "upload"
  const [connectionMode, setConnectionMode] = useState("phone");
  const [ipStreamUrl, setIpStreamUrl] = useState("http://192.168.0.105:8080/video");
  const [isIpStreaming, setIsIpStreaming] = useState(false);

  // Camera & Detection state
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // back camera for phone
  const [autoScan, setAutoScan] = useState(true);
  const [scanInterval, setScanInterval] = useState(10); // seconds
  const [countdown, setCountdown] = useState(10);
  const [isScanning, setIsScanning] = useState(false);

  // Telemetry & Results
  const [latestResult, setLatestResult] = useState(null);
  const [lastCapturedImage, setLastCapturedImage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [soundAlert, setSoundAlert] = useState(true);

  const videoRef = useRef(null);
  const ipImageRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const countdownTimerRef = useRef(null);

  const { socket } = useSocket();

  useEffect(() => {
    fetchBins();
    addLog("Admin CCTV Station initialized. Select connection source to begin monitoring.", "info");

    return () => {
      stopCamera();
      clearInterval(countdownTimerRef.current);
    };
  }, []);

  const fetchBins = async () => {
    try {
      const res = await API.get("/bins");
      setBins(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedBinId(res.data[0]._id);
      }
    } catch {
      toast.error("Failed to load bins list");
    }
  };

  const selectedBin = bins.find((b) => b._id === selectedBinId);

  const addLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [
      { id: Date.now() + Math.random(), time: timestamp, message, type },
      ...prev.slice(0, 35),
    ]);
  };

  // Start Local / Phone Camera
  const startCamera = async (mode = facingMode) => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      addLog(`Live camera feed online (${mode === "environment" ? "Phone Rear CCTV" : "Webcam"})`, "success");
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera. Please allow camera permissions.");
      addLog(`Camera error: ${err.message}`, "error");
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setIsIpStreaming(false);
    clearInterval(countdownTimerRef.current);
  };

  // Flip Camera
  const toggleFacingMode = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    if (cameraActive) startCamera(next);
  };

  // Start IP Road Camera stream
  const startIpStream = () => {
    if (!ipStreamUrl) {
      toast.error("Please enter a valid IP Camera Stream URL");
      return;
    }
    stopCamera();
    setIsIpStreaming(true);
    addLog(`Connected to Road CCTV Stream: ${ipStreamUrl}`, "success");
    toast.success("Connected to IP Road Camera Stream!");
  };

  // Auto-Scan interval effect
  useEffect(() => {
    if (autoScan && (cameraActive || isIpStreaming) && selectedBinId) {
      setCountdown(scanInterval);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            captureAndDetect();
            return scanInterval;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(countdownTimerRef.current);
      setCountdown(scanInterval);
    }

    return () => clearInterval(countdownTimerRef.current);
  }, [autoScan, cameraActive, isIpStreaming, selectedBinId, scanInterval]);

  // Capture frame from active stream
  const captureAndDetect = async () => {
    if (!selectedBinId) {
      toast.error("Please select a target bin");
      return;
    }

    if (isIpStreaming && ipImageRef.current) {
      // Capture from IP Camera MJPEG stream
      try {
        const img = ipImageRef.current;
        const canvas = canvasRef.current;
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 480;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
        setLastCapturedImage(imageBase64);
        await processFrame(imageBase64);
      } catch (err) {
        addLog(`IP Camera frame capture error: ${err.message}`, "error");
      }
      return;
    }

    if (cameraActive && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
      setLastCapturedImage(imageBase64);
      await processFrame(imageBase64);
    }
  };

  // Send frame to Backend for AI analysis and auto-dispatch
  const processFrame = async (imageBase64) => {
    if (isScanning) return;
    setIsScanning(true);
    addLog(`Analysing CCTV frame for ${selectedBin?.binId || "Target Bin"}...`, "info");

    try {
      const res = await API.post(`/bins/${selectedBinId}/live-detect`, {
        imageBase64,
        source: connectionMode === "phone" ? "phone_cctv" : "road_cctv",
      });

      const data = res.data;
      setLatestResult(data);

      const fill = data.aiResult?.fillLevel || 0;
      const isCritical = fill >= 75;

      // Update local bin state
      setBins((prev) =>
        prev.map((b) =>
          b._id === selectedBinId
            ? { ...b, fillLevel: fill, status: isCritical ? "critical" : fill >= 50 ? "medium" : "clean" }
            : b
        )
      );

      if (data.alertDispatched || isCritical) {
        addLog(
          `🚨 [CRITICAL OVERFLOW DETECTED] Fill: ${fill}%! Bin marked CRITICAL. Auto-dispatched cleanup task to Officer!`,
          "critical"
        );
        toast.error(`🚨 Critical Overflow (${fill}%)! Bin marked CRITICAL & Task sent to Officer!`, { duration: 7000 });
        if (soundAlert) playAlertTone();
      } else if (fill >= 50) {
        addLog(`⚠️ Medium Fill Level: ${fill}%. Accumulation in progress.`, "warning");
      } else {
        addLog(`✅ CCTV Scan: ${fill}% Fill level (${data.aiResult?.wasteType || "normal"}). Bin is Clean.`, "success");
      }
    } catch (err) {
      console.error("Live detection error:", err);
      addLog(`Detection error: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setIsScanning(false);
    }
  };

  // Manual File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setLastCapturedImage(base64);
      processFrame(base64);
    };
    reader.readAsDataURL(file);
  };

  // Audio tone for critical alerts
  const playAlertTone = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.log("Audio not supported", e);
    }
  };

  const isLive = cameraActive || isIpStreaming;

  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.container}>

        {/* Top Control Bar */}
        <div style={styles.headerCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>📹</span>
                <div>
                  <h1 style={styles.title}>Admin Live Road CCTV & Phone Surveillance</h1>
                  <p style={styles.subtitle}>
                    Connect your phone camera or road CCTV stream. The system continuously watches the dustbin, detects fill %, marks it critical, and notifies the officer automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Target Bin Selector */}
            <div style={styles.binSelectorBox}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#166534", display: "block", marginBottom: "4px" }}>
                🎯 Target Dustbin:
              </label>
              <select
                value={selectedBinId}
                onChange={(e) => setSelectedBinId(e.target.value)}
                style={styles.select}
              >
                {bins.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.binId || "BIN"} — {b.location?.address || b.city} (Ward: {b.ward || "All"}) • {b.fillLevel || 0}%
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Connection Source Selector Tabs */}
          <div style={styles.sourceTabs}>
            <button
              onClick={() => { setConnectionMode("phone"); stopCamera(); }}
              style={{
                ...styles.sourceTab,
                ...(connectionMode === "phone" ? styles.sourceTabActive : {}),
              }}
            >
              📱 Phone Rear Camera (Mobile CCTV)
            </button>
            <button
              onClick={() => { setConnectionMode("ip_stream"); stopCamera(); }}
              style={{
                ...styles.sourceTab,
                ...(connectionMode === "ip_stream" ? styles.sourceTabActive : {}),
              }}
            >
              🌐 Road CCTV / IP Stream URL
            </button>
            <button
              onClick={() => { setConnectionMode("webcam"); stopCamera(); }}
              style={{
                ...styles.sourceTab,
                ...(connectionMode === "webcam" ? styles.sourceTabActive : {}),
              }}
            >
              💻 Admin Laptop Webcam
            </button>
            <button
              onClick={() => { setConnectionMode("upload"); stopCamera(); }}
              style={{
                ...styles.sourceTab,
                ...(connectionMode === "upload" ? styles.sourceTabActive : {}),
              }}
            >
              📁 Test Photo Upload
            </button>
          </div>

          {/* Phone connection instructions banner */}
          {connectionMode === "phone" && (
            <div style={styles.phoneGuideBanner}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "20px" }}>📲</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "700", color: "#166534", fontSize: "13px" }}>
                    How to stream directly from your Mobile Phone:
                  </div>
                  <div style={{ fontSize: "12px", color: "#374151", marginTop: "4px", lineHeight: "1.5" }}>
                    <strong>Method A (Direct Mobile Browser):</strong> Open your phone's browser on the same Wi-Fi and open{" "}
                    <code style={{ background: "#dcfce7", padding: "2px 6px", borderRadius: "4px", fontWeight: "700", color: "#166534" }}>
                      {typeof window !== "undefined" ? `http://${window.location.hostname}:5173/camera-station` : "http://192.168.0.105:5173/camera-station"}
                    </code>
                    , then click <strong>"Start CCTV Stream"</strong> and point your back camera at the dustbin.
                    <br />
                    <strong>Method B (IP Webcam App):</strong> Install free app <em>IP Webcam</em> on phone, tap <em>"Start server"</em>, copy the stream URL (e.g. <code>http://192.168.0.x:8080/video</code>) and paste in <strong>"🌐 Road CCTV / IP Stream URL"</strong> tab above!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Source specific controls */}
          {connectionMode === "ip_stream" && (
            <div style={styles.ipConfigRow}>
              <input
                type="text"
                placeholder="Enter IP Camera Stream URL (e.g. http://192.168.1.100:8080/video)"
                value={ipStreamUrl}
                onChange={(e) => setIpStreamUrl(e.target.value)}
                style={styles.ipInput}
              />
              {!isIpStreaming ? (
                <button onClick={startIpStream} style={styles.primaryBtn}>
                  ▶ Connect Road Stream
                </button>
              ) : (
                <button onClick={stopCamera} style={styles.dangerBtn}>
                  ⏹ Disconnect Stream
                </button>
              )}
            </div>
          )}
        </div>

        {/* 2-Column Surveillance Monitor */}
        <div style={styles.grid}>

          {/* Left Column: Live Viewfinder */}
          <div style={styles.cameraCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={styles.cardTitle}>Live CCTV Feed</h2>
                <span style={{
                  padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "700",
                  background: isLive ? "#dcfce7" : "#fee2e2",
                  color: isLive ? "#15803d" : "#991b1b",
                }}>
                  {isLive ? "● ONLINE" : "○ OFFLINE"}
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                {cameraActive && connectionMode === "phone" && (
                  <button onClick={toggleFacingMode} style={styles.secondaryBtn} title="Flip between Front and Back camera">
                    🔄 Flip Camera ({facingMode === "environment" ? "Back" : "Front"})
                  </button>
                )}
                {(connectionMode === "phone" || connectionMode === "webcam") && (
                  !cameraActive ? (
                    <button onClick={() => startCamera(connectionMode === "phone" ? "environment" : "user")} style={styles.primaryBtn}>
                      ▶ Start CCTV Stream
                    </button>
                  ) : (
                    <button onClick={stopCamera} style={styles.dangerBtn}>
                      ⏹ Stop CCTV
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Viewport Box */}
            <div style={styles.viewportContainer}>
              {/* Local/Phone Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  ...styles.video,
                  display: cameraActive ? "block" : "none",
                }}
              />

              {/* IP Camera MJPEG Feed */}
              {isIpStreaming && (
                <img
                  ref={ipImageRef}
                  src={ipStreamUrl}
                  crossOrigin="anonymous"
                  alt="Road CCTV Feed"
                  style={styles.video}
                  onError={() => {
                    addLog("Could not load IP Camera stream. Check IP address and Wi-Fi.", "error");
                    setIsIpStreaming(false);
                  }}
                />
              )}

              {/* Offline Screen */}
              {!isLive && connectionMode !== "upload" && (
                <div style={styles.placeholderBox}>
                  <span style={{ fontSize: "48px", marginBottom: "10px" }}>
                    {connectionMode === "phone" ? "📱" : connectionMode === "ip_stream" ? "🌐" : "💻"}
                  </span>
                  <p style={{ fontWeight: "700", color: "#f8fafc", margin: "0 0 6px", fontSize: "16px" }}>
                    {connectionMode === "phone" && "Point your phone camera at the dustbin"}
                    {connectionMode === "ip_stream" && "Ready to connect to Road CCTV Stream"}
                    {connectionMode === "webcam" && "Ready to connect Admin Laptop Webcam"}
                  </p>
                  <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 16px", maxWidth: "450px" }}>
                    Continuous AI detection will automatically analyse waste fill level and dispatch tasks to officers when overflowing.
                  </p>
                  {connectionMode === "phone" && (
                    <button onClick={() => startCamera("environment")} style={styles.primaryBtn}>
                      ▶ Start Phone Rear CCTV Feed
                    </button>
                  )}
                  {connectionMode === "webcam" && (
                    <button onClick={() => startCamera("user")} style={styles.primaryBtn}>
                      ▶ Start Webcam Feed
                    </button>
                  )}
                  {connectionMode === "ip_stream" && (
                    <button onClick={startIpStream} style={styles.primaryBtn}>
                      ▶ Connect Stream URL
                    </button>
                  )}
                </div>
              )}

              {connectionMode === "upload" && !lastCapturedImage && (
                <div style={styles.placeholderBox}>
                  <span style={{ fontSize: "48px", marginBottom: "10px" }}>📁</span>
                  <p style={{ fontWeight: "700", color: "#f8fafc", margin: "0 0 6px" }}>Upload Test Dustbin Photo</p>
                  <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 16px" }}>
                    Select any photo of an overflowing or clean dustbin to test automatic detection and officer dispatch.
                  </p>
                  <label style={styles.uploadBtn}>
                    📂 Select Photo from Device
                    <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
                  </label>
                </div>
              )}

              {connectionMode === "upload" && lastCapturedImage && (
                <img src={lastCapturedImage} alt="Uploaded test" style={styles.video} />
              )}

              {/* HUD Target Overlay */}
              {isLive && (
                <div style={styles.hudOverlay}>
                  <div style={styles.targetReticle}>
                    <div style={styles.reticleCornerTL} />
                    <div style={styles.reticleCornerTR} />
                    <div style={styles.reticleCornerBL} />
                    <div style={styles.reticleCornerBR} />
                    <div style={styles.reticleCrosshair}>+</div>
                  </div>

                  <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", gap: "8px" }}>
                    <span style={styles.hudTag}>
                      📍 {selectedBin?.binId || "Target Bin"} • {selectedBin?.location?.address || "Live"}
                    </span>
                    {autoScan && (
                      <span style={{ ...styles.hudTag, background: "rgba(22, 101, 52, 0.9)" }}>
                        ⏱️ Auto-Detect: {countdown}s
                      </span>
                    )}
                  </div>

                  {isScanning && (
                    <div style={styles.scanningBar}>
                      ⚡ AI Analysing Dustbin Fill Level...
                    </div>
                  )}
                </div>
              )}

              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>

            {/* Toolbar */}
            <div style={styles.controlToolbar}>
              <button
                onClick={captureAndDetect}
                disabled={isScanning}
                style={{ ...styles.scanNowBtn, opacity: isScanning ? 0.7 : 1 }}
              >
                {isScanning ? "⚡ Analysing..." : "📸 Scan & Detect Now"}
              </button>

              <div style={styles.autoScanControl}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", color: "#1f2937" }}>
                  <input
                    type="checkbox"
                    checked={autoScan}
                    onChange={(e) => setAutoScan(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "#166534" }}
                  />
                  <span>Continuous Auto-Detect</span>
                </label>

                {autoScan && (
                  <select
                    value={scanInterval}
                    onChange={(e) => setScanInterval(Number(e.target.value))}
                    style={{ ...styles.select, width: "auto", padding: "4px 8px", fontSize: "12px" }}
                  >
                    <option value={5}>Every 5s</option>
                    <option value={10}>Every 10s</option>
                    <option value={20}>Every 20s</option>
                    <option value={30}>Every 30s</option>
                  </select>
                )}
              </div>

              <button
                onClick={() => setSoundAlert(!soundAlert)}
                style={{ ...styles.secondaryBtn, padding: "6px 12px", fontSize: "12px" }}
              >
                {soundAlert ? "🔔 Sound Alert ON" : "🔕 Sound OFF"}
              </button>

              {connectionMode !== "upload" && (
                <label style={styles.uploadLabel} title="Test with a photo file">
                  📁 Test Photo
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
                </label>
              )}
            </div>
          </div>

          {/* Right Column: Real-time Telemetry & Automatic Dispatch Log */}
          <div style={styles.telemetryColumn}>

            {/* Fill Level & Status Card */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>📊 Live AI Waste Telemetry</h2>

              {latestResult ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "20px", marginTop: "14px", marginBottom: "14px" }}>
                    <div style={styles.gaugeContainer}>
                      <div
                        style={{
                          ...styles.gaugeFill,
                          height: `${latestResult.aiResult?.fillLevel || 0}%`,
                          background:
                            (latestResult.aiResult?.fillLevel || 0) >= 75 ? "#ef4444"
                              : (latestResult.aiResult?.fillLevel || 0) >= 50 ? "#f59e0b" : "#10b981",
                        }}
                      />
                      <div style={styles.gaugeNumber}>
                        {latestResult.aiResult?.fillLevel || 0}%
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>Bin Status:</span>
                        <span style={{
                          padding: "2px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700",
                          background: latestResult.bin?.status === "critical" ? "#fee2e2" : latestResult.bin?.status === "medium" ? "#fef3c7" : "#dcfce7",
                          color: latestResult.bin?.status === "critical" ? "#dc2626" : latestResult.bin?.status === "medium" ? "#b45309" : "#15803d",
                        }}>
                          {(latestResult.bin?.status || "clean").toUpperCase()}
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>AI Confidence:</span>
                        <span style={{ fontWeight: "700", color: "#111827", fontSize: "13px" }}>
                          🤖 {latestResult.aiResult?.aiScore || 0}%
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>Waste Type:</span>
                        <span style={{ fontWeight: "600", color: "#4338ca", fontSize: "13px", textTransform: "capitalize" }}>
                          {latestResult.aiResult?.wasteType || "Mixed"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Auto-Dispatch Banner */}
                  {(latestResult.alertDispatched || (latestResult.aiResult?.fillLevel || 0) >= 75) && (
                    <div style={styles.alertDispatchBox}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "20px" }}>🚨</span>
                        <div>
                          <div style={{ fontWeight: "700", color: "#991b1b", fontSize: "13px" }}>
                            CRITICAL OVERFLOW — Task Auto-Dispatched!
                          </div>
                          <div style={{ fontSize: "12px", color: "#b91c1c", marginTop: "2px" }}>
                            Bin marked as <strong>CRITICAL</strong>. Real-time alert & task dispatched to assigned Officer for Ward {selectedBin?.ward || ""}.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Reasoning */}
                  {latestResult.aiResult?.reasoning && (
                    <div style={styles.reasoningBox}>
                      <span style={{ fontWeight: "600", color: "#374151" }}>AI Analysis: </span>
                      <span style={{ color: "#4b5563" }}>{latestResult.aiResult.reasoning}</span>
                    </div>
                  )}

                  {/* Detected Labels */}
                  {latestResult.aiResult?.wasteLabels && latestResult.aiResult.wasteLabels.length > 0 && (
                    <div style={{ marginTop: "12px" }}>
                      <div style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", marginBottom: "6px" }}>
                        DETECTED ITEMS:
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {latestResult.aiResult.wasteLabels.map((l, i) => (
                          <span key={i} style={styles.labelTag}>🏷️ {l}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={styles.emptyTelemetry}>
                  <span style={{ fontSize: "32px", marginBottom: "8px" }}>📡</span>
                  <p style={{ margin: 0, fontWeight: "500", color: "#6b7280", fontSize: "13px" }}>
                    Awaiting camera frame. Start CCTV stream to begin live detection.
                  </p>
                </div>
              )}
            </div>

            {/* Real-Time Activity Log */}
            <div style={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h2 style={styles.cardTitle}>📜 CCTV Surveillance & Alert Log</h2>
                <button onClick={() => setLogs([])} style={{ background: "none", border: "none", color: "#6b7280", fontSize: "11px", cursor: "pointer" }}>
                  Clear
                </button>
              </div>

              <div style={styles.logContainer}>
                {logs.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      ...styles.logItem,
                      borderLeftColor:
                        l.type === "critical" ? "#ef4444"
                          : l.type === "warning" ? "#f59e0b"
                          : l.type === "success" ? "#10b981"
                          : l.type === "error" ? "#dc2626" : "#3b82f6",
                    }}
                  >
                    <span style={styles.logTime}>[{l.time}]</span> {l.message}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f4f6f9" },
  container: { padding: "24px", maxWidth: "1440px", margin: "0 auto" },
  headerCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
  },
  title: { fontSize: "19px", fontWeight: "700", color: "#111827", margin: 0 },
  subtitle: { fontSize: "13px", color: "#6b7280", margin: "4px 0 0" },
  binSelectorBox: { minWidth: "300px" },
  select: {
    width: "100%",
    padding: "8px 12px",
    background: "#f9fafb",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#1f2937",
  },
  sourceTabs: {
    display: "flex",
    gap: "8px",
    marginTop: "16px",
    paddingTop: "14px",
    borderTop: "1px solid #f3f4f6",
    flexWrap: "wrap",
  },
  sourceTab: {
    padding: "8px 14px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    color: "#4b5563",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  sourceTabActive: {
    background: "#166534",
    color: "#ffffff",
    border: "1px solid #166534",
    fontWeight: "600",
  },
  phoneGuideBanner: {
    marginTop: "14px",
    padding: "12px 16px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "8px",
  },
  ipConfigRow: {
    display: "flex",
    gap: "10px",
    marginTop: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  ipInput: {
    flex: 1,
    minWidth: "300px",
    padding: "8px 12px",
    background: "#f9fafb",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "13px",
  },
  grid: { display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "20px" },
  cameraCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
  },
  telemetryColumn: { display: "flex", flexDirection: "column", gap: "20px" },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "18px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
  },
  cardTitle: { fontSize: "16px", fontWeight: "700", color: "#111827", margin: 0 },
  viewportContainer: {
    position: "relative",
    width: "100%",
    height: "440px",
    background: "#0f172a",
    borderRadius: "10px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  placeholderBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px",
    textAlign: "center",
    color: "#ffffff",
  },
  hudOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  targetReticle: {
    position: "relative",
    width: "70%",
    height: "70%",
    border: "1px dashed rgba(255, 255, 255, 0.3)",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  reticleCornerTL: { position: "absolute", top: "-2px", left: "-2px", width: "20px", height: "20px", borderTop: "3px solid #10b981", borderLeft: "3px solid #10b981" },
  reticleCornerTR: { position: "absolute", top: "-2px", right: "-2px", width: "20px", height: "20px", borderTop: "3px solid #10b981", borderRight: "3px solid #10b981" },
  reticleCornerBL: { position: "absolute", bottom: "-2px", left: "-2px", width: "20px", height: "20px", borderBottom: "3px solid #10b981", borderLeft: "3px solid #10b981" },
  reticleCornerBR: { position: "absolute", bottom: "-2px", right: "-2px", width: "20px", height: "20px", borderBottom: "3px solid #10b981", borderRight: "3px solid #10b981" },
  reticleCrosshair: { color: "rgba(16, 185, 129, 0.6)", fontSize: "24px", fontWeight: "300" },
  hudTag: {
    background: "rgba(15, 23, 42, 0.8)",
    color: "#ffffff",
    backdropFilter: "blur(4px)",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    border: "1px solid rgba(255, 255, 255, 0.15)",
  },
  scanningBar: {
    position: "absolute",
    bottom: "20px",
    background: "rgba(22, 101, 52, 0.95)",
    color: "#ffffff",
    padding: "6px 18px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    boxShadow: "0 0 15px rgba(34, 197, 94, 0.5)",
  },
  controlToolbar: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    marginTop: "16px",
    flexWrap: "wrap",
  },
  scanNowBtn: {
    padding: "10px 18px",
    background: "#166534",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  autoScanControl: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#f9fafb",
    padding: "6px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
  },
  primaryBtn: {
    padding: "8px 16px",
    background: "#166534",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "8px 14px",
    background: "#ffffff",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "8px 16px",
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  uploadBtn: {
    padding: "10px 20px",
    background: "#166534",
    color: "#ffffff",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    display: "inline-block",
  },
  uploadLabel: {
    padding: "8px 12px",
    background: "#f3f4f6",
    color: "#374151",
    border: "1px dashed #9ca3af",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
  },
  gaugeContainer: {
    width: "75px",
    height: "75px",
    borderRadius: "50%",
    background: "#f3f4f6",
    border: "2px solid #e5e7eb",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeFill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    transition: "height 0.5s ease",
    opacity: 0.85,
  },
  gaugeNumber: {
    position: "relative",
    zIndex: 2,
    fontSize: "16px",
    fontWeight: "800",
    color: "#111827",
    textShadow: "0 0 2px rgba(255,255,255,0.8)",
  },
  alertDispatchBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "10px 12px",
    marginTop: "10px",
  },
  reasoningBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    marginTop: "10px",
  },
  labelTag: {
    fontSize: "11px",
    background: "#f1f5f9",
    padding: "3px 8px",
    borderRadius: "12px",
    color: "#334155",
    border: "1px solid #e2e8f0",
  },
  emptyTelemetry: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    textAlign: "center",
  },
  logContainer: {
    height: "170px",
    overflowY: "auto",
    background: "#0f172a",
    borderRadius: "8px",
    padding: "10px",
    fontFamily: "monospace",
    fontSize: "11px",
  },
  logItem: {
    padding: "4px 6px",
    marginBottom: "4px",
    color: "#e2e8f0",
    borderLeft: "3px solid #3b82f6",
    lineHeight: "1.4",
  },
  logTime: { color: "#94a3b8" },
};
