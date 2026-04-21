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

// Make io accessible in routes
app.set("io", io);

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/bins", require("./routes/bins"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/analytics", require("./routes/analytics"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "SmartBin City running!", version: "1.0.0" });
});

// Socket.io connection
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join_admin", () => {
    socket.join("admin_room");
    console.log("Admin joined room");
  });

  socket.on("join_officer", (ward) => {
    socket.join(`ward_${ward}`);
    console.log(`Officer joined ward: ${ward}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});