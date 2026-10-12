
import './Room.css'
import { Stage, Layer, Line, Rect, Text, Circle } from 'react-konva'
import { useState, useRef, useEffect } from 'react'
import { socket } from './lib/socket'

function Room({ roomId }) {
  const [lines, setLines] = useState([])
  const [rectangles, setRectangles] = useState([])
  const [texts, setTexts] = useState([])

  const [tool, setTool] = useState('pen')
  const [textInput, setTextInput] = useState('')
  const [textPosition, setTextPosition] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState(1)

  const [userName] = useState(
    `User-${Math.floor(Math.random() * 1000)}`
  )

  const [userColor] = useState(
    `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`
  )

  const [remoteCursors, setRemoteCursors] = useState({})
  const [leftPanelWidth, setLeftPanelWidth] = useState(50)

  const isDrawing = useRef(false)
  const startPoint = useRef(null)
  const isResizing = useRef(false)
  const lastCursorSend = useRef(0)

  useEffect(() => {
    const joinRoom = () => {
      console.log('Socket connected:', socket.id)

      // Clear previous room's canvas when switching rooms
      setLines([])
      setRectangles([])
      setTexts([])

      socket.emit('joinRoom', {
        roomId,
        userName,
        userColor,
      })

      console.log('Joined room:', roomId)
    }

    // Receive saved drawings when joining a room
    const handleCanvasState = (drawings) => {
      setLines(drawings.lines || [])
      setRectangles(drawings.rectangles || [])
      setTexts(drawings.texts || [])

      console.log('Previous drawings loaded:', drawings)
    }

    const handleRemoteLine = (line) => {
      setLines((prev) => [...prev, line])
    }

    const handleRemoteRectangle = (rectangle) => {
      setRectangles((prev) => [...prev, rectangle])
    }

    const handleRemoteText = (text) => {
      setTexts((prev) => [...prev, text])
    }

    const handleRoomUsers = (count) => {
      setOnlineUsers(count)
    }

    const handleRemoteCursor = (cursor) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [cursor.socketId]: cursor,
      }))
    }

    const handleUserJoined = (user) => {
      console.log(`${user.userName} joined the room`)
    }

    socket.on('connect', joinRoom)
    socket.on('canvasState', handleCanvasState)
    socket.on('drawLine', handleRemoteLine)
    socket.on('drawRectangle', handleRemoteRectangle)
    socket.on('drawText', handleRemoteText)
    socket.on('roomUsers', handleRoomUsers)
    socket.on('cursorMove', handleRemoteCursor)
    socket.on('userJoined', handleUserJoined)

    if (socket.connected) {
      joinRoom()
    } else {
      socket.connect()
    }

    return () => {
      socket.off('connect', joinRoom)
      socket.off('canvasState', handleCanvasState)
      socket.off('drawLine', handleRemoteLine)
      socket.off('drawRectangle', handleRemoteRectangle)
      socket.off('drawText', handleRemoteText)
      socket.off('roomUsers', handleRoomUsers)
      socket.off('cursorMove', handleRemoteCursor)
      socket.off('userJoined', handleUserJoined)
    }
  }, [roomId, userName, userColor])

  const handleResizeStart = () => {
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleResizeMove = (e) => {
    if (!isResizing.current) return

    const workspace = document.querySelector('.workspace')
    if (!workspace) return

    const rect = workspace.getBoundingClientRect()

    const newWidth =
      ((e.clientX - rect.left) / rect.width) * 100

    if (newWidth >= 30 && newWidth <= 70) {
      setLeftPanelWidth(newWidth)
    }
  }

  const handleResizeEnd = () => {
    isResizing.current = false
    document.body.style.cursor = 'default'
    document.body.style.userSelect = 'auto'
  }

  useEffect(() => {
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)

    return () => {
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }
  }, [])

  const handleMouseDown = (e) => {
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()

    if (!pos) return

    if (tool === 'text') {
      setTextPosition({
        x: pos.x,
        y: pos.y,
      })
      setTextInput('')
      return
    }

    isDrawing.current = true

    startPoint.current = {
      x: pos.x,
      y: pos.y,
    }

    if (tool === 'pen') {
      setLines((prev) => [
        ...prev,
        [pos.x, pos.y],
      ])
    }

    if (tool === 'rectangle') {
      setRectangles((prev) => [
        ...prev,
        {
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
        },
      ])
    }
  }

  const handleMouseMove = (e) => {
    const stage = e.target.getStage()
    const point = stage.getPointerPosition()

    if (!point) return

    const now = Date.now()

    if (now - lastCursorSend.current >= 50) {
      socket.emit('cursorMove', {
        roomId,
        x: point.x,
        y: point.y,
      })

      lastCursorSend.current = now
    }

    if (!isDrawing.current) return

    if (tool === 'pen') {
      setLines((prev) => {
        if (prev.length === 0) return prev

        const lastLine = prev[prev.length - 1]

        const updatedLine = [
          ...lastLine,
          point.x,
          point.y,
        ]

        return [
          ...prev.slice(0, -1),
          updatedLine,
        ]
      })
    }

    if (tool === 'rectangle') {
      const start = startPoint.current
      if (!start) return

      setRectangles((prev) => {
        if (prev.length === 0) return prev

        const lastRectangle = prev[prev.length - 1]

        const updatedRectangle = {
          ...lastRectangle,
          width: point.x - start.x,
          height: point.y - start.y,
        }

        return [
          ...prev.slice(0, -1),
          updatedRectangle,
        ]
      })
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing.current) return

    if (tool === 'pen') {
      setLines((currentLines) => {
        if (currentLines.length === 0) return currentLines

        const lastLine = currentLines[currentLines.length - 1]

        socket.emit('drawLine', {
          roomId,
          line: lastLine,
        })

        return currentLines
      })
    }

    if (tool === 'rectangle') {
      setRectangles((currentRectangles) => {
        if (currentRectangles.length === 0) {
          return currentRectangles
        }

        const lastRectangle =
          currentRectangles[currentRectangles.length - 1]

        socket.emit('drawRectangle', {
          roomId,
          rectangle: lastRectangle,
        })

        return currentRectangles
      })
    }

    isDrawing.current = false
    startPoint.current = null
  }

  const handleAddText = () => {
    if (!textInput.trim() || !textPosition) return

    const newText = {
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
    }

    setTexts((prev) => [...prev, newText])

    socket.emit('drawText', {
      roomId,
      text: newText,
    })

    setTextInput('')
    setTextPosition(null)
  }

  const handleCancelText = () => {
    setTextInput('')
    setTextPosition(null)
  }

  return (
    <div className="room-page">
      <header className="room-header">
        <div className="room-logo">
          <span className="logo-icon">S</span>
          <span>SyncSpace</span>
        </div>

        <div className="room-info">
          <span className="room-id">{roomId}</span>

          <span className="online-status">
            <span className="online-dot"></span>
            {onlineUsers} online
          </span>
        </div>

        <button className="share-room-btn">
          Share Room
        </button>
      </header>

      <div className="workspace">
        <div
          className="whiteboard-panel"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="panel-header">
            <h3>WHITEBOARD</h3>

            <div className="tools">
              <button
                className={tool === 'pen' ? 'tool-btn active' : 'tool-btn'}
                onClick={() => setTool('pen')}
              >
                Pen
              </button>

              <button
                className={
                  tool === 'rectangle'
                    ? 'tool-btn active'
                    : 'tool-btn'
                }
                onClick={() => setTool('rectangle')}
              >
                Rectangle
              </button>

              <button
                className={tool === 'text' ? 'tool-btn active' : 'tool-btn'}
                onClick={() => setTool('text')}
              >
                Text
              </button>
            </div>
          </div>

          <div className="canvas-container">
            <Stage
              width={900}
              height={650}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <Layer>
                {lines.map((line, index) => (
                  <Line
                    key={`line-${index}`}
                    points={line}
                    stroke="#ffffff"
                    strokeWidth={3}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))}

                {rectangles.map((rectangle, index) => (
                  <Rect
                    key={`rect-${index}`}
                    x={rectangle.x}
                    y={rectangle.y}
                    width={rectangle.width}
                    height={rectangle.height}
                    stroke="#6d8cff"
                    strokeWidth={2}
                  />
                ))}

                {texts.map((item, index) => (
                  <Text
                    key={`text-${index}`}
                    x={item.x}
                    y={item.y}
                    text={item.text}
                    fill="#ffffff"
                    fontSize={20}
                  />
                ))}

                {Object.values(remoteCursors).map((cursor) => (
                  <ReactCursor
                    key={cursor.socketId}
                    cursor={cursor}
                  />
                ))}
              </Layer>
            </Stage>

            {textPosition && (
              <div
                className="text-input-overlay"
                style={{
                  left: textPosition.x,
                  top: textPosition.y,
                }}
              >
                <input
                  autoFocus
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddText()
                    if (e.key === 'Escape') handleCancelText()
                  }}
                  placeholder="Type text..."
                />

                <div className="text-actions">
                  <button onClick={handleAddText}>Add</button>
                  <button onClick={handleCancelText}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="resize-divider"
          onMouseDown={handleResizeStart}
        >
          <div className="resize-handle">⋮</div>
        </div>

        <div
          className="code-panel"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <div className="panel-header">
            <h3>CODE EDITOR</h3>
          </div>

          <div className="code-editor">
            <div className="code-line">
              <span className="line-number">1</span>
              <span>
                <span className="keyword">function</span>
                {' '}createRoom(user) {'{'}
              </span>
            </div>

            <div className="code-line">
              <span className="line-number">2</span>
              <span>{'  '}return room.create(user)</span>
            </div>

            <div className="code-line">
              <span className="line-number">3</span>
              <span>{'}'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReactCursor({ cursor }) {
  return (
    <>
      <Circle
        x={cursor.x}
        y={cursor.y}
        radius={7}
        fill={cursor.userColor}
        listening={false}
      />

      <Text
        x={cursor.x + 10}
        y={cursor.y - 10}
        text={cursor.userName}
        fill={cursor.userColor}
        fontSize={14}
        fontStyle="bold"
        listening={false}
      />
    </>
  )
}

export default Room
