
import './Room.css'
import { Stage, Layer, Line, Rect, Text, Circle } from 'react-konva'
import Editor from '@monaco-editor/react'
import { useState, useRef, useEffect, useCallback } from 'react'
import * as Y from 'yjs'
import { MonacoBinding } from 'y-monaco'
import { Awareness } from 'y-protocols/awareness'
import { socket } from './lib/socket'

function Room({
  roomId,
  onBack,
  initialFeature = 'collaboration',
}) {
  const [lines, setLines] = useState([])
  const [rectangles, setRectangles] = useState([])
  const [texts, setTexts] = useState([])
  const [tool, setTool] = useState('pen')
  const [textInput, setTextInput] = useState('')
  const [textPosition, setTextPosition] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [remoteCursors, setRemoteCursors] = useState({})
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (initialFeature === 'whiteboard') return 65
    if (initialFeature === 'editor') return 35
    return 50
  })

  const [userName] = useState(
    () => `User-${Math.floor(Math.random() * 1000)}`
  )
  const [userColor] = useState(
    () => `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`
  )

  const editorRef = useRef(null)
  const ydocRef = useRef(null)
  const ytextRef = useRef(null)
  const awarenessRef = useRef(null)
  const bindingRef = useRef(null)
  const syncReadyRef = useRef(false)

  const isDrawing = useRef(false)
  const startPoint = useRef(null)
  const isResizing = useRef(false)
  const lastCursorSend = useRef(0)

  useEffect(() => {
    if (initialFeature === 'whiteboard') {
      setLeftPanelWidth(65)
    } else if (initialFeature === 'editor') {
      setLeftPanelWidth(35)
    } else {
      setLeftPanelWidth(50)
    }
  }, [initialFeature, roomId])

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor

    editor.updateOptions({
      readOnly: false,
      domReadOnly: false,
    })

    const ytext = ytextRef.current
    const awareness = awarenessRef.current

    // Wait until the server's initial Yjs state has arrived.
    if (
      syncReadyRef.current &&
      ytext &&
      awareness &&
      editor.getModel() &&
      !bindingRef.current
    ) {
      bindingRef.current = new MonacoBinding(
        ytext,
        editor.getModel(),
        new Set([editor]),
        awareness
      )
    }
  }, [])

  useEffect(() => {
    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('monaco')
    const awareness = new Awareness(ydoc)

    ydocRef.current = ydoc
    ytextRef.current = ytext
    awarenessRef.current = awareness
    syncReadyRef.current = false

    awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
    })

    const bindEditor = () => {
      const editor = editorRef.current
      const model = editor?.getModel()

      if (
        !syncReadyRef.current ||
        !editor ||
        !model ||
        bindingRef.current
      ) {
        return
      }

      bindingRef.current = new MonacoBinding(
        ytext,
        model,
        new Set([editor]),
        awareness
      )
    }

    const handleYjsSync = (update) => {
      if (!Array.isArray(update)) return

      try {
        // Server sends a complete Yjs state as an array of bytes.
        Y.applyUpdate(
          ydoc,
          new Uint8Array(update),
          'server-state'
        )

        syncReadyRef.current = true
        bindEditor()
      } catch (error) {
        console.error('Failed to load Yjs state:', error)
      }
    }

    const handleYjsUpdate = (update) => {
      if (!Array.isArray(update)) return

      try {
        Y.applyUpdate(
          ydoc,
          new Uint8Array(update),
          'remote'
        )
      } catch (error) {
        console.error('Failed to apply remote Yjs update:', error)
      }
    }

    const handleLocalUpdate = (update, origin) => {
      if (origin === 'remote' || origin === 'server-state') return
      if (!syncReadyRef.current || !socket.connected) return

      socket.emit('yjsUpdate', {
        roomId,
        update: Array.from(update),
      })
    }

    const joinRoom = () => {
      setLines([])
      setRectangles([])
      setTexts([])
      setOnlineUsers([])
      setRemoteCursors({})

      socket.emit('joinRoom', {
        roomId,
        userName,
        userColor,
      })
    }

    const handleCanvasState = (drawings) => {
      setLines(drawings?.lines || [])
      setRectangles(drawings?.rectangles || [])
      setTexts(drawings?.texts || [])
    }

    const handleRemoteLine = (line) => {
      setLines((previous) => [...previous, line])
    }

    const handleRemoteRectangle = (rectangle) => {
      setRectangles((previous) => [...previous, rectangle])
    }

    const handleRemoteText = (item) => {
      setTexts((previous) => [...previous, item])
    }

    const handleRoomUsers = (users) => {
      setOnlineUsers(Array.isArray(users) ? users : [])
    }

    const handleRemoteCursor = (cursor) => {
      if (!cursor?.socketId || cursor.socketId === socket.id) return

      setRemoteCursors((previous) => ({
        ...previous,
        [cursor.socketId]: cursor,
      }))
    }

    const handleUserLeft = (socketId) => {
      setRemoteCursors((previous) => {
        const updated = { ...previous }
        delete updated[socketId]
        return updated
      })
    }

    ydoc.on('update', handleLocalUpdate)

    socket.on('connect', joinRoom)
    socket.on('canvasState', handleCanvasState)
    socket.on('drawLine', handleRemoteLine)
    socket.on('drawRectangle', handleRemoteRectangle)
    socket.on('drawText', handleRemoteText)
    socket.on('roomUsers', handleRoomUsers)
    socket.on('cursorMove', handleRemoteCursor)
    socket.on('userLeft', handleUserLeft)
    socket.on('yjsSync', handleYjsSync)
    socket.on('yjsUpdate', handleYjsUpdate)

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
      socket.off('userLeft', handleUserLeft)
      socket.off('yjsSync', handleYjsSync)
      socket.off('yjsUpdate', handleYjsUpdate)

      ydoc.off('update', handleLocalUpdate)

      bindingRef.current?.destroy()
      bindingRef.current = null
      editorRef.current = null

      awareness.destroy()
      ydoc.destroy()

      ydocRef.current = null
      ytextRef.current = null
      awarenessRef.current = null
      syncReadyRef.current = false
    }
  }, [roomId, userName, userColor])

  // Resizable whiteboard and code editor panels.
  const handleResizeStart = (event) => {
    event.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleResizeMove = useCallback((event) => {
    if (!isResizing.current) return

    const workspace = document.querySelector('.workspace')
    if (!workspace) return

    const bounds = workspace.getBoundingClientRect()
    if (!bounds.width) return

    const newWidth =
      ((event.clientX - bounds.left) / bounds.width) * 100

    if (newWidth >= 30 && newWidth <= 70) {
      setLeftPanelWidth(newWidth)
    }
  }, [])

  const handleResizeEnd = useCallback(() => {
    isResizing.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)

    return () => {
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [handleResizeMove, handleResizeEnd])

  // Whiteboard drawing handlers.
  const handleMouseDown = (event) => {
    const position = event.target.getStage().getPointerPosition()
    if (!position) return

    if (tool === 'text') {
      setTextPosition({ x: position.x, y: position.y })
      setTextInput('')
      return
    }

    isDrawing.current = true
    startPoint.current = { x: position.x, y: position.y }

    if (tool === 'pen') {
      setLines((previous) => [
        ...previous,
        [position.x, position.y],
      ])
    } else if (tool === 'rectangle') {
      setRectangles((previous) => [
        ...previous,
        {
          x: position.x,
          y: position.y,
          width: 0,
          height: 0,
        },
      ])
    }
  }

  const handleMouseMove = (event) => {
    const point = event.target.getStage().getPointerPosition()
    if (!point) return

    const now = Date.now()

    if (now - lastCursorSend.current >= 50 && socket.connected) {
      socket.emit('cursorMove', {
        roomId,
        x: point.x,
        y: point.y,
        userName,
        userColor,
      })

      lastCursorSend.current = now
    }

    if (!isDrawing.current) return

    if (tool === 'pen') {
      setLines((previous) => {
        if (!previous.length) return previous

        const lastLine = previous[previous.length - 1]

        return [
          ...previous.slice(0, -1),
          [...lastLine, point.x, point.y],
        ]
      })
    } else if (tool === 'rectangle') {
      const start = startPoint.current
      if (!start) return

      setRectangles((previous) => {
        if (!previous.length) return previous

        const last = previous[previous.length - 1]

        return [
          ...previous.slice(0, -1),
          {
            x: Math.min(start.x, point.x),
            y: Math.min(start.y, point.y),
            width: Math.abs(point.x - start.x),
            height: Math.abs(point.y - start.y),
          },
        ]
      })
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing.current) return

    if (tool === 'pen') {
      setLines((current) => {
        const line = current[current.length - 1]
        if (line && socket.connected) {
          socket.emit('drawLine', { roomId, line })
        }
        return current
      })
    } else if (tool === 'rectangle') {
      setRectangles((current) => {
        const rectangle = current[current.length - 1]
        if (rectangle && socket.connected) {
          socket.emit('drawRectangle', { roomId, rectangle })
        }
        return current
      })
    }

    isDrawing.current = false
    startPoint.current = null
  }

  const handleAddText = () => {
    if (!textInput.trim() || !textPosition) return

    const item = {
      x: textPosition.x,
      y: textPosition.y,
      text: textInput.trim(),
    }

    setTexts((previous) => [...previous, item])

    if (socket.connected) {
      socket.emit('drawText', { roomId, text: item })
    }

    setTextInput('')
    setTextPosition(null)
  }

  const handleCancelText = () => {
    setTextInput('')
    setTextPosition(null)
  }

  const handleShareRoom = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      window.alert('Room link copied!')
    } catch {
      window.prompt('Copy this room link:', window.location.href)
    }
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
            <span className="online-dot" />
            {onlineUsers.length} online
          </span>

          <div className="online-users-list">
            {onlineUsers.map((user) => (
              <span
                key={user.id}
                title={user.userName}
                className="online-user-chip"
              >
                <span
                  className="online-user-dot"
                  style={{ background: user.userColor }}
                />
                {user.userName}
              </span>
            ))}
          </div>
        </div>

        <div className="room-header-actions">
          <button
            type="button"
            className="share-room-btn"
            onClick={onBack}
          >
            ← Back to Home
          </button>

          <button
            type="button"
            className="share-room-btn"
            onClick={handleShareRoom}
          >
            Share Room
          </button>
        </div>
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
                type="button"
                className={tool === 'pen' ? 'tool-btn active' : 'tool-btn'}
                onClick={() => setTool('pen')}
              >
                Pen
              </button>

              <button
                type="button"
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
                type="button"
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
                    key={`rectangle-${index}`}
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
                  onChange={(event) => setTextInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleAddText()
                    if (event.key === 'Escape') handleCancelText()
                  }}
                  placeholder="Type text..."
                />

                <div className="text-actions">
                  <button type="button" onClick={handleAddText}>
                    Add
                  </button>
                  <button type="button" onClick={handleCancelText}>
                    Cancel
                  </button>
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
            <span className="editor-language">JavaScript · Yjs</span>
          </div>

          <div className="monaco-editor-container">
            <Editor
              key={roomId}
              height="100%"
              defaultLanguage="javascript"
              defaultValue=""
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                readOnly: false,
                domReadOnly: false,
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 14,
                tabSize: 2,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                padding: { top: 12 },
              }}
            />
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
        fill={cursor.userColor || '#34d399'}
        listening={false}
      />
      <Text
        x={cursor.x + 10}
        y={cursor.y - 10}
        text={cursor.userName || 'User'}
        fill={cursor.userColor || '#34d399'}
        fontSize={14}
        fontStyle="bold"
        listening={false}
      />
    </>
  )
}

export default Room
