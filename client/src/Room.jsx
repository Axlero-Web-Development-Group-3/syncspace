import './Room.css'
import { Stage, Layer, Line, Rect, Text } from 'react-konva'
import { useState, useRef } from 'react'

function Room({ roomId }) {
  const [lines, setLines] = useState([])
  const [rectangles, setRectangles] = useState([])
  const [texts, setTexts] = useState([])

  const [tool, setTool] = useState('pen')
  const [textInput, setTextInput] = useState('')
  const [textPosition, setTextPosition] = useState(null)

  const isDrawing = useRef(false)
  const startPoint = useRef(null)

  const handleMouseDown = (e) => {
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()

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
    if (!isDrawing.current) return

    const stage = e.target.getStage()
    const point = stage.getPointerPosition()

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
    isDrawing.current = false
    startPoint.current = null
  }

  const handleAddText = () => {
    if (!textInput.trim() || !textPosition) return

    setTexts((prev) => [
      ...prev,
      {
        x: textPosition.x,
        y: textPosition.y,
        text: textInput,
      },
    ])

    setTextInput('')
    setTextPosition(null)
  }

  const handleCancelText = () => {
    setTextInput('')
    setTextPosition(null)
  }

  return (
    <div className="room-page">

      {/* ================= HEADER ================= */}

      <header className="room-header">

        <div className="room-logo">
          <span className="room-logo-icon">S</span>

          <div className="room-logo-text">
            <span className="brand-name">SyncSpace</span>
            <span className="brand-subtitle">Collaborative Workspace</span>
          </div>
        </div>

        <div className="room-center-info">
          <span className="room-label">ROOM</span>
          <span className="room-id">{roomId}</span>
        </div>

        <div className="room-actions">

          <div className="online-users">
            <span className="online-dot"></span>
            <span>2 online</span>
          </div>

          <button className="share-btn">
            Share Room
          </button>

        </div>

      </header>


      {/* ================= WORKSPACE ================= */}

      <main className="workspace">

        {/* ================= WHITEBOARD ================= */}

        <section className="whiteboard-panel">

          <div className="panel-header">

            <div className="panel-title">
              <span className="panel-icon">✦</span>

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


          {/* Drawing Toolbar */}

          <div className="drawing-toolbar">

            <button
              className={`tool-button ${
                tool === 'pen' ? 'tool-active' : ''
              }`}
              onClick={() => setTool('pen')}
            >
              <span className="tool-icon">✎</span>
              <span>Pen</span>
            </button>

            <button
              className={`tool-button ${
                tool === 'rectangle' ? 'tool-active' : ''
              }`}
              onClick={() => setTool('rectangle')}
            >
              <span className="tool-icon">□</span>
              <span>Rectangle</span>
            </button>

            <button
              className={`tool-button ${
                tool === 'text' ? 'tool-active' : ''
              }`}
              onClick={() => setTool('text')}
            >
              <span className="tool-icon">T</span>
              <span>Text</span>
            </button>

          </div>


          {/* Whiteboard */}

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

                {/* Lines */}

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


                {/* Rectangles */}

                {rectangles.map((rectangle, index) => (
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
                ))}


                {/* Text */}

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


            {/* Text Input */}

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

                  <button onClick={handleAddText}>
                    Add
                  </button>

                  <button onClick={handleCancelText}>
                    Cancel
                  </button>

                </div>

              </div>
            )}

          </div>

        </section>


        {/* ================= CODE EDITOR ================= */}

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


          {/* Editor Tabs */}

          <div className="editor-tabs">

            <div className="editor-tab active-tab">
              <span className="js-dot"></span>
              index.js
            </div>

            <div className="editor-tab">
              + New
            </div>

          </div>


          {/* Code */}

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