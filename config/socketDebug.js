// socketDebug.js
const colors = require("colors/safe");

class SocketDebugger {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.startTime = Date.now();
  }

  timestamp() {
    return new Date().toISOString();
  }

  log(event, message, data = null) {
    if (!this.enabled) return;

    const timestamp = colors.gray(`[${this.timestamp()}]`);
    const eventName = colors.cyan(`[${event}]`);

    console.log(`${timestamp} ${eventName} ${message}`);
    if (data) {
      console.log(colors.gray("Data:"), JSON.stringify(data, null, 2));
    }
  }

  error(event, message, error) {
    if (!this.enabled) return;

    const timestamp = colors.gray(`[${this.timestamp()}]`);
    const eventName = colors.red(`[${event}]`);

    console.error(`${timestamp} ${eventName} ${message}`);
    if (error) {
      console.error(colors.red("Error:"), error);
    }
  }

  connectionStatus(connectedUsers) {
    if (!this.enabled) return;

    console.log("\n" + colors.yellow("=== Connected Users Status ==="));
    console.log(`Total connected users: ${colors.green(connectedUsers.size)}`);
    connectedUsers.forEach((socketId, userId) => {
      console.log(`${colors.blue(userId)}: ${colors.gray(socketId)}`);
    });
    console.log(colors.yellow("===========================\n"));
  }
}

module.exports = SocketDebugger;
