import './Room.css'
import { Stage, Layer, Line, Rect, Text } from 'react-konva'
import { useState, useRef, useEffect } from 'react'
import { socket } from './lib/socket'

function Room({ roomId }) {
  const [lines, setLines] = useState([])
  const [rectangles, setRectangles] = useState([])
  const [texts, setTexts] = useState([])

  const [tool, setTool] = useState('pen')
  const [textInput, setTextInput] = useState('')
  const [textPosition, setTextPosition] = useState(null)

  const isDrawing = useRef(false)
  const startPoint = useRef(null)

  // Join room and listen for drawings
  useEffect(() => {
    socket.emit('joinRoom', roomId)

    // Receive pen drawing from another user
    const handleRemoteLine = (line) => {
      setLines((prev) => [...prev, line])
    }

    // Receive rectangle from another user
    const handleRemoteRectangle = (rectangle) => {
      setRectangles((prev) => [...prev, rectangle])
    }

    // Receive text from another user
    const handleRemoteText = (text) => {
      setTexts((prev) => [...prev, text])
    }

    socket.on('drawLine', handleRemoteLine)
    socket.on('drawRectangle', handleRemoteRectangle)
    socket.on('drawText', handleRemoteText)

    return () => {
      socket.off('drawLine', handleRemoteLine)
      socket.off('drawRectangle', handleRemoteRectangle)
      socket.off('drawText', handleRemoteText)
    }
  }, [roomId])

  // Mouse Down
  const handleMouseDown = (e) => {
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()

    // Text tool
    if (tool === 'text') {
      setTextPosition({
        x: pos.x,
        y: pos.y,
      })

      setTextInput('')
      return
    }

    // Start drawing
    isDrawing.current = true

    startPoint.current = {
      x: pos.x,
      y: pos.y,
    }

    // Start pen line
    if (tool === 'pen') {
      setLines((prev) => [
        ...prev,
        [pos.x, pos.y],
      ])
    }

    // Start rectangle
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

  // Mouse Move
  const handleMouseMove = (e) => {
    if (!isDrawing.current) return

    const stage = e.target.getStage()
    const point = stage.getPointerPosition()

    // Pen
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

    // Rectangle
    if (tool === 'rectangle') {
      const start = startPoint.current

      if (!start) return

      setRectangles((prev) => {
        if (prev.length === 0) return prev

        const lastRectangle =
          prev[prev.length - 1]

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

  // Mouse Up
  const handleMouseUp = () => {
    if (!isDrawing.current) return

    // Send pen drawing
    if (tool === 'pen') {
      setLines((currentLines) => {
        if (currentLines.length === 0) {
          return currentLines
        }

        const lastLine =
          currentLines[currentLines.length - 1]

        socket.emit('drawLine', {
          roomId,
          line: lastLine,
        })

        return currentLines
      })
    }

    // Send rectangle
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

  // Add Text
  const handleAddText = () => {
    if (!textInput.trim() || !textPosition) return

    const newText = {
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
    }

    // Show text on current user's screen
    setTexts((prev) => [
      ...prev,
      newText,
    ])

    // Send text to other users
    socket.emit('drawText', {
      roomId,
      text: newText,
    })

    setTextInput('')
    setTextPosition(null)
  }

  // Cancel Text
  const handleCancelText = () => {
    setTextInput('')
    setTextPosition(null)
  }

  return (
    <div className="room-page">

      {/* HEADER */}
      <header className="room-header">

        <div className="room-logo">

          <span className="room-logo-icon">
            S
          </span>

          <div className="room-logo-text">

            <span className="brand-name">
              SyncSpace
            </span>

            <span className="brand-subtitle">
              Collaborative Workspace
            </span>

          </div>

        </div>

        <div className="room-center-info">

          <span className="room-label">
            ROOM
          </span>

          <span className="room-id">
            {roomId}
          </span>

        </div>

        <div className="room-actions">

          <div className="online-users">

            <span className="online-dot"></span>

            <span>
              2 online
            </span>

          </div>

          <button className="share-btn">
            Share Room
          </button>

        </div>

      </header>

      {/* WORKSPACE */}
      <main className="workspace">

        {/* WHITEBOARD */}
        <section className="whiteboard-panel">

          <div className="panel-header">

            <div className="panel-title">

              <span className="panel-icon">
                ✦
              </span>

              <div>

                <span className="panel-name">
                  Whiteboard
                </span>

                <span className="panel-description">
                  Visual collaboration
                </span>

              </div>

            </div>

            <span className="live-badge">
              LIVE
            </span>

          </div>

          {/* TOOLBAR */}
          <div className="drawing-toolbar">

            {/* PEN */}
            <button
              className={`tool-button ${
                tool === 'pen'
                  ? 'tool-active'
                  : ''
              }`}
              onClick={() => setTool('pen')}
            >

              <span className="tool-icon">
                ✎
              </span>

              <span>
                Pen
              </span>

            </button>

            {/* RECTANGLE */}
            <button
              className={`tool-button ${
                tool === 'rectangle'
                  ? 'tool-active'
                  : ''
              }`}
              onClick={() =>
                setTool('rectangle')
              }
            >

              <span className="tool-icon">
                □
              </span>

              <span>
                Rectangle
              </span>

            </button>

            {/* TEXT */}
            <button
              className={`tool-button ${
                tool === 'text'
                  ? 'tool-active'
                  : ''
              }`}
              onClick={() => setTool('text')}
            >

              <span className="tool-icon">
                T
              </span>

              <span>
                Text
              </span>

            </button>

          </div>

          {/* WHITEBOARD AREA */}
          <div className="whiteboard-area">

            <div className="canvas-label">

              <span className="canvas-status"></span>

              Drawing Canvas

            </div>

            <Stage
              width={900}
              height={650}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >

              <Layer>

                {/* PEN LINES */}
                {lines.map((line, index) => (
                  <Line
                    key={`line-${index}`}
                    points={line}
                    stroke="#4f46e5"
                    strokeWidth={4}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))}

                {/* RECTANGLES */}
                {rectangles.map(
                  (rectangle, index) => (
                    <Rect
                      key={`rectangle-${index}`}
                      x={rectangle.x}
                      y={rectangle.y}
                      width={rectangle.width}
                      height={rectangle.height}
                      stroke="#6366f1"
                      strokeWidth={3}
                      fill="rgba(99, 102, 241, 0.06)"
                    />
                  )
                )}

                {/* TEXT */}
                {texts.map((item, index) => (
                  <Text
                    key={`text-${index}`}
                    x={item.x}
                    y={item.y}
                    text={item.text}
                    fontSize={20}
                    fontStyle="bold"
                    fill="#1e293b"
                  />
                ))}

              </Layer>

            </Stage>

            {/* TEXT INPUT */}
            {textPosition && (
              <div
                className="text-input-box"
                style={{
                  left: textPosition.x,
                  top: textPosition.y,
                }}
              >

                <input
                  type="text"
                  autoFocus
                  placeholder="Enter text..."
                  value={textInput}
                  onChange={(e) =>
                    setTextInput(e.target.value)
                  }
                  onKeyDown={(e) => {

                    if (e.key === 'Enter') {
                      handleAddText()
                    }

                    if (e.key === 'Escape') {
                      handleCancelText()
                    }

                  }}
                />

                <div className="text-input-actions">

                  <button
                    onClick={handleAddText}
                  >
                    Add
                  </button>

                  <button
                    onClick={handleCancelText}
                  >
                    Cancel
                  </button>

                </div>

              </div>
            )}

          </div>

        </section>

        {/* CODE EDITOR */}
        <section className="code-panel">

          <div className="panel-header">

            <div className="panel-title">

              <span className="panel-icon code-icon">
                &lt;/&gt;
              </span>

              <div>

                <span className="panel-name">
                  Code Editor
                </span>

                <span className="panel-description">
                  Shared workspace
                </span>

              </div>

            </div>

            <span className="language-badge">
              JavaScript
            </span>

          </div>

          {/* EDITOR TABS */}
          <div className="editor-tabs">

            <div className="editor-tab active-tab">

              <span className="js-dot"></span>

              index.js

            </div>

            <div className="editor-tab">
              + New
            </div>

          </div>

          {/* CODE AREA */}
          <div className="code-area">

            <div className="code-content">

              <div className="line-numbers">
                1<br />
                2<br />
                3<br />
                4<br />
                5<br />
                6<br />
                7<br />
                8<br />
                9
              </div>

              <pre>
{`function createRoom(user) {
  const room = {
    owner: user,
    active: true
  };

  return room;
}`}
              </pre>

            </div>

            <div className="editor-footer">

              <span>
                JavaScript
              </span>

              <span>
                UTF-8
              </span>

              <span>
                ● Ready
              </span>

            </div>

          </div>

        </section>

      </main>

    </div>
  )
}

export default Room