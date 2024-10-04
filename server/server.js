const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8585;

let connectedClients = 0;
let totalMessagesSent = 0;
let lastMessageTime = null;
let connectedExtensions = new Map();

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  console[type](`[${timestamp}] ${message}`);
}

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    serveFile(res, 'index.html', 'text/html');
  } else if (req.url === '/test') {
    serveFile(res, 'test.html', 'text/html');
  } else if (req.url === '/status') {
    serveFile(res, 'status.html', 'text/html');
  } else if (req.url === '/api/status') {
    const status = {
      serverUptime: process.uptime(),
      connectedClients,
      totalMessagesSent,
      lastMessageTime,
      connectedExtensions: Array.from(connectedExtensions.values())
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    log(`Status API called. Connected clients: ${connectedClients}, Total messages: ${totalMessagesSent}`, 'info');
  } else if (req.url.startsWith('/css/')) {
    serveFile(res, req.url.slice(1), 'text/css');
  } else {
    res.writeHead(404);
    res.end('Not found');
    log(`404 - Not found: ${req.url}`, 'warn');
  }
});

function serveFile(res, filename, contentType) {
  fs.readFile(path.join(__dirname, 'public', filename), 'utf8', (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end(`Error loading ${filename}`);
      log(`Error loading file ${filename}: ${err.message}`, 'error');
    } else {
      content = content.replace(/{{PORT}}/g, PORT);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      log(`Served file: ${filename}`, 'info');
    }
  });
}

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  log(`Client connected from ${req.socket.remoteAddress}`, 'info');
  connectedClients++;

  ws.on('message', (message) => {
    log(`Received message: ${message.toString()}`, 'info');
    totalMessagesSent++;
    lastMessageTime = new Date().toISOString();

    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.type === 'IDENTIFY') {
        connectedExtensions.set(ws, {
          id: parsedMessage.extensionId,
          name: parsedMessage.extensionName,
          version: parsedMessage.extensionVersion,
          connectedAt: new Date().toISOString()
        });
        log(`Extension identified: ${parsedMessage.extensionName} (${parsedMessage.extensionId})`, 'info');
      } else if (parsedMessage.type === 'heartbeat') {
        log('Heartbeat received', 'info');
      } else {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message.toString());
          }
        });
        log(`Broadcasted message to ${wss.clients.size} clients`, 'info');
      }
    } catch (error) {
      log(`Error processing message: ${error.message}`, 'error');
    }
  });

  ws.on('close', (code, reason) => {
    log(`Client disconnected. Code: ${code}, Reason: ${reason}`, 'info');
    connectedClients--;
    connectedExtensions.delete(ws);
  });

  ws.on('error', (error) => {
    log(`WebSocket error: ${error.message}`, 'error');
  });
});

server.listen(PORT, () => {
  log(`Server is running on http://localhost:${PORT}`, 'info');
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
});

process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'error');
});