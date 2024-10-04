document.addEventListener('DOMContentLoaded', () => {
    const hostInput = document.getElementById('host');
    const portInput = document.getElementById('port');
    const fontSelect = document.getElementById('font');
    const fontSizeInput = document.getElementById('fontSize');
    const showPfpCheckbox = document.getElementById('showPfp');
    const showUsernameCheckbox = document.getElementById('showUsername');
    const showUserHandleCheckbox = document.getElementById('showUserHandle');
    const showDatetimeCheckbox = document.getElementById('showDatetime');
    const statusMessage = document.getElementById('statusMessage');
    const enableToggle = document.getElementById('enableToggle');
    const settingsForm = document.getElementById('settingsForm');
  
    // Load saved settings and check connection status on popup load
    chrome.storage.sync.get([
      'host', 'port', 'enabled', 'font', 'fontSize', 
      'showPfp', 'showUsername', 'showUserHandle', 'showDatetime'
    ], (data) => {
      if (data.host) hostInput.value = data.host;
      if (data.port) portInput.value = data.port;
      if (data.font) fontSelect.value = data.font;
      if (data.fontSize) fontSizeInput.value = data.fontSize;
      showPfpCheckbox.checked = data.showPfp !== false;
      showUsernameCheckbox.checked = data.showUsername !== false;
      showUserHandleCheckbox.checked = data.showUserHandle !== false;
      showDatetimeCheckbox.checked = data.showDatetime !== false;
      enableToggle.checked = data.enabled || false;
    });
  
    /**
     * Handles the form submission to save settings.
     */
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const host = hostInput.value.trim() || 'localhost';
      const port = portInput.value.trim() || '8585';
      const websocketUrl = `ws://${host}:${port}`;
      const font = fontSelect.value;
      const fontSize = fontSizeInput.value;
      const showPfp = showPfpCheckbox.checked;
      const showUsername = showUsernameCheckbox.checked;
      const showUserHandle = showUserHandleCheckbox.checked;
      const showDatetime = showDatetimeCheckbox.checked;
  
      chrome.storage.sync.set({ 
        host, port, websocketUrl, font, fontSize, 
        showPfp, showUsername, showUserHandle, showDatetime 
      }, () => {
        statusMessage.textContent = 'Settings saved';
        statusMessage.style.display = 'block';
        
        setTimeout(() => {
          statusMessage.style.display = 'none';
        }, 3000);
  
        if (enableToggle.checked) {
          chrome.runtime.sendMessage({ type: 'CONNECT_WEBSOCKET', url: websocketUrl }, (response) => {
            console.log(response);
          });
        }
      });
    });
  
    /**
     * Handles the toggle switch to enable or disable the WebSocket connection.
     */
    enableToggle.addEventListener('change', () => {
      const enabled = enableToggle.checked;
      chrome.storage.sync.set({ enabled }, () => {
        if (enabled) {
          chrome.storage.sync.get('websocketUrl', (data) => {
            if (data.websocketUrl) {
              chrome.runtime.sendMessage({ type: 'CONNECT_WEBSOCKET', url: data.websocketUrl }, (response) => {
                console.log(response);
              });
            } else {
              statusMessage.textContent = 'WebSocket URL not set';
              statusMessage.style.display = 'block';
              setTimeout(() => {
                statusMessage.style.display = 'none';
              }, 3000);
              enableToggle.checked = false;
            }
          });
        } else {
          chrome.runtime.sendMessage({ type: 'DISCONNECT_WEBSOCKET' }, (response) => {
            console.log(response);
          });
        }
      });
    });
  
  });