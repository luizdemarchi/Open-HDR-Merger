let pyodide = null;
let isPyodideInitialized = false;
let uploadedImages = [];

/**
 * Initializes Pyodide and loads necessary packages.
 * Deferred until the user initiates merging.
 */
async function initializePyodide() {
  try {
    // Do not hide the processing indicator until merge processing is complete.
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
 * Shows the processing indicator (spinner and text).
 */
function showProcessingIndicator() {
  document.getElementById('processingIndicator').hidden = false;
}

/**
 * Hides the processing indicator (spinner and text).
 */
function hideProcessingIndicator() {
  document.getElementById('processingIndicator').hidden = true;
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
 * The following event types are supported:
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
  // Append the new files to the existing list
  uploadedImages = uploadedImages.concat(files);
  updateThumbnails();
  validateFileCount();
  // Track image upload event (you might want to count this per batch or per file)
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
    // Append newly selected files instead of replacing
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
    // Hide the Create HDR button immediately upon clicking.
    document.getElementById('processBtn').hidden = true;
    trackEvent('create_hdr_click');
    showProcessingIndicator();

    if (!isPyodideInitialized) {
      await initializePyodide();
    }

    try {
      const imageBuffers = await Promise.all(uploadedImages.map(file => readImageAsArray(file)));
      const pyImages = imageBuffers.map(buf => new Uint8Array(buf));
      pyodide.globals.set("image_data", pyImages);

      const result = await pyodide.runPythonAsync(`merge_hdr(image_data)`);

      const blob = new Blob([new Uint8Array(result)], { type: 'image/png' });
      const downloadLink = document.getElementById('downloadLink');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = 'hdr_result.png';
      downloadLink.hidden = false;

      // Show the New Batch button to allow resetting the workflow.
      document.getElementById('newBatchBtn').hidden = false;

      trackEvent('merge_success');
    } catch (error) {
      // Re-show the Create HDR button if an error occurs.
      document.getElementById('processBtn').hidden = false;
      document.getElementById('downloadLink').hidden = true;
      trackEvent('merge_failed');
      alert('Merge failed. Please try again.');
      console.error(error);
    } finally {
      hideProcessingIndicator();
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

  // New Batch button resets the UI to its initial state.
  document.getElementById('newBatchBtn').addEventListener('click', () => {
    uploadedImages = [];
    imageUpload.value = "";
    document.getElementById('thumbnails').innerHTML = "";
    document.getElementById('processBtn').disabled = true;
    // Unhide the Create HDR button for the new batch.
    document.getElementById('processBtn').hidden = false;
    document.getElementById('downloadLink').hidden = true;
    document.getElementById('newBatchBtn').hidden = true;
    trackEvent('new_batch');
  });

  // Optional: Track when the download link is clicked.
  document.getElementById('downloadLink').addEventListener('click', () => {
    trackEvent('download_click');
  });
});
