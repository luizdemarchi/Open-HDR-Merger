let pyodide;
let uploadedImages = [];

async function initializePyodide() {
    pyodide = await loadPyodide();
    await pyodide.loadPackage(["numpy", "opencv-python"]);

    // Load hdr_processor.py
    const response = await fetch('hdr_processor.py');
    const code = await response.text();
    pyodide.FS.writeFile('hdr_processor.py', code);

    // Import the module
    await pyodide.runPython(`
        from hdr_processor import merge_hdr
    `);
}

function updateProgress(percentage) {
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = `${percentage}%`;
}

async function readImageAsArray(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsArrayBuffer(file);
    });
}

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

// Initialize
(async function() {
    await initializePyodide();
    trackEvent('pageview');
})();

document.getElementById('imageUpload').addEventListener('change', (e) => {
    uploadedImages = Array.from(e.target.files);
    document.getElementById('processBtn').disabled = uploadedImages.length < 3 || uploadedImages.length > 7;
});

document.getElementById('processBtn').addEventListener('click', async () => {
    try {
        updateProgress(10);
        const imageBuffers = await Promise.all(
            uploadedImages.map(file => readImageAsArray(file))
        );
        const pyImages = imageBuffers.map(buf => new Uint8Array(buf));

        // Pass to Python
        pyodide.globals.set("image_data", pyImages);

        updateProgress(30);
        const result = await pyodide.runPythonAsync(`
            merge_hdr(image_data)
        `);

        updateProgress(90);
        const blob = new Blob([result], { type: 'image/tiff' });
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