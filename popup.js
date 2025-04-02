// Get elements from popup.html
const loadingDiv = document.getElementById('loading');
const contentDiv = document.getElementById('content');
const errorDiv = document.getElementById('error');
const statusDiv = document.getElementById('status');
const bundleNameSpan = document.getElementById('bundleName');
const itemCountSpan = document.getElementById('itemCount');
const pdfCountSpan = document.getElementById('pdfCount');
const epubCountSpan = document.getElementById('epubCount');
const closeButton = document.getElementById('closeButton');
const downloadButton = document.getElementById('downloadButton');
const formatPdfRadio = document.getElementById('formatPdf');
const formatEpubRadio = document.getElementById('formatEpub');

let currentItemsData = []; // Store the array of item objects { bookName: "...", pdfUrl: "...", epubUrl: "..." }
let currentBundleName = ''; // Store original bundle name for display
let currentSanitizedBundleName = ''; // Store sanitized bundle name for directory

// --- Function to inject content script ---
async function injectContentScript(tabId) {
  try {
    // Inject the script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    console.log("Content script injected. Waiting for message...");
  } catch (err) {
    // Handle potential errors during injection gracefully
    if (err.message.includes("Cannot access contents") || err.message.includes("Extension context invalidated")) {
       console.warn("Popup closed before injection finished or cannot access target page fully.");
    } else if (!err.message.includes("Receiving end does not exist")) { // Ignore error if popup closed before response
       console.error('Error injecting script:', err);
       showError(`Error injecting script: ${err.message}`);
    }
  }
}

// --- Function to update popup display ---
function updatePopup(data) {
  loadingDiv.style.display = 'none';
  if (data && data.bundleName !== undefined && data.itemsData !== undefined) {
    currentBundleName = data.bundleName;
    // Use sanitized name for downloads, ensure it's usable
    currentSanitizedBundleName = data.sanitizedBundleName || 'Unknown_Bundle';
    currentItemsData = data.itemsData;

    bundleNameSpan.textContent = currentBundleName;
    itemCountSpan.textContent = currentItemsData.length;

    const pdfCount = currentItemsData.filter(item => item.pdfUrl).length;
    const epubCount = currentItemsData.filter(item => item.epubUrl).length;
    pdfCountSpan.textContent = pdfCount;
    epubCountSpan.textContent = epubCount;

    contentDiv.style.display = 'block';
    errorDiv.textContent = '';
    statusDiv.textContent = '';

    downloadButton.disabled = currentItemsData.length === 0 || (pdfCount === 0 && epubCount === 0);

     // Verification Feedback Logic
     if (currentItemsData.length > 0) {
        if (pdfCount === 0 && epubCount === 0) {
            statusDiv.textContent = 'Found items, but no PDF/EPUB links detected on this page.';
            statusDiv.style.color = 'orange';
        } else if (pdfCount !== currentItemsData.length || epubCount !== currentItemsData.length) {
             statusDiv.textContent = `Note: Link counts may differ from item count (${currentItemsData.length}).`;
             statusDiv.style.color = 'darkgoldenrod';
        }
     } else {
         if (data.bundleName !== 'Error Fetching' && data.bundleName !== 'Humble Page (Name Unknown)') {
            statusDiv.textContent = 'No downloadable items detected on this page type.';
            statusDiv.style.color = 'grey';
         }
     }
  } else {
    showError(data?.bundleName === 'Error Fetching' ? 'Error extracting data.' : 'Could not extract info.');
    downloadButton.disabled = true;
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
  const currentTab = tabs?.[0];
  if (currentTab?.id && currentTab.url) {
    if (currentTab.url.startsWith('https://www.humblebundle.com/')) {
      injectContentScript(currentTab.id);
    } else {
      showError('This extension only works on humblebundle.com pages.');
      downloadButton.disabled = true;
    }
  } else {
    showError('Could not get active tab information.');
    downloadButton.disabled = true;
  }
});

// --- Listen for messages from the content script ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "sendBundleInfo") {
        console.log("Received bundle info via message:", message.data);
        updatePopup(message.data);
        sendResponse({ status: "Info received by popup" }); // Acknowledge
    }
    // Keep the message channel open for asynchronous responses if needed elsewhere
    // It's good practice even if not strictly needed now.
    return true;
});

// --- Add functionality to the CLOSE button ---
closeButton.addEventListener('click', () => {
  window.close();
});

// --- Add functionality to the DOWNLOAD button ---
downloadButton.addEventListener('click', () => {
    let selectedFormat = '';
    let formatKey = ''; // 'pdfUrl' or 'epubUrl'
    let fileExtension = '';

    if (formatPdfRadio.checked) {
        selectedFormat = 'PDF';
        formatKey = 'pdfUrl';
        fileExtension = 'pdf';
    } else if (formatEpubRadio.checked) {
        selectedFormat = 'EPUB';
        formatKey = 'epubUrl';
        fileExtension = 'epub';
    } else {
        statusDiv.textContent = 'Error: No format selected?'; // Should not happen with default checked
        statusDiv.style.color = 'red';
        return;
    }

    // Filter items that actually have a URL for the selected format
    const itemsToDownload = currentItemsData.filter(item => item[formatKey]);
    const totalItemsDetected = currentItemsData.length; // For verification message

    if (itemsToDownload.length > 0) {
        let verificationMsg = `Starting ${itemsToDownload.length} ${selectedFormat} download(s)...`;
        // Add note only if the link count differs from the *overall* item count AND items were detected
        if (itemsToDownload.length !== totalItemsDetected && totalItemsDetected > 0) {
             verificationMsg += ` (Note: ${totalItemsDetected} items detected total)`;
             statusDiv.style.color = 'orange';
        } else {
             statusDiv.style.color = 'green';
        }
        statusDiv.textContent = verificationMsg;

        downloadButton.disabled = true;
        closeButton.disabled = true;

        let downloadsInitiated = 0;
        let downloadErrors = 0;

        itemsToDownload.forEach((item, index) => {
            const urlToDownload = item[formatKey];

             // --- DETAILED LOGGING ADDED HERE ---
             console.log(`--- Processing Item #${index} ---`);
             console.log(`  Item Data:`, item); // Log the whole item object
             console.log(`  currentSanitizedBundleName:`, currentSanitizedBundleName);
             console.log(`  item.bookName:`, item.bookName);
             console.log(`  fileExtension:`, fileExtension);
             // --- END OF DETAILED LOGGING ---

            // Construct the filename: Use sanitized names
            // Format: SanitizedBundleName/SanitizedBookName.extension
            const filename = `<span class="math-inline">\{item\.bookName\}\.</span>{fileExtension}`; // <<< USE THIS SIMPLIFIED VERSION
            console.log(`>>> Simplified filename string being passed to API for item #<span class="math-inline">\{index\}\: "</span>{filename}"`);
            console.log(`Attempting <span class="math-inline">\{selectedFormat\} download \#</span>{index + 1} for: ${item.bookName}`);
            console.log(`  URL: ${urlToDownload}`);
            console.log(`  Filename: ${filename}`);

            chrome.downloads.download({
                url: urlToDownload,
                filename: filename // Use the constructed, sanitized filename path
            }, (downloadId) => {
                downloadsInitiated++;
                if (chrome.runtime.lastError) {
                    downloadErrors++;
                    console.error(`Download failed for <span class="math-inline">\{item\.bookName\} \(</span>{urlToDownload}):`, chrome.runtime.lastError);
                    // Show first error in popup status
                    if(downloadErrors === 1) {
                      errorDiv.textContent = `Error on download #${index + 1}: ${chrome.runtime.lastError.message}. Check console.`;
                    }
                } else {
                    console.log(`Download started with ID: ${downloadId} for: ${item.bookName}`);
                }

                // Check if this is the last download attempt (whether success or fail)
                if (downloadsInitiated === itemsToDownload.length) {
                   statusDiv.textContent = `Initiated ${downloadsInitiated - downloadErrors} / ${itemsToDownload.length} downloads. ${downloadErrors > 0 ? downloadErrors + ' failed to start.' : ''}`;
                   // Close popup after a delay
                   setTimeout(() => window.close(), downloadErrors > 0 ? 40000 : 50000);
                }
            });
        });
    } else {
        statusDiv.textContent = `No ${selectedFormat} links were found for the detected items.`;
        statusDiv.style.color = 'red';
        console.error(`Download button clicked, but no ${selectedFormat} URLs available.`);
    }
});