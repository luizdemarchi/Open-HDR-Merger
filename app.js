let pyodide = null;
let isPyodideInitialized = false;
let uploadedImages = [];

/**
 * Initializes Pyodide and loads necessary packages.
 * Deferred until the user initiates merging.
 */
async function initializePyodide() {
  try {
    updateSpinner(true);
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
  } finally {
    updateSpinner(false);
  }
}

/**
 * Updates the progress bar.
 * @param {number} percentage - The current progress percentage.
 */
function updateProgress(percentage) {
  document.getElementById('progressBar').style.width = `${percentage}%`;
}

/**
 * Shows or hides the spinner.
 * @param {boolean} show - Whether to show the spinner.
 */
function updateSpinner(show) {
  const spinner = document.getElementById('spinner');
  spinner.hidden = !show;
  spinner.innerText = ""; // Ensure no text is displayed in the spinner
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
 * Tracks events with Google Analytics.
 * @param {string} eventType - The type of event.
 */
function trackEvent(eventType) {
  if (typeof gtag !== 'undefined') {
    const eventMap = {
      pageview: 'page_view',
      merge_success: 'merge_success',
      merge_failed: 'merge_failed'
    };
    gtag('event', eventMap[eventType]);
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
  uploadedImages = uploadedImages.concat(files);
  updateThumbnails();
  validateFileCount();
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
    uploadedImages = Array.from(e.target.files);
    updateThumbnails();
    validateFileCount();
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
    updateSpinner(true);
    updateProgress(20);
    // Small delay so that the progress bar updates immediately.
    await new Promise(resolve => setTimeout(resolve, 50));

    if (!isPyodideInitialized) {
      await initializePyodide();
    }
    updateProgress(30);

    try {
      updateProgress(40);
      const imageBuffers = await Promise.all(uploadedImages.map(file => readImageAsArray(file)));
      const pyImages = imageBuffers.map(buf => new Uint8Array(buf));
      pyodide.globals.set("image_data", pyImages);

      updateProgress(60);
      const result = await pyodide.runPythonAsync(`merge_hdr(image_data)`);
      updateProgress(80);

      const blob = new Blob([new Uint8Array(result)], { type: 'image/png' });
      updateProgress(100);
      const downloadLink = document.getElementById('downloadLink');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = 'hdr_result.png';
      downloadLink.hidden = false;

      // Hide the Create HDR button after a successful merge.
      document.getElementById('processBtn').hidden = true;

      // Show the New Batch button to allow resetting the workflow.
      document.getElementById('newBatchBtn').hidden = false;

      trackEvent('merge_success');
    } catch (error) {
      updateProgress(0);
      document.getElementById('downloadLink').hidden = true;
      trackEvent('merge_failed');
      alert('Merge failed. Please try again.');
      console.error(error);
    } finally {
      updateSpinner(false);
      // Explicit memory cleanup after merge.
      if (pyodide && pyodide._api && typeof pyodide._api.freeAllocatedMemory === 'function') {
        pyodide._api.freeAllocatedMemory();
      }
      if (pyodide) {
        try {
          // Instead of clearing sys.modules, use garbage collection.
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
    updateProgress(0);
  });
});
