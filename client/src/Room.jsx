import './Room.css'

function Room({ roomId }) {
  return (
    <div className="room-page">

      <header className="room-header">
        <div className="room-logo">
          <span className="room-logo-icon">S</span>
          <span>SyncSpace</span>
        </div>

        <div className="room-info">
         <span>Room:</span>
         <strong>{roomId}</strong>
      </div>

        <div className="online-users">
          <span className="online-dot"></span>
          <span>2 Online</span>
        </div>
      </header>

      <main className="workspace">

        <section className="whiteboard-panel">
          <div className="panel-header">
            WHITEBOARD
          </div>

          <div className="whiteboard-area">
            <p>Whiteboard Area</p>
            <span>Canvas will be added later</span>
          </div>
        </section>

        <section className="code-panel">
          <div className="panel-header">
            CODE EDITOR
          </div>

          <div className="code-area">
            <pre>{`function createRoom(user) {
  const room = {
    owner: user,
    active: true
  };

  return room;
}`}</pre>

            <span className="editor-note">
              Code editor will be added later
            </span>
          </div>
        </section>

      </main>

    </div>
  )
}

export default Room