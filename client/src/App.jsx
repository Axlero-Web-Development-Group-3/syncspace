
import { useEffect, useState } from 'react'
import './App.css'
import Room from './Room'
import { socket } from './lib/socket'

// Read the room ID from the URL hash.
function getRoomIdFromHash() {
  const match = window.location.hash.match(/^#room\/([^/?#]+)/)

  if (!match) return ''

  try {
    return decodeURIComponent(match[1]).trim()
  } catch {
    return ''
  }
}

function App() {
  const [roomId, setRoomId] = useState(() => {
    return (
      getRoomIdFromHash() ||
      sessionStorage.getItem('syncspace-roomId') ||
      ''
    )
  })

  const [showRoom, setShowRoom] = useState(() => {
    return Boolean(
      getRoomIdFromHash() ||
      sessionStorage.getItem('syncspace-roomId')
    )
  })

  const [showJoin, setShowJoin] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const [initialFeature, setInitialFeature] = useState(
    () =>
      sessionStorage.getItem('syncspace-initial-feature') ||
      'collaboration'
  )

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem('syncspace-user') || 'null'
      )
    } catch {
      return null
    }
  })

  // Open a room directly when its shared URL is visited.
  useEffect(() => {
    const urlRoomId = getRoomIdFromHash()

    if (!urlRoomId) return

    sessionStorage.setItem('syncspace-roomId', urlRoomId)
    sessionStorage.setItem(
      'syncspace-initial-feature',
      'collaboration'
    )

    setRoomId(urlRoomId)
    setInitialFeature('collaboration')
    setShowRoom(true)
    setShowJoin(false)
  }, [])

  // Connect Socket.IO and join the current room.
  useEffect(() => {
    const handleConnect = () => {
      const savedRoomId =
        getRoomIdFromHash() ||
        sessionStorage.getItem('syncspace-roomId')

      if (!savedRoomId) return

      let savedUser = null

      try {
        savedUser = JSON.parse(
          sessionStorage.getItem('syncspace-user') || 'null'
        )
      } catch {
        savedUser = null
      }

      socket.emit('joinRoom', {
        roomId: savedRoomId,
        userName: savedUser?.name || 'Guest',
        userColor: '#34d399',
      })
    }

    socket.on('connect', handleConnect)

    if (!socket.connected) {
      socket.connect()
    } else {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.disconnect()
    }
  }, [])

  // Handle browser Back and Forward navigation.
  useEffect(() => {
    const handlePopState = () => {
      const urlRoomId = getRoomIdFromHash()

      if (urlRoomId) {
        sessionStorage.setItem('syncspace-roomId', urlRoomId)
        setRoomId(urlRoomId)
        setShowRoom(true)
        setShowJoin(false)
      } else {
        sessionStorage.removeItem('syncspace-roomId')
        sessionStorage.removeItem('syncspace-initial-feature')

        setRoomId('')
        setShowRoom(false)
        setShowJoin(false)
        setInitialFeature('collaboration')
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  // Create a new room.
  const createRoom = (feature = 'collaboration') => {
    const newRoomId =
      'room-' + Math.random().toString(36).substring(2, 8)

    window.history.pushState(
      { syncspaceRoom: true, roomId: newRoomId },
      '',
      '#room/' + newRoomId
    )

    sessionStorage.setItem('syncspace-roomId', newRoomId)
    sessionStorage.setItem('syncspace-initial-feature', feature)

    setRoomId(newRoomId)
    setInitialFeature(feature)
    setShowRoom(true)
    setShowJoin(false)

    if (socket.connected) {
      socket.emit('joinRoom', {
        roomId: newRoomId,
        userName: currentUser?.name || 'Guest',
        userColor: '#34d399',
      })
    }
  }

  // Accept either a room ID or a complete shared room URL.
  const joinRoom = () => {
    const enteredValue = roomId.trim()

    if (!enteredValue) {
      window.alert('Please enter a Room ID or shared room link.')
      return
    }

    let cleanRoomId = enteredValue

    if (enteredValue.includes('#room/')) {
      try {
        const parsedUrl = new URL(enteredValue)
        const match = parsedUrl.hash.match(/^#room\/([^/?#]+)/)

        if (match) {
          cleanRoomId = decodeURIComponent(match[1]).trim()
        } else {
          window.alert('Invalid room link.')
          return
        }
      } catch {
        const match = enteredValue.match(/#room\/([^/?#]+)/)

        if (match) {
          try {
            cleanRoomId = decodeURIComponent(match[1]).trim()
          } catch {
            window.alert('Invalid room link.')
            return
          }
        } else {
          window.alert('Invalid room link.')
          return
        }
      }
    }

    if (!cleanRoomId || /[/?#\s]/.test(cleanRoomId)) {
      window.alert('Please enter a valid Room ID or shared room link.')
      return
    }

    window.history.pushState(
      { syncspaceRoom: true, roomId: cleanRoomId },
      '',
      '#room/' + encodeURIComponent(cleanRoomId)
    )

    sessionStorage.setItem('syncspace-roomId', cleanRoomId)
    sessionStorage.setItem(
      'syncspace-initial-feature',
      'collaboration'
    )

    setRoomId(cleanRoomId)
    setInitialFeature('collaboration')
    setShowJoin(false)
    setShowRoom(true)

    if (socket.connected) {
      socket.emit('joinRoom', {
        roomId: cleanRoomId,
        userName: currentUser?.name || 'Guest',
        userColor: '#34d399',
      })
    }
  }

  // Return to the home page.
  const leaveRoom = () => {
    sessionStorage.removeItem('syncspace-roomId')
    sessionStorage.removeItem('syncspace-initial-feature')

    setRoomId('')
    setShowRoom(false)
    setShowJoin(false)
    setInitialFeature('collaboration')

    window.history.replaceState(
      { syncspaceHome: true },
      '',
      window.location.pathname + window.location.search
    )
  }

  // Open login or registration.
  const openAuth = (mode) => {
    setAuthMode(mode)
    setAuthMessage('')
    setName('')
    setEmail('')
    setPassword('')
    setShowAuth(true)
  }

  // Login and registration.
  const handleAuth = async (event) => {
    event.preventDefault()
    setAuthMessage('')
    setAuthLoading(true)

    try {
      const endpoint = authMode === 'login' ? 'login' : 'register'

      const payload =
        authMode === 'login'
          ? { email, password }
          : { name, email, password }

      const apiUrl =
        import.meta.env.VITE_API_URL || 'http://localhost:5000'

      const response = await fetch(
        apiUrl + '/api/auth/' + endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
      setShowAuth(false)
      setPassword('')

      window.alert(
        'Welcome' +
          (data.user?.name ? ', ' + data.user.name : '') +
          '!'
      )
    } catch (error) {
      setAuthMessage(
        error.message || 'Unable to connect to the server.'
      )
    } finally {
      setAuthLoading(false)
    }
  }

  // Logout.
  const logout = () => {
    sessionStorage.removeItem('syncspace-token')
    sessionStorage.removeItem('syncspace-user')
    setCurrentUser(null)
    window.alert('You have logged out.')
  }

  // Render the collaborative room.
  if (showRoom && roomId) {
    return (
      <Room
        roomId={roomId}
        onBack={leaveRoom}
        initialFeature={initialFeature}
      />
    )
  }

  return (
    <div className="app">
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
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              )}

              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Password (minimum 6 characters)"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />

              {authMessage && <p role="alert">{authMessage}</p>}

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
                : 'Already have an account?'}{' '}
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

      {showJoin && (
        <div className="join-overlay">
          <div className="join-box">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => setShowJoin(false)}
            >
              Close ✕
            </button>

            <h2>Join a Room</h2>
            <p>Enter the room ID or paste a shared room link.</p>

            <input
              type="text"
              placeholder="Enter Room ID or shared link"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') joinRoom()
              }}
            />

            <div className="join-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowJoin(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="join-confirm-btn"
                onClick={joinRoom}
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button
                type="button"
                className="login-btn"
                onClick={logout}
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              className="login-btn"
              onClick={() => openAuth('login')}
            >
              Login
            </button>
          )}

          <button
            type="button"
            className="get-started-btn"
            onClick={() => createRoom('collaboration')}
          >
            Get Started
          </button>
        </div>
      </header>

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
              <button
                type="button"
                className="primary-btn"
                onClick={() => createRoom('collaboration')}
              >
                Create a Room →
              </button>

              <button
                type="button"
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
                  <pre>
                    {'function createRoom(user) {\n' +
                      '  const room = {\n' +
                      '    owner: user,\n' +
                      '    active: true\n' +
                      '  };\n\n' +
                      '  return room;\n' +
                      '}'}
                  </pre>
                  <div className="cursor-label">Shivani</div>
                </div>
              </div>
            </div>
          </div>
        </section>

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
            <button
              type="button"
              className="feature-card"
              onClick={() => createRoom('collaboration')}
            >
              <div className="feature-icon">✦</div>
              <h3>Real-time Collaboration</h3>
              <p>
                Work together with multiple users and see
                changes instantly without refreshing the page.
              </p>
              <span className="feature-link">
                Start Collaborating →
              </span>
            </button>

            <button
              type="button"
              className="feature-card"
              onClick={() => createRoom('whiteboard')}
            >
              <div className="feature-icon">⌘</div>
              <h3>Collaborative Whiteboard</h3>
              <p>
                Draw system architectures, diagrams, flows,
                and ideas on a shared digital canvas.
              </p>
              <span className="feature-link">
                Open Whiteboard →
              </span>
            </button>

            <button
              type="button"
              className="feature-card"
              onClick={() => createRoom('editor')}
            >
              <div className="feature-icon">&lt;/&gt;</div>
              <h3>Shared Code Editor</h3>
              <p>
                Write and edit code together using a
                powerful developer-focused editor.
              </p>
              <span className="feature-link">
                Open Code Editor →
              </span>
            </button>

            <button
              type="button"
              className="feature-card"
              onClick={() => {
                setRoomId('')
                setShowJoin(true)
              }}
            >
              <div className="feature-icon">◉</div>
              <h3>Private Rooms</h3>
              <p>
                Join a dedicated room using its Room ID
                and collaborate with your teammates.
              </p>
              <span className="feature-link">
                Join a Private Room →
              </span>
            </button>
          </div>
        </section>

        <section id="about" className="about-section">
          <div>
            <p className="section-tag">BUILT FOR COLLABORATION</p>
            <h2>One workspace. Multiple possibilities.</h2>
          </div>

          <p>
            SyncSpace brings technical discussions, visual
            thinking, and collaborative coding into one shared
            environment. Whether you are conducting a technical
            interview, learning with friends, or working with
            a remote team, everyone stays in sync.
          </p>
        </section>
      </main>

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
