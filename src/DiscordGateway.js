import config from './Config';

const DISCORD_GATEWAY_ENDPOINT = 'wss://gateway.discord.gg/?v=6&encoding=json';

const OS = navigator.platform;
const BROWSER = 'Chrome';
const DEVICE = chrome.i18n.getMessage('appName');

export default class DiscordGateway {
  constructor(token, retryDelay = 500, closeDelay = 600000) {
    this._token = token;
    this._retryDelay = retryDelay;
    this._closeDelay = closeDelay;
  }
  sendStatusUpdate(newStatus) {
    clearTimeout(this._retryTimer);
    clearTimeout(this._closeTimer);
    if (!this._ws || this._ws.readyState === WebSocket.CLOSED) {
      /* Connect websocket */
      if (config.loggingEnabled) {
        console.log(`Token ${this._token}: initialize websocket...`);
      }
      this._ws = new WebSocket(DISCORD_GATEWAY_ENDPOINT);
      this._lastSeq = null;
      this._ws.onopen = (e) => {
        this._send(this._getOpIdentifyPayload(newStatus)); /* Identify and send initial status */
        this._identifyStatus = newStatus;
      };
      this._ws.onmessage = (e) => this._messageHandler(JSON.parse(e.data));
      this._ws.onerror = (e) => console.log(`Token ${this._token}: connection error`);
      this._ws.onclose = (e) => {
        clearInterval(this._heartbeatTimer);
        if (config.loggingEnabled) {
          console.log(`Token ${this._token}: connection closed\n - code: ${e.code}\n - reason: ${e.reason}\n - wasClean: ${e.wasClean}`);
        }
      };
    } else if (this._ws.readyState === WebSocket.OPEN) {
      this._send(this._getOpStatusUpdatePayload(newStatus)); /* Send status update */
    } else if (this._ws.readyState === WebSocket.CONNECTING || this._ws.readyState === WebSocket.CLOSING) {
      this._retryTimer = setTimeout(() => this.sendStatusUpdate(newStatus), this._retryDelay); /* Retry later */
    }
    if (this._closeDelay > 0) {
      this._closeTimer = setTimeout(this.close, this._closeDelay);
    }
  }
  close() {
    clearTimeout(this._retryTimer);
    clearTimeout(this._closeTimer);
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
      this._ws.close();
    }
  }
  _send(payload) {
    this._ws.send(JSON.stringify(payload));
    if (config.loggingEnabled) {
      console.log(`Token ${this._token}: sent ${JSON.stringify(payload, null, 4)}`);
    }
  }
  /* Send heartbeat */
  _sendHeartbeat() {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._send(this._getOpHeartbeatPayload());
    }
  }
  _messageHandler(data) {
    this._lastSeq = data.s;
    switch (data.op) {
    case 1: /* heartbeat request */
      this._sendHeartbeat();
      if (config.loggingEnabled) {
        console.log(`Token ${this._token}: received heartbeat request message: ${JSON.stringify(data, null, 4)}`);
      }
      break;
    case 10: /* hello */
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = setInterval(this._sendHeartbeat.bind(this), data.d.heartbeat_interval)
      if (config.loggingEnabled) {
        console.log(`Token ${this._token}: received hello message: ${JSON.stringify(data, null, 4)}`);
      }
      if (!this._identifyStatus) {
        this._send(this._getOpStatusUpdatePayload(this._identifyStatus)); /* Send status update if status is null, because null initial status doesn't work */
      }
      break;
    default:
    }
  }
  /* Get heartbeat operation payload */
  _getOpHeartbeatPayload() {
    return {
      op: 1,
      d: this._lastSeq,
    };
  }
  /* Get status update partial payload */
  _getStatusUpdatePayload(status) {
    return {
      game: status === null ? null : {
        name: status,
        type: 2,
      },
      status: 'online',
      since: null,
      afk: false,
    };
  }
  /* Get identify operation payload */
  _getOpIdentifyPayload(status) {
    return {
      op: 2,
      d: {
        token: this._token,
        properties: {
          $os: OS,
          $browser: BROWSER,
          $device: DEVICE,
        },
        compress: false,
        large_threshold: 50,
        presence: this._getStatusUpdatePayload(status),
      }
    };
  }
  /* Get status update operation payload */
  _getOpStatusUpdatePayload(status) {
    return {
      op: 3,
      d: this._getStatusUpdatePayload(status),
    };
  }
}
