// Get elements from popup.html
const loadingDiv = document.getElementById('loading');
const contentDiv = document.getElementById('content');
const errorDiv = document.getElementById('error');
const bundleNameSpan = document.getElementById('bundleName');
const bookCountSpan = document.getElementById('bookCount');
const confirmButton = document.getElementById('confirmButton');

// --- Function to inject content script ---
async function injectContentScript(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js'] // The script to inject
    });

    // Check if injection was successful and potentially get immediate results
    if (chrome.runtime.lastError) {
        console.error('Script injection failed:', chrome.runtime.lastError.message);
        showError('Could not run script on the page.');
    } else if (results && results[0] && results[0].result) {
        updatePopup(results[0].result);
    } else {
        // If no immediate result, wait for message listener below
        console.log("Content script injected. Waiting for message...");
    }
  } catch (err) {
    console.error('Error injecting script:', err);
    showError(`Error injecting script: ${err.message}`);
  }
}

// --- Function to update popup display ---
function updatePopup(data) {
  loadingDiv.style.display = 'none'; // Hide loading message
  if (data && data.bundleName !== undefined && data.bookCount !== undefined) {
    bundleNameSpan.textContent = data.bundleName;
    bookCountSpan.textContent = data.bookCount;
    contentDiv.style.display = 'block'; // Show content
    errorDiv.textContent = ''; // Clear any previous error
  } else {
    showError('Could not extract bundle information from the page.');
  }
}

// --- Function to show errors ---
function showError(message) {
    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'none';
    errorDiv.textContent = message;
    console.error(message);
}


// --- Main logic when popup opens ---
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const currentTab = tabs[0];
  if (currentTab && currentTab.id && currentTab.url) {
    // Check if it's a Humble Bundle book page URL
    if (currentTab.url.startsWith('https://www.humblebundle.com/')) {
      injectContentScript(currentTab.id);
    } else {
      showError('This extension only works on Humble Bundle book pages (humblebundle.com/...).');
    }
  } else {
    showError('Could not get active tab information.');
  }
});

// --- Listen for messages from the content script ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "sendBundleInfo") {
        console.log("Received bundle info via message:", message.data);
        updatePopup(message.data);
    }
    return true; // Keep message channel open for async response if needed
});


// --- Add functionality to the confirmation button ---
confirmButton.addEventListener('click', () => {
  console.log('User confirmed the displayed info.');
  // Add logic here later (e.g., save info, trigger download process)
  window.close(); // Closes the popup
});