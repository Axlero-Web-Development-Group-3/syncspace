
const express = require('express')
const http = require('http')
const cors = require('cors')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const { Server } = require('socket.io')
const Room = require('./models/Room')

dotenv.config()

const app = express()
const server = http.createServer(app)

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
]

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
})

// Get the list of online users in a room.
function getRoomUsers(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId)

  if (!room) return []

  return [...room]
    .map((socketId) => {
      const client = io.sockets.sockets.get(socketId)

      if (!client || !client.data.user) return null

      return {
        id: socketId,
        userName: client.data.user.userName,
        userColor: client.data.user.userColor,
      }
    })
    .filter(Boolean)
}

function broadcastRoomUsers(roomId) {
  io.to(roomId).emit('roomUsers', getRoomUsers(roomId))
}

// Find a room in MongoDB or create it.
async function getOrCreateRoom(roomId) {
  let room = await Room.findOne({ roomId })

  if (!room) {
    try {
      room = await Room.create({ roomId })
    } catch (error) {
      if (error.code !== 11000) throw error

      room = await Room.findOne({ roomId })
    }
  }

  return room
}

// Health-check routes.
app.get('/', (req, res) => {
  res.send('SyncSpace server is running')
})

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SyncSpace API is healthy',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected',
  })
})

// Socket.IO connection.
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Join room and load saved whiteboard and code.
  socket.on('joinRoom', async (data) => {
    if (!data || typeof data.roomId !== 'string') return

    const roomId = data.roomId.trim()
    if (!roomId) return

    try {
      const savedRoom = await getOrCreateRoom(roomId)

      // Leave any previously joined room.
      for (const previousRoom of [...socket.rooms]) {
        if (previousRoom !== socket.id) {
          socket.leave(previousRoom)
          broadcastRoomUsers(previousRoom)
        }
      }

      socket.join(roomId)

      socket.data.user = {
        userName: data.userName || 'Guest',
        userColor: data.userColor || '#34d399',
      }

      socket.data.roomId = roomId

      // Send saved data to the joining user.
      socket.emit('canvasState', savedRoom.drawings)
      socket.emit('codeTextState', savedRoom.code || '')

      broadcastRoomUsers(roomId)

      console.log(`${socket.data.user.userName} joined ${roomId}`)
    } catch (error) {
      console.error('Room loading failed:', error.message)

      socket.emit(
        'roomError',
        'Could not load room data. Please try again.'
      )
    }
  })

  // Save and broadcast pen drawings.
  socket.on('drawLine', async (data) => {
    if (
      !data?.roomId ||
      !Array.isArray(data.line) ||
      socket.data.roomId !== data.roomId
    ) return

    try {
      const result = await Room.updateOne(
        { roomId: data.roomId },
        { $push: { 'drawings.lines': data.line } }
      )

      if (!result.matchedCount) {
        socket.emit('roomError', 'Room not found. Please rejoin.')
        return
      }

      socket.to(data.roomId).emit('drawLine', data.line)
    } catch (error) {
      console.error('Line save failed:', error.message)
      socket.emit('roomError', 'Could not save drawing.')
    }
  })

  // Save and broadcast rectangles.
  socket.on('drawRectangle', async (data) => {
    if (
      !data?.roomId ||
      !data.rectangle ||
      socket.data.roomId !== data.roomId
    ) return

    try {
      const result = await Room.updateOne(
        { roomId: data.roomId },
        { $push: { 'drawings.rectangles': data.rectangle } }
      )

      if (!result.matchedCount) {
        socket.emit('roomError', 'Room not found. Please rejoin.')
        return
      }

      socket.to(data.roomId).emit(
        'drawRectangle',
        data.rectangle
      )
    } catch (error) {
      console.error('Rectangle save failed:', error.message)
      socket.emit('roomError', 'Could not save drawing.')
    }
  })

  // Save and broadcast text objects.
  socket.on('drawText', async (data) => {
    if (
      !data?.roomId ||
      !data.text ||
      socket.data.roomId !== data.roomId
    ) return

    try {
      const result = await Room.updateOne(
        { roomId: data.roomId },
        { $push: { 'drawings.texts': data.text } }
      )

      if (!result.matchedCount) {
        socket.emit('roomError', 'Room not found. Please rejoin.')
        return
      }

      socket.to(data.roomId).emit('drawText', data.text)
    } catch (error) {
      console.error('Text save failed:', error.message)
      socket.emit('roomError', 'Could not save drawing.')
    }
  })

  // Broadcast cursor movement to other users.
  socket.on('cursorMove', (data) => {
    if (
      !data?.roomId ||
      socket.data.roomId !== data.roomId ||
      typeof data.x !== 'number' ||
      typeof data.y !== 'number'
    ) return

    socket.to(data.roomId).emit('cursorMove', {
      socketId: socket.id,
      x: data.x,
      y: data.y,
      userName: data.userName || 'Guest',
      userColor: data.userColor || '#34d399',
    })
  })

  // Save the latest code and broadcast it.
  socket.on('codeTextUpdate', async (data) => {
    if (
      !data?.roomId ||
      typeof data.code !== 'string' ||
      socket.data.roomId !== data.roomId
    ) return

    try {
      const result = await Room.updateOne(
        { roomId: data.roomId },
        { $set: { code: data.code } }
      )

      if (!result.matchedCount) {
        socket.emit('roomError', 'Room not found. Please rejoin.')
        return
      }

      socket.to(data.roomId).emit(
        'codeTextUpdate',
        data.code
      )
    } catch (error) {
      console.error('Code save failed:', error.message)
      socket.emit('roomError', 'Could not save code.')
    }
  })

  // Handle disconnect.
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId

    if (roomId) {
      socket.to(roomId).emit('userLeft', socket.id)
      broadcastRoomUsers(roomId)
    }

    console.log('User disconnected:', socket.id)
  })
})

// Connect MongoDB before starting the server.
const PORT = process.env.PORT || 5000

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from server/.env')
    }

    await mongoose.connect(process.env.MONGODB_URI)

    console.log('MongoDB connected successfully')

    server.listen(PORT, () => {
      console.log(`SyncSpace server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Server startup failed:', error.message)
    process.exit(1)
  }
}

startServer()
