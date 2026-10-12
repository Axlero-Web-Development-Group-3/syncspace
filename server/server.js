
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

console.log('CLIENT_URL loaded:', process.env.CLIENT_URL);
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

// MongoDB schema: stores all drawings for a room
const drawingSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    lines: {
      type: Array,
      default: [],
    },
    rectangles: {
      type: Array,
      default: [],
    },
    texts: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

const Drawing = mongoose.model('Drawing', drawingSchema);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SyncSpace server is running',
  });
});

// Get saved drawings for a room
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

// Save the current drawing state
async function saveDrawing(roomId, type, item) {
  if (!roomId || !['lines', 'rectangles', 'texts'].includes(type)) {
    return;
  }

  const update = {
    $push: { [type]: item },
    $setOnInsert: { roomId },
  };

  await Drawing.findOneAndUpdate(
    { roomId },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Real-time Socket.IO events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinRoom', async (data) => {
    try {
      // Supports either an object or a roomId string
      const roomId =
        typeof data === 'string' ? data : data?.roomId;
      const userName =
        typeof data === 'object' ? data?.userName : undefined;

      if (!roomId) {
        console.log('joinRoom received without roomId');
        return;
      }

      socket.join(roomId);
      socket.data.roomId = roomId;

      console.log(
        `${userName || socket.id} joined room: ${roomId}`
      );

      const drawing = await Drawing.findOne({ roomId }).lean();

      socket.emit('canvasState', {
        lines: drawing?.lines || [],
        rectangles: drawing?.rectangles || [],
        texts: drawing?.texts || [],
      });
    } catch (error) {
      console.error('Error joining room:', error.message);
    }
  });

  socket.on('drawLine', async (data) => {
    try {
      const roomId = data?.roomId || socket.data.roomId;
      const line = data?.line || data;

      if (!roomId) return;

      await saveDrawing(roomId, 'lines', line);
      socket.to(roomId).emit('drawLine', line);
    } catch (error) {
      console.error('Error saving line:', error.message);
    }
  });

  socket.on('drawRectangle', async (data) => {
    try {
      const roomId = data?.roomId || socket.data.roomId;
      const rectangle = data?.rectangle || data;

      if (!roomId) return;

      await saveDrawing(roomId, 'rectangles', rectangle);
      socket.to(roomId).emit('drawRectangle', rectangle);
    } catch (error) {
      console.error('Error saving rectangle:', error.message);
    }
  });

  socket.on('drawText', async (data) => {
    try {
      const roomId = data?.roomId || socket.data.roomId;
      const text = data?.text || data;

      if (!roomId) return;

      await saveDrawing(roomId, 'texts', text);
      socket.to(roomId).emit('drawText', text);
    } catch (error) {
      console.error('Error saving text:', error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnecting:', socket.id);
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
