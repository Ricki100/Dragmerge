// UI Controls - All UI and formatting functionality
// This file contains functions for UI controls, formatting, and user interface management

// UI State Management
let applyMode = 'selected'; // 'all' or 'selected'

// Formatting Functions
function toggleFormatStyle(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    // Check if we have multiple boxes selected - if so, don't apply format all
    if (typeof selectedBoxes !== 'undefined' && selectedBoxes && selectedBoxes.length > 1) {
        console.log('Multiple boxes selected, skipping format all button');
        return;
    }
    
    button.classList.toggle('active');
    if (button.classList.contains('active')) {
        button.style.background = '#007bff';
        button.style.color = 'white';
        button.style.borderColor = '#007bff';
    } else {
        button.style.background = '';
        button.style.color = '';
        button.style.borderColor = '';
    }
    applyLiveFormatting(); // Apply formatting immediately
}

function updateFontDropdowns() {
    // Update font dropdowns with available fonts
    const fontDropdowns = document.querySelectorAll('#formatAllFontFamily, #bindField');
    
    fontDropdowns.forEach(dropdown => {
        if (dropdown && sessionState.availableFonts) {
            // Clear existing options
            dropdown.innerHTML = '';
            
            // Add available fonts
            sessionState.availableFonts.forEach(font => {
                const option = document.createElement('option');
                option.value = font;
                option.textContent = font;
                dropdown.appendChild(option);
            });
        }
    });
}

function formatAllTextBoxes() {
    if (!sessionState.boxes || sessionState.boxes.length === 0) {
        console.log('No boxes to format');
        return;
    }
    
    const settings = getCurrentFormattingSettings();
    console.log('Formatting all text boxes with settings:', settings);
    
    sessionState.boxes.forEach(box => {
        if (box.type === 'text' || box.boxType === 'text') {
            applyFormattingToBox(box, settings);
        }
    });
}

function setApplyMode(mode) {
    applyMode = mode;
    
    // Update button states
    const allBtn = document.getElementById('applyToAllBtn');
    const selectedBtn = document.getElementById('applyToSelectedBtn');
    
    if (allBtn && selectedBtn) {
        if (mode === 'all') {
            allBtn.classList.add('btn-primary');
            allBtn.classList.remove('btn-outline-secondary');
            selectedBtn.classList.add('btn-outline-secondary');
            selectedBtn.classList.remove('btn-primary');
        } else {
            selectedBtn.classList.add('btn-primary');
            selectedBtn.classList.remove('btn-outline-secondary');
            allBtn.classList.add('btn-outline-secondary');
            allBtn.classList.remove('btn-primary');
        }
    }
    
    console.log('Apply mode set to:', mode);
}

function applyLiveFormatting() {
    if (applyMode === 'all') {
        formatAllTextBoxes();
    } else {
        // Apply to selected box only
        if (sessionState.selectedBox) {
            const settings = getCurrentFormattingSettings();
            applyFormattingToBox(sessionState.selectedBox, settings);
        }
    }
}

function getCurrentFormattingSettings() {
    const fontFamily = document.getElementById('formatAllFontFamily')?.value || 'Arial';
    const fontSize = document.getElementById('formatAllFontSize')?.value || '16';
    const textColor = document.getElementById('formatAllTextColor')?.value || '#000000';
    const textAlign = document.getElementById('formatAllTextAlign')?.value || 'center';
    
    // Get text style states
    const boldBtn = document.getElementById('formatAllBold');
    const italicBtn = document.getElementById('formatAllItalic');
    const underlineBtn = document.getElementById('formatAllUnderline');
    
    const isBold = boldBtn?.classList.contains('active') || false;
    const isItalic = italicBtn?.classList.contains('active') || false;
    const isUnderline = underlineBtn?.classList.contains('active') || false;
    
    return {
        fontFamily,
        fontSize: parseInt(fontSize),
        textColor,
        textAlign,
        isBold,
        isItalic,
        isUnderline
    };
}

function setupLiveFormattingListeners() {
    // Font family dropdown
    const fontFamilySelect = document.getElementById('formatAllFontFamily');
    if (fontFamilySelect) {
        fontFamilySelect.addEventListener('change', applyLiveFormatting);
        fontFamilySelect.addEventListener('input', applyLiveFormatting);
    }
    
    // Font size input
    const fontSizeInput = document.getElementById('formatAllFontSize');
    if (fontSizeInput) {
        fontSizeInput.addEventListener('change', applyLiveFormatting);
        fontSizeInput.addEventListener('input', applyLiveFormatting);
    }
    
    // Text color input
    const textColorInput = document.getElementById('formatAllTextColor');
    if (textColorInput) {
        textColorInput.addEventListener('change', applyLiveFormatting);
        textColorInput.addEventListener('input', applyLiveFormatting);
    }
    
    // Text alignment dropdown
    const textAlignSelect = document.getElementById('formatAllTextAlign');
    if (textAlignSelect) {
        textAlignSelect.addEventListener('change', applyLiveFormatting);
        textAlignSelect.addEventListener('input', applyLiveFormatting);
    }
    
    console.log('Live formatting listeners setup complete');
}

// Apply formatting to a specific box
function applyFormattingToBox(box, settings) {
    if (!box || !box.element) return;
    
    const element = box.element;
    
    // Apply font family
    element.style.fontFamily = settings.fontFamily;
    
    // Apply font size
    element.style.fontSize = settings.fontSize + 'px';
    
    // Apply text color
    element.style.color = settings.textColor;
    
    // Apply text alignment
    element.style.textAlign = settings.textAlign;
    
    // Apply text styles
    element.style.fontWeight = settings.isBold ? 'bold' : 'normal';
    element.style.fontStyle = settings.isItalic ? 'italic' : 'normal';
    element.style.textDecoration = settings.isUnderline ? 'underline' : 'none';
    
    // Update box data
    box.fontFamily = settings.fontFamily;
    box.fontSize = settings.fontSize;
    box.textColor = settings.textColor;
    box.textAlign = settings.textAlign;
    box.isBold = settings.isBold;
    box.isItalic = settings.isItalic;
    box.isUnderline = settings.isUnderline;
    
    console.log('Formatting applied to box:', box.id);
}

// UI Toggle Functions
function toggleEditorMode() {
    isEditorMode = !isEditorMode;
    
    const editorSidebar = document.getElementById('editorSidebar');
    if (editorSidebar) {
        editorSidebar.classList.toggle('active', isEditorMode);
    }
    
    // Update button text
    const toggleBtn = document.querySelector('[onclick="toggleEditorMode()"]');
    if (toggleBtn) {
        toggleBtn.textContent = isEditorMode ? 'Exit Editor' : 'Edit Mode';
    }
    
    console.log('Editor mode toggled:', isEditorMode);
}

function togglePreviewMode() {
    isPreviewMode = !isPreviewMode;
    const previewBtn = document.getElementById('previewModeBtn');
    const mainContainer = document.querySelector('.main-container');
    
    if (isPreviewMode) {
        // Enter Preview Mode - Clean view
        previewBtn.textContent = 'Edit Mode';
        previewBtn.className = 'btn btn-outline-primary';
        
        // Add preview mode styling to main container
        mainContainer.classList.add('preview-mode');
        
        // Hide all transform controls
        hideAllTransformControls();
        
        // Clear all highlighting and borders
        clearAllHighlighting();
        
        // Hide grid
        const gridOverlay = document.getElementById('gridOverlay');
        if (gridOverlay) {
            gridOverlay.classList.remove('show');
        }
        
        // Ensure clean preview
        ensureCleanPreview(true);
        
    } else {
        // Exit Preview Mode - Show editing controls
        previewBtn.textContent = 'Preview Mode';
        previewBtn.className = 'btn btn-outline-primary';
        
        // Remove preview mode styling
        mainContainer.classList.remove('preview-mode');
        
        // Show transform controls
        showAllTransformControls();
        
        // Show grid if it was enabled
        if (snapToGridEnabled) {
            const gridOverlay = document.getElementById('gridOverlay');
            if (gridOverlay) {
                gridOverlay.classList.add('show');
            }
        }
    }
    
    console.log('Preview mode toggled:', isPreviewMode);
}

function toggleSnapToGrid() {
    snapToGridEnabled = !snapToGridEnabled;
    console.log('Snap to grid:', snapToGridEnabled ? 'enabled' : 'disabled');
}

function toggleGrid() {
    const gridOverlay = document.getElementById('gridOverlay');
    if (gridOverlay) {
        gridOverlay.classList.toggle('show');
    }
    
    const gridBtn = document.getElementById('gridBtn');
    if (gridBtn) {
        gridBtn.style.background = gridOverlay.classList.contains('show') ? 
            'rgba(0, 123, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)';
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

function toggleInteractionMode(useCanvas = true) {
    if (useCanvas) {
        // Switch to canvas mode
        document.querySelectorAll('.draggable-text-box, .draggable-image-box').forEach(box => {
            box.style.display = 'none';
        });
        if (canvasInteractionSystem) {
            canvasInteractionSystem.canvas.style.display = 'block';
            canvasInteractionSystem.draw();
        }
    } else {
        // Switch to DOM mode
        document.querySelectorAll('.draggable-text-box, .draggable-image-box').forEach(box => {
            box.style.display = 'block';
        });
        if (canvasInteractionSystem) {
            canvasInteractionSystem.canvas.style.display = 'none';
        }
    }
}

// Button State Management
function updateDownloadButtonState() {
    const hasTemplate = sessionState.templatePdfBytes !== null;
    const hasCSV = sessionState.csvRows.length > 0;
    const hasBoxes = sessionState.boxes.length > 0;
    const boxCount = sessionState.boxes.length;
    
    const downloadBtn = document.getElementById('downloadPdfsBtn');
    const screenshotBtn = document.getElementById('screenshotBtn');
    
    if (downloadBtn) {
        if (hasTemplate && hasCSV && hasBoxes) {
            downloadBtn.disabled = false;
            downloadBtn.textContent = `📦 Download All PDFs (ZIP) - ${sessionState.csvRows.length} records`;
        } else {
            downloadBtn.disabled = true;
            let reason = '';
            if (!hasTemplate) reason += 'PDF template, ';
            if (!hasCSV) reason += 'CSV data, ';
            if (!hasBoxes) reason += 'text/image boxes';
            downloadBtn.textContent = `📦 Download All PDFs (ZIP) - Missing: ${reason.slice(0, -2)}`;
        }
    }
    
    if (screenshotBtn) {
        screenshotBtn.disabled = !hasTemplate;
    }
    
    console.log('Download button state updated:', {
        hasTemplate,
        hasCSV,
        hasBoxes,
        boxCount
    });
}

function updateCreateRecordsButtonState() {
    // This function is kept for compatibility but does nothing
    // Record creation is now handled automatically
}

function updateEditorButtonStates(enabled) {
    const editorButtons = document.querySelectorAll('#editorSidebar button, #editorSidebar input, #editorSidebar select, #editorSidebar textarea');
    editorButtons.forEach(button => {
        button.disabled = !enabled;
    });
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
        undoBtn.disabled = undoStack.length === 0;
    }
    
    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
    }
}

// Display and Info Updates
function updateRecordsInfo() {
    // This function is kept for compatibility but does nothing
    // Records info is now handled by the page navigation system
}

function updateRecordDisplay() {
    // Update the display of current record information
    const recordInfoDisplay = document.getElementById('recordInfoDisplay');
    if (recordInfoDisplay && sessionState.csvRows && sessionState.csvRows.length > 0) {
        const currentRecordIndex = currentPage * recordsPerPage;
        const record = sessionState.csvRows[currentRecordIndex];
        
        if (record) {
            recordInfoDisplay.style.display = 'block';
            recordInfoDisplay.innerHTML = `
                <div style="font-size: 14px; color: #2c3e50; font-weight: 600; letter-spacing: 0.2px; text-align: center; width: 100%;">
                    Record ${currentRecordIndex + 1} of ${sessionState.csvRows.length}
                </div>
            `;
        }
    }
}

function updateRecordInfo() {
    // This function is kept for compatibility but does nothing
    // Record info is now handled by the page navigation system
}

async function updateTextBoxMappingDisplay() {
    // Update the display of text box mappings
    if (!sessionState.boxes || sessionState.boxes.length === 0) {
        return;
    }
    
    console.log('Updating text box mapping display...');
    
    // This would update any UI elements showing box mappings
    // Implementation depends on specific UI requirements
}

// Font Management
function updateFontDropdown() {
    // Update font dropdown with available fonts
    const fontDropdown = document.getElementById('formatAllFontFamily');
    if (fontDropdown && sessionState.availableFonts) {
        // Clear existing options
        fontDropdown.innerHTML = '';
        
        // Add available fonts
        sessionState.availableFonts.forEach(font => {
            const option = document.createElement('option');
            option.value = font;
            option.textContent = font;
            fontDropdown.appendChild(option);
        });
        
        // Set default font
        if (sessionState.defaultFontFamily) {
            fontDropdown.value = sessionState.defaultFontFamily;
        }
    }
}

function updateTextBoxFont(box) {
    // Update font for a specific text box
    if (!box || !box.element) return;
    
    const fontFamily = box.fontFamily || sessionState.defaultFontFamily || 'Arial';
    const fontSize = box.fontSize || 16;
    
    box.element.style.fontFamily = fontFamily;
    box.element.style.fontSize = fontSize + 'px';
    
    console.log('Font updated for box:', box.id, fontFamily, fontSize);
}

// Clean Preview Functions
function ensureCleanPreview(hideBorders = true) {
    // Ensure clean preview by hiding UI elements
    const boxes = document.querySelectorAll('.draggable-text-box, .draggable-image-box');
    boxes.forEach(box => {
        if (hideBorders) {
            box.style.border = 'none';
            box.style.boxShadow = 'none';
        } else {
            // Restore borders
            if (box.classList.contains('draggable-text-box')) {
                box.style.border = '1px solid #28a745';
            } else if (box.classList.contains('draggable-image-box')) {
                box.style.border = '2px dashed #007bff';
            }
        }
    });
}

// Page Navigation
function updatePageNavigation() {
    if (!sessionState.csvRows || sessionState.csvRows.length === 0) {
        recordsPerPage = 4; // Default
        totalPages = 1;
        currentPage = 0;
        return;
    }
    
    const boxCount = parseInt(document.getElementById('boxCountSelect')?.value || '4');
    recordsPerPage = boxCount;
    totalPages = Math.ceil(sessionState.csvRows.length / recordsPerPage);
    currentPage = Math.min(currentPage, totalPages - 1);
    
    // Update page info display
    const pageInfo = document.getElementById('pageInfo');
    const pageRecordsInfo = document.getElementById('pageRecordsInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
    }
    
    if (pageRecordsInfo) {
        const startRecord = currentPage * recordsPerPage + 1;
        const endRecord = Math.min((currentPage + 1) * recordsPerPage, sessionState.csvRows.length);
        pageRecordsInfo.textContent = `Records ${startRecord}-${endRecord}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 0;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages - 1;
    }
    
    console.log('Page navigation updated:', {
        currentPage,
        totalPages,
        recordsPerPage,
        totalRecords: sessionState.csvRows.length
    });
}

// Page Navigation Functions
async function previousPage() {
    if (currentPage > 0) {
        currentPage--;
        updatePageNavigation();
        updateRecordDisplay();
        await updateAllBoxesWithCSVData();
        console.log('Navigated to previous page:', currentPage);
    }
}

async function nextPage() {
    if (currentPage < totalPages - 1) {
        currentPage++;
        updatePageNavigation();
        updateRecordDisplay();
        await updateAllBoxesWithCSVData();
        console.log('Navigated to next page:', currentPage);
    }
}
