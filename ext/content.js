import optionsStorage from "./options-storage.js";

console.log("💈 Loaded:", chrome.runtime.getManifest().name);

let processedMessageIds = {};
let broadcastId = "";

function createHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(16);
}

async function extractChatMessages(messagePane) {
  console.log("Attempting to extract chat messages");
  const messages = [];

  if (!messagePane) {
    console.error("Message pane is null or undefined");
    return messages;
  }

  const messageElements = messagePane.children;
  console.log(`Found ${messageElements.length} messages`);

  console.log("------ CHECK NEW MESSAGES ------");
  console.log(messagePane);

  console.log("MessageElements");
  console.log(messageElements);

  if (!processedMessageIds[broadcastId]) {
    processedMessageIds[broadcastId] = new Set();
  }

  for (let index = messageElements.length - 1; index >= 0; index--) {
    const messageParent = messageElements[index];

    try {
      const messageEl = messageParent.firstElementChild;
      console.log(messageEl);

      console.log(`Processing message element ${index + 1}`);

      const pfpContainer = messageEl.firstElementChild;

      let pfpUrl =
        "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"; // Default URL

      // sometimes it takes a while for the pfp to load, so we need to wait for it
      const loadedUrl = await new Promise((resolve) => {
        const startTime = Date.now();

        const checkImage = () => {
          const img = pfpContainer.querySelector("img");
          if (img) {
            resolve(img.src || img.dataset.src);
          } else if (Date.now() - startTime > 300) {
            resolve(null); 
          } else {
            requestAnimationFrame(checkImage); 
          }
        };

        checkImage();
      });

      if (loadedUrl) {
        pfpUrl = loadedUrl;
      }

      console.log(`Profile picture URL: ${pfpUrl}`);

      const userInfoDiv = messageEl.children[1];
      const handleContainer = userInfoDiv.firstElementChild;
      const usernameContainer =
        handleContainer.firstElementChild.querySelector("div:first-child");
      const usernameSpan = usernameContainer.querySelector("span:first-child");
      const userhandleContainer =
        handleContainer.firstElementChild.lastElementChild;
      const userhandleSpan = userhandleContainer.querySelector("span");
      const textContainer = userInfoDiv.querySelector(":scope > span");

      if (!userInfoDiv || !textContainer) {
        console.log(
          `Missing required elements for message ${index + 1}, skipping`,
        );
        console.log(`userInfoDiv: ${userInfoDiv ? "Found" : "Missing"}`);
        console.log(`userMessageSpan: ${textContainer ? "Found" : "Missing"}`);
        continue;
      }

      const username = usernameSpan
        ? usernameSpan.textContent.trim()
        : "Unknown User";
      const userHandle = userhandleSpan
        ? userhandleSpan.textContent.trim()
        : "@unknown";
      const isVerified =
        userInfoDiv.querySelector('svg[data-testid="icon-verified"]') !== null;
      const messageText = textContainer.textContent.trim();

      const messageId = createHash(userHandle + messageText);

      console.log(`Message ID: ${messageId}`);

      if (!processedMessageIds[broadcastId].has(messageId)) {
        console.log(`Extracted info:
              Username: ${username}
              User Handle: ${userHandle}
              Is Verified: ${isVerified}
              Message: ${messageText}
              ID: ${messageId}`);

        // Ensure we have only 10 items in the set at max
        if (processedMessageIds[broadcastId].size >= 10) {
          const oldestMessageId = processedMessageIds[broadcastId]
            .values()
            .next().value; // Get the first (oldest) item
          processedMessageIds[broadcastId].delete(oldestMessageId); // Remove the oldest item
        }

        processedMessageIds[broadcastId].add(messageId);
        console.log(`New message detected, adding to messages array`);
        messages.push({
          pfp: pfpUrl,
          username,
          userHandle,
          message: messageText,
          isVerified,
          broadcastId,
          messageId,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`Message already processed, skipping`);
      }
    } catch (error) {
      console.error(`Error processing message ${index + 1}: ${error}`);
    }
  }

  console.log(`New messages extracted: ${messages.length}`);
  return messages;
}

// Function to send messages to the background script
function sendMessagesToBackground(messages) {
  if (messages.length === 0) {
    console.log("No new messages to send");
    return;
  }

  console.log("Attempting to send messages to background script:", messages);
  try {
    chrome.runtime.sendMessage(
      { type: "NEW_MESSAGES", messages },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending messages:", chrome.runtime.lastError);
          return;
        }
        if (response && response.status === "sent") {
          console.log("Messages sent and processed successfully");
          console.log("Response from background script:", response);
        } else {
          console.warn("Unexpected response from background script:", response);
        }
      },
    );
  } catch (error) {
    console.error("Failed to send messages:", error);
  }
}

// Set up a MutationObserver to watch for new messages
function setupChatObserver(messageContainer) {
  console.log("Setting up chat observer");

  let messagePane = null;
  let lastMessageCount = 0;

  broadcastId = window.location.pathname.split("/")[3];
  console.log(`Broadcast ID: ${broadcastId}`);

  const observer = new MutationObserver((mutations) => {
    console.log("Mutation detected in message container");

    // Check if messagePane exists, if not, try to find it
    if (!messagePane) {
      messagePane = messageContainer;
      if (messagePane) {
        console.log("Message pane found:", messagePane);
        let initialMessageCount = messagePane.children.length;
        console.log("Initial message count:", initialMessageCount);
      } else {
        console.log("Message pane not found yet");
        return;
      }
    }

    let newMessagesAdded = false;

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        const currentMessageCount = messagePane.children.length;
        console.log("Current message count:", currentMessageCount);
        if (currentMessageCount > lastMessageCount) {
          newMessagesAdded = true;
          lastMessageCount = currentMessageCount;
          console.log("New messages detected based on count");
          break;
        }
      }
    }

    if (newMessagesAdded) {
      processNewMessages(messagePane);
    } else {
      console.log("No new messages detected from mutation");
    }
  });

  observer.observe(messageContainer, {
    childList: true,
  });
  console.log("Message container observer started");

  // Check for initial messages
  if (messagePane) {
    console.log("Extracting initial messages");
    processNewMessages(messagePane);
  } else {
    console.log("No initial message pane found, will process when it appears");
  }
}

// Update processNewMessages to be async
async function processNewMessages(messagePane) {
  console.log("Processing new messages");
  const newMessages = await extractChatMessages(messagePane);
  if (newMessages.length > 0) {
    console.log(
      `Extracted ${newMessages.length} new messages, sending to background...`,
    );
    sendMessagesToBackground(newMessages);
  } else {
    console.log("No new messages extracted after detection");
  }
}

// Function to wait for the chat container and message container to appear
function waitForChatContainer() {
  console.log("Waiting for chat container...");
  const observer = new MutationObserver((mutations, obs) => {
    const chatContainerSelector = '[data-testid="chatContainer"]';
    let chatContainer = document.querySelector(chatContainerSelector);
    if (!chatContainer) {
      chatContainer = document.querySelector('[aria-label="Trending"]');
    }
    console.log("Chat container:", chatContainer);
    if (chatContainer) {
      console.log("Chat container selector:", chatContainerSelector);

      const messageContainerSelector = "div > div:nth-child(2) > div > div";
      const messageContainer = chatContainer.querySelector(
        messageContainerSelector,
      );
      console.log("Message container:", messageContainer);
      if (messageContainer) {
        console.log("Message container selector:", messageContainerSelector);
        obs.disconnect(); // Stop observing for chat container
        setupChatObserver(messageContainer);
      } else {
        console.log("Message container not found, continuing to observe");
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Check if we're on a broadcast page
if (
  // window.location.pathname.includes("/broadcasts/") &&
  // window.location.pathname.includes("/chat")
  window.location.pathname.includes("/broadcasts/")
) {
  console.log(
    "Broadcast chat page detected, starting to wait for chat container",
  );
  waitForChatContainer();
} else {
  console.log("Not a broadcast chat page, extension inactive");
}

// Add this function to establish WebSocket connection
async function connectWebSocket() {
  try {
    const options = await optionsStorage.getAll();
    const host = options.host || "localhost";
    const port = options.port || "8585";
    const ws = new WebSocket(`ws://${host}:${port}`);

    ws.onopen = () => {
      console.log("WebSocket connected successfully");
      chrome.runtime.sendMessage({ type: "WS_CONNECTED" });
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      chrome.runtime.sendMessage({ type: "WS_ERROR", error: error.message });
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
      chrome.runtime.sendMessage({ type: "WS_CLOSED" });
    };

  } catch (error) {
    console.error("Error connecting to WebSocket:", error);
    chrome.runtime.sendMessage({ type: "WS_ERROR", error: error.message });
  }
}

// Modify the existing chrome.runtime.onMessage listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ status: "alive" });
  } else if (message.type === "CONNECT_WS") {
    connectWebSocket();
    sendResponse({ status: "connecting" });
  }
});

// Handle reconnect action
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "reconnect") {
    if (socket) {
      socket.close();
    }

    connectToServer();
  }
});
