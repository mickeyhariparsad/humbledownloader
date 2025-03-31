(function() {
    console.log("Humble Helper content script running.");
  
    function getBundleInfo() {
      let bundleName = 'Not Found';
      let bookCount = 0;
  
      // --- !!! Selector for Bundle Name (Adjust Needed) !!! ---
      // Try finding the main page title or a specific heading element.
      const nameElement = document.querySelector('.product-title-text') || document.querySelector('.heading-large') || document.querySelector('h1');
      if (nameElement) {
           bundleName = nameElement.textContent.replace(/Thanks for purchasing/i, '').trim();
           if (!bundleName || bundleName.length < 5) {
              bundleName = document.title.replace(/ \(pay what you want and help charity\)/i, '').replace(/Humble Tech Book Bundle: /i, '').trim();
           }
      } else {
          bundleName = document.title.replace(/ \(pay what you want and help charity\)/i, '').replace(/Humble Tech Book Bundle: /i, '').trim();
      }
  
  
      // --- !!! Selector for Book Items (Adjust Needed) !!! ---
      // Find all elements representing individual books/items in the bundle tiers.
      const bookElements = document.querySelectorAll('.tier-item-view'); // <<< ADJUST THIS SELECTOR!
      bookCount = bookElements.length;
  
      console.log("Found Name:", bundleName);
      console.log("Found Count Selector Matches:", bookCount);
  
      if (bookCount === 0) {
          console.warn("Book count is 0. The selector '.tier-item-view' might be incorrect for this page.");
      }
  
      return { bundleName, bookCount };
    }
  
    // Send the extracted data back to the popup script
    const bundleInfo = getBundleInfo();
    console.log("Sending data back to popup:", bundleInfo);
  
     chrome.runtime.sendMessage({ action: "sendBundleInfo", data: bundleInfo }, (response) => {
         if (chrome.runtime.lastError) {
             console.error("Error sending message:", chrome.runtime.lastError.message);
         } else {
             console.log("Popup received message:", response);
         }
     });
  
  })();