document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI state
    document.getElementById('spinner').style.display = 'none';
    document.getElementById('initLoading').style.display = 'none';
    document.getElementById('downloadLink').hidden = true;
});

let pyodide = null;
let uploadedImages = [];
let isProcessing = false;

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('imageUpload');
const thumbnailContainer = document.getElementById('thumbnailContainer');
const processBtn = document.getElementById('processBtn');
const newBatchBtn = document.getElementById('newBatchBtn');
const downloadLink = document.getElementById('downloadLink');
const spinner = document.getElementById('spinner');
const initSpinner = document.getElementById('initLoading');

// Initialize Pyodide on first merge attempt
async function initializePyodide() {
    initSpinner.style.display = 'block';
    try {
        pyodide = await loadPyodide();
        await pyodide.loadPackage(["numpy", "opencv-python"]);

        // Load HDR processor code
        const response = await fetch('hdr_processor.py');
        const code = await response.text();
        pyodide.FS.writeFile('hdr_processor.py', code);
        await pyodide.runPython(`from hdr_processor import merge_hdr`);
    } finally {
        initSpinner.style.display = 'none';
    }
}

// Process HDR merge
async function processMerge() {
    if (!pyodide) await initializePyodide();
    if (isProcessing || !isValidImageCount()) return;

    isProcessing = true;
    downloadLink.hidden = true; // Force hide at start
    newBatchBtn.style.display = 'none';
    showSpinner(true);

    try {
        // Convert images to Uint8Arrays
        const imageBuffers = await Promise.all(
            uploadedImages.map(file => readImageAsArray(file))
        );
        const pyImages = imageBuffers.map(buf => new Uint8Array(buf));

        // Process HDR merge
        pyodide.globals.set("image_data", pyImages);
        const result = await pyodide.runPythonAsync(`merge_hdr(image_data)`);

        // Create downloadable PNG
        const blob = new Blob([new Uint8Array(result)], { type: 'image/png' });
        const objectURL = URL.createObjectURL(blob);

        downloadLink.href = objectURL;
        downloadLink.download = `hdr_result_${Date.now()}.png`;
        downloadLink.hidden = false;
        newBatchBtn.style.display = 'inline-block';
    } catch (error) {
        console.error('Merge failed:', error);
        alert('Merge failed. Please check console for details.');
        downloadLink.hidden = true; // Ensure hidden on error
    } finally {
        isProcessing = false;
        showSpinner(false);
        // Cleanup
        pyodide._api.freeAllocatedMemory();
        pyodide.runPython("import sys; sys.modules.clear()");
    }
}

// UI Helpers
function showSpinner(show) {
    spinner.style.display = show ? 'block' : 'none';
}

async function readImageAsArray(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsArrayBuffer(file);
    });
}

// Drag-and-Drop Handlers
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
    }
});

// File Input Handler
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
});

// Handle uploaded files
function handleFiles(files) {
    uploadedImages = Array.from(files);
    updateThumbnails();
    processBtn.disabled = !isValidImageCount();
    fileInput.value = ''; // Clear input after handling
}

// Update thumbnail previews
function updateThumbnails() {
    thumbnailContainer.innerHTML = '';

    uploadedImages.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'thumbnail-wrapper';
            wrapper.innerHTML = `
                <div style="position:relative; margin:5px;">
                    <img src="${e.target.result}"
                         class="thumbnail"
                         alt="${file.name}">
                    <div class="delete-thumbnail"
                         data-index="${index}"
                         title="Remove image">×</div>
                </div>
            `;
            thumbnailContainer.appendChild(wrapper);
        };
        reader.readAsDataURL(file);
    });

    // Add delete functionality
    document.querySelectorAll('.delete-thumbnail').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            uploadedImages.splice(index, 1);
            updateThumbnails();
            processBtn.disabled = !isValidImageCount();
        });
    });
}

// Validate image count
function isValidImageCount() {
    return uploadedImages.length >= 3 && uploadedImages.length <= 7;
}

// New Batch Handler
newBatchBtn.addEventListener('click', () => {
    uploadedImages = [];
    fileInput.value = ''; // Clear file input
    updateThumbnails();
    processBtn.disabled = true;
    downloadLink.hidden = true;
    newBatchBtn.style.display = 'none';
});

// Event Listeners
processBtn.addEventListener('click', processMerge);