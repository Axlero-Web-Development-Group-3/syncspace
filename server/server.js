const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  })
);

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
  },
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SyncSpace server is running",
  });
});

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);

    console.log(`${socket.id} joined room: ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log("client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});