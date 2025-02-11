let pyodide = null;
let isPyodideInitialized = false;
let uploadedImages = [];

/*
 * Global error handling to catch fatal Pyodide errors.
 * (These handlers may not always be triggered if Pyodide crashes before JavaScript can catch them.)
 */
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes("Pyodide has suffered a fatal error")) {
    console.error("Fatal Pyodide error caught (global error):", event.message);
    const processingText = document.getElementById('processingText');
    const spinner = document.getElementById('spinner');
    if (processingText) {
      processingText.innerText = "Couldn't merge. Try again. Make sure images are aligned.";
    }
    if (spinner) {
      spinner.hidden = true;
    }
    document.getElementById('newBatchBtn').hidden = false;
    isPyodideInitialized = false;
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes("Pyodide has suffered a fatal error")) {
    console.error("Fatal Pyodide error caught (unhandled rejection):", event.reason.message);
    const processingText = document.getElementById('processingText');
    const spinner = document.getElementById('spinner');
    if (processingText) {
      processingText.innerText = "Couldn't merge. Try again. Make sure images are aligned.";
    }
    if (spinner) {
      spinner.hidden = true;
    }
    document.getElementById('newBatchBtn').hidden = false;
    isPyodideInitialized = false;
    event.preventDefault();
  }
});

/**
 * Initializes Pyodide and loads necessary packages.
 * Deferred until the user initiates merging or when loading is needed.
 */
async function initializePyodide() {
  try {
    // Reload the Python libs
    pyodide = await loadPyodide();
    await pyodide.loadPackage(["numpy", "opencv-python"]);

    const response = await fetch('hdr_processor.py');
    const code = await response.text();
    pyodide.FS.writeFile('hdr_processor.py', code);
    await pyodide.runPython(`from hdr_processor import merge_hdr`);
    isPyodideInitialized = true;
  } catch (err) {
    console.error("Pyodide initialization failed", err);
    alert("Failed to initialize Pyodide. Please refresh the page and try again.");
  }
}

/**
 * Shows the processing indicator (spinner and text) and moves focus to it.
 */
function showProcessingIndicator() {
  const indicator = document.getElementById('processingIndicator');
  indicator.hidden = false;
  const processingText = document.getElementById('processingText');
  if (processingText) {
    processingText.focus();
  }
}

/**
 * Hides the processing indicator (spinner and text).
 */
function hideProcessingIndicator() {
  document.getElementById('processingIndicator').hidden = true;
}

/**
 * Resets the processing indicator to its default state:
 * - Shows the spinner.
 * - Sets the default processing text.
 */
function resetProcessingIndicator() {
  const spinner = document.getElementById('spinner');
  const processingText = document.getElementById('processingText');
  if (spinner) {
    spinner.hidden = false;
  }
  if (processingText) {
    processingText.innerText = "Processing. Wait a moment...";
  }
}

/**
 * Reads an image file as an ArrayBuffer.
 * @param {File} file - The image file.
 * @returns {Promise<ArrayBuffer>}
 */
async function readImageAsArray(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Tracks custom events with Google Analytics.
 * Supported event types:
 * - "pageview"
 * - "upload_images"
 * - "create_hdr_click"
 * - "merge_success"
 * - "merge_failed"
 * - "new_batch"
 * - "download_click"
 * @param {string} eventType - The type of event.
 */
function trackEvent(eventType) {
  if (typeof gtag !== 'undefined') {
    const eventMap = {
      pageview: { action: 'page_view', category: 'Page', label: 'Home Page' },
      upload_images: { action: 'upload_images', category: 'Images', label: 'User Uploaded Images' },
      create_hdr_click: { action: 'create_hdr_click', category: 'HDR Processing', label: 'Create HDR Button Click' },
      merge_success: { action: 'merge_success', category: 'HDR Processing', label: 'Merge Successful' },
      merge_failed: { action: 'merge_failed', category: 'HDR Processing', label: 'Merge Failed' },
      new_batch: { action: 'new_batch', category: 'Batch', label: 'New Batch Click' },
      download_click: { action: 'download_click', category: 'Download', label: 'Download HDR Image Click' }
    };
    const evt = eventMap[eventType];
    if (evt) {
      gtag('event', evt.action, {
        'event_category': evt.category,
        'event_label': evt.label
      });
    }
  }
}

/**
 * Updates the thumbnail previews for the uploaded images.
 */
function updateThumbnails() {
  const thumbnailsContainer = document.getElementById('thumbnails');
  thumbnailsContainer.innerHTML = "";
  uploadedImages.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const thumbDiv = document.createElement('div');
      thumbDiv.className = 'thumbnail';

      const img = document.createElement('img');
      img.src = e.target.result;
      img.alt = file.name;

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.innerText = '✖';
      // Set accessibility attribute for delete button
      delBtn.setAttribute("aria-label", "delete");
      delBtn.addEventListener('click', () => {
        uploadedImages.splice(index, 1);
        updateThumbnails();
        validateFileCount();
      });

      thumbDiv.appendChild(img);
      thumbDiv.appendChild(delBtn);
      thumbnailsContainer.appendChild(thumbDiv);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validates the number of uploaded images and enables/disables the merge button.
 */
function validateFileCount() {
  const processBtn = document.getElementById('processBtn');
  if (uploadedImages.length >= 3 && uploadedImages.length <= 7) {
    processBtn.disabled = false;
  } else {
    processBtn.disabled = true;
  }
}

/* Drag-and-Drop Event Handlers */
function handleDrop(e) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
  // Append new files rather than replacing existing ones
  uploadedImages = uploadedImages.concat(files);
  updateThumbnails();
  validateFileCount();
  if (files.length > 0) {
    trackEvent('upload_images');
  }
}

function handleDragOver(e) {
  e.preventDefault();
}

/* DOMContentLoaded: Setup event listeners */
document.addEventListener('DOMContentLoaded', () => {
  trackEvent('pageview');

  // File selection via click on the drop area
  const imageUpload = document.getElementById('imageUpload');
  imageUpload.addEventListener('change', (e) => {
    const newFiles = Array.from(e.target.files);
    // Append newly selected files instead of replacing existing ones
    uploadedImages = uploadedImages.concat(newFiles);
    updateThumbnails();
    validateFileCount();
    if (newFiles.length > 0) {
      trackEvent('upload_images');
    }
  });

  // Drag-and-drop area
  const dropArea = document.getElementById('dropArea');
  dropArea.addEventListener('dragover', handleDragOver);
  dropArea.addEventListener('drop', handleDrop);
  // Make the entire drop area clickable to trigger file selection.
  dropArea.addEventListener('click', () => {
    imageUpload.click();
  });

  // Merge (Create HDR) button
  document.getElementById('processBtn').addEventListener('click', async () => {
    // Immediately hide the Create HDR button upon clicking.
    document.getElementById('processBtn').hidden = true;
    trackEvent('create_hdr_click');
    showProcessingIndicator();
    resetProcessingIndicator();

    if (!isPyodideInitialized) {
      await initializePyodide();
    }

    let errorOccurred = false;
    try {
      const imageBuffers = await Promise.all(uploadedImages.map(file => readImageAsArray(file)));
      const pyImages = imageBuffers.map(buf => new Uint8Array(buf));
      pyodide.globals.set("image_data", pyImages);

      // Wrap the merge call in a timeout (15 seconds)
      const mergePromise = pyodide.runPythonAsync(`merge_hdr(image_data)`);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Merge operation timed out")), 15000);
      });
      const result = await Promise.race([mergePromise, timeoutPromise]);

      const blob = new Blob([new Uint8Array(result)], { type: 'image/png' });
      const downloadLink = document.getElementById('downloadLink');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = 'hdr_result.png';
      downloadLink.hidden = false;
      // Move focus to the download link for accessibility
      downloadLink.focus();

      // Show the New Batch button to allow resetting the workflow.
      document.getElementById('newBatchBtn').hidden = false;

      trackEvent('merge_success');
    } catch (error) {
      errorOccurred = true;
      // Hide the spinner so that only the error message is visible.
      document.getElementById('spinner').hidden = true;
      // Replace the processing text with the error message.
      document.getElementById('processingText').innerText = "Couldn't merge. Try again. Make sure images are aligned.";
      // Show the New Batch button.
      document.getElementById('newBatchBtn').hidden = false;
      trackEvent('merge_failed');
      console.error(error);
      // Reset Pyodide so that the next batch reloads the libraries.
      isPyodideInitialized = false;
    } finally {
      if (!errorOccurred) {
        hideProcessingIndicator();
      }
      // Explicit memory cleanup after merge.
      if (pyodide && pyodide._api && typeof pyodide._api.freeAllocatedMemory === 'function') {
        pyodide._api.freeAllocatedMemory();
      }
      if (pyodide) {
        try {
          await pyodide.runPython("import gc; gc.collect()");
        } catch (err) {
          console.error("Error during memory cleanup", err);
        }
      }
    }
  });

  // New Batch button resets the UI to its initial state without reloading the libraries immediately.
  document.getElementById('newBatchBtn').addEventListener('click', () => {
    // Reset file list and UI elements.
    uploadedImages = [];
    imageUpload.value = "";
    document.getElementById('thumbnails').innerHTML = "";
    document.getElementById('processBtn').disabled = true;
    // Unhide the Create HDR button for the new batch.
    document.getElementById('processBtn').hidden = false;
    document.getElementById('downloadLink').hidden = true;
    document.getElementById('newBatchBtn').hidden = true;
    // Reset and hide the processing indicator.
    resetProcessingIndicator();
    hideProcessingIndicator();
    // Unload the Python libraries (do not reload them now).
    isPyodideInitialized = false;
    trackEvent('new_batch');
  });

  // Track when the download link is clicked.
  document.getElementById('downloadLink').addEventListener('click', () => {
    trackEvent('download_click');
  });
});
