const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// All routes
app.use("/api/auth",      require("./routes/auth"));
app.use("/api/bins",      require("./routes/bins"));
app.use("/api/reports",   require("./routes/reports"));
app.use("/api/tasks",     require("./routes/tasks"));
app.use("/api/upload",    require("./routes/upload"));
app.use("/api/analytics", require("./routes/analytics"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "SmartBin City running!",
    version: "2.0.0",
    features: [
      "Gemini AI detection",
      "Real-time Socket.io",
      "Cloudinary upload",
      "Overflow prediction",
      "Route optimisation",
      "PDF export",
      "Green Points leaderboard",
    ],
  });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("join_admin",   () => socket.join("admin_room"));
  socket.on("join_officer", (city) => socket.join(`city_${city}`));
  socket.on("disconnect",   () => console.log("Disconnected:", socket.id));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`SmartBin server v2.0 running on port ${PORT}`);
});