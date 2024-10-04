// background.js for Chrome extension (Manifest V3)

// Constants for reconnection and heartbeat intervals
const INITIAL_RECONNECT_INTERVAL = 5000; // 5 seconds
const MAX_RECONNECT_INTERVAL = 60000; // 1 minute
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10; // Increased from 5 to 10

/**
 * Utility function for logging with timestamp.
 * @param {string} message - The message to log.
 * @param {string} type - The type of log ('info', 'warn', 'error').
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  if (console[type]) {
    console[type](`[${timestamp}] ${message}`);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * Utility function to update the connection status and extension badge.
 * @param {boolean} connected - Current connection status.
 */
function updateConnectionStatus(connected) {
  isConnected = connected;
  chrome.runtime.sendMessage({ type: 'CONNECTION_STATUS_CHANGE', isConnected });
  log(`Connection status updated: ${connected ? 'Connected' : 'Disconnected'}`, connected ? 'info' : 'warn');

  // Update extension badge based on connection status
  if (connected) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
  }
}

// Global variable to track connection status
let isConnected = false;

// WebSocketManager Class Definition
class WebSocketManager {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.heartbeatIntervalId = null;
    this.reconnectTimeoutId = null;
    this.websocketUrl = null;

    // Bind methods to ensure correct 'this' context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.scheduleReconnect = this.scheduleReconnect.bind(this);
    this.startHeartbeat = this.startHeartbeat.bind(this);
    this.stopHeartbeat = this.stopHeartbeat.bind(this);
    this.handleOpen = this.handleOpen.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleClose = this.handleClose.bind(this);
  }

  /**
   * Establishes a WebSocket connection.
   * @param {string} url - The WebSocket server URL.
   */
  connect(url) {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      log('WebSocket already connected or connecting', 'warn');
      return;
    }

    // Validate URL
    try {
      new URL(url); // This will throw if URL is invalid
    } catch (e) {
      log(`Invalid WebSocket URL: ${url}`, 'error');
      return;
    }

    this.websocketUrl = url;
    updateConnectionStatus(false);
    log(`Attempting to connect to WebSocket: ${url}`);

    try {
      this.socket = new WebSocket(url);
    } catch (error) {
      log(`Failed to create WebSocket: ${error.message}`, 'error');
      this.scheduleReconnect();
      return;
    }

    // Assign event handlers
    this.socket.onopen = this.handleOpen;
    this.socket.onmessage = this.handleMessage;
    this.socket.onerror = this.handleError;
    this.socket.onclose = this.handleClose;
  }

  /**
   * Handles the WebSocket 'open' event.
   */
  handleOpen() {
    log('WebSocket connected successfully', 'info');
    updateConnectionStatus(true);
    this.reconnectAttempts = 0;
    this.startHeartbeat();

    // Send identification message
    const manifest = chrome.runtime.getManifest();
    const identificationMessage = JSON.stringify({
      type: 'IDENTIFY',
      extensionId: chrome.runtime.id,
      extensionName: manifest.name,
      extensionVersion: manifest.version
    });
    this.sendMessage(identificationMessage);
    log('Sent identification message', 'info');
  }

  /**
   * Handles incoming WebSocket messages.
   * @param {MessageEvent} event - The message event.
   */
  handleMessage(event) {
    log(`Received message from server: ${event.data}`, 'info');
    // Handle incoming messages as needed
    // For example, process commands or data sent from the server
  }

  /**
   * Handles WebSocket errors.
   * @param {Event} error - The error event.
   */
  handleError(error) {
    log(`WebSocket error: ${error.message}`, 'error');
    this.stopHeartbeat(); // Ensure heartbeat is stopped on error
    // Errors will eventually trigger onclose, so no need to close here
  }

  /**
   * Handles the WebSocket 'close' event.
   * @param {CloseEvent} event - The close event.
   */
  handleClose(event) {
    log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`, 'warn');
    updateConnectionStatus(false);
    this.stopHeartbeat();
    this.socket = null;
    this.scheduleReconnect();
  }

  /**
   * Sends a message through the WebSocket.
   * @param {string} message - The message to send.
   */
  sendMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
      log(`Sent message: ${message}`, 'info');
    } else {
      log('Cannot send message. WebSocket is not open.', 'warn');
    }
  }

  /**
   * Starts sending heartbeat messages at regular intervals.
   */
  startHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }

    this.heartbeatIntervalId = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const heartbeatMessage = JSON.stringify({ type: 'heartbeat' });
        this.sendMessage(heartbeatMessage);
        log('Heartbeat sent', 'info');
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stops sending heartbeat messages.
   */
  stopHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
      log('Heartbeat stopped', 'info');
    }
  }

  /**
   * Schedules a reconnection attempt with exponential backoff.
   */
  scheduleReconnect() {
    // Clear any existing reconnection attempts
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      log('Max reconnection attempts reached. Stopping reconnection attempts.', 'error');
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(INITIAL_RECONNECT_INTERVAL * Math.pow(2, this.reconnectAttempts), MAX_RECONNECT_INTERVAL);
    this.reconnectAttempts++;
    log(`Reconnection attempt ${this.reconnectAttempts} in ${delay / 1000} seconds`, 'info');

    this.reconnectTimeoutId = setTimeout(() => {
      if (this.websocketUrl) {
        this.connect(this.websocketUrl);
      }
    }, delay);
  }

  /**
   * Disconnects the WebSocket gracefully.
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      log('WebSocket connection closed by user', 'info');
    }
    updateConnectionStatus(false);
    this.stopHeartbeat();

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.reconnectAttempts = 0;
  }
}

// Instantiate the WebSocketManager
const wsManager = new WebSocketManager();

/**
 * Initializes the WebSocket connection based on stored settings.
 */
function initializeWebSocket() {
  chrome.storage.sync.get(['enabled', 'websocketUrl'], (data) => {
    if (data.enabled && data.websocketUrl) {
      wsManager.connect(data.websocketUrl);
    } else {
      log('WebSocket connection not enabled or URL not set', 'info');
      updateConnectionStatus(false);
    }
  });
}

/**
 * Handles incoming messages from other parts of the extension.
 * @param {Object} message - The message object.
 * @param {Object} sender - The sender of the message.
 * @param {Function} sendResponse - The response callback.
 * @returns {boolean} - Indicates asynchronous response.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log(`Received message: ${JSON.stringify(message)}`, 'info');

  switch (message.type) {
    case 'CONNECT_WEBSOCKET':
      if (message.url) {
        chrome.storage.sync.set({ websocketUrl: message.url, enabled: true }, () => {
          wsManager.connect(message.url);
          sendResponse({ isConnected: isConnected });
        });
      } else {
        log('CONNECT_WEBSOCKET message missing url', 'error');
        sendResponse({ isConnected: false, error: 'URL missing' });
      }
      break;

    case 'DISCONNECT_WEBSOCKET':
      wsManager.disconnect();
      sendResponse({ isConnected: false });
      break;

    case 'CHECK_CONNECTION':
      sendResponse({ isConnected: isConnected });
      break;

    case 'NEW_MESSAGES':
      // Handle new messages as needed
      if (wsManager.socket && wsManager.socket.readyState === WebSocket.OPEN) {
        wsManager.sendMessage(JSON.stringify(message.messages));
        sendResponse({ status: 'sent', messagesSent: message.messages.length });
      } else {
        log('Cannot send new messages. WebSocket is not connected.', 'warn');
        sendResponse({ status: 'error', message: 'WebSocket not connected' });
      }
      break;

    case 'WS_CONNECTED':
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      break;

    case 'WS_ERROR':
    case 'WS_CLOSED':
      chrome.action.setBadgeText({ text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
      break;

    default:
      log(`Unknown message type: ${message.type}`, 'warn');
  }

  return true; // Keeps the message channel open for asynchronous responses
});

/**
 * Checks if the content script is responsive.
 */
function checkContentScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "PING" }, function (response) {
        if (chrome.runtime.lastError) {
          log("Content script not responsive", 'warn');
        } else {
          log("Content script is alive", 'info');
        }
      });
    }
  });
}

// Periodically check content script responsiveness every 5 minutes
setInterval(checkContentScript, 5 * 60 * 1000);

/**
 * Handles network status changes using navigator.onLine.
 */
function handleNetworkStatus() {
  if (navigator.onLine) {
    log('Network online', 'info');
    if (!isConnected) {
      initializeWebSocket();
    }
  } else {
    log('Network offline', 'warn');
    wsManager.disconnect();
  }
}

// Listen to online and offline events using service worker's global scope
self.addEventListener('online', () => {
  log('Service Worker network online', 'info');
  if (!isConnected) {
    initializeWebSocket();
  }
});

self.addEventListener('offline', () => {
  log('Service Worker network offline', 'warn');
  wsManager.disconnect();
});

/**
 * Initializes WebSocket connection on extension startup.
 */
chrome.runtime.onStartup.addListener(() => {
  log('Extension started', 'info');
  initializeWebSocket();
});

/**
 * Initializes WebSocket connection on extension installation.
 */
chrome.runtime.onInstalled.addListener(() => {
  log('Extension installed', 'info');
  initializeWebSocket();
});

/**
 * Listens for changes in storage to dynamically handle enabling/disabling WebSocket.
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    const enabledChanged = changes.enabled;
    const urlChanged = changes.websocketUrl;

    if (enabledChanged || urlChanged) {
      const enabled = enabledChanged ? enabledChanged.newValue : isConnected;
      const url = urlChanged ? urlChanged.newValue : wsManager.websocketUrl;

      if (enabled && url) {
        log(
          "Enabled state or WebSocket URL changed. Connecting WebSocket.",
          "info",
        );
        wsManager.connect(url);
      } else {
        log(
          "WebSocket disabled or URL removed. Disconnecting WebSocket.",
          "info",
        );
        wsManager.disconnect();
      }
    }
  }
});

/**
 * Gracefully handle service worker shutdown by disconnecting WebSocket.
 */
self.addEventListener('beforeunload', () => {
  log('Service Worker is unloading. Disconnecting WebSocket.', 'info');
  wsManager.disconnect();
});
