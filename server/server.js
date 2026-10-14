
const express = require('express')
const http = require('http')
const cors = require('cors')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')
const Y = require('yjs')

const Room = require('./models/Room')
const User = require('./models/User')

dotenv.config()

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 5000

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((url) => url.trim())
    : []),
]

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
})

// Shared Yjs documents for rooms on this server instance.
const yDocs = new Map()

// Serializes MongoDB saves for each room.
const saveQueues = new Map()

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

// -------------------- AUTH APIs --------------------

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

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token: createToken(user._id),
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

    return res.json({
      success: true,
      message: 'Login successful',
      token: createToken(user._id),
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
  const members = io.sockets.adapter.rooms.get(roomId)
  if (!members) return []

  return [...members]
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

function saveYjsState(roomId, doc) {
  const previous = saveQueues.get(roomId) || Promise.resolve()

  // Read the latest document state when this queued save runs.
  const next = previous
    .catch(() => {})
    .then(async () => {
      const state = Buffer.from(
        Y.encodeStateAsUpdate(doc)
      ).toString('base64')

      const code = doc.getText('monaco').toString()

      await Room.updateOne(
        { roomId },
        {
          $set: {
            yjsState: state,
            code,
          },
        }
      )
    })

  saveQueues.set(roomId, next)

  return next.finally(() => {
    if (saveQueues.get(roomId) === next) {
      saveQueues.delete(roomId)
    }
  })
}

async function getYDoc(roomId, savedRoom) {
  const existingDoc = yDocs.get(roomId)
  if (existingDoc) return existingDoc

  const doc = new Y.Doc()
  const sharedText = doc.getText('monaco')

  if (savedRoom.yjsState) {
    try {
      const savedUpdate = Buffer.from(
        savedRoom.yjsState,
        'base64'
      )

      Y.applyUpdate(
        doc,
        new Uint8Array(savedUpdate),
        'database'
      )
    } catch (error) {
      doc.destroy()
      throw new Error(
        `Could not restore Yjs state for ${roomId}: ${error.message}`
      )
    }
  } else if (savedRoom.code) {
    // Migrate the previous plain-text code into Yjs.
    sharedText.insert(0, savedRoom.code)
  } else {
    sharedText.insert(0, '// Start coding together...\n')
  }

  // Store the document before awaiting persistence so another
  // join request in this process can reuse the same document.
  yDocs.set(roomId, doc)

  doc.on('update', () => {
    saveYjsState(roomId, doc).catch((error) => {
      console.error('Yjs persistence failed:', error.message)
    })
  })

  await saveYjsState(roomId, doc)

  return doc
}

// -------------------- SOCKET.IO --------------------

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('joinRoom', async (data) => {
    if (!data || typeof data.roomId !== 'string') return

    const roomId = data.roomId.trim()
    if (!roomId) return

    try {
      const savedRoom = await getOrCreateRoom(roomId)

      // Leave any previous room before joining this one.
      for (const previousRoom of [...socket.rooms]) {
        if (previousRoom !== socket.id) {
          socket.leave(previousRoom)
          broadcastRoomUsers(previousRoom)
        }
      }

      socket.data.user = {
        userName:
          typeof data.userName === 'string' && data.userName.trim()
            ? data.userName.trim()
            : 'Guest',
        userColor:
          typeof data.userColor === 'string'
            ? data.userColor
            : '#34d399',
      }

      socket.data.roomId = roomId
      socket.join(roomId)

      const doc = await getYDoc(roomId, savedRoom)

      socket.emit('canvasState', savedRoom.drawings || {
        lines: [],
        rectangles: [],
        texts: [],
      })

      // This event name and payload match Room.jsx.
      socket.emit(
        'yjsSync',
        Array.from(Y.encodeStateAsUpdate(doc))
      )

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

  // -------------------- YJS CODE SYNC --------------------

  socket.on('yjsUpdate', async (data) => {
    if (
      !data ||
      typeof data.roomId !== 'string' ||
      !Array.isArray(data.update) ||
      socket.data.roomId !== data.roomId
    ) {
      return
    }

    const doc = yDocs.get(data.roomId)

    if (!doc) {
      socket.emit(
        'roomError',
        'Yjs document is not ready. Please rejoin the room.'
      )
      return
    }

    try {
      const update = Uint8Array.from(data.update)

      // Yjs merges concurrent edits using CRDT operations.
      Y.applyUpdate(doc, update, socket.id)

      // The document update listener queues MongoDB persistence.
      // Send the update to every other room member.
      socket.to(data.roomId).emit(
        'yjsUpdate',
        Array.from(update)
      )

      await saveYjsState(data.roomId, doc)
    } catch (error) {
      console.error('Yjs update failed:', error.message)
      socket.emit(
        'roomError',
        'Could not sync collaborative code.'
      )
    }
  })

  // -------------------- WHITEBOARD --------------------

  socket.on('drawLine', async (data) => {
    if (
      !data ||
      typeof data.roomId !== 'string' ||
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

  socket.on('drawRectangle', async (data) => {
    if (
      !data ||
      typeof data.roomId !== 'string' ||
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

  socket.on('drawText', async (data) => {
    if (
      !data ||
      typeof data.roomId !== 'string' ||
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

  // -------------------- REMOTE CURSORS --------------------

  socket.on('cursorMove', (data) => {
    if (
      !data ||
      typeof data.roomId !== 'string' ||
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
      userName: socket.data.user?.userName || 'Guest',
      userColor: socket.data.user?.userColor || '#34d399',
    })
  })

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
