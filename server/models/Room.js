
const mongoose = require('mongoose')

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    drawings: {
      lines: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
      rectangles: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
      texts: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
    },

    // Legacy code string, retained for migration/compatibility.
    code: {
      type: String,
      default: '',
    },

    // Base64-encoded Yjs document state.
    yjsState: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('Room', roomSchema)
