
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5174",
  })
);

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5174",
  },
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SyncSpace server is running",
  });
});

// Socket.io
io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  // Join room
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);

    console.log(`${socket.id} joined room: ${roomId}`);

    const userCount =
      io.sockets.adapter.rooms.get(roomId)?.size || 0;

    io.to(roomId).emit("roomUsers", userCount);
  });

  // Pen drawing
  socket.on("drawLine", ({ roomId, line }) => {
    socket.to(roomId).emit("drawLine", line);
  });

  // Rectangle drawing
  socket.on("drawRectangle", ({ roomId, rectangle }) => {
    socket.to(roomId).emit("drawRectangle", rectangle);
  });

  // Text drawing
  socket.on("drawText", ({ roomId, text }) => {
    socket.to(roomId).emit("drawText", text);
  });

  // Disconnect
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms].filter(
      (room) => room !== socket.id
    );

    rooms.forEach((roomId) => {
      setTimeout(() => {
        const userCount =
          io.sockets.adapter.rooms.get(roomId)?.size || 0;

        io.to(roomId).emit("roomUsers", userCount);
      }, 0);
    });

    console.log("client disconnecting:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

