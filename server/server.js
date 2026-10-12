
const express = require('express')
const http = require('http')
const cors = require('cors')
const dotenv = require('dotenv')
const { Server } = require('socket.io')

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

// In-memory room data
const roomDrawings = new Map()
const roomCode = new Map()

function getRoomDrawings(roomId) {
  if (!roomDrawings.has(roomId)) {
    roomDrawings.set(roomId, {
      lines: [],
      rectangles: [],
      texts: [],
    })
  }

  return roomDrawings.get(roomId)
}

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

app.get('/', (req, res) => {
  res.send('SyncSpace server is running')
})

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SyncSpace API is healthy',
  })
})

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Join a room
  socket.on('joinRoom', (data) => {
    if (!data || typeof data.roomId !== 'string') return

    const roomId = data.roomId.trim()
    if (!roomId) return

    // Leave previous room if the same socket changes rooms.
    for (const previousRoom of socket.rooms) {
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

    // Send current whiteboard state to this user.
    socket.emit('canvasState', getRoomDrawings(roomId))

    // Send latest code to this user.
    socket.emit('codeTextState', roomCode.get(roomId) ?? '')

    broadcastRoomUsers(roomId)

    console.log(`${socket.data.user.userName} joined ${roomId}`)
  })

  // Whiteboard: pen drawing
  socket.on('drawLine', (data) => {
    if (!data?.roomId || !Array.isArray(data.line)) return

    const drawings = getRoomDrawings(data.roomId)
    drawings.lines.push(data.line)

    socket.to(data.roomId).emit('drawLine', data.line)
  })

  // Whiteboard: rectangle
  socket.on('drawRectangle', (data) => {
    if (!data?.roomId || !data.rectangle) return

    const drawings = getRoomDrawings(data.roomId)
    drawings.rectangles.push(data.rectangle)

    socket.to(data.roomId).emit(
      'drawRectangle',
      data.rectangle
    )
  })

  // Whiteboard: text
  socket.on('drawText', (data) => {
    if (!data?.roomId || !data.text) return

    const drawings = getRoomDrawings(data.roomId)
    drawings.texts.push(data.text)

    socket.to(data.roomId).emit('drawText', data.text)
  })

  // Whiteboard: remote cursor
  socket.on('cursorMove', (data) => {
    if (
      !data?.roomId ||
      typeof data.x !== 'number' ||
      typeof data.y !== 'number'
    ) {
      return
    }

    socket.to(data.roomId).emit('cursorMove', {
      socketId: socket.id,
      x: data.x,
      y: data.y,
      userName: data.userName || 'Guest',
      userColor: data.userColor || '#34d399',
    })
  })

  // Code editor: receive and broadcast code.
  socket.on('codeTextUpdate', (data) => {
    if (
      !data?.roomId ||
      typeof data.code !== 'string'
    ) {
      return
    }

    roomCode.set(data.roomId, data.code)

    socket.to(data.roomId).emit(
      'codeTextUpdate',
      data.code
    )
  })

  // Disconnect
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId

    if (roomId) {
      socket.to(roomId).emit('userLeft', socket.id)
      broadcastRoomUsers(roomId)
    }

    console.log('User disconnected:', socket.id)
  })
})

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log(`SyncSpace server running on port ${PORT}`)
})
