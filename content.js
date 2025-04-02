(function() {
    // Prevent multiple executions if injected multiple times rapidly
    if (window.humbleHelperScriptHasRun_v3) return;
    window.humbleHelperScriptHasRun_v3 = true;
  
    console.log("Humble Helper content script running on:", window.location.href);
  
    // Simple function to sanitize text for use in filenames/directories
    function sanitizeFilename(name) {
        if (!name) return 'unknown_item';
        let sanitized = name;
        // Remove invalid characters (Windows, macOS, Linux common subset)
        sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_'); // Replace with underscore
        // Replace sequences of spaces/underscores with a single underscore
        sanitized = sanitized.replace(/[\s_]+/g, '_');
        // Remove leading/trailing underscores/spaces/periods
        sanitized = sanitized.replace(/^[_.\s]+|[_.\s]+$/g, '');
        // Prevent empty names after sanitization
        if (!sanitized) {
          return 'sanitized_item'; // Return a default if sanitization made it empty
        }
        // Optional: Truncate long names (e.g., to 100 chars) to avoid path length issues
        // sanitized = sanitized.substring(0, 100);
        return sanitized;
    }
  
    function getBundleInfo() {
      let bundleName = 'Not Found';
      let itemsData = []; // Array to hold objects like { bookName: "...", pdfUrl: "...", epubUrl: "..." }
      let sanitizedBundleName = 'Unknown_Bundle'; // Default sanitized name
  
      try {
        // --- Attempt to find Bundle/Page Name ---
        const nameElSelectors = [
            'h1#hibtext', '.product-title-text', '.heading-large', 'a#logo img'
        ];
        let nameElement = null;
        for (const selector of nameElSelectors) {
            nameElement = document.querySelector(selector);
            if (nameElement) break;
        }
        if (nameElement) {
            let rawName = (nameElement.textContent || nameElement.alt || '').trim();
            bundleName = rawName.replace(/Thanks for purchasing/i, '').trim();
            if (!bundleName || bundleName.length < 5 || bundleName === 'Humble') {
                bundleName = document.title.replace(/ Humble Bundle.*/i, '').trim();
            }
        } else {
            bundleName = document.title.replace(/ Humble Bundle.*/i, '').trim();
        }
        if (!bundleName) bundleName = 'Humble Page (Name Unknown)';
        sanitizedBundleName = sanitizeFilename(bundleName); // Sanitize here
  
  
        // --- Attempt to find Download Items and Extract Info (Downloads Page Structure) ---
        const itemElements = document.querySelectorAll('.download-rows .row[data-human-name]');
  
        itemElements.forEach((itemRow, index) => {
            let bookName = 'Unknown Book';
            let pdfUrl = null;
            let epubUrl = null;
  
            // Extract book name
            bookName = itemRow.dataset.humanName || itemRow.querySelector('.gameinfo .title a')?.textContent.trim();
            if (!bookName) {
                bookName = `Item ${index + 1}`; // Fallback if name extraction fails
            }
            const sanitizedBookName = sanitizeFilename(bookName); // Sanitize book name
  
  
            // Extract PDF and EPUB URLs for this specific item
            const downloadButtonsDiv = itemRow.querySelector('.download-buttons');
            if (downloadButtonsDiv) {
                const allLabels = downloadButtonsDiv.querySelectorAll('span.label');
                allLabels.forEach(label => {
                    try {
                        const formatText = label.textContent.trim().toUpperCase();
                        const downloadDiv = label.closest('.download');
                        if (downloadDiv) {
                            const linkElement = downloadDiv.querySelector('a.a');
                            if (linkElement?.href) {
                                const url = linkElement.href;
                                if (formatText === 'PDF') {
                                    pdfUrl = url;
                                } else if (formatText === 'EPUB') {
                                    epubUrl = url;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Error processing a download link:", e);
                    }
                });
            }
  
            // Add the extracted data for this item to the array
            itemsData.push({
                bookName: sanitizedBookName, // Store the sanitized version for filenames
                pdfUrl: pdfUrl,
                epubUrl: epubUrl
            });
        });
  
        // --- Log findings ---
        console.log("Found Bundle Name:", bundleName);
        console.log("Sanitized Bundle Name:", sanitizedBundleName);
        console.log("Processed Items Count:", itemsData.length);
        console.log("PDF links found:", itemsData.filter(item => item.pdfUrl).length);
        console.log("EPUB links found:", itemsData.filter(item => item.epubUrl).length);
  
      } catch (error) {
          console.error("Error during content script execution:", error);
          // Return defaults on major error
          return { bundleName: 'Error Fetching', sanitizedBundleName: 'Error_Bundle', itemsData: [] };
      }
  
      // Return collected info
      return {
          bundleName: bundleName, // Original name for display
          sanitizedBundleName: sanitizedBundleName, // Name safe for directory
          itemsData: itemsData // Array of item objects
       };
    }
  
    // --- Send data back ---
    const bundleInfo = getBundleInfo();
    // Log simplified info
    console.log("Sending data back to popup:", {
        bundleName: bundleInfo.bundleName,
        itemCount: bundleInfo.itemsData.length,
        pdfCount: bundleInfo.itemsData.filter(i=>i.pdfUrl).length,
        epubCount: bundleInfo.itemsData.filter(i=>i.epubUrl).length
        });
  
    chrome.runtime.sendMessage({ action: "sendBundleInfo", data: bundleInfo }, (response) => {
        if (chrome.runtime.lastError) {
            if (!chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
               console.warn("Popup message failed:", chrome.runtime.lastError.message);
            }
        } else if (response) {
           console.log("Popup received message acknowledgment:", response);
        }
         // Clear flag after attempt
         delete window.humbleHelperScriptHasRun_v3;
    });
  
  })();