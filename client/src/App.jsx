import './App.css'

function App() {
  return (
    <div className="app">

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
          <button className="login-btn">Login</button>
          <button className="signup-btn">Get Started</button>
        </div>
      </header>

      <main id="home">

        <section className="hero-section">

          <div className="hero-content">

            <div className="badge">
              <span className="status-dot"></span>
              Real-time collaboration
            </div>

            <h1>
              Collaborate.
              <br />
              <span>Code. Create.</span>
              <br />
              Together.
            </h1>

            <p className="hero-description">
              A real-time workspace where developers can collaborate,
              visualize ideas, and write code together — all in one place.
            </p>

            <div className="hero-buttons">
              <button className="primary-btn">
                Create a Room →
              </button>

              <button className="secondary-btn">
                Join a Room
              </button>
            </div>

            <p className="hero-note">
              No complicated setup. Just create a room and start collaborating.
            </p>

          </div>

          <div className="workspace-preview">

            <div className="preview-header">

              <div className="window-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <span className="room-name">
                SyncSpace / room-42
              </span>

              <div className="online-users">
                <span className="user-avatar">S</span>
                <span className="user-avatar second">A</span>
                <span className="online-text">
                  2 online
                </span>
              </div>

            </div>

            <div className="preview-body">

              <div className="whiteboard-preview">

                <span className="preview-label">
                  WHITEBOARD
                </span>

                <div className="diagram">

                  <div className="diagram-box frontend">
                    React
                  </div>

                  <div className="arrow">
                    ↓
                  </div>

                  <div className="diagram-box backend">
                    Node.js
                  </div>

                  <div className="arrow">
                    ↓
                  </div>

                  <div className="diagram-box database">
                    MongoDB
                  </div>

                </div>

              </div>

              <div className="code-preview">

                <span className="preview-label">
                  CODE EDITOR
                </span>

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

        </section>

        <section id="features" className="features-section">

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
              <div className="feature-icon">✦</div>

              <h3>
                Real-time Collaboration
              </h3>

              <p>
                Work together with multiple users and see
                changes instantly without refreshing the page.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⌘</div>

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
              <div className="feature-icon">◉</div>

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

        <section id="about" className="about-section">

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

      <footer className="footer">

        <div className="logo">
          <span className="logo-icon">S</span>
          <span>SyncSpace</span>
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