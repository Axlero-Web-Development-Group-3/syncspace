import { useEffect, useState } from 'react'
import './App.css'
import Room from './Room'
import { socket } from './lib/socket'

function App() {
  const [roomId, setRoomId] = useState(
    () => sessionStorage.getItem('syncspace-roomId') || ''
  )

  const [showRoom, setShowRoom] = useState(
    () => Boolean(sessionStorage.getItem('syncspace-roomId'))
  )

  const [showJoin, setShowJoin] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('syncspace-user') || 'null')
    } catch {
      return null
    }
  })

  useEffect(() => {
    const savedRoomId = sessionStorage.getItem('syncspace-roomId')

    socket.connect()

    const handleConnect = () => {
      console.log('Socket connected:', socket.id)

      if (savedRoomId) {
        socket.emit('joinRoom', {
          roomId: savedRoomId,
          userName: currentUser?.name || 'Guest',
        })
      }
    }

    const handleDisconnect = () => {
      console.log('Socket disconnected')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.disconnect()
    }
  }, [])

  const createRoom = () => {
    const newRoomId = `room-${Math.random()
      .toString(36)
      .substring(2, 8)}`

    sessionStorage.setItem('syncspace-roomId', newRoomId)
    setRoomId(newRoomId)
    setShowRoom(true)

    if (socket.connected) {
      socket.emit('joinRoom', {
        roomId: newRoomId,
        userName: currentUser?.name || 'Guest',
      })
    }
  }

  const joinRoom = () => {
    const cleanRoomId = roomId.trim()

    if (!cleanRoomId) {
      alert('Please enter a Room ID')
      return
    }

    sessionStorage.setItem('syncspace-roomId', cleanRoomId)
    setRoomId(cleanRoomId)
    setShowJoin(false)
    setShowRoom(true)

    if (socket.connected) {
      socket.emit('joinRoom', {
        roomId: cleanRoomId,
        userName: currentUser?.name || 'Guest',
      })
    }
  }

  const leaveRoom = () => {
    sessionStorage.removeItem('syncspace-roomId')
    setRoomId('')
    setShowRoom(false)
  }

  const openAuth = (mode) => {
    setAuthMode(mode)
    setAuthMessage('')
    setName('')
    setEmail('')
    setPassword('')
    setShowAuth(true)
  }

  const handleAuth = async (event) => {
    event.preventDefault()
    setAuthMessage('')
    setAuthLoading(true)

    try {
      const endpoint =
        authMode === 'login' ? 'login' : 'register'

      const payload =
        authMode === 'login'
          ? { email, password }
          : { name, email, password }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed.')
      }

      sessionStorage.setItem('syncspace-token', data.token)
      sessionStorage.setItem(
        'syncspace-user',
        JSON.stringify(data.user)
      )

      setCurrentUser(data.user)
      setAuthMessage(
        authMode === 'login'
          ? 'Login successful!'
          : 'Registration successful!'
      )

      setShowAuth(false)
      setPassword('')
      alert(
        `Welcome${data.user?.name ? `, ${data.user.name}` : ''}!`
      )
    } catch (error) {
      setAuthMessage(
        error.message || 'Unable to connect to the server.'
      )
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = () => {
    sessionStorage.removeItem('syncspace-token')
    sessionStorage.removeItem('syncspace-user')
    setCurrentUser(null)
    alert('You have logged out.')
  }

  if (showRoom) {
    return <Room roomId={roomId} />
  }

  return (
    <div className="app">
      {/* Login and Register Popup */}
      {showAuth && (
        <div className="join-overlay">
          <div className="join-box">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => setShowAuth(false)}
            >
              Close ✕
            </button>

            <h2>
              {authMode === 'login'
                ? 'Welcome Back'
                : 'Create Your Account'}
            </h2>

            <p>
              {authMode === 'login'
                ? 'Login to your SyncSpace account.'
                : 'Register to get started with SyncSpace.'}
            </p>

            <form onSubmit={handleAuth}>
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}

              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Password (minimum 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />

              {authMessage && (
                <p role="alert">{authMessage}</p>
              )}

              <button
                type="submit"
                className="join-confirm-btn"
                disabled={authLoading}
              >
                {authLoading
                  ? 'Please wait...'
                  : authMode === 'login'
                    ? 'Login'
                    : 'Create Account'}
              </button>
            </form>

            <p>
              {authMode === 'login'
                ? "Don't have an account?"
                : 'Already have an account?'}
              {' '}
              <button
                type="button"
                className="cancel-btn"
                onClick={() => {
                  setAuthMode(
                    authMode === 'login' ? 'register' : 'login'
                  )
                  setAuthMessage('')
                }}
              >
                {authMode === 'login' ? 'Register' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Join Room Popup */}
      {showJoin && (
        <div className="join-overlay">
          <div className="join-box">
            <h2>Join a Room</h2>
            <p>Enter the room ID to join a collaboration room.</p>

            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') joinRoom()
              }}
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
                onClick={joinRoom}
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
          <span className="logo-icon">S</span>
          <span>SyncSpace</span>
        </div>

        <nav className="nav-links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </nav>

        <div className="nav-actions">
          {currentUser ? (
            <>
              <span>{currentUser.name}</span>
              <button className="login-btn" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <button
              className="login-btn"
              onClick={() => openAuth('login')}
            >
              Login
            </button>
          )}

          <button
            className="get-started-btn"
            onClick={createRoom}
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section id="home" className="hero-section">
          <div className="hero-content">
            <p className="hero-tag">REAL-TIME COLLABORATION</p>

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
              <button className="primary-btn" onClick={createRoom}>
                Create a Room →
              </button>

              <button
                className="secondary-btn"
                onClick={() => {
                  setRoomId('')
                  setShowJoin(true)
                }}
              >
                Join a Room
              </button>
            </div>
          </div>

          <div className="workspace-preview">
            <div className="preview-header">
              <div className="preview-room">SyncSpace / room-42</div>

              <div className="preview-online">
                <span className="online-dot"></span>
                2 online
              </div>
            </div>

            <div className="preview-content">
              <div className="preview-whiteboard">
                <div className="preview-title">WHITEBOARD</div>

                <div className="whiteboard-content">
                  <div className="architecture-box">React</div>
                  <div className="arrow">↓</div>
                  <div className="architecture-box">Node.js</div>
                  <div className="arrow">↓</div>
                  <div className="architecture-box">MongoDB</div>
                </div>
              </div>

              <div className="preview-editor">
                <div className="preview-title">CODE EDITOR</div>

                <div className="code-content">
                  <pre>{`function createRoom(user) {
  const room = {
    owner: user,
    active: true
  };

  return room;
}`}</pre>
                  <div className="cursor-label">Shivani</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="features-section">
          <div className="section-heading">
            <p className="section-tag">POWERFUL FEATURES</p>
            <h2>Everything you need to collaborate</h2>
            <p>
              Designed for developers, technical teams,
              students, and remote collaboration.
            </p>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">✦</div>
              <h3>Real-time Collaboration</h3>
              <p>
                Work together with multiple users and see
                changes instantly without refreshing the page.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⌘</div>
              <h3>Collaborative Whiteboard</h3>
              <p>
                Draw system architectures, diagrams,
                flows, and ideas on a shared digital canvas.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">&lt;/&gt;</div>
              <h3>Shared Code Editor</h3>
              <p>
                Write and edit code together using a
                powerful developer focused editor.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">◉</div>
              <h3>Private Rooms</h3>
              <p>
                Create dedicated rooms and invite teammates,
                interviewers, or collaborators.
              </p>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="about-section">
          <div>
            <p className="section-tag">BUILT FOR COLLABORATION</p>
            <h2>One workspace. Multiple possibilities.</h2>
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
          <span className="logo-icon">S</span>
          <span>SyncSpace</span>
        </div>

        <p>Built for developers who build together.</p>
        <p>© 2026 SyncSpace</p>
      </footer>
    </div>
  )
}

export default App