import { useEffect, useState } from 'react'
import './App.css'
import Room from './Room'
import { socket } from './lib/socket'

function App() {
  const [showRoom, setShowRoom] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
    useEffect(() => {
    socket.connect()

    const handleConnect = () => {
      console.log("Socket connected:", socket.id)
    }

    const handleDisconnect = () => {
      console.log("Socket disconnected")
    }

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)

    return () => {
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.disconnect()
    }
  }, [])

  if (showRoom) {
    return <Room />
  }

  return (
    <div className="app">

      {/* Join Room Popup */}
      {showJoin && (
        <div className="join-overlay">

          <div className="join-box">

            <h2>Join a Room</h2>

            <p>
              Enter the room ID to join a collaboration room.
            </p>

            <input
              type="text"
              placeholder="Enter Room ID"
            />

            <div className="join-actions">

              <button
                className="cancel-btn"
                onClick={() => setShowJoin(false)}
              >
                Cancel
              </button>

              <button
                className="join-confirm-btn"
                onClick={() => setShowRoom(true)}
              >
                Join Room
              </button>

            </div>

          </div>

        </div>
      )}

      {/* Navbar */}
      <header className="navbar">

        <div className="logo">

          <span className="logo-icon">
            S
          </span>

          <span>
            SyncSpace
          </span>

        </div>

        <nav className="nav-links">

          <a href="#home">
            Home
          </a>

          <a href="#features">
            Features
          </a>

          <a href="#about">
            About
          </a>

        </nav>

        <div className="nav-actions">

          <button className="login-btn">
            Login
          </button>

          <button
            className="get-started-btn"
            onClick={() => setShowRoom(true)}
          >
            Get Started
          </button>

        </div>

      </header>

      {/* Hero Section */}
      <main>

        <section
          id="home"
          className="hero-section"
        >

          <div className="hero-content">

            <p className="hero-tag">
              REAL-TIME COLLABORATION
            </p>

            <h1>
              Collaborate. Code.
              <br />
              Create. Together.
            </h1>

            <p className="hero-description">
              A real-time workspace where developers can
              collaborate, visualize ideas, and write code
              together — all in one place.
            </p>

            <div className="hero-buttons">

              <button
                className="primary-btn"
                onClick={() => setShowRoom(true)}
              >
                Create a Room →
              </button>

              <button
                className="secondary-btn"
                onClick={() => setShowJoin(true)}
              >
                Join a Room
              </button>

            </div>

          </div>

          {/* Workspace Preview */}
          <div className="workspace-preview">

            <div className="preview-header">

              <div className="preview-room">
                SyncSpace / room-42
              </div>

              <div className="preview-online">
                <span className="online-dot"></span>
                2 online
              </div>

            </div>

            <div className="preview-content">

              {/* Whiteboard */}
              <div className="preview-whiteboard">

                <div className="preview-title">
                  WHITEBOARD
                </div>

                <div className="whiteboard-content">

                  <div className="architecture-box">
                    React
                  </div>

                  <div className="arrow">
                    ↓
                  </div>

                  <div className="architecture-box">
                    Node.js
                  </div>

                  <div className="arrow">
                    ↓
                  </div>

                  <div className="architecture-box">
                    MongoDB
                  </div>

                </div>

              </div>

              {/* Code Editor */}
              <div className="preview-editor">

                <div className="preview-title">
                  CODE EDITOR
                </div>

                <div className="code-content">

                  <pre>
{`function createRoom(user) {
  const room = {
    owner: user,
    active: true
  };

  return room;
}`}
                  </pre>

                  <div className="cursor-label">
                    Shivani
                  </div>

                </div>

              </div>

            </div>

          </div>

        </section>

        {/* Features Section */}
        <section
          id="features"
          className="features-section"
        >

          <div className="section-heading">

            <p className="section-tag">
              POWERFUL FEATURES
            </p>

            <h2>
              Everything you need to collaborate
            </h2>

            <p>
              Designed for developers, technical teams,
              students, and remote collaboration.
            </p>

          </div>

          <div className="feature-grid">

            <div className="feature-card">

              <div className="feature-icon">
                ✦
              </div>

              <h3>
                Real-time Collaboration
              </h3>

              <p>
                Work together with multiple users and see
                changes instantly without refreshing the page.
              </p>

            </div>

            <div className="feature-card">

              <div className="feature-icon">
                ⌘
              </div>

              <h3>
                Collaborative Whiteboard
              </h3>

              <p>
                Draw system architectures, diagrams,
                flows, and ideas on a shared digital canvas.
              </p>

            </div>

            <div className="feature-card">

              <div className="feature-icon">
                &lt;/&gt;
              </div>

              <h3>
                Shared Code Editor
              </h3>

              <p>
                Write and edit code together using a
                powerful developer focused editor.
              </p>

            </div>

            <div className="feature-card">

              <div className="feature-icon">
                ◉
              </div>

              <h3>
                Private Rooms
              </h3>

              <p>
                Create dedicated rooms and invite teammates,
                interviewers, or collaborators.
              </p>

            </div>

          </div>

        </section>

        {/* About Section */}
        <section
          id="about"
          className="about-section"
        >

          <div>

            <p className="section-tag">
              BUILT FOR COLLABORATION
            </p>

            <h2>
              One workspace. Multiple possibilities.
            </h2>

          </div>

          <p>
            SyncSpace brings technical discussions,
            visual thinking, and collaborative coding into
            one shared environment. Whether you are conducting
            a technical interview, learning with friends,
            or working with a remote team, everyone stays in sync.
          </p>

        </section>

      </main>

      {/* Footer */}
      <footer className="footer">

        <div className="logo">

          <span className="logo-icon">
            S
          </span>

          <span>
            SyncSpace
          </span>

        </div>

        <p>
          Built for developers who build together.
        </p>

        <p>
          © 2026 SyncSpace
        </p>

      </footer>

    </div>
  )
}

export default App