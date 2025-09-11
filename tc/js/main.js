// Main - Application initialization and global setup
// This file contains the main application initialization, global variables, and DOM setup

// Global Variables and State Management
let currentPdf = null;
let currentFile = null;
let serverPdfUrl = null;
let currentRecord = 0;
let csvData = null;
let editorCanvas = null;
let pdfViewer = null;
let pdfContent = null;
let pdfLocked = true;
let isEditorMode = false;
let isPreviewMode = false;
let currentTransform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let snapToGridEnabled = false;
let snapGuides = [];
let boxCounter = 0;
let currentBoxId = null;
let selectedBoxes = [];
let canvasInteractionSystem = null;
let undoStack = [];
let redoStack = [];
let applyMode = 'selected';
let recordsPerPage = 4;
let totalPages = 1;
let currentPage = 0;

// Font management system
let availableFonts = ['Arial', 'Times New Roman', 'Helvetica', 'Georgia', 'Verdana', 'Courier New'];
let loadedFonts = {};
let defaultFontFamily = 'Arial';

// Session state management
let sessionState = {
    templatePdf: null,
    templatePdfBytes: null,
    csv: null,
    csvRows: [],
    layout: null,
    boxes: [],
    selectedBox: null,
    // File metadata for change detection
    pdfMetadata: null,
    csvMetadata: null,
    // Live file monitoring
    liveMonitoringEnabled: false,
    // Font management
    availableFonts: [...availableFonts],
    defaultFontFamily: 'Arial'
};

// Initialize sessionState fonts
if (!sessionState.availableFonts) {
    sessionState.availableFonts = [...availableFonts];
}
if (!sessionState.defaultFontFamily) {
    sessionState.defaultFontFamily = 'Arial';
}

// Main Application Initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    
    // Initialize core systems
    initializeCoreSystems();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize UI components
    initializeUIComponents();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Initialize PDF.js
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        console.log('PDF.js initialized');
    } else {
        console.error('PDF.js library not loaded');
    }
    
    // Initialize undo/redo system
    initializeUndoSystem();
    
    // Initialize font handling
    initializeFontHandling();
    
    // Setup file change monitoring
    setupFileChangeMonitoring();
    
    // Initialize live file monitoring controls
    setupLiveFileMonitoringControls();
    
    console.log('Application initialization complete');
});

// Core System Initialization
function initializeCoreSystems() {
    // Initialize page navigation with default values (4 boxes per page)
    updatePageNavigation();
    
    // Initialize canvas interaction system
    canvasInteractionSystem = new CanvasInteractionSystem();
    
    // Enable canvas mode by default
    setTimeout(() => {
        toggleInteractionMode(true);
    }, 1000);
    
    // Ensure record info display is hidden initially
    const recordInfoDisplay = document.getElementById('recordInfoDisplay');
    if (recordInfoDisplay) {
        recordInfoDisplay.style.display = 'none';
    }
    
    // Show all transform controls by default
    setTimeout(() => {
        showAllTransformControls();
    }, 100);
    
    console.log('Core systems initialized');
}

// Event Listeners Setup
function setupEventListeners() {
    // Set up PDF file input event listener
    const pdfFileInput = document.getElementById('pdfFile');
    if (pdfFileInput) {
        pdfFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                currentFile = file;
                document.getElementById('fileLabel').textContent = file.name;
                  
                  // Store file metadata for change detection
                  sessionState.pdfMetadata = {
                      name: file.name,
                      lastModified: file.lastModified,
                      size: file.size
                  };
                 
                // Hide download link
                document.getElementById('downloadLink').style.display = 'none';
                serverPdfUrl = null;

                // Automatically load and preview the PDF
                loadPdf(file);
            }
        });
        console.log('PDF file input event listener set up');
    } else {
        console.error('PDF file input element not found');
    }
    
    // Set up CSV file input event listener
    const csvFileInput = document.getElementById('csvFile');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', function(e) {
            console.log('CSV file selected:', e.target.files[0]);
            const file = e.target.files[0];
            if (file) {
                console.log('CSV file selected:', file.name, file.size);
                
                // Store file metadata for change detection
                sessionState.csvMetadata = {
                    name: file.name,
                    lastModified: file.lastModified,
                    size: file.size
                };
                
                parseCSVFile(file);
            } else {
                console.log('No CSV file selected');
            }
        });
        console.log('CSV file input event listener set up');
    } else {
        console.error('CSV file input element not found');
    }
    
    // Set up drag and drop support
    const uploadArea = document.querySelector('.sidebar');
    const fileInput = document.getElementById('pdfFile');
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.style.backgroundColor = '#e3f2fd';
        });

        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            uploadArea.style.backgroundColor = '';
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.style.backgroundColor = '';
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                fileInput.files = files;
                currentFile = files[0];
                document.getElementById('fileLabel').textContent = files[0].name;
                 
                 // Store file metadata for change detection
                 sessionState.pdfMetadata = {
                     name: files[0].name,
                     lastModified: files[0].lastModified,
                     size: files[0].size
                 };
                
                // Hide download link
                document.getElementById('downloadLink').style.display = 'none';
                serverPdfUrl = null;

                // Automatically load and preview the PDF
                loadPdf(files[0]);
            }
        });
        console.log('Drag and drop support set up');
    } else {
        console.error('Upload area or file input not found for drag and drop');
    }
    
    // Initialize snap-to-grid toggle
    const snapToGridToggle = document.getElementById('snapToGridToggle');
    if (snapToGridToggle) {
        snapToGridToggle.addEventListener('change', function() {
            snapToGridEnabled = this.checked;
            console.log('Snap to grid:', snapToGridEnabled ? 'enabled' : 'disabled');
        });
        console.log('Snap-to-grid toggle set up');
    } else {
        console.log('Snap-to-grid toggle not found (element may not exist)');
    }
    
    console.log('Event listeners setup complete');
}

// UI Components Initialization
function initializeUIComponents() {
    // Initialize alignment dropdown to center by default
    const alignmentSelect = document.getElementById('formatAllTextAlign');
    if (alignmentSelect) {
        alignmentSelect.value = 'center';
    }
    
    // Add comprehensive event listeners for live formatting
    setupLiveFormattingListeners();

    // Bold button
    const boldBtn = document.getElementById('formatAllBold');
    if (boldBtn) {
        boldBtn.addEventListener('click', function() {
            // Check if we have multiple boxes selected - if so, don't apply format all
            if (typeof selectedBoxes !== 'undefined' && selectedBoxes && selectedBoxes.length > 1) {
                console.log('Multiple boxes selected, skipping format all bold button');
                return;
            }
            
            this.classList.toggle('active');
            if (this.classList.contains('active')) {
                this.style.background = '#007bff';
                this.style.color = 'white';
                this.style.borderColor = '#007bff';
            } else {
                this.style.background = '';
                this.style.color = '';
                this.style.borderColor = '';
            }
            applyLiveFormatting(); // Apply formatting immediately
        });
    }

    // Italic button
    const italicBtn = document.getElementById('formatAllItalic');
    if (italicBtn) {
        italicBtn.addEventListener('click', function() {
            // Check if we have multiple boxes selected - if so, don't apply format all
            if (typeof selectedBoxes !== 'undefined' && selectedBoxes && selectedBoxes.length > 1) {
                console.log('Multiple boxes selected, skipping format all italic button');
                return;
            }
            
            this.classList.toggle('active');
            if (this.classList.contains('active')) {
                this.style.background = '#007bff';
                this.style.color = 'white';
                this.style.borderColor = '#007bff';
            } else {
                this.style.background = '';
                this.style.color = '';
                this.style.borderColor = '';
            }
            applyLiveFormatting(); // Apply formatting immediately
        });
    }

    // Underline button
    const underlineBtn = document.getElementById('formatAllUnderline');
    if (underlineBtn) {
        underlineBtn.addEventListener('click', function() {
            // Check if we have multiple boxes selected - if so, don't apply format all
            if (typeof selectedBoxes !== 'undefined' && selectedBoxes && selectedBoxes.length > 1) {
                console.log('Multiple boxes selected, skipping format all underline button');
                return;
            }
            
            this.classList.toggle('active');
            if (this.classList.contains('active')) {
                this.style.background = '#007bff';
                this.style.color = 'white';
                this.style.borderColor = '#007bff';
            } else {
                this.style.background = '';
                this.style.color = '';
                this.style.borderColor = '';
            }
            applyLiveFormatting(); // Apply formatting immediately
        });
    }
    
    console.log('UI components initialized');
}

// Font Handling Initialization
function initializeFontHandling() {
    // Font upload area
    const fontUploadArea = document.getElementById('fontUploadArea');
    const fontUploadInput = document.getElementById('fontUploadInput');
    const fontUploadStatus = document.getElementById('fontUploadStatus');
    
    if (fontUploadArea && fontUploadInput) {
        // Click to upload
        fontUploadArea.addEventListener('click', () => {
            fontUploadInput.click();
        });
        
        // File input change
        fontUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFontUpload(file);
            }
        });
        
        // Drag and drop
        fontUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fontUploadArea.classList.add('dragover');
        });
        
        fontUploadArea.addEventListener('dragleave', () => {
            fontUploadArea.classList.remove('dragover');
        });
        
        fontUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fontUploadArea.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.ttf') || file.name.endsWith('.otf'))) {
                handleFontUpload(file);
            }
        });
    }
    
    // Google Font URL input
    const googleFontInput = document.getElementById('googleFontInput');
    const googleFontBtn = document.getElementById('googleFontBtn');
    
    if (googleFontInput && googleFontBtn) {
        googleFontBtn.addEventListener('click', () => {
            const url = googleFontInput.value.trim();
            if (url) {
                handleGoogleFontUrl(url);
            }
        });
        
        googleFontInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const url = googleFontInput.value.trim();
                if (url) {
                    handleGoogleFontUrl(url);
                }
            }
        });
    }
    
    console.log('Font handling initialized');
}

// File Change Monitoring
function setupFileChangeMonitoring() {
    // Set up file change monitoring for live updates
    if (sessionState.liveMonitoringEnabled) {
        checkForFileChanges();
    }
}

function checkForFileChanges() {
    // Check for file changes periodically
    setInterval(() => {
        if (sessionState.liveMonitoringEnabled) {
            // Implementation for checking file changes
            console.log('Checking for file changes...');
        }
    }, 5000); // Check every 5 seconds
}

function setupLiveFileMonitoringControls() {
    // Set up live file monitoring controls
    const fileControls = document.getElementById('fileControls');
    if (fileControls) {
        const liveMonitoringDiv = document.createElement('div');
        liveMonitoringDiv.innerHTML = `
            <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; font-size: 12px;">Live File Monitoring</h4>
                <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;">
                    <input type="checkbox" id="enableLiveMonitoring">
                    Monitor files for changes
                </label>
                <button id="refreshFilesBtn" class="btn btn-sm btn-outline-secondary" style="margin-top: 8px; font-size: 10px;">
                    Refresh Files
                </button>
                <p style="margin: 5px 0 0 0; font-size: 10px; color: #666;">
                    Automatically reload files when they change on disk
                </p>
            </div>
        `;
        
        fileControls.appendChild(liveMonitoringDiv);
        
        // Add event listeners
        document.getElementById('enableLiveMonitoring').addEventListener('change', function(e) {
            sessionState.liveMonitoringEnabled = e.target.checked;
            console.log('Live monitoring:', e.target.checked ? 'enabled' : 'disabled');
        });
        
        document.getElementById('refreshFilesBtn').addEventListener('click', function() {
            refreshFilesForLiveMonitoring();
        });
    }
}

function refreshFilesForLiveMonitoring() {
    // Refresh files for live monitoring
    console.log('Refreshing files for live monitoring...');
    
    // Implementation for refreshing files
    if (sessionState.pdfMetadata) {
        console.log('Refreshing PDF file...');
        // Reload PDF if it has changed
    }
    
    if (sessionState.csvMetadata) {
        console.log('Refreshing CSV file...');
        // Reload CSV if it has changed
    }
}

// Application Status and Logging
function logApplicationStatus() {
    console.log('=== APPLICATION STATUS ===');
    console.log('PDF loaded:', !!currentPdf);
    console.log('CSV loaded:', !!sessionState.csvRows.length);
    console.log('Boxes created:', sessionState.boxes.length);
    console.log('Current record:', currentRecord);
    console.log('Preview mode:', isPreviewMode);
    console.log('Editor mode:', isEditorMode);
    console.log('Snap to grid:', snapToGridEnabled);
    console.log('========================');
}

// Export status for debugging
window.getApplicationStatus = logApplicationStatus;
window.sessionState = sessionState;
window.currentPdf = () => currentPdf;
window.currentFile = () => currentFile;
