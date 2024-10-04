# X Stream Chat

X Stream Chat is a browser extension that allows you to relay chat messages from X (formerly Twitter) broadcasts to a local WebSocket server. This enables you to display these messages in a customizable chat overlay for streaming purposes.

## Features

- Capture chat messages from X broadcasts in real-time
- Relay messages to a local WebSocket server
- Customizable chat display options
- Status page to monitor connections and message flow

## Setup

### Prerequisites

- Node.js (v14 or later recommended)
- pnpm (recommended) or npm
- A Chromium-based browser (e.g., Google Chrome, Microsoft Edge)

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/your-username/x-stream-chat.git
   cd x-stream-chat
   ```

2. Install dependencies using pnpm (recommended) or npm:
   ```
   pnpm install
   # or
   npm install
   ```

3. Build the extension:
   ```
   pnpm run build
   # or
   npm run build
   ```

### Loading the Extension

#### For Users:
1. Open your browser and navigate to `chrome://extensions`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `distribution` folder in the project directory

#### For Developers:
Use `web-ext` for development and testing:

## Usage

1. Open the X Stream Chat extension popup by clicking on its icon in your browser toolbar.

2. Configure the settings:
   - Enter the host and port for your WebSocket server (default: localhost:8585)
   - Choose your preferred font and font size
   - Select which elements to display (profile picture, username, handle, timestamp)

3. Click "Save" to apply your settings.

4. Toggle the switch to enable the connection to the WebSocket server.

5. Navigate to an X broadcast page. The extension will automatically start capturing chat messages and sending them to your server.

6. Open `http://localhost:8585` in a browser or add it as a browser source in your streaming software to display the chat overlay.

## Development

- To watch for changes and rebuild the extension automatically:
  ```
  npm run watch
  ```

- To run the extension in development mode with live reloading:
  ```
  npm run dev
  ```

## Troubleshooting

- If you're not seeing any messages, make sure:
  1. The extension is enabled and connected (check the popup)
  2. You're on an X broadcast page
  3. The WebSocket server is running
  4. Check the browser console for any error messages

- To view the extension's background script logs:
  1. Go to `chrome://extensions`
  2. Find X Stream Chat and click on "background page" under "Inspect views"

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.