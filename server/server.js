
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  })
);

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Store drawings for each room in MongoDB
const drawingSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    lines: { type: Array, default: [] },
    rectangles: { type: Array, default: [] },
    texts: { type: Array, default: [] },
  },
  { timestamps: true }
);

const Drawing = mongoose.model('Drawing', drawingSchema);

// Track online users in each room
const roomUsers = new Map();

function getRoomUsers(roomId) {
  return Array.from(roomUsers.get(roomId)?.values() || []);
}

function broadcastRoomUsers(roomId) {
  io.to(roomId).emit('roomUsers', getRoomUsers(roomId));
}

// Remove a disconnected user from their room
function removeUserFromRoom(socket) {
  const roomId = socket.data.roomId;

  if (!roomId) return;

  const users = roomUsers.get(roomId);

  if (users) {
    users.delete(socket.id);

    if (users.size === 0) {
      roomUsers.delete(roomId);
    }
  }

  socket.to(roomId).emit('userLeft', socket.id);
  broadcastRoomUsers(roomId);

  socket.data.roomId = null;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SyncSpace server is running',
  });
});

// Get saved drawings
app.get('/api/rooms/:roomId/drawings', async (req, res) => {
  try {
    const drawing = await Drawing.findOne({
      roomId: req.params.roomId,
    }).lean();

    res.json({
      success: true,
      drawings: drawing || {
        roomId: req.params.roomId,
        lines: [],
        rectangles: [],
        texts: [],
      },
    });
  } catch (error) {
    console.error('Error loading drawings:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not load drawings',
    });
  }
});

// Save one drawing item
async function saveDrawing(roomId, type, item) {
  if (
    !roomId ||
    !['lines', 'rectangles', 'texts'].includes(type)
  ) {
    return;
  }

  await Drawing.findOneAndUpdate(
    { roomId },
    {
      $push: { [type]: item },
      $setOnInsert: { roomId },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join a room and load its saved drawings
  socket.on('joinRoom', async (data) => {
    try {
      const roomId =
        typeof data === 'string' ? data : data?.roomId;

      const suppliedName =
        typeof data === 'object' ? data?.userName : undefined;

      if (!roomId) {
        console.log('joinRoom received without roomId');
        return;
      }

      // Avoid duplicate registration for the same room
      if (socket.data.roomId === roomId) {
        if (suppliedName) {
          socket.data.userName = suppliedName;
        }

        const users = roomUsers.get(roomId);

        if (users) {
          users.set(socket.id, {
            id: socket.id,
            userName: socket.data.userName || 'Guest',
          });
        }

        broadcastRoomUsers(roomId);

        const existingDrawing = await Drawing.findOne({
          roomId,
        }).lean();

        socket.emit('canvasState', {
          lines: existingDrawing?.lines || [],
          rectangles: existingDrawing?.rectangles || [],
          texts: existingDrawing?.texts || [],
        });

        return;
      }

      // Remove the user from their previous room, if any
      if (socket.data.roomId) {
        socket.leave(socket.data.roomId);
        removeUserFromRoom(socket);
      }

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userName = suppliedName || 'Guest';

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }

      roomUsers.get(roomId).set(socket.id, {
        id: socket.id,
        userName: socket.data.userName,
      });

      console.log(
        `${socket.data.userName} joined room: ${roomId}`
      );

      // Update online users for everyone in this room
      broadcastRoomUsers(roomId);

      // Send previously saved drawings to the joining user
      const drawing = await Drawing.findOne({
        roomId,
      }).lean();

      socket.emit('canvasState', {
        lines: drawing?.lines || [],
        rectangles: drawing?.rectangles || [],
        texts: drawing?.texts || [],
      });
    } catch (error) {
      console.error('Error joining room:', error.message);
    }
  });

  // Broadcast cursor movement to other users in the room
  socket.on('cursorMove', (data) => {
    const roomId = socket.data.roomId;

    if (!roomId || data?.roomId !== roomId) return;

    socket.to(roomId).emit('cursorMove', {
      socketId: socket.id,
      x: data.x,
      y: data.y,
      userName: socket.data.userName || 'Guest',
      userColor: data.userColor,
    });
  });

  // Save and broadcast a line
  socket.on('drawLine', async (data) => {
    try {
      const roomId = socket.data.roomId;

      if (!roomId) return;
      if (data?.roomId && data.roomId !== roomId) return;

      const line = data?.line || data;

      await saveDrawing(roomId, 'lines', line);
      socket.to(roomId).emit('drawLine', line);
    } catch (error) {
      console.error('Error saving line:', error.message);
    }
  });

  // Save and broadcast a rectangle
  socket.on('drawRectangle', async (data) => {
    try {
      const roomId = socket.data.roomId;

      if (!roomId) return;
      if (data?.roomId && data.roomId !== roomId) return;

      const rectangle = data?.rectangle || data;

      await saveDrawing(roomId, 'rectangles', rectangle);
      socket.to(roomId).emit('drawRectangle', rectangle);
    } catch (error) {
      console.error('Error saving rectangle:', error.message);
    }
  });

  // Save and broadcast text
  socket.on('drawText', async (data) => {
    try {
      const roomId = socket.data.roomId;

      if (!roomId) return;
      if (data?.roomId && data.roomId !== roomId) return;

      const text = data?.text || data;

      await saveDrawing(roomId, 'texts', text);
      socket.to(roomId).emit('drawText', text);
    } catch (error) {
      console.error('Error saving text:', error.message);
    }
  });

  // Clean up when a user disconnects
  socket.on('disconnect', () => {
    const userName = socket.data.userName || socket.id;

    removeUserFromRoom(socket);

    console.log('Client disconnected:', userName);
  });
});

// Connect to MongoDB before starting the server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully');

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  });
