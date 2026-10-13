
const express = require('express')
const http = require('http')
const cors = require('cors')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')

const Room = require('./models/Room')
const User = require('./models/User')

dotenv.config()

const app = express()
const server = http.createServer(app)

const PORT = process.env.PORT || 5000

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

// -------------------- AUTH HELPERS --------------------

function createToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing from server/.env')
  }

  return jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
  }
}

// -------------------- REGISTER API --------------------

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {}

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please enter name, email and password',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await User.findOne({
      email: normalizedEmail,
    })

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    })

    const token = createToken(user._id)

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: publicUser(user),
    })
  } catch (error) {
    console.error('Registration error:', error.message)

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      })
    }

    return res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
    })
  }
})

// -------------------- LOGIN API --------------------

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please enter email and password',
      })
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    })

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      })
    }

    const token = createToken(user._id)

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: publicUser(user),
    })
  } catch (error) {
    console.error('Login error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
    })
  }
})

// -------------------- HEALTH CHECK --------------------

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

// -------------------- ROOM HELPERS --------------------

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

// -------------------- SOCKET.IO --------------------

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Join a room and load saved whiteboard/code.
  socket.on('joinRoom', async (data) => {
    if (!data || typeof data.roomId !== 'string') return

    const roomId = data.roomId.trim()
    if (!roomId) return

    try {
      const savedRoom = await getOrCreateRoom(roomId)

      // Leave any previously joined rooms.
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

      // Send existing saved content to the joining user.
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
    ) {
      return
    }

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
    ) {
      return
    }

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
    ) {
      return
    }

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

  // Broadcast cursor movement to other room members.
  socket.on('cursorMove', (data) => {
    if (
      !data?.roomId ||
      socket.data.roomId !== data.roomId ||
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

  // Save and broadcast the latest code.
  socket.on('codeTextUpdate', async (data) => {
    if (
      !data?.roomId ||
      typeof data.code !== 'string' ||
      socket.data.roomId !== data.roomId
    ) {
      return
    }

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

  // Handle disconnection.
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId

    if (roomId) {
      socket.to(roomId).emit('userLeft', socket.id)
      broadcastRoomUsers(roomId)
    }

    console.log('User disconnected:', socket.id)
  })
})

// -------------------- START SERVER --------------------

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing from server/.env')
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing from server/.env')
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
