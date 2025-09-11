// PDF Handlers - All PDF-related functionality
// This file contains functions for loading, rendering, and controlling PDF documents

// PDF.js will be initialized in main.js after DOM is ready

// PDF Loading Functions
async function loadPdf(file) {
    try {
        console.log('Loading PDF file:', file.name);
        
        // Show loading state
        document.getElementById('noPdf').style.display = 'none';
        document.getElementById('pdfViewer').style.display = 'none';
        document.getElementById('loadingPdf').style.display = 'block';

        // Cancel any ongoing rendering operations
        if (window.currentRenderTask) {
            try {
                await window.currentRenderTask.cancel();
                console.log('Cancelled previous render task');
            } catch (cancelError) {
                console.log('Previous render task already completed or cancelled');
            }
            window.currentRenderTask = null;
        }
        
        // Clear the canvas
        const canvas = document.getElementById('viewer');
        if (canvas) {
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Reset current PDF
        currentPdf = null;

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Validate PDF file
        if (!isValidPdfFile(arrayBuffer)) {
            throw new Error('Invalid PDF file format. Please ensure the file is a valid PDF.');
        }

        // Create a separate copy for PDF-lib BEFORE loading with PDF.js
        const templateBytes = new Uint8Array(arrayBuffer).slice();

        // Load PDF document with enhanced options for better compatibility
        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            // Enhanced options for better PDF compatibility
            disableAutoFetch: false,
            disableStream: false,
            disableRange: false,
            // Better handling of different PDF versions
            maxImageSize: 1024 * 1024 * 10, // 10MB max image size
            isEvalSupported: false,
            // Improved font handling
            useSystemFonts: true,
            // Better color space handling
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
            // Enhanced error handling
            stopAtErrors: false,
            // Better memory management
            verbosity: 0
        });
        
        const pdf = await loadingTask.promise;
        
        // Store PDF info
        currentPdf = pdf;

        // Update session state with the separate copy
        sessionState.templatePdf = pdf;
        sessionState.templatePdfBytes = templateBytes;
        
        // Enable Download PDFs button if CSV and boxes are also loaded
        updateDownloadButtonState();
        
        // Update records info
        updateRecordsInfo();

        // Render the page (always page 1 for single-page PDFs)
        await renderPage(1);

        // Initialize simple editor after PDF is loaded
        initEditorCanvas();

        // Hide loading and noPdf message, show PDF viewer
        document.getElementById('loadingPdf').style.display = 'none';
        document.getElementById('noPdf').style.display = 'none';
        document.getElementById('pdfViewer').style.display = 'block';
        
        // Initialize PDF dragging functionality
        initPDFDragging();
        
        // Initialize PDF lock status
        updatePDFLockStatus();
        
        // Update PDF area outline
        updatePdfAreaOutline();

    } catch (error) {
        console.error('Error loading PDF:', error);
        document.getElementById('loadingPdf').style.display = 'none';
        document.getElementById('noPdf').style.display = 'block';
        document.getElementById('noPdf').innerHTML = `
            <h3>Error loading PDF</h3>
            <p>${error.message}</p>
        `;
    }
}

async function loadPdfFromUrl(url) {
    try {
        // Fetch PDF from server
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch PDF from server');
        }
        
        const arrayBuffer = await response.arrayBuffer();

        // Load PDF document
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        
        // Store PDF info
        currentPdf = pdf;

        // Update session state
        sessionState.templatePdf = pdf;
        sessionState.templatePdfBytes = arrayBuffer.slice(0); // Create a copy to avoid detachment

        // Render the page (always page 1 for single-page PDFs)
        await renderPage(1);

        // Hide loading and noPdf message, show PDF viewer
        document.getElementById('loadingPdf').style.display = 'none';
        document.getElementById('noPdf').style.display = 'none';
        document.getElementById('pdfViewer').style.display = 'block';
        
        // Initialize PDF dragging functionality
        initPDFDragging();

    } catch (error) {
        console.error('Error loading PDF from URL:', error);
        document.getElementById('loadingPdf').style.display = 'none';
        document.getElementById('noPdf').style.display = 'block';
        document.getElementById('noPdf').innerHTML = `
            <h3>Error loading PDF</h3>
            <p>${error.message}</p>
        `;
    }
}

async function renderPage(pageNumber) {
    if (!currentPdf) return;

    try {
        // Cancel any ongoing rendering operations
        if (window.currentRenderTask) {
            try {
                await window.currentRenderTask.cancel();
                console.log('Cancelled previous render task');
            } catch (cancelError) {
                console.log('Previous render task already completed or cancelled');
            }
        }

        // Get page
        const page = await currentPdf.getPage(pageNumber);

        // Set up canvas
        const canvas = document.getElementById('viewer');
        const context = canvas.getContext('2d');

        // Clear the canvas first
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate high-DPI scale for crisp display
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewerContainer = document.querySelector('.viewer-container');
        const containerWidth = viewerContainer.clientWidth;
        const containerHeight = viewerContainer.clientHeight;
        
        // Get PDF viewport at scale 1.0 to calculate display size
        const baseViewport = page.getViewport({scale: 1.0});
        
        // Calculate display scale to fit container
        const scaleX = containerWidth / baseViewport.width;
        const scaleY = containerHeight / baseViewport.height;
        const displayScale = Math.min(scaleX, scaleY, 1.0); // Don't scale up, only down
        
        // Calculate high-DPI render scale (2x for crisp display on high-DPI screens)
        const renderScale = displayScale * Math.max(2.0, devicePixelRatio);
        
        // Create viewport at high resolution
        const viewport = page.getViewport({scale: renderScale});
        
        // Enable high-quality rendering
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        // Set canvas size to match viewport
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Scale the canvas for display
        canvas.style.width = (viewport.width / devicePixelRatio) + 'px';
        canvas.style.height = (viewport.height / devicePixelRatio) + 'px';
        
        // Scale the context to match the device pixel ratio
        context.scale(devicePixelRatio, devicePixelRatio);
        
        // Create render context
        const renderContext = {
            canvasContext: context,
            viewport: viewport,
            // Enhanced rendering options
            intent: 'display',
            renderInteractiveForms: false,
            // Better text rendering
            textLayer: null,
            annotationLayer: null
        };

        // Render the page
        window.currentRenderTask = page.render(renderContext);
        await window.currentRenderTask.promise;
        
        // Update editor canvas size to match the rendered PDF
        if (typeof editorCanvas !== 'undefined' && editorCanvas) {
            updateEditorPageSize();
        }

        console.log('PDF rendered at original quality:', viewport.width, 'x', viewport.height);

    } catch (error) {
        console.error('Error rendering page:', error);
    }
}

// PDF Area Outline Functions
function updatePdfAreaOutline() {
    const canvas = document.getElementById('viewer');
    const outline = document.getElementById('pdfAreaOutline');
    
    if (canvas && outline) {
        const rect = canvas.getBoundingClientRect();
        const container = document.querySelector('.viewer-container');
        const containerRect = container.getBoundingClientRect();
        
        outline.style.left = (rect.left - containerRect.left) + 'px';
        outline.style.top = (rect.top - containerRect.top) + 'px';
        outline.style.width = rect.width + 'px';
        outline.style.height = rect.height + 'px';
    }
}

function updateOutlineOnZoom() {
    updatePdfAreaOutline();
}

// PDF Validation
function isValidPdfFile(arrayBuffer) {
    try {
        // Check PDF file signature
        const uint8Array = new Uint8Array(arrayBuffer);
        const pdfSignature = String.fromCharCode(uint8Array[0], uint8Array[1], uint8Array[2], uint8Array[3]);
        
        if (pdfSignature !== '%PDF') {
            console.error('Invalid PDF signature:', pdfSignature);
            return false;
        }
        
        // Check file size (minimum 100 bytes for a valid PDF)
        if (arrayBuffer.byteLength < 100) {
            console.error('PDF file too small:', arrayBuffer.byteLength);
            return false;
        }
        
        // Check for PDF version
        const header = String.fromCharCode.apply(null, uint8Array.slice(0, 20));
        const versionMatch = header.match(/%PDF-(\d+\.\d+)/);
        
        if (!versionMatch) {
            console.error('No PDF version found in header');
            return false;
        }
        
        const version = parseFloat(versionMatch[1]);
        if (version < 1.0 || version > 2.0) {
            console.warn('Unusual PDF version:', version);
        }
        
        console.log('PDF validation passed:', {
            signature: pdfSignature,
            version: version,
            size: arrayBuffer.byteLength
        });
        
        return true;
        
    } catch (error) {
        console.error('Error validating PDF file:', error);
        return false;
    }
}

// PDF Controls and Navigation
function togglePDFLock() {
    pdfLocked = !pdfLocked;
    updatePDFLockStatus();
    console.log('PDF lock toggled:', pdfLocked ? 'locked' : 'unlocked');
}

function updatePDFLockStatus() {
    const lockBtn = document.getElementById('pdfLockBtn');
    if (lockBtn) {
        lockBtn.textContent = pdfLocked ? '🔒' : '🔓';
        lockBtn.title = pdfLocked ? 'PDF is locked - click to unlock' : 'PDF is unlocked - click to lock';
    }
    
    // Update PDF viewer cursor
    const pdfViewer = document.getElementById('pdfViewer');
    if (pdfViewer) {
        pdfViewer.style.cursor = pdfLocked ? 'default' : 'grab';
    }
}

function resetView() {
    currentTransform = { x: 0, y: 0, scale: 1 };
    updatePDFTransform();
    updateZoomDisplay();
    clearStoredBoxPositions();
    console.log('View reset to original position and scale');
}

function clearStoredBoxPositions() {
    // Clear any stored box positions for reset
    sessionStorage.removeItem('boxPositions');
    console.log('Cleared stored box positions');
}

function fitToWindow() {
    if (!currentPdf) return;
    
    const viewerContainer = document.querySelector('.viewer-container');
    const containerWidth = viewerContainer.clientWidth;
    const containerHeight = viewerContainer.clientHeight;
    
    // Get PDF dimensions
    const canvas = document.getElementById('viewer');
    const pdfWidth = canvas.width;
    const pdfHeight = canvas.height;
    
    // Calculate scale to fit container
    const scaleX = containerWidth / pdfWidth;
    const scaleY = containerHeight / pdfHeight;
    const scale = Math.min(scaleX, scaleY, 1.0);
    
    // Center the PDF
    const x = (containerWidth - pdfWidth * scale) / 2;
    const y = (containerHeight - pdfHeight * scale) / 2;
    
    currentTransform = { x, y, scale };
    updatePDFTransform();
    updateZoomDisplay();
    
    console.log('PDF fitted to window:', { x, y, scale });
}

function showZoomHelpIndicator() {
    const indicator = document.getElementById('zoomHelpIndicator');
    if (indicator) {
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 4000);
    }
}

// Zoom Functions
function zoomIn() {
    const currentScale = currentTransform.scale;
    const newScale = Math.min(currentScale * 1.2, 5.0); // Max 5x zoom
    currentTransform.scale = newScale;
    updatePDFTransform();
    updateZoomDisplay();
    showZoomHelpIndicator();
}

function zoomOut() {
    const currentScale = currentTransform.scale;
    const newScale = Math.max(currentScale / 1.2, 0.1); // Min 0.1x zoom
    currentTransform.scale = newScale;
    updatePDFTransform();
    updateZoomDisplay();
    showZoomHelpIndicator();
}

function setZoomLevel(levelIndex) {
    const zoomLevels = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];
    if (levelIndex >= 0 && levelIndex < zoomLevels.length) {
        currentTransform.scale = zoomLevels[levelIndex];
        updatePDFTransform();
        updateZoomDisplay();
        showZoomHelpIndicator();
    }
}

function updateZoomDisplay() {
    const zoomDisplay = document.getElementById('zoomDisplay');
    const zoomSelect = document.getElementById('zoomSelect');
    
    if (zoomDisplay) {
        zoomDisplay.textContent = Math.round(currentTransform.scale * 100) + '%';
    }
    
    if (zoomSelect) {
        const zoomLevels = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];
        const closestLevel = zoomLevels.reduce((prev, curr) => 
            Math.abs(curr - currentTransform.scale) < Math.abs(prev - currentTransform.scale) ? curr : prev
        );
        const levelIndex = zoomLevels.indexOf(closestLevel);
        zoomSelect.value = levelIndex;
    }
}

// PDF Dragging and Interaction
function initPDFDragging() {
    const pdfViewer = document.getElementById('pdfViewer');
    if (!pdfViewer) return;
    
    // Remove existing event listeners
    pdfViewer.removeEventListener('mousedown', startDragging);
    pdfViewer.removeEventListener('touchstart', startDraggingTouch);
    pdfViewer.removeEventListener('wheel', handleWheel);
    
    // Add event listeners
    pdfViewer.addEventListener('mousedown', startDragging);
    pdfViewer.addEventListener('touchstart', startDraggingTouch);
    pdfViewer.addEventListener('wheel', handleWheel);
    
    console.log('PDF dragging initialized');
}

function startDragging(e) {
    if (pdfLocked) return;
    
    isDragging = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
    document.getElementById('pdfViewer').classList.add('dragging');
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDragging);
}

function startDraggingTouch(e) {
    if (pdfLocked) return;
    
    isDragging = true;
    const touch = e.touches[0];
    lastMousePos = { x: touch.clientX, y: touch.clientY };
    document.getElementById('pdfViewer').classList.add('dragging');
    
    document.addEventListener('touchmove', dragTouch);
    document.addEventListener('touchend', stopDragging);
}

function drag(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    
    currentTransform.x += deltaX;
    currentTransform.y += deltaY;
    
    lastMousePos = { x: e.clientX, y: e.clientY };
    updatePDFTransform();
}

function dragTouch(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - lastMousePos.x;
    const deltaY = touch.clientY - lastMousePos.y;
    
    currentTransform.x += deltaX;
    currentTransform.y += deltaY;
    
    lastMousePos = { x: touch.clientX, y: touch.clientY };
    updatePDFTransform();
}

function stopDragging() {
    isDragging = false;
    document.getElementById('pdfViewer').classList.remove('dragging');
    
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDragging);
    document.removeEventListener('touchmove', dragTouch);
    document.removeEventListener('touchend', stopDragging);
}

function handleWheel(e) {
    if (pdfLocked) return;
    
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5.0, currentTransform.scale * delta));
    
    // Zoom towards mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const scaleChange = newScale / currentTransform.scale;
    currentTransform.x = mouseX - (mouseX - currentTransform.x) * scaleChange;
    currentTransform.y = mouseY - (mouseY - currentTransform.y) * scaleChange;
    currentTransform.scale = newScale;
    
    updatePDFTransform();
    updateZoomDisplay();
}

function updatePDFTransform() {
    const pdfContent = document.getElementById('pdfContent');
    if (pdfContent) {
        pdfContent.style.transform = `translate(${currentTransform.x}px, ${currentTransform.y}px) scale(${currentTransform.scale})`;
    }
}

function setupMouseWheelZoom() {
    const pdfViewer = document.getElementById('pdfViewer');
    if (pdfViewer) {
        pdfViewer.addEventListener('wheel', handleWheel, { passive: false });
    }
}

// PDF Generation and Export
async function generateSamplePDF() {
    if (!sessionState.templatePdfBytes || !sessionState.csvRows.length) {
        alert('Please load both a PDF template and CSV data first.');
        return;
    }
    
    try {
        console.log('Generating sample PDF...');
        
        // Load the PDF document
        const pdfDoc = await PDFLib.PDFDocument.load(sessionState.templatePdfBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        
        // Get the first CSV record
        const firstRecord = sessionState.csvRows[0];
        
        // Add sample text
        firstPage.drawText(`Sample: ${firstRecord.title || 'Sample Title'}`, {
            x: 50,
            y: 700,
            size: 20,
            color: PDFLib.rgb(0, 0, 0)
        });
        
        // Save the PDF
        const pdfBytes = await pdfDoc.save();
        
        // Create download link
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample.pdf';
        a.click();
        
        URL.revokeObjectURL(url);
        console.log('Sample PDF generated successfully');
        
    } catch (error) {
        console.error('Error generating sample PDF:', error);
        alert('Error generating sample PDF: ' + error.message);
    }
}

// PDF Generation Logging
function exportPDFGenerationLogs() {
    const logs = JSON.parse(localStorage.getItem('pdfGenerationLogs') || '[]');
    if (logs.length === 0) {
        alert('No PDF generation logs found.');
        return;
    }
    
    const logText = logs.map(log => 
        `[${log.timestamp}] ${log.action}: ${log.details}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdf-generation-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function logPDFGenerationSummary(totalRecords, mode) {
    const summary = {
        timestamp: new Date().toISOString(),
        action: 'PDF Generation Summary',
        details: `Generated ${totalRecords} PDFs in ${mode} mode`,
        totalRecords: totalRecords,
        mode: mode
    };
    
    // Store in localStorage
    const logs = JSON.parse(localStorage.getItem('pdfGenerationLogs') || '[]');
    logs.push(summary);
    
    // Keep only last 100 logs
    if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
    }
    
    localStorage.setItem('pdfGenerationLogs', JSON.stringify(logs));
    console.log('PDF generation summary logged:', summary);
}

// Reset Functions
function resetAllBoxesToOriginal() {
    // Reset all boxes to their original positions
    sessionState.boxes.forEach(box => {
        if (box.element) {
            box.element.style.left = box.originalX + 'px';
            box.element.style.top = box.originalY + 'px';
            box.element.style.width = box.originalWidth + 'px';
            box.element.style.height = box.originalHeight + 'px';
        }
    });
    
    console.log('All boxes reset to original positions');
}

function resetSession() {
    // Reset all session state
    sessionState.templatePdf = null;
    sessionState.templatePdfBytes = null;
    sessionState.csv = null;
    sessionState.csvRows = [];
    sessionState.layout = null;
    sessionState.boxes = [];
    sessionState.selectedBox = null;
    sessionState.pdfMetadata = null;
    sessionState.csvMetadata = null;
    sessionState.liveMonitoringEnabled = false;
    
    // Reset global variables
    currentPdf = null;
    currentFile = null;
    serverPdfUrl = null;
    currentRecord = 0;
    csvData = null;
    
    // Clear UI
    document.getElementById('noPdf').style.display = 'block';
    document.getElementById('pdfViewer').style.display = 'none';
    document.getElementById('loadingPdf').style.display = 'none';
    document.getElementById('fileLabel').textContent = '📄 Click to select PDF file';
    document.getElementById('csvLabel').textContent = '📊 Click to select CSV file';
    
    // Clear canvas
    const canvas = document.getElementById('viewer');
    if (canvas) {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Clear boxes
    document.querySelectorAll('.draggable-text-box, .draggable-image-box').forEach(box => {
        box.remove();
    });
    
    // Reset download button
    updateDownloadButtonState();
    
    console.log('Session reset complete');
}
