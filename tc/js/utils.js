// Utils - Utility functions and helpers
// This file contains helper functions, utilities, and common operations

// Color Utilities
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Image Loading and Processing
function loadImageFromUrl(imageUrl, imageBox) {
    if (!imageUrl || !imageBox) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = function() {
        // Clear existing content
        imageBox.innerHTML = '';
        
        // Create and style the image
        const imageElement = document.createElement('img');
        imageElement.src = imageUrl;
        imageElement.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            width: 100%;
            height: 100%;
            object-fit: contain;
            object-position: center;
            aspect-ratio: auto;
            image-rendering: auto;
        `;
        
        imageBox.appendChild(imageElement);
        
        // Update box data
        const box = sessionState.boxes.find(b => b.element === imageBox);
        if (box) {
            box.imageUrl = imageUrl;
        }
        
        console.log('Image loaded successfully:', imageUrl);
    };
    
    img.onerror = function() {
        console.error('Failed to load image:', imageUrl);
        imageBox.innerHTML = '<div style="color: red; font-size: 12px;">Failed to load image</div>';
    };
    
    img.src = imageUrl;
}

async function loadImageWithRetry(imageUrl, maxRetries = 3, timeout = 10000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Loading image attempt ${attempt}/${maxRetries}:`, imageUrl);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(imageUrl, {
                signal: controller.signal,
                mode: 'cors'
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            
            console.log(`Image loaded successfully on attempt ${attempt}:`, imageUrl);
            return objectUrl;
            
        } catch (error) {
            console.warn(`Image load attempt ${attempt} failed:`, error.message);
            
            if (attempt === maxRetries) {
                throw new Error(`Failed to load image after ${maxRetries} attempts: ${error.message}`);
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

// Google Drive URL Conversion
function convertGoogleDriveUrl(url) {
    if (!url || typeof url !== 'string') return url;
    
    // Check if it's a Google Drive sharing URL
    const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (driveMatch) {
        const fileId = driveMatch[1];
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    
    // Check if it's already a direct download URL
    if (url.includes('uc?export=download')) {
        return url;
    }
    
    return url;
}

// Text Box Auto-Resize
function autoResizeTextBox(box) {
    if (!box || !box.element) return;
    
    const element = box.element;
    const text = element.textContent || '';
    
    if (!text.trim()) {
        element.style.height = '20px';
        return;
    }
    
    // Create a temporary element to measure text
    const temp = document.createElement('div');
    temp.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre-wrap;
        word-wrap: break-word;
        font-family: ${element.style.fontFamily || 'Arial'};
        font-size: ${element.style.fontSize || '16px'};
        font-weight: ${element.style.fontWeight || 'normal'};
        font-style: ${element.style.fontStyle || 'normal'};
        line-height: ${element.style.lineHeight || '1.2'};
        width: ${element.style.width || '200px'};
        padding: 5px;
    `;
    temp.textContent = text;
    
    document.body.appendChild(temp);
    const height = temp.offsetHeight;
    document.body.removeChild(temp);
    
    // Set minimum height
    const minHeight = 20;
    const newHeight = Math.max(minHeight, height);
    
    element.style.height = newHeight + 'px';
    
    // Update box data
    box.height = newHeight;
    
    console.log('Text box auto-resized:', box.id, 'height:', newHeight);
}

function updateTextSize(element) {
    if (!element) return;
    
    const text = element.textContent || '';
    if (!text.trim()) return;
    
    // Get current font size
    const currentSize = parseInt(element.style.fontSize) || 16;
    
    // Calculate optimal size based on content length
    let optimalSize = currentSize;
    
    if (text.length > 100) {
        optimalSize = Math.max(12, currentSize - 2);
    } else if (text.length < 20) {
        optimalSize = Math.min(24, currentSize + 2);
    }
    
    if (optimalSize !== currentSize) {
        element.style.fontSize = optimalSize + 'px';
        
        // Update box data
        const box = sessionState.boxes.find(b => b.element === element);
        if (box) {
            box.fontSize = optimalSize;
        }
        
        console.log('Text size updated:', optimalSize);
    }
}

// Progress Updates
function updateProgress(loaded, total, progressBar, progressText) {
    const percentage = Math.round((loaded / total) * 100);
    if (progressBar) progressBar.style.width = percentage + '%';
    if (progressText) progressText.textContent = percentage + '%';
}

// Image Styling for Capture
function styleImageBoxForCapture(img) {
    if (!img) return;
    
    // Ensure image is properly styled for capture
    img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center;
        display: block;
        margin: 0;
        padding: 0;
        border: none;
        outline: none;
    `;
}

function hideUIElementsForCapture(clonedViewer) {
    // Hide UI elements that shouldn't appear in capture
    const elementsToHide = clonedViewer.querySelectorAll(
        '.pdf-controls, .quality-indicator, .zoom-help-indicator, .grid-overlay'
    );
    
    elementsToHide.forEach(element => {
        element.style.display = 'none';
    });
}

// Error Logging and Management
function logImageLoadError(errorLog) {
    const errors = JSON.parse(localStorage.getItem('imageLoadErrors') || '[]');
    errors.push({
        timestamp: new Date().toISOString(),
        ...errorLog
    });
    
    // Keep only last 100 errors
    if (errors.length > 100) {
        errors.splice(0, errors.length - 100);
    }
    
    localStorage.setItem('imageLoadErrors', JSON.stringify(errors));
    console.error('Image load error logged:', errorLog);
}

function showImageLoadErrorNotification(errorLog) {
    // Create error notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 15px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 300px;
    `;
    
    notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">Image Load Error</div>
        <div style="font-size: 12px;">${errorLog.url}</div>
        <div style="font-size: 11px; margin-top: 5px; opacity: 0.9;">${errorLog.error}</div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 5000);
}

function showImageLoadWarningNotification(failedCount, totalImages) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ffc107;
        color: #212529;
        padding: 15px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 300px;
    `;
    
    notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">⚠️ Image Load Warning</div>
        <div style="font-size: 12px;">${failedCount} of ${totalImages} images failed to load</div>
        <div style="font-size: 11px; margin-top: 5px; opacity: 0.8;">Check console for details</div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 7 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 7000);
}

// Error Log Export
function exportImageErrorLogs() {
    const errors = JSON.parse(localStorage.getItem('imageLoadErrors') || '[]');
    if (errors.length === 0) {
        alert('No image load errors found.');
        return;
    }
    
    const logText = errors.map(error => 
        `[${error.timestamp}] ${error.url}: ${error.error}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `image-load-errors-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    
    URL.revokeObjectURL(url);
}

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

function showErrorLogsDashboard() {
    const imageErrors = JSON.parse(localStorage.getItem('imageLoadErrors') || '[]');
    const pdfLogs = JSON.parse(localStorage.getItem('pdfGenerationLogs') || '[]');
    
    const dashboard = document.createElement('div');
    dashboard.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    dashboard.innerHTML = `
        <h3>Error Logs Dashboard</h3>
        <div style="margin-bottom: 20px;">
            <h4>Image Load Errors (${imageErrors.length})</h4>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
                ${imageErrors.length === 0 ? '<p>No image load errors</p>' : 
                  imageErrors.slice(-10).map(error => 
                    `<div style="margin-bottom: 5px; font-size: 12px;">
                        <strong>${new Date(error.timestamp).toLocaleString()}</strong><br>
                        ${error.url}<br>
                        <span style="color: red;">${error.error}</span>
                    </div>`
                  ).join('')}
            </div>
        </div>
        <div style="margin-bottom: 20px;">
            <h4>PDF Generation Logs (${pdfLogs.length})</h4>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
                ${pdfLogs.length === 0 ? '<p>No PDF generation logs</p>' : 
                  pdfLogs.slice(-10).map(log => 
                    `<div style="margin-bottom: 5px; font-size: 12px;">
                        <strong>${new Date(log.timestamp).toLocaleString()}</strong><br>
                        ${log.action}: ${log.details}
                    </div>`
                  ).join('')}
            </div>
        </div>
        <div style="text-align: right;">
            <button onclick="exportImageErrorLogs()" style="margin-right: 10px;">Export Image Errors</button>
            <button onclick="exportPDFGenerationLogs()" style="margin-right: 10px;">Export PDF Logs</button>
            <button onclick="clearAllLogs()" style="margin-right: 10px;">Clear All Logs</button>
            <button onclick="this.parentElement.parentElement.remove()">Close</button>
        </div>
    `;
    
    document.body.appendChild(dashboard);
}

function clearAllLogs() {
    localStorage.removeItem('imageLoadErrors');
    localStorage.removeItem('pdfGenerationLogs');
    console.log('All logs cleared');
    alert('All logs have been cleared.');
}

function getCommonErrors(errors) {
    const errorCounts = {};
    errors.forEach(error => {
        const key = error.error || error.message || 'Unknown error';
        errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    return Object.entries(errorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }));
}

// Undo/Redo System
let undoStack = [];
let redoStack = [];

function initializeUndoSystem() {
    console.log('Undo system initialized');
}

function saveUndoState(action) {
    const state = {
        timestamp: Date.now(),
        action: action,
        boxes: JSON.parse(JSON.stringify(sessionState.boxes)),
        selectedBox: sessionState.selectedBox ? sessionState.selectedBox.id : null
    };
    
    undoStack.push(state);
    
    // Limit stack size
    if (undoStack.length > 50) {
        undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    redoStack = [];
    
    updateUndoRedoButtons();
    console.log('Undo state saved:', action);
}

function undoLastAction() {
    if (undoStack.length === 0) return;
    
    const currentState = {
        timestamp: Date.now(),
        action: 'current',
        boxes: JSON.parse(JSON.stringify(sessionState.boxes)),
        selectedBox: sessionState.selectedBox ? sessionState.selectedBox.id : null
    };
    
    redoStack.push(currentState);
    
    const undoState = undoStack.pop();
    restoreState(undoState);
    
    updateUndoRedoButtons();
    console.log('Action undone:', undoState.action);
}

function redoLastAction() {
    if (redoStack.length === 0) return;
    
    const currentState = {
        timestamp: Date.now(),
        action: 'current',
        boxes: JSON.parse(JSON.stringify(sessionState.boxes)),
        selectedBox: sessionState.selectedBox ? sessionState.selectedBox.id : null
    };
    
    undoStack.push(currentState);
    
    const redoState = redoStack.pop();
    restoreState(redoState);
    
    updateUndoRedoButtons();
    console.log('Action redone:', redoState.action);
}

function restoreState(state) {
    // Clear existing boxes
    sessionState.boxes.forEach(box => {
        if (box.element && box.element.parentElement) {
            box.element.parentElement.removeChild(box.element);
        }
    });
    
    // Restore boxes
    sessionState.boxes = [];
    state.boxes.forEach(boxData => {
        if (boxData.type === 'text') {
            restoreTextBox(boxData);
        } else if (boxData.type === 'image') {
            restoreImageBox(boxData);
        }
    });
    
    // Restore selection
    if (state.selectedBox) {
        const box = sessionState.boxes.find(b => b.id === state.selectedBox);
        if (box) {
            sessionState.selectedBox = box;
            box.element.classList.add('selected');
            showTransformControls(box.element);
        }
    }
    
    updateDownloadButtonState();
    console.log('State restored:', state.action);
}

function restoreTextBox(boxData) {
    const textBox = document.createElement('div');
    textBox.id = boxData.id;
    textBox.className = 'draggable-text-box';
    textBox.style.cssText = `
        position: absolute;
        left: ${boxData.x}px;
        top: ${boxData.y}px;
        width: ${boxData.width}px;
        height: ${boxData.height}px;
        background: transparent;
        border: 1px solid #28a745;
        padding: 5px;
        cursor: move;
        font-family: ${boxData.fontFamily || 'Arial'};
        font-size: ${boxData.fontSize || 16}px;
        color: ${boxData.textColor || '#000'};
        text-align: ${boxData.textAlign || 'center'};
        font-weight: ${boxData.isBold ? 'bold' : 'normal'};
        font-style: ${boxData.isItalic ? 'italic' : 'normal'};
        text-decoration: ${boxData.isUnderline ? 'underline' : 'none'};
        user-select: none;
        z-index: 20;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        overflow: visible;
        word-wrap: break-word;
        white-space: normal;
        line-height: 1.2;
    `;
    textBox.textContent = boxData.text || 'Text Box';
    textBox.contentEditable = true;
    
    const pdfContent = document.getElementById('pdfContent');
    if (pdfContent) {
        pdfContent.appendChild(textBox);
    }
    
    const box = {
        ...boxData,
        element: textBox
    };
    
    sessionState.boxes.push(box);
    makeDraggable(textBox);
    addBoxEditorEventListeners(box);
}

function restoreImageBox(boxData) {
    const imageBox = document.createElement('div');
    imageBox.id = boxData.id;
    imageBox.className = 'draggable-image-box';
    imageBox.style.cssText = `
        position: absolute;
        left: ${boxData.x}px;
        top: ${boxData.y}px;
        width: ${boxData.width}px;
        height: ${boxData.height}px;
        border: 2px dashed #007bff;
        background: rgba(255,255,255,0.2);
        cursor: move;
        z-index: 10;
        overflow: visible;
        min-width: 10px;
        min-height: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    if (boxData.imageUrl) {
        const img = document.createElement('img');
        img.src = boxData.imageUrl;
        img.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            width: 100%;
            height: 100%;
            object-fit: contain;
            object-position: center;
        `;
        imageBox.appendChild(img);
    } else {
        imageBox.innerHTML = '<div style="color: #007bff; font-size: 12px;">Image Box</div>';
    }
    
    const pdfContent = document.getElementById('pdfContent');
    if (pdfContent) {
        pdfContent.appendChild(imageBox);
    }
    
    const box = {
        ...boxData,
        element: imageBox
    };
    
    sessionState.boxes.push(box);
    makeDraggable(imageBox);
    addBoxEditorEventListeners(box);
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Delete key
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (sessionState.selectedBox) {
                deleteSelectedBox();
                e.preventDefault();
            }
        }
        
        // Escape key
        if (e.key === 'Escape') {
            clearAllHighlighting();
            sessionState.selectedBox = null;
        }
        
        // Ctrl+Z (Undo)
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            undoLastAction();
            e.preventDefault();
        }
        
        // Ctrl+Y or Ctrl+Shift+Z (Redo)
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            redoLastAction();
            e.preventDefault();
        }
        
        // Ctrl+D (Duplicate)
        if (e.ctrlKey && e.key === 'd') {
            if (sessionState.selectedBox) {
                duplicateSelectedBox();
                e.preventDefault();
            }
        }
        
        // P key (Preview mode)
        if (e.key === 'p' || e.key === 'P') {
            togglePreviewMode();
            e.preventDefault();
        }
        
        // G key (Toggle grid)
        if (e.key === 'g' || e.key === 'G') {
            toggleGrid();
            e.preventDefault();
        }
    });
    
    console.log('Keyboard shortcuts setup complete');
}

// Context Menu
function showBoxContextMenu(x, y, boxElement) {
    // Remove existing context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 150px;
    `;
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="duplicateSelectedBox(); this.parentElement.remove();" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;">Duplicate</div>
        <div class="context-menu-item" onclick="deleteSelectedBox(); this.parentElement.remove();" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;">Delete</div>
        <div class="context-menu-item" onclick="this.parentElement.remove();" style="padding: 8px 12px; cursor: pointer;">Cancel</div>
    `;
    
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
    });
}

// Cleanup Functions
function cleanupTemporaryFiles() {
    // Clean up any temporary files or URLs
    const tempUrls = document.querySelectorAll('[src^="blob:"]');
    tempUrls.forEach(element => {
        if (element.src.startsWith('blob:')) {
            URL.revokeObjectURL(element.src);
        }
    });
    
    console.log('Temporary files cleaned up');
}

// Auto-cleanup on page unload
window.addEventListener('beforeunload', cleanupTemporaryFiles);
