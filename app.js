let pyodide;
let uploadedImages = [];

async function initializePyodide() {
  pyodide = await loadPyodide();

  // Load Pyodide-compatible packages
  await pyodide.loadPackage(["numpy", "opencv-python"]);

  // Load your HDR processing script
  await pyodide.runPython(`
    import js
    import cv2
    import numpy as np
    from js import console
  `);
}

// Progress bar update
function updateProgress(percentage) {
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = `${percentage}%`;
}

// Read image as Uint8Array
async function readImageAsArray(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            resolve(uint8Array);
        };
        reader.readAsArrayBuffer(file);
    });
}

// Track events with CountAPI
function trackEvent(eventType) {
  const eventMap = {
    pageview: 'page_view',
    merge_success: 'merge_success',
    merge_failed: 'merge_failed'
  };
  gtag('event', eventMap[eventType]);
}

// Track page view on load
trackEvent('pageview');

try {
  // ... processing logic
  trackEvent('merge_success');
} catch (error) {
  trackEvent('merge_failed');
}

// Initialize
(async function() {
    await initializePyodide();
    trackEvent('pageview');
})();

// Event Listeners
document.getElementById('imageUpload').addEventListener('change', (e) => {
    uploadedImages = Array.from(e.target.files);
    document.getElementById('processBtn').disabled = uploadedImages.length < 3 || uploadedImages.length > 7;
});

document.getElementById('processBtn').addEventListener('click', async () => {
    try {
        updateProgress(10);
        const imageDataArray = await Promise.all(
            uploadedImages.map(file => readImageAsArray(file))
        );

        updateProgress(30);
        const result = await pyodide.runPythonAsync(`
            from hdr_processor import merge_hdr
            merge_hdr(${JSON.stringify(Array.from(imageDataArray))})
        `);

        updateProgress(90);
        const blob = new Blob([new Uint8Array(result)], { type: 'image/tiff' });
        const downloadLink = document.getElementById('downloadLink');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = 'hdr_result.tiff';
        downloadLink.hidden = false;

        updateProgress(100);
        setTimeout(() => updateProgress(0), 2000);
        trackEvent('merge_success');
    } catch (error) {
        updateProgress(0);
        trackEvent('merge_failed');
        alert('Merge failed. Check console for details.');
        console.error(error);
    }
});