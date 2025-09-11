 // Initialize PDF.js
 pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

 let currentPdf = null;
 let currentFile = null;
 let serverPdfUrl = null;

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
     liveMonitoringEnabled: false
 };

 // Enhanced box management system
 let boxCounter = 0;
 let currentBoxId = null;
 
 // Font management system
 let availableFonts = ['Arial', 'Times New Roman', 'Helvetica', 'Georgia', 'Verdana', 'Courier New'];
// Initialize sessionState fonts
if (!sessionState.availableFonts) {
sessionState.availableFonts = [...availableFonts];
}
if (!sessionState.defaultFontFamily) {
sessionState.defaultFontFamily = 'Arial';
}
 let loadedFonts = {};
 let defaultFontFamily = 'Arial';
 
 // CSV data management
 let currentRecord = 0;
 let csvData = null;

 // Editor canvas management
 let editorCanvas = null;
 
 // PDF viewer management
 let pdfViewer = null;
 let pdfContent = null;
 let pdfLocked = true; // PDF is locked by default when uploaded
 let isEditorMode = false;
 
 // PDF transform management
 let currentTransform = { x: 0, y: 0, scale: 1 };
 
 // PDF dragging state
 let isDragging = false;
 let lastMousePos = { x: 0, y: 0 };


 
 // Initialize editor canvas
 function initEditorCanvas() {
     if (editorCanvas) return; // Already initialized
     
     const canvasElement = document.getElementById('editorCanvas');
     if (!canvasElement) {
         console.error('Editor canvas element not found');
         return;
     }
     
     // Set canvas size to match PDF viewer
     const pdfViewer = document.getElementById('pdfViewer');
     if (pdfViewer) {
         const rect = pdfViewer.getBoundingClientRect();
         canvasElement.width = rect.width;
         canvasElement.height = rect.height;
     }
     
     // Initialize Fabric.js canvas
     editorCanvas = new fabric.Canvas('editorCanvas', {
         selection: true,
         preserveObjectStacking: true
     });
     
     // Set canvas position to overlay PDF
     canvasElement.style.position = 'absolute';
     canvasElement.style.top = '20px';
     canvasElement.style.left = '20px';
     canvasElement.style.pointerEvents = 'auto';
     canvasElement.style.zIndex = '15';
     
     // Make canvas visible when in editor mode
     canvasElement.style.display = 'block';
     
     // Set Fabric.js canvas dimensions to match
     editorCanvas.setDimensions({
         width: canvasElement.width,
         height: canvasElement.height
     });
     
     console.log('Editor canvas initialized');
 }

// File input handler - will be set up in DOMContentLoaded



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
         


         // Enable Generate From Template button
         // generateFromTemplateBtn was removed
         
         // Enable Download PDFs button if CSV and boxes are also loaded
         updateDownloadButtonState();
         
         // Update records info
         updateRecordsInfo();

         // Render the page (always page 1 for single-page PDFs)
         await renderPage(1);

         // Initialize simple editor after PDF is loaded
         initEditor();

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

         // Set canvas dimensions to high-resolution size
         canvas.width = viewport.width;
         canvas.height = viewport.height;
         
         // Set canvas display size to fit viewer (this creates the crisp effect)
         canvas.style.width = (baseViewport.width * displayScale) + 'px';
         canvas.style.height = (baseViewport.height * displayScale) + 'px';

         // Make sure canvas is visible
         canvas.style.display = 'block';

         // Render page at original quality
         const renderContext = {
             canvasContext: context,
             viewport: viewport
         };

         // Store the render task so it can be cancelled if needed
         window.currentRenderTask = page.render(renderContext);
         await window.currentRenderTask.promise;

         console.log('PDF page rendered successfully at high resolution');
         
         // Show quality indicator
         const qualityIndicator = document.getElementById('qualityIndicator');
         if (qualityIndicator) {
             qualityIndicator.classList.add('show');
             setTimeout(() => {
                 qualityIndicator.classList.remove('show');
             }, 3000);
         }

         // Debug canvas visibility after rendering
         const canvasRect = canvas.getBoundingClientRect();
         console.log('Canvas rendered successfully!');
         console.log('Canvas bounding rect:', canvasRect);
         console.log('Canvas computed styles:', {
             position: getComputedStyle(canvas).position,
             top: getComputedStyle(canvas).top,
             left: getComputedStyle(canvas).left,
             width: getComputedStyle(canvas).width,
             height: getComputedStyle(canvas).height,
             zIndex: getComputedStyle(canvas).zIndex,
             display: getComputedStyle(canvas).display,
             visibility: getComputedStyle(canvas).visibility
         });

         // Update editor canvas size to match the rendered PDF
         if (typeof editorCanvas !== 'undefined' && editorCanvas) {
             updateEditorPageSize();
         }

         console.log('PDF rendered at original quality:', viewport.width, 'x', viewport.height);

     } catch (error) {
         console.error('Error rendering page:', error);
     }
 }
 
 // Update editor canvas size to match PDF
 function updateEditorPageSize() {
     if (!editorCanvas) return;
     
     const canvas = document.getElementById('viewer');
     const canvasElement = document.getElementById('editorCanvas');
     
     if (canvas && canvasElement) {
         // Get the display size of the PDF canvas
         const displayWidth = parseInt(canvas.style.width) || canvas.width;
         const displayHeight = parseInt(canvas.style.height) || canvas.height;
         
         // Update editor canvas size to match
         canvasElement.width = displayWidth;
         canvasElement.height = displayHeight;
         
         // Update Fabric.js canvas dimensions
         editorCanvas.setDimensions({
             width: displayWidth,
             height: displayHeight
         });
         
         // Re-render the canvas
         editorCanvas.renderAll();
         
         console.log('Editor canvas resized to:', displayWidth, 'x', displayHeight);
     }
 }

// Drag and drop support - will be set up in DOMContentLoaded


 
// Initialize snap-to-grid toggle - will be set up in DOMContentLoaded
 
 // Function to update download button state
 function updateDownloadButtonState() {
     const hasTemplate = sessionState.templatePdfBytes !== null;
     const hasCSV = sessionState.csvRows.length > 0;
     const hasBoxes = sessionState.boxes.length > 0;
     const boxCount = sessionState.boxes.length;
     
     const downloadBtn = document.getElementById('downloadPdfsBtn');
     const messageDiv = document.getElementById('downloadPdfsMessage');
     
     console.log('updateDownloadButtonState called:', {
         hasTemplate,
         hasCSV,
         hasBoxes,
         boxCount,
         shouldDisable: !(hasTemplate && hasCSV && hasBoxes) || boxCount > 1
     });
     
     if (downloadBtn) {
         // Enable "Download PDFs" button when all requirements are met
         // Allow bulk PDF generation with multiple boxes for zip download
         const shouldDisable = !(hasTemplate && hasCSV && hasBoxes);
         downloadBtn.disabled = shouldDisable;
         
         // Update button text to indicate status
         if (!(hasTemplate && hasCSV && hasBoxes)) {
             downloadBtn.title = 'Requires template PDF, CSV data, and at least one box.';
         } else {
             downloadBtn.title = `Download all ${sessionState.csvRows.length} PDFs in a zip file`;
         }
     }
     
     // Hide the message about multiple boxes (removed as requested)
     if (messageDiv) {
             messageDiv.style.display = 'none';
     }
 }
 

 
 // Function to update PDF area outline (disabled - outline is hidden)
 function updatePdfAreaOutline() {
     const outline = document.getElementById('pdfAreaOutline');
     
     if (!outline) return;
     
     // Always keep the outline hidden
     outline.style.display = 'none !important';
     outline.style.visibility = 'hidden';
     
     console.log('PDF area outline is disabled and hidden');
 }
 
 // Update outline when zoom changes
 function updateOutlineOnZoom() {
     setTimeout(updatePdfAreaOutline, 100); // Small delay to ensure zoom is applied
 }
 
 // Field Selection Modal
 function showFieldSelectionModal(csvColumns, boxCount, boxType) {
     return new Promise((resolve) => {
         // Create modal overlay
         const modalOverlay = document.createElement('div');
         modalOverlay.style.cssText = `
             position: fixed;
             top: 0;
             left: 0;
             width: 100%;
             height: 100%;
             background: rgba(0, 0, 0, 0.5);
             display: flex;
             align-items: center;
             justify-content: center;
             z-index: 10000;
         `;

         // Create modal content
         const modalContent = document.createElement('div');
         modalContent.style.cssText = `
             background: white;
             padding: 30px;
             border-radius: 10px;
             box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
             max-width: 400px;
             width: 90%;
             text-align: center;
         `;

         // Create title
         const title = document.createElement('h3');
         title.textContent = `Select CSV Field for ${boxCount} ${boxType === 'text' ? 'Text' : 'Image'} Boxes`;
         title.style.cssText = `
             margin: 0 0 20px 0;
             color: #333;
             font-size: 18px;
         `;

         // Create description
         const description = document.createElement('p');
         description.textContent = `Choose which CSV field to use for all ${boxCount} boxes:`;
         description.style.cssText = `
             margin: 0 0 20px 0;
             color: #666;
             font-size: 14px;
         `;
         


         // Create dropdown
         const dropdown = document.createElement('select');
         dropdown.style.cssText = `
             width: 100%;
             padding: 12px;
             border: 2px solid #ddd;
             border-radius: 6px;
             font-size: 16px;
             margin-bottom: 20px;
             background: white;
         `;

         // Add default option
         const defaultOption = document.createElement('option');
         defaultOption.value = '';
         defaultOption.textContent = '-- Select a field --';
         defaultOption.disabled = true;
         defaultOption.selected = true;
         dropdown.appendChild(defaultOption);

         // Add CSV columns as options
         csvColumns.forEach(column => {
             const option = document.createElement('option');
             option.value = column;
             option.textContent = column;
             dropdown.appendChild(option);
         });

         // Create button container
         const buttonContainer = document.createElement('div');
         buttonContainer.style.cssText = `
             display: flex;
             gap: 10px;
             justify-content: center;
         `;

         // Create OK button
         const okButton = document.createElement('button');
         okButton.textContent = 'Create Boxes';
         okButton.style.cssText = `
             padding: 10px 20px;
             background: #007bff;
             color: white;
             border: none;
             border-radius: 5px;
             cursor: pointer;
             font-size: 14px;
         `;
         okButton.onclick = () => {
             const selectedValue = dropdown.value;
             if (selectedValue) {
                 modalOverlay.remove();
                 resolve(selectedValue);
             } else {
                 alert('Please select a field first.');
             }
         };

         // Create Cancel button
         const cancelButton = document.createElement('button');
         cancelButton.textContent = 'Cancel';
         cancelButton.style.cssText = `
             padding: 10px 20px;
             background: #6c757d;
             color: white;
             border: none;
             border-radius: 5px;
             cursor: pointer;
             font-size: 14px;
         `;
         cancelButton.onclick = () => {
             modalOverlay.remove();
             resolve(null);
         };

         // Add hover effects
         okButton.onmouseover = () => okButton.style.background = '#0056b3';
         okButton.onmouseout = () => okButton.style.background = '#007bff';
         cancelButton.onmouseover = () => cancelButton.style.background = '#545b62';
         cancelButton.onmouseout = () => cancelButton.style.background = '#6c757d';

         // Assemble modal
         buttonContainer.appendChild(okButton);
         buttonContainer.appendChild(cancelButton);
         modalContent.appendChild(title);
         modalContent.appendChild(description);
         modalContent.appendChild(dropdown);
         modalContent.appendChild(buttonContainer);
         modalOverlay.appendChild(modalContent);

         // Add to page
         document.body.appendChild(modalOverlay);

         // Focus on dropdown
         dropdown.focus();

         // Handle Enter key
         dropdown.onkeydown = (e) => {
             if (e.key === 'Enter' && dropdown.value) {
                 okButton.click();
             }
         };
     });
 }

 // Toggle Format Style Function
 function toggleFormatStyle(buttonId) {
     const button = document.getElementById(buttonId);
     if (button) {
         button.classList.toggle('active');
         button.style.background = button.classList.contains('active') ? '#007bff' : '';
         button.style.color = button.classList.contains('active') ? 'white' : '';
     }
 }

 // Update Font Dropdowns Function
 function updateFontDropdowns() {
     const fontSelects = [
         document.getElementById('formatAllFontFamily'),
         document.getElementById('boxFontFamily')
     ];
     
     fontSelects.forEach(select => {
         if (select) {
             // Store current selection
             const currentValue = select.value;
             
             // Clear existing options
             select.innerHTML = '';
             
             // Add all available fonts
             sessionState.availableFonts.forEach(fontName => {
                 const option = document.createElement('option');
                 option.value = fontName;
                 option.textContent = fontName;
                 select.appendChild(option);
             });
             
             // Restore selection if it still exists, otherwise use default
             if (sessionState.availableFonts.includes(currentValue)) {
                 select.value = currentValue;
             } else if (sessionState.defaultFontFamily && sessionState.availableFonts.includes(sessionState.defaultFontFamily)) {
                 select.value = sessionState.defaultFontFamily;
             }
         }
     });
 }

 // Format All Text Boxes Function
 function formatAllTextBoxes() {
     const textBoxes = sessionState.boxes.filter(box => box.boxType === 'text');
     
     if (textBoxes.length === 0) {
         alert('No text boxes found to format.');
         return;
     }
     
     // Get formatting values from the form
     const fontFamily = document.getElementById('formatAllFontFamily').value;
     const fontSize = document.getElementById('formatAllFontSize').value;
     const textColor = document.getElementById('formatAllTextColor').value;
     const textAlign = document.getElementById('formatAllTextAlign').value;
     
     // Get text style states
     const boldBtn = document.getElementById('formatAllBold');
     const italicBtn = document.getElementById('formatAllItalic');
     const underlineBtn = document.getElementById('formatAllUnderline');
     
     const isBold = boldBtn.classList.contains('active');
     const isItalic = italicBtn.classList.contains('active');
     const isUnderline = underlineBtn.classList.contains('active');

     // Apply formatting to all text boxes
     textBoxes.forEach(box => {
         if (box.element) {
             const element = box.element;
             
             // Update element styles with proper font family formatting
             element.style.fontFamily = `'${fontFamily}', Arial, sans-serif`;
             element.style.fontSize = fontSize + 'px';
             element.style.color = textColor;
             element.style.textAlign = textAlign;
             
             // Apply text styles
             element.style.fontWeight = isBold ? 'bold' : 'normal';
             element.style.fontStyle = isItalic ? 'italic' : 'normal';
             element.style.textDecoration = isUnderline ? 'underline' : 'none';
             
             // Update box data in session state
             box.fontFamily = fontFamily;
             box.fontSize = parseInt(fontSize);
             box.color = textColor;
             box.textAlign = textAlign;
             box.bold = isBold;
             box.italic = isItalic;
             box.underline = isUnderline;
         }
     });

     // Show success message
     alert(`Applied formatting to ${textBoxes.length} text box(es)!`);
 }

 // Global variable for apply mode (default: selected only)
 let applyMode = 'selected';

 // Function to set apply mode (all boxes vs selected only)
 function setApplyMode(mode) {
     applyMode = mode;
     
     // Update button styles
     const allBtn = document.getElementById('applyToAllBtn');
     const selectedBtn = document.getElementById('applyToSelectedBtn');
     
     if (allBtn && selectedBtn) {
         if (mode === 'all') {
             allBtn.className = 'btn btn-sm btn-primary';
             selectedBtn.className = 'btn btn-sm btn-outline-secondary';
         } else {
             allBtn.className = 'btn btn-sm btn-outline-secondary';
             selectedBtn.className = 'btn btn-sm btn-primary';
         }
     }
 }

 // Function to apply live formatting instantly
 function applyLiveFormatting() {
     console.log('applyLiveFormatting called');
     
     // Check if we have multiple boxes selected - if so, don't apply format all
     if (typeof selectedBoxes !== 'undefined' && selectedBoxes && selectedBoxes.length > 1) {
         console.log('Multiple boxes selected, skipping applyLiveFormatting to avoid conflicts');
         return;
     }
     
     // Get formatting values from the form
     const fontFamily = document.getElementById('formatAllFontFamily').value;
     const fontSize = document.getElementById('formatAllFontSize').value;
     const textColor = document.getElementById('formatAllTextColor').value;
     const textAlign = document.getElementById('formatAllTextAlign').value;
     
     // Get text style states
     const boldBtn = document.getElementById('formatAllBold');
     const italicBtn = document.getElementById('formatAllItalic');
     const underlineBtn = document.getElementById('formatAllUnderline');
     
     const isBold = boldBtn.classList.contains('active');
     const isItalic = italicBtn.classList.contains('active');
     const isUnderline = underlineBtn.classList.contains('active');
     
     console.log('Style states:', { isBold, isItalic, isUnderline });

     // Determine which boxes to format based on apply mode
     let boxesToFormat = [];
     if (applyMode === 'all') {
         boxesToFormat = sessionState.boxes.filter(box => box.boxType === 'text');
     } else {
         // Format only selected box
         if (sessionState.selectedBox && sessionState.selectedBox.boxType === 'text') {
             boxesToFormat = [sessionState.selectedBox];
         }
     }

     if (boxesToFormat.length === 0) {
         return; // No boxes to format
     }

     // Apply formatting to the determined boxes
     boxesToFormat.forEach(box => {
         if (box.element) {
             const element = box.element;
             
             // Update element styles with proper font family formatting
             element.style.fontFamily = `'${fontFamily}', Arial, sans-serif`;
             element.style.fontSize = fontSize + 'px';
             element.style.color = textColor;
             element.style.textAlign = textAlign;
             
             // Apply text styles
             element.style.fontWeight = isBold ? 'bold' : 'normal';
             element.style.fontStyle = isItalic ? 'italic' : 'normal';
             element.style.textDecoration = isUnderline ? 'underline' : 'none';
             
             // Update box data in session state
             box.fontFamily = fontFamily;
             box.fontSize = parseInt(fontSize);
             box.color = textColor;
             box.textAlign = textAlign;
             box.bold = isBold;
             box.italic = isItalic;
             box.underline = isUnderline;
         }
     });
 }

 // Updated function to toggle format styles with live application
 function toggleFormatStyle(buttonId) {
     const button = document.getElementById(buttonId);
     if (button) {
         button.classList.toggle('active');
         button.style.background = button.classList.contains('active') ? '#007bff' : '';
         button.style.color = button.classList.contains('active') ? 'white' : '';
         
         // Apply formatting immediately after style toggle
         applyLiveFormatting();
     }
 }

 // Get current formatting settings from the panel
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

 // Setup comprehensive live formatting listeners
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

 // Add event listeners for text style buttons
 document.addEventListener('DOMContentLoaded', function() {
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

     // CSV file input handler
     const csvFileInput = document.getElementById('csvFile');
     console.log('Looking for CSV file input:', csvFileInput);
     if (csvFileInput) {
         console.log('CSV file input found, adding event listener');
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
                 console.log('No file selected');
             }
         });
     } else {
         console.error('CSV file input not found!');
     }

     // Setup keyboard shortcuts for box management
     setupKeyboardShortcuts();
      
      // Setup file change monitoring
      setupFileChangeMonitoring();
      
      // Setup enhanced zoom functionality
      setupMouseWheelZoom();
      
      // Add live file monitoring controls
      setupLiveFileMonitoringControls();
  });

          // File change monitoring system
  function setupFileChangeMonitoring() {
      // Monitor file inputs for changes
      const pdfFileInput = document.getElementById('pdfFile');
      const csvFileInput = document.getElementById('csvFile');
      
      if (pdfFileInput) {
          pdfFileInput.addEventListener('change', function(e) {
              const file = e.target.files[0];
              if (file) {
                  // Store file metadata for change detection
                  sessionState.pdfMetadata = {
                      name: file.name,
                      lastModified: file.lastModified,
                      size: file.size
                  };
                  
                  // Load the PDF
                  loadPdf(file);
                  
                  // If live monitoring is enabled, keep the file selected
                  if (sessionState.liveMonitoringEnabled) {
                      console.log('Live monitoring enabled - keeping PDF file selected for updates');
                  }
              }
          });
      }
      
      if (csvFileInput) {
          csvFileInput.addEventListener('change', function(e) {
              const file = e.target.files[0];
              if (file) {
                  // Store file metadata for change detection
                  sessionState.csvMetadata = {
                      name: file.name,
                      lastModified: file.lastModified,
                      size: file.size
                  };
                  
                  // Parse the CSV
                  parseCSVFile(file);
                  
                  // If live monitoring is enabled, keep the file selected
                  if (sessionState.liveMonitoringEnabled) {
                      console.log('Live monitoring enabled - keeping CSV file selected for updates');
                  }
              }
          });
      }
      
      // Start periodic file checking
      setInterval(checkForFileChanges, 2000); // Check every 2 seconds
      
      // Also monitor for manual file removal
      if (pdfFileInput) {
          pdfFileInput.addEventListener('input', function(e) {
              if (e.target.files.length === 0 && sessionState.pdfMetadata) {
                  if (sessionState.liveMonitoringEnabled) {
                      console.log('PDF file removed but live monitoring is enabled - consider re-selecting for updates');
                  } else {
                      console.log('PDF file manually removed, clearing metadata');
                      sessionState.pdfMetadata = null;
                  }
              }
          });
      }
      
      if (csvFileInput) {
          csvFileInput.addEventListener('input', function(e) {
              if (e.target.files.length === 0 && sessionState.csvMetadata) {
                  if (sessionState.liveMonitoringEnabled) {
                      console.log('CSV file removed but live monitoring is enabled - consider re-selecting for updates');
                  } else {
                      console.log('CSV file manually removed, clearing metadata');
                      sessionState.csvMetadata = null;
                  }
              }
          });
      }
      
      // Check for file changes when page becomes visible again
      document.addEventListener('visibilitychange', function() {
          if (!document.hidden) {
              console.log('Page became visible, checking for file changes...');
              checkForFileChanges();
          }
      });
      
      // Cleanup render tasks when page is unloaded
      window.addEventListener('beforeunload', function() {
          if (window.currentRenderTask) {
              try {
                  window.currentRenderTask.cancel();
              } catch (cancelError) {
                  // Ignore errors during page unload
              }
          }
      });
  }
  
  // Check for external file changes
  function checkForFileChanges() {
      try {
          const pdfFileInput = document.getElementById('pdfFile');
          const csvFileInput = document.getElementById('csvFile');
          
          // Check PDF file changes
          if (pdfFileInput && pdfFileInput.files.length > 0 && sessionState.pdfMetadata) {
              const currentFile = pdfFileInput.files[0];
              if (currentFile.name === sessionState.pdfMetadata.name && 
                  (currentFile.lastModified !== sessionState.pdfMetadata.lastModified || 
                   currentFile.size !== sessionState.pdfMetadata.size)) {
                  
                  console.log('PDF file change detected, updating...');
                  
                  // Update metadata
                  sessionState.pdfMetadata.lastModified = currentFile.lastModified;
                  sessionState.pdfMetadata.size = currentFile.size;
                  
                  console.log('PDF file change detected, updating...');
                  
                  // Reload PDF in background (only if not currently rendering)
                  if (!window.currentRenderTask || window.currentRenderTask.destroyed) {
                      // Add a small delay to prevent rapid successive reloads
                      setTimeout(() => {
                          loadPdf(currentFile);
                      }, 100);
                  } else {
                      console.log('PDF currently rendering, will check again later');
                  }
              }
          }
          
          // Check CSV file changes
          if (csvFileInput && csvFileInput.files.length > 0 && sessionState.csvMetadata) {
              const currentFile = csvFileInput.files[0];
              if (currentFile.name === sessionState.csvMetadata.name && 
                  (currentFile.lastModified !== sessionState.csvMetadata.lastModified || 
                   currentFile.size !== sessionState.csvMetadata.size)) {
                  
                  console.log('CSV file change detected, updating...');
                  
                  // Update metadata
                  sessionState.csvMetadata.lastModified = currentFile.lastModified;
                  sessionState.csvMetadata.size = currentFile.size;
                  
                  // Reload CSV in background (add small delay to prevent rapid successive parsing)
                  setTimeout(() => {
                      parseCSVFile(currentFile);
                  }, 100);
              }
          }
      } catch (error) {
          console.error('Error checking for file changes:', error);
      }
  }

 // Live File Monitoring Controls
 function setupLiveFileMonitoringControls() {
     // Add live monitoring toggle to the UI
     const fileControls = document.querySelector('.file-controls');
     if (fileControls) {
         const liveMonitoringDiv = document.createElement('div');
         liveMonitoringDiv.className = 'live-monitoring-controls';
         liveMonitoringDiv.innerHTML = `
             <div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #dee2e6;">
                 <h4 style="margin: 0 0 10px 0; color: #495057;">🔄 Live File Monitoring</h4>
                 <div style="display: flex; align-items: center; gap: 10px;">
                     <label style="display: flex; align-items: center; gap: 5px; font-size: 14px;">
                         <input type="checkbox" id="enableLiveMonitoring" style="margin: 0;">
                         Enable live updates when files change
                     </label>
                     <button id="refreshFilesBtn" style="padding: 5px 10px; font-size: 12px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">
                         🔄 Refresh Files
                     </button>
                 </div>
                 <p style="margin: 10px 0 0 0; font-size: 12px; color: #6c757d;">
                     <strong>Note:</strong> For live updates to work, files must remain selected in the file inputs above.
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
 
 // Refresh files for live monitoring
 function refreshFilesForLiveMonitoring() {
     if (sessionState.pdfMetadata) {
         console.log('Refreshing PDF file for live monitoring...');
         // This would typically prompt user to re-select the file
         alert('Please re-select your PDF file to enable live monitoring');
     }
     
     if (sessionState.csvMetadata) {
         console.log('Refreshing CSV file for live monitoring...');
         // This would typically prompt user to re-select the file
         alert('Please re-select your CSV file to enable live monitoring');
     }
 }

 // Simple Multiple Records Management
 let recordsCreated = 0;
 
 function createMultipleTextRecords() {
     // Check if CSV data is loaded
     if (!sessionState.csvRows || sessionState.csvRows.length === 0) {
         alert('Please upload CSV data first!');
         return;
     }
     
     // Check if we have text boxes with CSV columns assigned
     const textBoxes = sessionState.boxes.filter(box => box.boxType === 'text' && box.fieldKey);
     
     if (textBoxes.length === 0) {
         alert('Please create at least one text box with a CSV field assigned!');
         return;
     }
     
     // Get the number of records to create from dropdown
     const recordsCount = parseInt(document.getElementById('recordsCountSelect').value);
     
     // Remove initial text boxes
     textBoxes.forEach(box => {
         if (box.element) {
             box.element.remove();
         }
     });
     sessionState.boxes = sessionState.boxes.filter(box => box.boxType !== 'text');
     
     // Create multiple text boxes for each record
     for (let i = 0; i < recordsCount; i++) {
         if (i >= sessionState.csvRows.length) break; // Don't create more than available records
         
         const record = sessionState.csvRows[i];
         const verticalOffset = i * 120; // Space between boxes
         
         // Create text boxes
         textBoxes.forEach((templateBox, txtIndex) => {
             // Create text box (existing logic)
             const recordText = record[templateBox.fieldKey] || `Record ${i + 1}`;
             
         const newBox = {
                 ...templateBox,
             id: ++boxCounter,
                 boxId: boxCounter, // Add boxId for consistency with delete function
                 y: templateBox.y + verticalOffset, // Stack vertically with spacing
             element: null
         };
         
         // Create the text box element
         const textBox = document.createElement('div');
         textBox.className = 'draggable-text-box';
         textBox.id = 'textBox_' + newBox.id;
         textBox.style.cssText = `
             position: absolute;
             left: ${newBox.x}px;
             top: ${newBox.y}px;
             width: ${newBox.width}px;
             height: ${newBox.height}px;
             min-width: 20px;
             min-height: 15px;
             background: transparent;
             border: none;
             padding: 5px;
             cursor: move;
             pointer-events: auto;
             z-index: 20;
             font-family: ${newBox.fontFamily}, sans-serif;
             font-size: ${newBox.fontSize}px;
             color: ${newBox.color};
             text-align: ${newBox.textAlign};
             user-select: none;
             box-sizing: border-box;
             overflow: hidden;
             box-shadow: none;
             transition: all 0.1s ease;
             display: block;
             line-height: 1.2;
         `;
         textBox.textContent = recordText;
         textBox.contentEditable = false;
             

         
         // Add to overlay container
         const overlayContainer = document.getElementById('overlayContainer');
         overlayContainer.appendChild(textBox);
         
         // Enable drag and resize using the same system as image boxes
         makeDraggable(textBox);
         
         // Explicitly add resize handles for text boxes
         addResizeHandles(textBox);
         
         // Box will automatically scale with camera zoom
         textBox.style.transform = '';
         
         // Add resize handles for visual feedback (same as image boxes)
         addResizeHandles(textBox);
         
         // Add click handler
         textBox.addEventListener('click', function(e) {
             e.stopPropagation();
             console.log('Text box clicked:', textBox);
             
             // Don't allow selection in preview mode
             if (isPreviewMode) {
                 console.log('Preview mode active - selection disabled');
                 return;
             }
             
             // Check if Ctrl/Cmd key is pressed for multiple selection
             if (e.ctrlKey || e.metaKey) {
                 // Multiple selection mode
                 const boxData = sessionState.boxes.find(b => b.element === textBox);
                 if (boxData) {
                     if (selectedBoxes.find(b => b.element === textBox)) {
                         // Remove from multiple selection
                         removeFromMultipleSelection(boxData);
                     } else {
                         // Add to multiple selection
                         addToMultipleSelection(boxData);
                     }
                     updateMultiSelectionEditor();
                 }
             } else {
                 // Single selection mode
                 clearMultipleSelection();
                 
             // Remove selection from all boxes
             document.querySelectorAll('.draggable-text-box, .draggable-image-box').forEach(box => {
                 box.classList.remove('selected');
             });
             textBox.classList.add('selected');
             sessionState.selectedBox = textBox; // Store the DOM element, not the box object
             
             // Keep transform controls visible when selecting a box
             showAllTransformControls();
             console.log('Box selected - keeping transform controls visible');
             
             updateBoxEditor();
             updateBoxEditorValues(newBox);
                 
                 // Highlight corresponding box
                 const boxData = sessionState.boxes.find(b => b.element === textBox);
                 if (boxData) {
                     console.log('Found box data for click:', boxData);
                     // Highlighting functionality removed
                     // Show record info for the selected box
                     showRecordInfo(boxData);
                 } else {
                     console.log('No box data found for text box:', textBox);
                 }
             }
         });
         
         // Add double-click handler to show transform controls with resize cursors
         textBox.addEventListener('dblclick', function(e) {
             e.stopPropagation();
             console.log('Text box double-clicked - showing transform controls with resize cursors');
             
             // Don't allow in preview mode
             if (isPreviewMode) {
                 console.log('Preview mode active - transform controls disabled');
                 return;
             }
             
             // Show transform controls for this box
             showTransformControls(textBox);
             
             // Set resize cursors on all transform controls
             const transformControls = textBox.querySelectorAll('.transform-control');
             transformControls.forEach(control => {
                 const handle = control.dataset.handle;
                 switch(handle) {
                     case 'nw': control.style.cursor = 'nw-resize'; break;
                     case 'n': control.style.cursor = 'n-resize'; break;
                     case 'ne': control.style.cursor = 'ne-resize'; break;
                     case 'e': control.style.cursor = 'e-resize'; break;
                     case 'se': control.style.cursor = 'se-resize'; break;
                     case 's': control.style.cursor = 's-resize'; break;
                     case 'sw': control.style.cursor = 'sw-resize'; break;
                     case 'w': control.style.cursor = 'w-resize'; break;
                 }
             });
         });
         
         newBox.element = textBox;
         sessionState.boxes.push(newBox);
         });
     }
     
     recordsCreated += recordsCount;
     updateRecordsInfo();
     
     // Reset to first page and update navigation
     currentPage = 0;
     updatePageNavigation();
     updateAllTextBoxesWithCSVData();
     
     const totalBoxes = textBoxes.length * recordsCount;
     alert(`Created ${totalBoxes} text boxes for ${recordsCount} records!`);
     
     // Update download button state to enable downloads
     updateDownloadButtonState();
     
     // Update text box scaling to match current PDF viewer state
     // Camera zoom - no manual scaling needed
 }
 
 function updateRecordsInfo() {
     // recordsInfo element was removed with the Multiple Records section
     // This function is kept for compatibility but does nothing
 }
 
 async function createMultipleImageRecords() {
     // Check if CSV data is loaded
     if (!sessionState.csvRows || sessionState.csvRows.length === 0) {
         alert('Please upload CSV data first!');
         return;
     }
     
     // Check if we have image boxes with CSV columns assigned
     const imageBoxes = sessionState.boxes.filter(box => box.boxType === 'image' && box.fieldKey);
     
     if (imageBoxes.length === 0) {
         alert('Please create at least one image box with a CSV field assigned!');
         return;
     }
     
     // Get the number of records to create from dropdown
     const recordsCount = parseInt(document.getElementById('recordsCountSelect').value);
     
     // Remove initial image boxes
     imageBoxes.forEach(box => {
         if (box.parentNode) {
             box.remove();
         }
     });
     sessionState.boxes = sessionState.boxes.filter(box => box.boxType !== 'image');
     
     // Create multiple image boxes for each record
     for (let i = 0; i < recordsCount; i++) {
         if (i >= sessionState.csvRows.length) break; // Don't create more than available records
         
         const record = sessionState.csvRows[i];
         const verticalOffset = i * 120; // Space between boxes
         
         // Create image boxes
         imageBoxes.forEach(async (templateBox, imgIndex) => {
             // Create image box using DOM elements
             const centerX = parseFloat(templateBox.style?.left) || 100;
             const centerY = (parseFloat(templateBox.style?.top) || 100) + verticalOffset; // Stack vertically
             
             // Create a DOM-based image box
             const imageBox = document.createElement('div');
             imageBox.className = 'draggable-image-box';
             imageBox.style.cssText = `
                 position: absolute;
                 left: ${(centerX - 50)}px;
                 top: ${(centerY - 50)}px;
                 width: 100px;
                 height: 100px;
                 border: none;
                 background: transparent;
                 cursor: move;
                 z-index: 10;
                 overflow: visible;
                 box-sizing: border-box;
                 transition: all 0.1s ease;
             `;

             // Add custom properties
             imageBox.boxId = ++boxCounter;
             imageBox.boxType = 'image';
             imageBox.fieldKey = templateBox.fieldKey;
             imageBox.imageSource = 'csv';
             imageBox.imageUrl = '';
             imageBox.boxIndex = i; // Track which record this box represents

             // Add click handler for selection
             imageBox.addEventListener('click', function(e) {
                 e.stopPropagation();
                 console.log('Image box clicked (createMultiple):', imageBox);
                 
                 // Check if Ctrl/Cmd key is pressed for multiple selection
                 if (e.ctrlKey || e.metaKey) {
                     // Multiple selection mode
                     const boxData = sessionState.boxes.find(b => b.element === imageBox);
                     if (boxData) {
                         if (selectedBoxes.find(b => b.element === imageBox)) {
                             // Remove from multiple selection
                             removeFromMultipleSelection(boxData);
                         } else {
                             // Add to multiple selection
                             addToMultipleSelection(boxData);
                         }
                         updateMultiSelectionEditor();
                     }
                 } else {
                     // Single selection mode
                     clearMultipleSelection();
                     
                 // Remove selection from all boxes
                 document.querySelectorAll('.draggable-image-box, .draggable-text-box').forEach(box => {
                     box.classList.remove('selected');
                 });
                 imageBox.classList.add('selected');
                 sessionState.selectedBox = imageBox; // Store the DOM element
                 currentBoxId = imageBox.boxId;
                 
                 // Keep transform controls visible when selecting an image box
                 showAllTransformControls();
                 console.log('Image box selected - keeping transform controls visible');
                 
                 updateBoxEditor();
                 updateBoxEditorValues(imageBox);
                     
                     // Highlight corresponding box
                     const boxData = sessionState.boxes.find(b => b.element === imageBox);
                     if (boxData) {
                         console.log('Found box data for image click:', boxData);
                         // Highlighting functionality removed
                     } else {
                         console.log('No box data found for image box:', imageBox);
                     }
                 }
             });

             // Add double-click handler to show transform controls with resize cursors
             imageBox.addEventListener('dblclick', function(e) {
                 e.stopPropagation();
                 console.log('Image box double-clicked - showing transform controls with resize cursors');
                 
                 // Don't allow in preview mode
                 if (isPreviewMode) {
                     console.log('Preview mode active - transform controls disabled');
                     return;
                 }
                 
                 // Show transform controls for this box
                 showTransformControls(imageBox);
                 
                 // Set resize cursors on all transform controls
                 const transformControls = imageBox.querySelectorAll('.transform-control');
                 transformControls.forEach(control => {
                     const handle = control.dataset.handle;
                     switch(handle) {
                         case 'nw': control.style.cursor = 'nw-resize'; break;
                         case 'n': control.style.cursor = 'n-resize'; break;
                         case 'ne': control.style.cursor = 'ne-resize'; break;
                         case 'e': control.style.cursor = 'e-resize'; break;
                         case 'se': control.style.cursor = 'se-resize'; break;
                         case 's': control.style.cursor = 's-resize'; break;
                         case 'sw': control.style.cursor = 'sw-resize'; break;
                         case 'w': control.style.cursor = 'w-resize'; break;
                     }
                 });
             });

             // Add to PDF viewer and enable drag/resize
             const pdfViewer = document.getElementById('pdfViewer');
             pdfViewer.appendChild(imageBox);
             enableDragResize(imageBox);
             
             // Box will automatically scale with camera zoom
             imageBox.style.transform = '';
             
             // Create a proper box object for the image box
             const imageBoxObject = {
                 boxId: imageBox.boxId,
                 boxType: 'image',
                 fieldKey: imageBox.fieldKey,
                 imageSource: imageBox.imageSource,
                 imageUrl: imageBox.imageUrl,
                 element: imageBox
             };
             
             sessionState.boxes.push(imageBoxObject);
             
             // Update the image with CSV data
             // Calculate the record index for this box using unified calculation
             const recordIndex = currentPage * recordsPerPage + (sessionState.boxes.length % recordsPerPage);
             await updateImageBoxWithCSVData(imageBoxObject, recordIndex);
         });
     }
     
     recordsCreated += recordsCount;
     updateRecordsInfo();
     
     // Reset to first page and update navigation
     currentPage = 0;
     updatePageNavigation();
     
     const totalBoxes = imageBoxes.length * recordsCount;
     alert(`Created ${totalBoxes} image boxes for ${recordsCount} records!`);
     
     // Update download button state to enable downloads
     updateDownloadButtonState();
     
     // Update image box scaling to match current PDF viewer state
     // Camera zoom - no manual scaling needed
 }

 function updateCreateRecordsButtonState() {
     // Multiple records buttons were removed
     // This function is kept for compatibility but does nothing
 }
 
 // Page navigation variables
 let currentPage = 0;
 let recordsPerPage = 4;
 let totalPages = 1;
 
 function updatePageNavigation() {
     const pageNav = document.getElementById('pageNavigation');
     const pageInfo = document.getElementById('pageInfo');
     const pageRecordsInfo = document.getElementById('pageRecordsInfo');
     const prevBtn = document.getElementById('prevPageBtn');
     const nextBtn = document.getElementById('nextPageBtn');
     
     if (!sessionState.csvRows || sessionState.csvRows.length === 0) {
         // Show navigation with default values when no CSV is loaded
         pageInfo.textContent = `Page 1 of 1`;
         pageRecordsInfo.textContent = `No CSV data loaded`;
         prevBtn.disabled = true;
         nextBtn.disabled = true;
         pageNav.style.display = 'block';
         return;
     }
     
     // Calculate records per page based on the box count selection
     // This should be the number of boxes the user wants to show per page
     const boxCountSelect = document.getElementById('boxCountSelect');
     const selectedBoxCount = boxCountSelect ? parseInt(boxCountSelect.value) || 4 : 4;
     
     // Set records per page to the selected box count
     recordsPerPage = selectedBoxCount;
     
     // Ensure recordsPerPage doesn't exceed the total number of CSV records
     if (sessionState.csvRows && sessionState.csvRows.length > 0) {
         recordsPerPage = Math.min(recordsPerPage, sessionState.csvRows.length);
     }
     
     totalPages = Math.ceil(sessionState.csvRows.length / recordsPerPage);
     
     // Debug logging
     console.log('Navigation Debug:', {
         selectedBoxCount: selectedBoxCount,
         recordsPerPage: recordsPerPage,
         totalRecords: sessionState.csvRows.length,
         totalPages: totalPages,
         currentPage: currentPage
     });
     
     // Update page info
     pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
     
     // Calculate record range for current page
     const startRecord = currentPage * recordsPerPage;
     const endRecord = Math.min(startRecord + recordsPerPage - 1, sessionState.csvRows.length - 1);
     pageRecordsInfo.textContent = `Showing records ${startRecord + 1}-${endRecord + 1}`;
     
     // Update button states
     prevBtn.disabled = currentPage === 0;
     nextBtn.disabled = currentPage >= totalPages - 1;
     
     // Show navigation
     pageNav.style.display = 'block';
     
     // Show synchronization info for debugging
     showBoxSyncInfo();
 }
 
 async function previousPage() {
     console.log('Previous page clicked. Current page:', currentPage);
     if (currentPage > 0) {
         currentPage--;
         console.log('Moving to page:', currentPage);
         updatePageNavigation();
         console.log('Updating text boxes for page:', currentPage);
         await updateAllBoxesWithCSVData(); // This already handles both text and image boxes
     } else {
         console.log('Already at first page');
     }
 }
 
 async function nextPage() {
     console.log('Next page clicked. Current page:', currentPage, 'Total pages:', totalPages);
     if (currentPage < totalPages - 1) {
         currentPage++;
         console.log('Moving to page:', currentPage);
         updatePageNavigation();
         console.log('Updating text boxes for page:', currentPage);
         await updateAllBoxesWithCSVData(); // This already handles both text and image boxes
     } else {
         console.log('Already at last page');
     }
 }
 
 function updateRecordDisplay() {
     updatePageNavigation();
 }
 
 function generateRecordsPreview() {
     const previewContainer = document.getElementById('previewContainer');
     if (!previewContainer || !sessionState.csvRows || sessionState.csvRows.length === 0) return;
     
     const totalRecords = sessionState.csvRows.length;
     const totalPages = Math.ceil(totalRecords / recordsPerPage);
     
     let previewHTML = '';
     
     for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
         const startRecord = pageIndex * recordsPerPage;
         const endRecord = Math.min(startRecord + recordsPerPage, totalRecords);
         const recordsOnThisPage = endRecord - startRecord;
         
         previewHTML += `
             <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #ccc; background: white;">
                 <div style="font-weight: bold; color: #007bff; margin-bottom: 8px;">
                     Page ${pageIndex + 1} (Records ${startRecord + 1}-${endRecord})
                 </div>
                 <div style="display: flex; flex-direction: column; gap: 5px;">
         `;
         
         for (let i = 0; i < recordsOnThisPage; i++) {
             const recordIndex = startRecord + i;
             const record = sessionState.csvRows[recordIndex];
             const recordText = Object.values(record).slice(0, 3).join(' | '); // Show first 3 fields
             
             previewHTML += `
                 <div style="padding: 5px; background: #f0f0f0; border-left: 3px solid #007bff; font-size: 11px;">
                     <strong>Record ${recordIndex + 1}:</strong> ${recordText}
                 </div>
             `;
         }
         
         previewHTML += `
                 </div>
             </div>
         `;
     }
     
     previewContainer.innerHTML = previewHTML;
 }
 
// Initialize simple system when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing simple system...');
    updateRecordsInfo();
    
    // Initialize page navigation with default values (4 boxes per page)
    updatePageNavigation();
    
    // Initialize canvas interaction system
    canvasInteractionSystem = new CanvasInteractionSystem();
    
    // Enable canvas mode by default
    setTimeout(() => {
        toggleInteractionMode(true);
    }, 1000);
    
    // Initialize undo/redo system
    initializeUndoSystem();
    
    // Ensure record info display is hidden initially
    const recordInfoDisplay = document.getElementById('recordInfoDisplay');
    if (recordInfoDisplay) {
        recordInfoDisplay.style.display = 'none';
    }
    
    // Show all transform controls by default
    setTimeout(() => {
        showAllTransformControls();
    }, 100);
    
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
});
 
 // Function to show box synchronization info
 function showBoxSyncInfo() {
     console.log('=== BOX SYNCHRONIZATION INFO ===');
     console.log('Total boxes:', sessionState.boxes.length);
     
     if (sessionState.boxes.length === 0) {
         console.log('No boxes created yet');
         return;
     }
     
     sessionState.boxes.forEach((box, index) => {
         console.log(`Box ${index}:`);
         console.log(`  - Type: ${box.type || box.boxType}`);
         console.log(`  - Field Key: ${box.fieldKey || 'None'}`);
         console.log(`  - Position: ${index}`);
         console.log(`  - Current Content: "${box.element ? box.element.textContent : 'No element'}"`);
         
         // Calculate which record this box should show
         if (box.fieldKey && sessionState.csvRows) {
             const recordIndex = currentPage * recordsPerPage + (index % recordsPerPage);
             if (recordIndex < sessionState.csvRows.length) {
                 const recordData = sessionState.csvRows[recordIndex];
                 const csvText = recordData[box.fieldKey] || '';
                 console.log(`  - Should show record ${recordIndex + 1}: "${csvText}"`);
             } else {
                 console.log(`  - Record index out of bounds: ${recordIndex}`);
             }
         }
     });
     
     if (sessionState.csvRows && sessionState.csvRows.length > 0) {
         console.log(`CSV Data: ${sessionState.csvRows.length} records available`);
         console.log(`Records per page: ${recordsPerPage}`);
         console.log(`Total pages: ${totalPages}`);
         console.log(`Current page: ${currentPage}`);
         
         // Show what records will be displayed on current page
         const startRecord = currentPage * recordsPerPage;
         const endRecord = Math.min(startRecord + recordsPerPage - 1, sessionState.csvRows.length - 1);
         console.log(`Current page shows records ${startRecord + 1}-${endRecord + 1}`);
         
         // Show which record each box will display
         sessionState.boxes.forEach((box, index) => {
             // Use unified record index calculation for all box types
             const recordIndex = currentPage * recordsPerPage + (index % recordsPerPage);
             
             if (recordIndex < sessionState.csvRows.length) {
                 const record = sessionState.csvRows[recordIndex];
                 if (record && box.fieldKey) {
                     console.log(`  Box ${index} (${box.boxType}) will show record ${recordIndex + 1}: ${record[box.fieldKey] || 'No data'}`);
                 } else {
                     console.log(`  Box ${index} (${box.boxType}) will show record ${recordIndex + 1}: No field assigned or no record data`);
                 }
             } else {
                 console.log(`  Box ${index} (${box.boxType}) will show empty (no more records)`);
             }
         });
     } else {
         console.log('No CSV data loaded yet');
     }
     console.log('================================');
 }


 
 // InDesign-style layout management
 
 async function updateTextBoxMappingDisplay() {
     // Update all text boxes with current record data using unified approach
     await updateAllBoxesWithCSVData();
 }
 
 // Grid-based positioning system for consistent box placement
 const GRID_SIZE = 20; // Grid spacing in pixels
 const BOX_SPACING = 10; // Minimum spacing between boxes
 
 // Function to calculate optimal position for new boxes using a grid system
 function calculateOptimalBoxPosition(boxType) {
     const existingBoxes = sessionState.boxes.filter(box => box.boxType === boxType);
     const pdfViewer = document.getElementById('pdfViewer');
     const pdfCanvas = document.getElementById('viewer');
     
     // Get the actual PDF canvas area (not the entire viewer)
     const viewerRect = pdfViewer.getBoundingClientRect();
     const canvasRect = pdfCanvas.getBoundingClientRect();
     
     // Calculate the center of the actual PDF canvas area
     const centerX = (canvasRect.width / 2) - (canvasRect.left - viewerRect.left);
     const centerY = (canvasRect.height / 2) - (canvasRect.top - viewerRect.top);
     
     if (existingBoxes.length === 0) {
         // First box of this type - place in the center of visible area
         return { 
             x: Math.max(50, centerX - 60), 
             y: Math.max(50, centerY - 20) 
         };
     }
     
     // Create a grid-based positioning system
     const boxWidth = boxType === 'text' ? 120 : 100;
     const boxHeight = boxType === 'text' ? 40 : 100;
     
     // Find the next available grid position
     let gridX = Math.floor(centerX / GRID_SIZE);
     let gridY = Math.floor(centerY / GRID_SIZE);
     
     // Try to find an empty spot in a spiral pattern from center
     let radius = 0;
     let found = false;
     
     while (!found && radius < 20) { // Limit search radius
         for (let angle = 0; angle < 360 && !found; angle += 45) {
             const radians = (angle * Math.PI) / 180;
             const testGridX = Math.floor(centerX / GRID_SIZE) + Math.floor(radius * Math.cos(radians));
             const testGridY = Math.floor(centerY / GRID_SIZE) + Math.floor(radius * Math.sin(radians));
             
             const testX = testGridX * GRID_SIZE;
             const testY = testGridY * GRID_SIZE;
             
             // Check if this position is available
             if (isPositionAvailable(testX, testY, boxWidth, boxHeight, existingBoxes)) {
                 gridX = testGridX;
                 gridY = testGridY;
                 found = true;
             }
         }
         radius++;
     }
     
     // If no position found in spiral, place in a predictable location
     if (!found) {
         // Place in a new row below existing boxes
         const maxY = Math.max(...existingBoxes.map(box => {
             if (box.element) {
                 const rect = box.element.getBoundingClientRect();
                 return rect.top - canvasRect.top + rect.height;
             }
             return 0;
         }));
         gridY = Math.floor((maxY + BOX_SPACING) / GRID_SIZE);
         gridX = Math.floor(centerX / GRID_SIZE);
     }
     
     return { 
         x: gridX * GRID_SIZE, 
         y: gridY * GRID_SIZE 
     };
 }
 
 // Helper function to check if a position is available
 function isPositionAvailable(x, y, width, height, existingBoxes) {
     const pdfViewer = document.getElementById('pdfViewer');
     const pdfCanvas = document.getElementById('viewer');
     
     // Get the actual PDF canvas area boundaries
     const viewerRect = pdfViewer.getBoundingClientRect();
     const canvasRect = pdfCanvas.getBoundingClientRect();
     
     // Calculate the PDF canvas area relative to the viewer
     const canvasLeft = canvasRect.left - viewerRect.left;
     const canvasTop = canvasRect.top - viewerRect.top;
     const canvasWidth = canvasRect.width;
     const canvasHeight = canvasRect.height;
     
     // Check bounds - ensure box stays within PDF canvas area
     if (x < canvasLeft || y < canvasTop || x + width > canvasLeft + canvasWidth || y + height > canvasTop + canvasHeight) {
         return false;
     }
     
     // Check collision with existing boxes
     for (const box of existingBoxes) {
         if (box.element) {
             const rect = box.element.getBoundingClientRect();
             const boxX = rect.left - viewerRect.left;
             const boxY = rect.top - viewerRect.top;
             const boxWidth = rect.width;
             const boxHeight = rect.height;
             
             // Check if boxes overlap (with some padding)
             if (!(x + width + BOX_SPACING < boxX || 
                   x > boxX + boxWidth + BOX_SPACING || 
                   y + height + BOX_SPACING < boxY || 
                   y > boxY + boxHeight + BOX_SPACING)) {
                 return false;
             }
         }
     }
     
     return true;
 }
 
         // Function to show dynamic box identifier while dragging
 function showBoxIdentifier(box, isDragging) {
     if (!box || !box.element) return;
     
     const boxIndex = sessionState.boxes.indexOf(box);
     const boxType = box.boxType;
     
     if (isDragging) {
         // Create or update the identifier popup
         let identifier = box.element.querySelector('.drag-identifier');
         if (!identifier) {
             identifier = document.createElement('div');
             identifier.className = 'drag-identifier';
             identifier.style.cssText = `
                 position: absolute;
                 top: -25px;
                 left: 50%;
                 transform: translateX(-50%);
                 background: ${boxType === 'text' ? '#007bff' : '#28a745'};
                 color: white;
                 padding: 4px 8px;
                 border-radius: 12px;
                 font-size: 12px;
                 font-weight: bold;
                 white-space: nowrap;
                 z-index: 1000;
                 box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                 animation: identifierPop 0.3s ease-out;
             `;
             box.element.appendChild(identifier);
         }
         
         // Update content
         identifier.textContent = `${boxType === 'text' ? 'Text' : 'Image'} Box ${boxIndex + 1}`;
         identifier.style.display = 'block';
         
         // Highlight the corresponding box of the other type with clean visual feedback
         // Highlighting functionality removed
         
     } else {
         // Hide identifier
         const identifier = box.element.querySelector('.drag-identifier');
         if (identifier) {
             identifier.style.display = 'none';
         }
         
         // Highlighting functionality removed - using records display box instead
     }
 }
 
 // Highlighting functionality removed - using records display box instead
 
 // Function to show which record the boxes represent
 function showRecordInfo(selectedBox, correspondingBox = null) {
     if (!selectedBox || !sessionState.csvRows) return;
     
     // Find the box's index in the main boxes array
     const boxIndex = sessionState.boxes.indexOf(selectedBox);
     if (boxIndex === -1) {
         console.log('Box not found in sessionState.boxes');
         return;
     }
     
     // Calculate which record this box represents based on its position and current page
     // Use the same logic as updateTextBoxWithCSVData for consistency
     const pageIndex = boxIndex % recordsPerPage; // Get position within current page
     const recordIndex = currentPage * recordsPerPage + pageIndex;
     
     // Calculate the actual record number (1-based for display)
     const actualRecordNumber = recordIndex + 1;
     
     if (recordIndex < sessionState.csvRows.length) {
         const record = sessionState.csvRows[recordIndex];
         
         // Update the integrated record info display in the left panel
         const recordInfoDisplay = document.getElementById('recordInfoDisplay');
         const recordInfoText = document.getElementById('recordInfoText');
         
         if (recordInfoDisplay && recordInfoText) {
             // Show the record info display
             recordInfoDisplay.style.display = 'block';
             
             // Update the main text
             recordInfoText.textContent = `Record ${actualRecordNumber} of ${sessionState.csvRows.length}`;
             
             console.log('Record info shown for box:', selectedBox, 'Box index:', boxIndex, 'Page index:', pageIndex, 'Record:', actualRecordNumber, 'of', sessionState.csvRows.length);
         }
     } else {
         console.log('Record index out of bounds:', recordIndex, 'CSV rows:', sessionState.csvRows.length);
     }
 }
 

 
 // Function to clear all highlighting
 function clearAllHighlighting() {
     // Remove highlighting from all boxes
     sessionState.boxes.forEach(box => {
         if (box.element) {
             box.element.style.border = '';
             box.element.style.backgroundColor = '';
             
             // Reset transform controls
             const resizeHandles = box.element.querySelectorAll('.transform-control');
             resizeHandles.forEach(handle => {
                 handle.style.backgroundColor = '';
                 handle.style.borderColor = '';
             });
         }
     });
     
     // Don't hide record info - keep it visible for selected box
     // hideRecordInfo();
 }
 
 // Multiple selection functionality
 let selectedBoxes = [];
 
 function addToMultipleSelection(box) {
     if (!selectedBoxes.find(b => b.element === box.element)) {
         selectedBoxes.push(box);
         box.element.classList.add('multi-selected');
         box.element.style.border = '2px solid #007bff';
         box.element.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
         
         // Show record info for multiple selection
         if (selectedBoxes.length > 1) {
             const recordInfoDisplay = document.getElementById('recordInfoDisplay');
             const recordInfoText = document.getElementById('recordInfoText');
             
             if (recordInfoDisplay && recordInfoText) {
                 recordInfoDisplay.style.display = 'block';
                 recordInfoText.textContent = `Multiple Selection (${selectedBoxes.length} boxes)`;
             }
         }
     }
 }
 
 function removeFromMultipleSelection(box) {
     const index = selectedBoxes.findIndex(b => b.element === box.element);
     if (index > -1) {
         selectedBoxes.splice(index, 1);
         box.element.classList.remove('multi-selected');
         box.element.style.border = '';
         box.element.style.backgroundColor = '';
         
         // Keep transform controls visible when removing from multiple selection
         showAllTransformControls();
         console.log('Box removed from multiple selection - keeping transform controls visible');
         
         // Hide record info if no boxes remain selected
         if (selectedBoxes.length === 0) {
             const recordInfoDisplay = document.getElementById('recordInfoDisplay');
             if (recordInfoDisplay) {
                 recordInfoDisplay.style.display = 'none';
             }
         }
     }
 }
 
 function clearMultipleSelection() {
     selectedBoxes.forEach(box => {
         if (box.element) {
             box.element.classList.remove('multi-selected');
             box.element.style.border = '';
             box.element.style.backgroundColor = '';
         }
     });
     selectedBoxes = [];
     
     // Keep transform controls visible when clearing multiple selection
     showAllTransformControls();
     console.log('Multiple selection cleared - keeping transform controls visible');
     updateMultiSelectionEditor();
     
     // Hide record info when multiple selection is cleared
     const recordInfoDisplay = document.getElementById('recordInfoDisplay');
     if (recordInfoDisplay) {
         recordInfoDisplay.style.display = 'none';
     }
 }
 
 function clearAllHighlighting() {
     // Clear highlighting from all boxes
     sessionState.boxes.forEach(box => {
         if (box.element) {
             box.element.style.border = '';
             box.element.style.backgroundColor = '';
             
             // Reset transform controls
             const resizeHandles = box.element.querySelectorAll('.transform-control');
             resizeHandles.forEach(handle => {
                 handle.style.backgroundColor = '';
                 handle.style.borderColor = '';
                 handle.style.boxShadow = '';
             });
         }
     });
     
     // Don't hide record info - keep it visible for selected box
     // hideRecordInfo();
 }
 
 function updateMultiSelectionEditor() {
     // Update the existing box editor to show multiple selection info
     updateBoxEditorForMultipleSelection();
 }
 
 function updateBoxEditorForMultipleSelection() {
     const boxEditor = document.getElementById('boxEditor');
     if (!boxEditor) return;
     
     if (selectedBoxes.length > 1) {
         // Show multiple selection info in the existing box editor
         const textBoxes = selectedBoxes.filter(box => box.type === 'text' || box.boxType === 'text').length;
         const imageBoxes = selectedBoxes.filter(box => box.type === 'image' || box.boxType === 'image').length;
         
         // Update the box editor title to show multiple selection
         const titleElement = boxEditor.querySelector('h4') || boxEditor.querySelector('h3');
         if (titleElement) {
             titleElement.textContent = `Multiple Selection (${selectedBoxes.length} boxes)`;
             titleElement.style.color = '#007bff';
         }
         
         // Add info about selected boxes
         let infoElement = boxEditor.querySelector('.multi-selection-info');
         if (!infoElement) {
             infoElement = document.createElement('div');
             infoElement.className = 'multi-selection-info';
             infoElement.style.cssText = `
                 margin-bottom: 10px;
                 padding: 8px;
                 background: #fff3cd;
                 border: 1px solid #ffeaa7;
                 border-radius: 4px;
                 font-size: 12px;
                 color: #856404;
             `;
             boxEditor.insertBefore(infoElement, boxEditor.firstChild);
         }
         
         infoElement.innerHTML = `
             <strong>Selected:</strong> ${textBoxes} text boxes, ${imageBoxes} image boxes<br>
             <em>Changes will apply to all selected text boxes</em>
         `;
         
         // Show the box editor
         boxEditor.style.display = 'block';
     } else {
         // Hide multiple selection info
         const infoElement = boxEditor.querySelector('.multi-selection-info');
         if (infoElement) {
             infoElement.remove();
         }
         
         // Reset title
         const titleElement = boxEditor.querySelector('h4') || boxEditor.querySelector('h3');
         if (titleElement) {
             titleElement.textContent = 'Box Properties';
             titleElement.style.color = '';
         }
     }
 }
 

 
 // Add click handler to document to show transform controls when clicking elsewhere
 document.addEventListener('click', function(e) {
     // Only clear if clicking on something that's not a box
     if (!e.target.classList.contains('draggable-text-box') && 
         !e.target.classList.contains('draggable-image-box') &&
         !e.target.closest('.draggable-text-box') &&
         !e.target.closest('.draggable-image-box') &&
         !e.target.classList.contains('transform-control')) {
         
         // Show all transform controls when clicking outside
         showAllTransformControls();
         console.log('Clicked outside boxes - showing all transform controls');
         
         // Hide record info when clicking outside boxes
         // hideRecordInfo();
     }
 });
 
 // Initialize font handling
 initializeFontHandling();

 // Layout Editor Variables
 let selectedBox = null;

 // Page size definitions (in points)
 const PAGE_SIZES = {
     'A4': { width: 595, height: 842 },
     'A5': { width: 420, height: 595 },
     'A6': { width: 298, height: 420 }
 };

 // Initialize simple HTML-based editor
 function initEditor() {
     // Create the overlay container for text boxes
     const overlayContainer = document.createElement('div');
     overlayContainer.id = 'overlayContainer';
     overlayContainer.style.cssText = `
         position: absolute;
         top: 0;
         left: 0;
         width: 100%;
         height: 100%;
         pointer-events: none;
         z-index: 10;
     `;
     
     const pdfViewer = document.getElementById('pdfViewer');
     if (pdfViewer) {
         pdfViewer.appendChild(overlayContainer);
         pdfViewer.style.position = 'relative';
     }
 }

 function toggleEditorMode() {
     isEditorMode = !isEditorMode;
     const viewer = document.getElementById('viewer');
     const editorCanvasElement = document.getElementById('editorCanvas');
     const pdfViewer = document.getElementById('pdfViewer');
     
     if (isEditorMode) {
         // Show both PDF and editor canvas
         viewer.style.display = 'block';
         editorCanvasElement.style.display = 'block';
         
         // Disable PDF dragging when in editor mode
         if (pdfViewer) {
             pdfViewer.style.cursor = 'default';
         }
         
         if (editorCanvas) {
             editorCanvas.renderAll();
         }
         
         // Show all transform controls when entering edit mode
         setTimeout(() => {
             showAllTransformControls();
             console.log('Edit mode activated - showing all transform controls');
         }, 100);
     } else {
         // Hide editor canvas, keep PDF visible
         editorCanvasElement.style.display = 'none';
         viewer.style.display = 'block';
         
         // Re-enable PDF dragging when not in editor mode
         if (pdfViewer) {
             pdfViewer.style.cursor = 'grab';
         }
         
         // Show all transform controls when exiting edit mode too
         setTimeout(() => {
             showAllTransformControls();
             console.log('Edit mode deactivated - showing all transform controls');
         }, 100);
     }
 }



 async function addText() {
     // Save undo state before adding text
     saveUndoState('Add Text Box');
     
     // Ensure editor is initialized
     if (!document.getElementById('overlayContainer')) {
         initEditor();
     }
     
     // Get PDF viewer and canvas dimensions for centering
     const pdfViewer = document.getElementById('pdfViewer');
     const pdfCanvas = document.getElementById('viewer');
     if (!pdfViewer || !pdfCanvas || !sessionState.templatePdf) {
         alert('Please upload a PDF template first');
         return;
     }
     
     // Show helpful message if zoomed in
     if (currentTransform.scale > 1.5) {
         showZoomHelpIndicator();
     }
     
     // Check if CSV data is available
     if (!sessionState.csvRows || sessionState.csvRows.length === 0) {
         alert('Please upload CSV data first!');
         return;
     }
     
     // Get number of boxes to add from dropdown
     const boxCount = parseInt(document.getElementById('boxCountSelect').value) || 1;
     console.log('Adding text boxes - boxCount:', boxCount, 'dropdown value:', document.getElementById('boxCountSelect').value);
     
     // Use PDF canvas area for positioning instead of entire viewer
     const viewerRect = pdfViewer.getBoundingClientRect();
     const canvasRect = pdfCanvas.getBoundingClientRect();
     const centerX = (canvasRect.width / 2) - (canvasRect.left - viewerRect.left) - 60;
     const centerY = (canvasRect.height / 2) - (canvasRect.top - viewerRect.top) - 20;
     
     // Get available CSV columns
     const csvColumns = sessionState.csvColumns || [];
     if (csvColumns.length === 0) {
         alert('No CSV columns found. Please check your CSV file.');
         return;
     }
     
     // Create field selection modal
     const selectedField = await showFieldSelectionModal(csvColumns, boxCount, 'text');
     if (!selectedField) {
         return; // User cancelled
     }
     
     // Add multiple boxes for the same field across different records
     console.log('Starting loop to create', boxCount, 'text boxes');
     for (let i = 0; i < boxCount; i++) {
         console.log('Creating text box', i + 1, 'of', boxCount);
         // Calculate optimal position for this text box
         const position = calculateOptimalBoxPosition('text');
         const boxX = position.x + (i * 20); // Small offset for multiple boxes
         const boxY = position.y + (i * 15);
         
         // Create text box element
         const textBox = document.createElement('div');
         textBox.className = 'draggable-text-box';
         textBox.id = 'textBox_' + ++boxCounter;
         console.log('Created text box element with ID:', textBox.id, 'boxCounter:', boxCounter);
         
         // Get current formatting settings from the panel
         const formatting = getCurrentFormattingSettings();
         
         textBox.style.cssText = `
             position: absolute;
             left: ${boxX}px;
             top: ${boxY}px;
             width: 120px;
             height: 40px;
             min-width: 20px;
             min-height: 15px;
             background: transparent;
             border: none;
             padding: 5px;
             cursor: move;
             pointer-events: auto;
             z-index: 20;
             font-family: '${formatting.fontFamily}', Arial, sans-serif;
             font-size: ${formatting.fontSize}px;
             color: ${formatting.textColor};
             text-align: ${formatting.textAlign};
             font-weight: ${formatting.isBold ? 'bold' : 'normal'};
             font-style: ${formatting.isItalic ? 'italic' : 'normal'};
             text-decoration: ${formatting.isUnderline ? 'underline' : 'none'};
             user-select: none;
             box-sizing: border-box;
             overflow: hidden;
             box-shadow: none;
             transition: all 0.1s ease;
             display: block;
             line-height: 1.2;
         `;
         
         // Add to overlay container
         const overlayContainer = document.getElementById('overlayContainer');
         overlayContainer.appendChild(textBox);
         
         // Enable drag and resize using the same system as image boxes
         makeDraggable(textBox);
         
         // Explicitly add resize handles for text boxes
         addResizeHandles(textBox);
         
         // Box will automatically scale with camera zoom
         textBox.style.transform = '';
         
         // Add resize handles for visual feedback (same as image boxes)
         addResizeHandles(textBox);
         
         // Show orange transform controls as the main selection indicator
         showTransformControls(textBox);
         
         // Ensure small boxes are draggable and resize to content
         setTimeout(() => {
             ensureSmallBoxesDraggable(); // Ensure small boxes are draggable
             resizeTextBoxToContent(textBox); // Resize box to match text content
         }, 50);
         
         // Add to session state with current formatting settings
         const boxData = {
             id: boxCounter,
             boxId: boxCounter, // Add boxId for consistency with delete function
             element: textBox,
             type: 'text',
             boxType: 'text',
             fieldKey: selectedField, // Use fieldKey instead of csvColumn
             staticText: '', // Start with empty text, will be filled by synchronization
             bold: formatting.isBold,
             italic: formatting.isItalic,
             underline: formatting.isUnderline,
             fontSize: formatting.fontSize,
             fontFamily: formatting.fontFamily,
             color: formatting.textColor,
             textAlign: formatting.textAlign,
             x: boxX,
             y: boxY,
             width: 120,
             height: 40
         };
         
         // Add click handler for selection
         textBox.addEventListener('click', function(e) {
             e.stopPropagation();
             console.log('Text box clicked (addText):', textBox, 'boxData:', boxData);
             
             // Don't allow selection in preview mode
             if (isPreviewMode) {
                 console.log('Preview mode active - selection disabled');
                 return;
             }
             
             // Check if Ctrl/Cmd key is pressed for multiple selection
             if (e.ctrlKey || e.metaKey) {
                 // Multiple selection mode
                 if (selectedBoxes.find(b => b.element === textBox)) {
                     // Remove from multiple selection
                     removeFromMultipleSelection(boxData);
                 } else {
                     // Add to multiple selection
                     addToMultipleSelection(boxData);
                 }
                 updateMultiSelectionEditor();
             } else {
                 // Single selection mode
                 clearMultipleSelection();
             
             // Remove selection from all boxes
             document.querySelectorAll('.draggable-text-box, .draggable-image-box').forEach(box => {
                 box.classList.remove('selected');
             });
             
             // Select this box
             textBox.classList.add('selected');
             sessionState.selectedBox = boxData;
             
             // Keep transform controls visible when selecting a text box
             showAllTransformControls();
             console.log('Text box selected in addText - keeping transform controls visible');
             updateBoxEditor();
             updateBoxEditorValues(boxData);
                 
                 // Highlight the corresponding box
                 console.log('Highlighting corresponding box for:', boxData);
                 // Highlighting functionality removed
                 
                 // Show record info for the selected box
                 showRecordInfo(boxData);
             }
         });
         
         // Add double-click handler to show transform controls with resize cursors
         textBox.addEventListener('dblclick', function(e) {
             e.stopPropagation();
             console.log('Text box double-clicked (addText) - showing transform controls with resize cursors');
             
             // Don't allow in preview mode
             if (isPreviewMode) {
                 console.log('Preview mode active - transform controls disabled');
                 return;
             }
             
             // Show transform controls for this box
             showTransformControls(textBox);
             
             // Set resize cursors on all transform controls
             const transformControls = textBox.querySelectorAll('.transform-control');
             transformControls.forEach(control => {
                 const handle = control.dataset.handle;
                 switch(handle) {
                     case 'nw': control.style.cursor = 'nw-resize'; break;
                     case 'n': control.style.cursor = 'n-resize'; break;
                     case 'ne': control.style.cursor = 'ne-resize'; break;
                     case 'e': control.style.cursor = 'e-resize'; break;
                     case 'se': control.style.cursor = 'se-resize'; break;
                     case 's': control.style.cursor = 's-resize'; break;
                     case 'sw': control.style.cursor = 'sw-resize'; break;
                     case 'w': control.style.cursor = 'w-resize'; break;
                 }
             });
         });
         
         sessionState.boxes.push(boxData);
         sessionState.selectedBox = boxData;
         currentBoxId = boxCounter;
         
         // Update box editor
         updateBoxEditor();
         updateBoxEditorValues(boxData);
         
         // Update download button state
         updateDownloadButtonState();
         
         // Update page navigation to recalculate recordsPerPage
         updatePageNavigation();
         
         // Update text box scaling to match current PDF viewer state
         // Camera zoom - no manual scaling needed
         
         // Select the text box immediately for editing
         textBox.focus();
         // Remove the problematic select() call - text boxes don't have select() method
         
         // Update text size to fit the initial box dimensions
         updateTextSize(textBox);
         
         // IMPORTANT: Synchronize this individual text box with CSV data
         // This ensures each text box shows the correct data for its position
         const localIndex = (sessionState.boxes.length - 1) % recordsPerPage;
         const recordIndex = currentPage * recordsPerPage + localIndex;
         if (recordIndex < sessionState.csvRows.length) {
             const recordData = sessionState.csvRows[recordIndex];
             const csvText = recordData ? recordData[selectedField] || `Record ${recordIndex + 1}` : `Record ${recordIndex + 1}`;
             textBox.textContent = csvText;
             boxData.staticText = csvText;
             console.log(`Text box ${i + 1} synchronized with record ${recordIndex + 1}: "${csvText}"`);
         }
     } // End of the for loop
 
             // After creating all text boxes, update them with CSV data to ensure synchronization
     await updateAllBoxesWithCSVData();
 
 // After all text boxes are created, show transform controls
 if (boxCount > 0) {
     const lastCreatedBox = sessionState.boxes[sessionState.boxes.length - 1];
     if (lastCreatedBox && lastCreatedBox.type === 'text') {
         console.log('Text box created:', lastCreatedBox);
         // Show transform controls for the last created text box
         showTransformControls(lastCreatedBox.element);
     }
     
     // Show status message with zoom info
     const zoomMessage = currentTransform.scale > 1.5 ? ' (Boxes positioned in visible area)' : '';
     updateEditorStatus(`Text boxes created - drag to position and edit properties${zoomMessage}`);
     
     // Show all transform controls after creating text boxes
     setTimeout(() => {
         showAllTransformControls();
         console.log('Text boxes created - showing all transform controls');
     }, 100);
 }
 }

 async function addImagePlaceholder() {
     console.log('addImagePlaceholder called');
     
     // Save undo state before adding image
     saveUndoState('Add Image Box');
     
     // Don't toggle editor mode for image boxes - they use DOM elements, not canvas
     
     // Show helpful message if zoomed in
     if (currentTransform.scale > 1.5) {
         showZoomHelpIndicator();
     }

     // Check if CSV data is available
     if (!sessionState.csvRows || sessionState.csvRows.length === 0) {
         alert('Please upload CSV data first!');
         return;
     }

     // Get number of boxes to add from dropdown
     const boxCount = parseInt(document.getElementById('boxCountSelect').value) || 1;
     
     // Get available CSV columns
     const csvColumns = sessionState.csvColumns || [];
     if (csvColumns.length === 0) {
         alert('No CSV columns found. Please check your CSV file.');
         return;
     }
     
     // Create field selection modal
     const selectedField = await showFieldSelectionModal(csvColumns, boxCount, 'image');
     if (!selectedField) {
         return; // User cancelled
     }
     
     console.log('Image boxes will be created for CSV field:', selectedField);
     console.log('Available CSV columns:', csvColumns);
     console.log('First few rows of CSV data:', sessionState.csvRows.slice(0, 3).map(row => ({ [selectedField]: row[selectedField] })));
     
     // Add multiple image boxes for the same field across different records
     for (let i = 0; i < boxCount; i++) {
         // Calculate optimal position for this image box
         const position = calculateOptimalBoxPosition('image');
         const boxX = position.x + (i * 20); // Small offset for multiple boxes
         const boxY = position.y + (i * 15);
         
         // Create a DOM-based image box (similar to MERGE-ONLINE approach)
         const imageBox = document.createElement('div');
         imageBox.className = 'draggable-image-box';
         
         imageBox.style.cssText = `
             position: absolute;
             left: ${boxX}px;
             top: ${boxY}px;
             width: 100px;
             height: 100px;
             min-width: 40px;
             min-height: 30px;
             background: transparent;
             border: none;
             cursor: move;
             pointer-events: auto;
             z-index: 10;
             overflow: visible;
             box-sizing: border-box;
             transition: all 0.1s ease;
             transform-origin: top left;
         `;

         // Add custom properties
         imageBox.boxId = ++boxCounter;
         imageBox.boxType = 'image';
         imageBox.fieldKey = selectedField;
         imageBox.imageSource = 'csv';
         imageBox.imageUrl = ''; // Start empty, will be filled by synchronization

         // Set placeholder text initially
         imageBox.textContent = 'Loading...';
         imageBox.style.border = '2px dashed #ccc';
         imageBox.style.background = 'transparent';

                 // Add click handler for selection
 imageBox.addEventListener('click', function(e) {
     e.stopPropagation();
     console.log('Image box clicked:', imageBox);
     
     // Don't allow selection in preview mode
     if (isPreviewMode) {
         console.log('Preview mode active - selection disabled');
         return;
     }
     
     // Check if Ctrl/Cmd key is pressed for multiple selection
     if (e.ctrlKey || e.metaKey) {
         // Multiple selection mode
         const box = sessionState.boxes.find(b => b.element === imageBox);
         if (box) {
             if (selectedBoxes.find(b => b.element === imageBox)) {
                 // Remove from multiple selection
                 removeFromMultipleSelection(box);
             } else {
                 // Add to multiple selection
                 addToMultipleSelection(box);
             }
             updateMultiSelectionEditor();
         }
     } else {
         // Single selection mode
         clearMultipleSelection();
         
         // Remove selected class from all boxes
         document.querySelectorAll('.draggable-image-box, .draggable-text-box').forEach(box => {
             box.classList.remove('selected');
         });
         // Add selected class to this box
         imageBox.classList.add('selected');
         
         // Update session state
         sessionState.selectedBox = imageBox; // Store the DOM element
         currentBoxId = imageBox.boxId;
         
         // Keep transform controls visible when selecting an image box
         showAllTransformControls();
         console.log('Image box selected in addImagePlaceholder - keeping transform controls visible');
         
         // Update box editor
         updateBoxEditor();
         
         // Find the box data
         const box = sessionState.boxes.find(b => b.element === imageBox);
         if (box) {
             console.log('Found box data for image click:', box);
             updateBoxEditorValues(box); // Use the box object for editor values
             
             // Show record info for the selected box
             showRecordInfo(box);
         } else {
             console.log('No box data found for image box:', imageBox);
         }
     }
 });

 // Add double-click handler to show transform controls with resize cursors
 imageBox.addEventListener('dblclick', function(e) {
     e.stopPropagation();
     console.log('Image box double-clicked (addImagePlaceholder) - showing transform controls with resize cursors');
     
     // Don't allow in preview mode
     if (isPreviewMode) {
         console.log('Preview mode active - transform controls disabled');
         return;
     }
     
     // Show transform controls for this box
     showTransformControls(imageBox);
     
     // Set resize cursors on all transform controls
     const transformControls = imageBox.querySelectorAll('.transform-control');
     transformControls.forEach(control => {
         const handle = control.dataset.handle;
         switch(handle) {
             case 'nw': control.style.cursor = 'nw-resize'; break;
             case 'n': control.style.cursor = 'n-resize'; break;
             case 'ne': control.style.cursor = 'ne-resize'; break;
             case 'e': control.style.cursor = 'e-resize'; break;
             case 'se': control.style.cursor = 'se-resize'; break;
             case 's': control.style.cursor = 's-resize'; break;
             case 'sw': control.style.cursor = 'sw-resize'; break;
             case 'w': control.style.cursor = 'w-resize'; break;
         }
     });
 });

     // Add to overlay container (same as text boxes)
     const overlayContainer = document.getElementById('overlayContainer');
     if (!overlayContainer) {
         initEditor();
     }
     overlayContainer.appendChild(imageBox);
     
     // Box will automatically scale with camera zoom
     imageBox.style.transform = '';

     // Add to session state (same structure as text boxes)
     const boxData = {
         id: imageBox.boxId,
         element: imageBox,
         type: 'image',
         boxType: 'image',
         fieldKey: selectedField, // Use fieldKey instead of csvColumn
         imageSource: 'csv',
         imageUrl: '', // Will be filled by synchronization
         x: boxX,
         y: boxY,
         width: 100,
         height: 100
     };
     
     sessionState.boxes.push(boxData);
     sessionState.selectedBox = imageBox; // Store the DOM element, not the box object
     currentBoxId = imageBox.boxId;
     
     // Update box editor
     updateBoxEditor();
     updateBoxEditorValues(boxData);

     // Enable drag and resize for this box
     enableDragResize(imageBox);
     
     // Show orange transform controls as the main selection indicator
     showTransformControls(imageBox);
     
     // Ensure small boxes are draggable
     setTimeout(() => {
         ensureSmallBoxesDraggable();
     }, 50);

     const zoomMessage = currentTransform.scale > 1.5 ? ' (Box positioned in visible area)' : '';
     updateEditorStatus('Image box created - drag it to position and edit properties' + zoomMessage);
     
     // Update download button state to enable downloads
     updateDownloadButtonState();
     
     // Update page navigation to recalculate recordsPerPage
     updatePageNavigation();
     
     // Update image box scaling to match current PDF viewer state
     // Camera zoom - no manual scaling needed
     
     // Set initial placeholder text
     imageBox.textContent = 'Loading...';
     imageBox.style.border = '2px dashed #ccc';
     imageBox.style.background = 'transparent';
     
     console.log(`Image box ${i + 1} created for field: ${selectedField}`);
 } // End of for loop
 
 // After all image boxes are created, synchronize them with CSV data
 // This ensures proper loading and display of images
 setTimeout(async () => {
     await updateAllBoxesWithCSVData();
 }, 100);
 
 // After all image boxes are created, show transform controls and highlight
 if (boxCount > 0) {
     const lastCreatedBox = sessionState.boxes[sessionState.boxes.length - 1];
     if (lastCreatedBox && lastCreatedBox.type === 'image') {
         console.log('Image box created:', lastCreatedBox);
         
         // Show transform controls for the last created image box
         showTransformControls(lastCreatedBox.element);
     }
     
     // Show all transform controls after creating image boxes
     setTimeout(() => {
         showAllTransformControls();
         console.log('Image boxes created - showing all transform controls');
     }, 100);
 }
}





 // Function to enable drag and resize for DOM elements (similar to MERGE-ONLINE)
 function makeDraggable(element) {
     // Make sure Interact.js is available
     if (typeof interact === 'undefined') {
         console.error('Interact.js not loaded');
         return;
     }

     // Enable dragging
     interact(element).draggable({
         listeners: {
             start: function(event) {
                 // Don't allow dragging in preview mode
                 if (isPreviewMode) {
                     console.log('Preview mode active - dragging disabled');
                     return;
                 }
                 
                 console.log('DRAG START TRIGGERED on:', event.target);
                 console.log('Target classes:', event.target.className);
                 console.log('Target size:', event.target.offsetWidth + 'x' + event.target.offsetHeight);
                 
                 // Save undo state before starting drag
                 saveUndoState('Move Box');
                 
                 event.target.classList.add('dragging');
                 console.log('Drag started on:', event.target);
                 
                 // Ensure move cursor during drag
                 event.target.style.cursor = 'move';
                 
                 // Don't show transform controls during drag (only on double-click)
                 // showAllTransformControls();
                 // showTransformControls(event.target);
                 
                 // Don't show blue border during drag (use orange controls instead)
                 // event.target.style.border = '2px dashed #007bff';
                 
                 // If dragging a text overlay, find the parent text box
                 const targetElement = event.target.classList.contains('text-drag-overlay') 
                     ? event.target.parentElement 
                     : event.target;
                 
                 // Find the box object and show identifier
                 const box = sessionState.boxes.find(b => b.element === targetElement);
                 if (box) {
                     console.log('Found box object:', box);
                     showBoxIdentifier(box, true);
                     // Highlighting functionality removed
                 } else {
                     console.log('No box object found for element:', targetElement);
                 }
             },
             move: function(event) {
                 console.log('DRAG MOVE TRIGGERED - dx:', event.dx, 'dy:', event.dy);
                 
                 // If dragging a text overlay, move the parent text box instead
                 const targetElement = event.target.classList.contains('text-drag-overlay') 
                     ? event.target.parentElement 
                     : event.target;
                 
                 const left = parseFloat(targetElement.style.left) + event.dx;
                 const top = parseFloat(targetElement.style.top) + event.dy;
                 
                 if (snapToGridEnabled) {
                     // Apply snap-to-grid when enabled
                     const snappedPosition = snapToGrid(left, top, targetElement);
                     targetElement.style.left = snappedPosition.x + 'px';
                     targetElement.style.top = snappedPosition.y + 'px';
                 } else {
                     // Free movement when snap-to-grid is disabled
                     targetElement.style.left = left + 'px';
                     targetElement.style.top = top + 'px';
                 }
                 
                 // Update the box position in session state
                 const box = sessionState.boxes.find(b => b.element === targetElement);
                 if (box) {
                     box.x = parseFloat(targetElement.style.left);
                     box.y = parseFloat(targetElement.style.top);
                 }
             },
             end: function(event) {
                 event.target.classList.remove('dragging');
                 clearSnapGuides();
                 console.log('Drag ended on:', event.target);
                 
                 // Ensure move cursor is maintained after drag
                 event.target.style.cursor = 'move';
                 
                 // Don't show transform controls when dragging ends (only on double-click)
                 // showAllTransformControls();
                 
                 // Don't hide border when dragging ends (let click handlers manage it)
                 // event.target.style.border = 'none';
                 
                 // Hide identifier when dragging ends
                 const targetElement = event.target.classList.contains('text-drag-overlay') 
                     ? event.target.parentElement 
                     : event.target;
                 
                 const box = sessionState.boxes.find(b => b.element === targetElement);
                 if (box) {
                     console.log('Hiding identifier for box:', box);
                     showBoxIdentifier(box, false);
                     // Highlighting functionality removed
                 }
                 
                 // Don't show transform controls after drag operation (only on double-click)
                 // setTimeout(() => {
                 //     showAllTransformControls();
                 // }, 100);
             }
         }
     });

     // Enable resizing with free movement
     interact(element).resizable({
         edges: { left: true, right: true, top: true, bottom: true },
         // Allow free movement during resize
         inertia: false,
         // Remove any constraints that might cause "flying out" behavior
         modifiers: [
             // Allow extremely small sizes for tiny text
             interact.modifiers.restrictSize({
                 min: { width: 5, height: 4 }
                 // Removed max constraints to allow free resizing
             })
         ],
         listeners: {
             start: function(event) {
                 // Don't allow resizing in preview mode
                 if (isPreviewMode) {
                     console.log('Preview mode active - resizing disabled');
                     return;
                 }
                 
                 // Save undo state before starting resize
                 saveUndoState('Resize Box');
                 
                 console.log('Resize started on:', event.target);
                 
                 // Don't show transform controls during resize (only on double-click)
                 // showAllTransformControls();
                 // showTransformControls(event.target);
                 
                 // Don't show blue border during resize (use orange controls instead)
                 // event.target.style.border = '2px dashed #007bff';
             },
             move: function(event) {
                 const target = event.target;
                 let width = parseFloat(target.style.width);
                 let height = parseFloat(target.style.height);
                 let left = parseFloat(target.style.left);
                 let top = parseFloat(target.style.top);

                 // Update width and height
                 width += event.deltaRect.width;
                 height += event.deltaRect.height;
                 
                 // Update position for left and top edges
                 left += event.deltaRect.left;
                 top += event.deltaRect.top;

                 // Debug resize values
                 console.log('Resize - Delta:', event.deltaRect, 'New size:', width + 'x' + height, 'New pos:', left + ',' + top);

                     // Apply changes with free positioning
                     target.style.width = width + 'px';
                     target.style.height = height + 'px';
                     target.style.left = left + 'px';
                     target.style.top = top + 'px';
             
             // Ensure images maintain aspect ratio after resize
             if (target.classList.contains('draggable-image-box')) {
                 const img = target.querySelector('img');
                 if (img) {
                     img.style.objectFit = 'contain';
                     img.style.objectPosition = 'center';
                     img.style.aspectRatio = 'auto';
                     img.style.imageRendering = 'auto';
                 }
             }
             },
             end: function(event) {
                 console.log('Resize ended on:', event.target);
                 
                 // Ensure move cursor is restored after resize
                 event.target.style.cursor = 'move';
                 
                 // Don't show transform controls when resizing ends (only on double-click)
                 // showAllTransformControls();
                 
                 // Don't hide border when resizing ends (let click handlers manage it)
                 // event.target.style.border = 'none';
                 
                 // Don't show transform controls after resize operation (only on double-click)
                 // setTimeout(() => {
                 //     showAllTransformControls();
                 // }, 100);
             }
         }
     });
 }

 // Function to load static image
 function loadStaticImage(box, imageUrl) {
     console.log('loadStaticImage called with:', box, imageUrl);
     if (!imageUrl) return;
     
     // Try proxy first, then fallback to direct URL
     const proxiedUrl = 'proxy_image.php?url=' + encodeURIComponent(imageUrl);
     console.log('Proxied URL:', proxiedUrl);
     
     // Create image element
     const img = document.createElement('img');
     img.crossOrigin = 'anonymous'; // Add CORS attribute
     img.src = proxiedUrl;
     
     // Add fallback for when proxy fails
     img.onerror = function() {
         console.log('Proxy failed, trying direct URL:', imageUrl);
         this.crossOrigin = 'anonymous';
         this.src = imageUrl;
     };
     img.style.width = '100%';
     img.style.height = '100%';
     img.style.objectFit = 'contain';
     img.style.objectPosition = 'center';
     
     // Add error handling
     img.onerror = function() {
         console.error('Failed to load image:', imageUrl);
         console.error('Error details:', this.src);
         box.element.innerHTML = '<div style="color: red; text-align: center; padding: 10px; font-size: 12px;">Failed to load image<br>' + imageUrl + '</div>';
     };
     
     img.onload = function() {
         console.log('Image loaded successfully:', imageUrl);
     };
     
     // Clear existing content and add image
     box.element.innerHTML = '';
     box.element.style.background = 'transparent';
     box.element.style.border = '2px dashed #ccc';
     box.element.appendChild(img);
     
     // Update box properties
     box.imageUrl = imageUrl;
 }

 // Function to convert Google Drive URLs to direct download URLs
 function convertGoogleDriveUrl(url) {
     if (!url) return url;
     
     // Check if it's a Google Drive sharing link
     const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
     if (driveMatch) {
         const fileId = driveMatch[1];
         // Convert to direct download URL (better for live servers)
         return `https://drive.google.com/uc?export=download&id=${fileId}`;
     }
     
     // Check for other Google Drive URL patterns
     const driveMatch2 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
     if (driveMatch2) {
         const fileId = driveMatch2[1];
         return `https://drive.google.com/uc?export=download&id=${fileId}`;
     }
     
     // Check if it's already a direct Google Drive URL
     if (url.includes('drive.google.com/uc?export=')) {
         return url;
     }
     
     return url;
 }

 // Function to update image box with CSV data
 async function updateImageBoxWithCSVData(box, recordIndex) {
     console.log('updateImageBoxWithCSVData called with:', box, 'recordIndex:', recordIndex);
     if (box.boxType !== 'image' || !box.fieldKey) {
         console.log('Box is not image type or no field key selected');
         return;
     }
     
     // Debug: Check if the field key exists in CSV columns
     if (sessionState.csvColumns && !sessionState.csvColumns.includes(box.fieldKey)) {
         console.warn(`⚠️ Field key "${box.fieldKey}" not found in CSV columns:`, sessionState.csvColumns);
         box.element.innerHTML = '<div style="color: #ffc107; text-align: center; padding: 10px; font-size: 12px; font-weight: bold;">Field Not Found<br><span style="font-size: 10px; color: #6c757d;">"' + box.fieldKey + '" not in CSV</span></div>';
         box.element.style.border = '2px dashed #ffc107';
         box.element.style.background = 'rgba(255, 193, 7, 0.1)';
         return;
     }
     
     console.log(`Image box update - Record index: ${recordIndex}, Field key: ${box.fieldKey}`);
     
     if (recordIndex >= sessionState.csvRows.length) {
         console.log(`No more records available for image box, showing placeholder`);
         box.element.innerHTML = '<div style="color: #6c757d; text-align: center; padding: 10px; font-size:12px;">No Image Available</div>';
         return;
     }
     
     // Get current CSV row data
     const currentRow = sessionState.csvRows[recordIndex];
     if (!currentRow) {
         console.log('No current row data available');
         return;
     }
     
     const imageUrl = currentRow[box.fieldKey];
     console.log('Image URL from CSV:', imageUrl);
     if (!imageUrl) {
         console.log('No image URL found in CSV column');
         return;
     }
     
     // Validate that this is actually a URL, not just text
     if (!imageUrl.includes('http') && !imageUrl.includes('www.') && !imageUrl.includes('.jpg') && !imageUrl.includes('.png') && !imageUrl.includes('.jpeg') && !imageUrl.includes('.gif') && !imageUrl.includes('.webp')) {
         console.warn('⚠️ Invalid image URL detected (appears to be text, not URL):', imageUrl);
         box.element.innerHTML = '<div style="color: #ffc107; text-align: center; padding: 10px; font-size: 12px; font-weight: bold;">Invalid Image Data<br><span style="font-size: 10px; color: #6c757d;">"' + imageUrl + '" is not a valid URL</span></div>';
         box.element.style.border = '2px dashed #ffc107';
         box.element.style.background = 'rgba(255, 193, 7, 0.1)';
         return;
     }
     
     // Clean the URL first (remove extra spaces, newlines, etc.)
     let cleanedUrl = imageUrl.trim().replace(/[\r\n\s]+/g, '_');
     console.log('Original CSV URL:', imageUrl);
     console.log('Cleaned CSV URL:', cleanedUrl);
     
     // Convert Google Drive URLs to direct download URLs
     cleanedUrl = convertGoogleDriveUrl(cleanedUrl);
     console.log('After Google Drive conversion:', cleanedUrl);
     
     // Use enhanced image loading with retry logic
     try {
         console.log('Loading CSV image with enhanced retry logic:', cleanedUrl);
         
         // Show loading state
         box.element.innerHTML = '<div style="color: #6c757d; text-align: center; padding: 10px; font-size: 12px;">Loading image...</div>';
         box.element.style.border = '2px dashed #6c757d';
         box.element.style.background = 'rgba(108, 117, 125, 0.1)';
         
         // Load image with retry logic
         const loadedImg = await loadImageWithRetry(cleanedUrl, 3, 15000);
         
         // Create image element with loaded data
         const img = document.createElement('img');
         img.src = loadedImg.src;
         img.crossOrigin = 'anonymous';
     img.style.width = '100%';
     img.style.height = '100%';
     img.style.objectFit = 'contain';
     img.style.objectPosition = 'center';
     
     img.onload = function() {
         console.log('CSV image loaded successfully:', imageUrl);
         // Clear any error styling
         box.element.style.border = '2px solid #28a745';
         box.element.style.background = 'transparent';
     };
     
     // Clear existing content and add image
     box.element.innerHTML = '';
     box.element.style.background = 'transparent';
     box.element.style.border = '2px dashed #ccc';
     
     // Remove any existing images to prevent accumulation
     const existingImages = box.element.querySelectorAll('img');
     existingImages.forEach(existingImg => existingImg.remove());
     
     box.element.appendChild(img);
         
     } catch (error) {
         console.error('Failed to load CSV image after all retries:', error.message);
         
         // Show error state
         box.element.innerHTML = '<div style="color: #dc3545; text-align: center; padding: 10px; font-size: 12px; font-weight: bold;">Image Load Failed<br><span style="font-size: 10px; color: #6c757d;">' + (imageUrl.length > 30 ? imageUrl.substring(0, 30) + '...' : imageUrl) + '</span><br><span style="font-size: 10px; color: #dc3545;">' + error.message + '</span></div>';
         box.element.style.border = '2px dashed #dc3545';
         box.element.style.background = 'rgba(220, 53, 69, 0.1)';
     }
     
     // Update box properties
     box.imageUrl = imageUrl;
 }

 function duplicateObject() {
     if (!selectedEditorObject || !editorCanvas) return;

     const clone = fabric.util.object.clone(selectedEditorObject);
     clone.set({
         left: selectedEditorObject.left + 20,
         top: selectedEditorObject.top + 20
     });

     editorCanvas.add(clone);
     editorCanvas.setActiveObject(clone);
     updateEditorStatus('Object duplicated');
 }

 function toggleLock() {
     if (!selectedEditorObject) return;

     selectedEditorObject.selectable = !selectedEditorObject.selectable;
     selectedEditorObject.evented = !selectedEditorObject.evented;
     
     const lockBtn = document.getElementById('lockBtn');
     if (selectedEditorObject.selectable) {
         lockBtn.textContent = 'Lock';
         lockBtn.className = 'editor-btn editor-btn-warning';
     } else {
         lockBtn.textContent = 'Unlock';
         lockBtn.className = 'editor-btn editor-btn-success';
     }

     updateEditorStatus(selectedEditorObject.selectable ? 'Object unlocked' : 'Object locked');
 }

 function deleteObject() {
     if (!selectedEditorObject || !editorCanvas) return;

     editorCanvas.remove(selectedEditorObject);
     editorCanvas.discardActiveObject();
     updateEditorStatus('Object deleted');
 }

 function clearCanvas() {
     if (!editorCanvas) return;

     if (confirm('Are you sure you want to clear all objects?')) {
         editorCanvas.clear();
         updateEditorStatus('Canvas cleared');
     }
 }

 function onEditorObjectSelected(e) {
     selectedEditorObject = e.target;
     updateEditorSidebar();
     updateEditorButtonStates(true);
     updateEditorStatus('Object selected');
 }

 function onEditorObjectDeselected() {
     selectedEditorObject = null;
     document.getElementById('editorSidebar').classList.remove('active');
     updateEditorButtonStates(false);
     updateEditorStatus('No object selected');
 }

 function onEditorObjectModified(e) {
     updateEditorSidebar();
     updateEditorStatus('Object modified');
 }

 function onEditorObjectMoving(e) {
     if (gridSize > 0) {
         const obj = e.target;
         obj.set({
             left: Math.round(obj.left / gridSize) * gridSize,
             top: Math.round(obj.top / gridSize) * gridSize
         });
     }
 }

 function onEditorObjectScaling(e) {
     if (gridSize > 0) {
         const obj = e.target;
         obj.set({
             width: Math.round(obj.width / gridSize) * gridSize,
             height: Math.round(obj.height / gridSize) * gridSize
         });
     }
 }

 function updateEditorSidebar() {
     if (!selectedEditorObject) return;

     document.getElementById('editorSidebar').classList.add('active');

     // Get object metadata
     const meta = selectedEditorObject.meta || {};

     // Update form fields
     document.getElementById('bindField').value = meta.bind || '';
     document.getElementById('staticContent').value = meta.static || '';
     document.getElementById('posX').value = Math.round(selectedEditorObject.left);
     document.getElementById('posY').value = Math.round(selectedEditorObject.top);
     document.getElementById('width').value = Math.round(selectedEditorObject.width || selectedEditorObject.scaleX * 100);
     document.getElementById('height').value = Math.round(selectedEditorObject.height || selectedEditorObject.scaleY * 100);

     // Add event listeners for form changes
     document.getElementById('bindField').onchange = updateEditorObjectMeta;
     document.getElementById('staticContent').oninput = updateEditorObjectMeta;
     document.getElementById('posX').onchange = updateEditorObjectPosition;
     document.getElementById('posY').onchange = updateEditorObjectPosition;
     document.getElementById('width').onchange = updateEditorObjectSize;
     document.getElementById('height').onchange = updateEditorObjectSize;
 }

 function updateEditorObjectMeta() {
     if (!selectedEditorObject) return;

     selectedEditorObject.meta = {
         bind: document.getElementById('bindField').value,
         static: document.getElementById('staticContent').value
     };

     // Update text content if it's a text object
     if (selectedEditorObject.type === 'text' && document.getElementById('staticContent').value) {
         selectedEditorObject.set('text', document.getElementById('staticContent').value);
     }

     editorCanvas.renderAll();
 }

 function updateEditorObjectPosition() {
     if (!selectedEditorObject) return;

     selectedEditorObject.set({
         left: parseInt(document.getElementById('posX').value),
         top: parseInt(document.getElementById('posY').value)
     });

     editorCanvas.renderAll();
 }

 function updateEditorObjectSize() {
     if (!selectedEditorObject) return;

     const width = parseInt(document.getElementById('width').value);
     const height = parseInt(document.getElementById('height').value);

     if (selectedEditorObject.type === 'text') {
         selectedEditorObject.set('fontSize', Math.min(width, height) / 2);
     } else {
         selectedEditorObject.set({
             width: width,
             height: height
         });
     }

     editorCanvas.renderAll();
 }

 function updateEditorButtonStates(enabled) {
     document.getElementById('duplicateBtn').disabled = !enabled;
     document.getElementById('lockBtn').disabled = !enabled;
     document.getElementById('deleteBtn').disabled = !enabled;
 }

 // Helper function to get box object from selected DOM element
 function getSelectedBoxObject() {
     if (!sessionState.selectedBox) return null;
     
     // If selectedBox is already a box object, return it
     if (sessionState.selectedBox.boxId && sessionState.selectedBox.boxType) {
         return sessionState.selectedBox;
     }
     
     // If selectedBox is a DOM element, find the corresponding box object
     if (sessionState.selectedBox.classList) {
         return sessionState.boxes.find(box => box.element === sessionState.selectedBox);
     }
     
     return null;
 }

 // Auto-cleanup function to delete temporary files on page refresh
 function cleanupTemporaryFiles() {
     console.log('Cleaning up temporary files...');
     
     // Clean up uploads folder
     fetch('cleanup_files.php', {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json',
         },
         body: JSON.stringify({
             action: 'cleanup',
             folders: ['uploads', 'layouts', 'runtime']
         })
     })
     .then(response => response.json())
     .then(data => {
         if (data.success) {
             console.log('Temporary files cleaned up successfully');
         } else {
             console.log('Cleanup completed with warnings:', data.message);
         }
     })
     .catch(error => {
         console.log('Cleanup error (non-critical):', error);
     });
 }

 // Run cleanup on page load/refresh
 window.addEventListener('load', cleanupTemporaryFiles);
 
 // Also run cleanup before page unload (additional safety)
 window.addEventListener('beforeunload', cleanupTemporaryFiles);

 // Enhanced Box Management Functions
 function updateBoxEditor() {
     const deleteBoxBtn = document.getElementById('deleteBoxBtn');
     if (sessionState.selectedBox) {
         // Enable delete button when a box is selected
         if (deleteBoxBtn) {
             deleteBoxBtn.disabled = false;
         }
     } else {
         // Disable delete button when no box is selected
         if (deleteBoxBtn) {
             deleteBoxBtn.disabled = true;
         }
         
         // Hide record info when no box is selected
         const recordInfoDisplay = document.getElementById('recordInfoDisplay');
         if (recordInfoDisplay) {
             recordInfoDisplay.style.display = 'none';
         }
     }
     
     // Update the create records button state
     updateCreateRecordsButtonState();
 }

 function updateBoxEditorValues(box) {
     if (!box) return;

     // Update field key dropdown
     updateFieldKeyDropdown(box);
     


     // Update font size input
     const fontSizeInput = document.getElementById('fontSizeInput');
     if (fontSizeInput) {
         if (selectedBoxes.length > 1) {
             const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
             const allSameSize = textBoxes.every(b => b.fontSize === textBoxes[0].fontSize);
             fontSizeInput.value = allSameSize ? textBoxes[0].fontSize : '';
         } else {
             fontSizeInput.value = box.fontSize || 16;
         }
     }

     // Update font family select
     const fontFamilySelect = document.getElementById('fontFamilySelect');
     if (fontFamilySelect) {
         if (selectedBoxes.length > 1) {
             const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
             const allSameFamily = textBoxes.every(b => b.fontFamily === textBoxes[0].fontFamily);
             fontFamilySelect.value = allSameFamily ? textBoxes[0].fontFamily : '';
         } else {
             fontFamilySelect.value = box.fontFamily || 'Arial';
         }
     }

     // Update color input
     const colorInput = document.getElementById('colorInput');
     if (colorInput) {
         if (selectedBoxes.length > 1) {
             const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
             const allSameColor = textBoxes.every(b => b.color === textBoxes[0].color);
             colorInput.value = allSameColor ? textBoxes[0].color : '';
         } else {
             colorInput.value = box.color || '#000000';
         }
     }

     // Update bold button
     const boldBtn = document.getElementById('boldBtn');
     if (boldBtn) {
         if (selectedBoxes.length > 1) {
             const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
             const allBold = textBoxes.every(b => b.bold);
             const allNotBold = textBoxes.every(b => !b.bold);
             boldBtn.classList.toggle('active', allBold);
             boldBtn.classList.toggle('mixed', !allBold && !allNotBold);
         } else {
             boldBtn.classList.toggle('active', box.bold);
             boldBtn.classList.remove('mixed');
         }
     }

     // Update italic button
     const italicBtn = document.getElementById('italicBtn');
     if (italicBtn) {
         if (selectedBoxes.length > 1) {
             const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
             const allItalic = textBoxes.every(b => b.italic);
             const allNotItalic = textBoxes.every(b => !b.italic);
             italicBtn.classList.toggle('active', allItalic);
             italicBtn.classList.toggle('mixed', !allItalic && !allNotItalic);
         } else {
             italicBtn.classList.toggle('active', box.italic);
             italicBtn.classList.remove('mixed');
         }
     }

     // Add event listeners
     addBoxEditorEventListeners(box);
 }

 function addBoxEditorEventListeners(box) {
     // CSV Column change
     const columnSelect = document.getElementById('boxColumnSelect');
     if (columnSelect) {
         columnSelect.onchange = async function() {
             if (selectedBoxes.length > 1) {
                 // Apply to all selected text boxes
                 const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
                 textBoxes.forEach(selectedBox => {
                     selectedBox.fieldKey = this.value;
                     if (selectedBox.boxType === 'text') {
                         updateTextBoxContent(selectedBox);
                     }
                 });
                 
                 // Update page navigation to ensure synchronization
                 updatePageNavigation();
                 
                 updateEditorStatus(`Applied field key to ${textBoxes.length} text boxes: ${this.value || 'None'}`);
             } else {
                 // Single box
         box.fieldKey = this.value;
             if (box.boxType === 'text') {
         updateTextBoxContent(box);
             } else if (box.boxType === 'image' && box.imageSource === 'csv') {
                 // Calculate the record index for this box using unified calculation
                 const boxIndex = sessionState.boxes.indexOf(box);
                 const recordIndex = currentPage * recordsPerPage + (boxIndex % recordsPerPage);
                 await updateImageBoxWithCSVData(box, recordIndex);
             }
         updateEditorStatus(`Box bound to field key: ${this.value || 'None'}`);
                 
                 // Field changed - highlighting functionality removed
                 console.log('Field changed for box:', box);
                 
                 // Update page navigation to ensure synchronization
                 updatePageNavigation();
             }
         updateCreateRecordsButtonState();
         };
     }
     
     // Font size change
     const fontSizeInput = document.getElementById('fontSizeInput');
     if (fontSizeInput) {
         fontSizeInput.onchange = function() {
             if (selectedBoxes.length > 1) {
                 // Apply to all selected text boxes
                 const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
                 textBoxes.forEach(selectedBox => {
                     selectedBox.fontSize = parseInt(this.value);
                     updateTextBoxFont(selectedBox);
                 });
                 updateEditorStatus(`Applied font size to ${textBoxes.length} text boxes: ${this.value}`);
             } else {
                 // Single box
                 box.fontSize = parseInt(this.value);
                 updateTextBoxFont(box);
                 updateEditorStatus(`Font size updated: ${this.value}`);
             }
         };
     }
     
     // Font family change
     const fontFamilySelect = document.getElementById('fontFamilySelect');
     if (fontFamilySelect) {
         fontFamilySelect.onchange = function() {
             if (selectedBoxes.length > 1) {
                 // Apply to all selected text boxes
                 const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
                 textBoxes.forEach(selectedBox => {
                     selectedBox.fontFamily = this.value;
                     updateTextBoxFont(selectedBox);
                 });
                 updateEditorStatus(`Applied font family to ${textBoxes.length} text boxes: ${this.value}`);
             } else {
                 // Single box
                 box.fontFamily = this.value;
                 updateTextBoxFont(box);
                 updateEditorStatus(`Font family updated: ${this.value}`);
             }
         };
     }
     
     // Color change
     const colorInput = document.getElementById('colorInput');
     if (colorInput) {
         colorInput.onchange = function() {
             if (selectedBoxes.length > 1) {
                 // Apply to all selected text boxes
                 const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
                 textBoxes.forEach(selectedBox => {
                     selectedBox.color = this.value;
                     updateTextBoxFont(selectedBox);
                 });
                 updateEditorStatus(`Applied color to ${textBoxes.length} text boxes: ${this.value}`);
             } else {
                 // Single box
                 box.color = this.value;
                 updateTextBoxFont(box);
                 updateEditorStatus(`Color updated: ${this.value}`);
             }
         };
     }
     
     // Bold toggle
     const boldBtn = document.getElementById('boldBtn');
     if (boldBtn) {
         boldBtn.onclick = function() {
             if (selectedBoxes.length > 1) {
                 // Apply to all selected text boxes
                 const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
                 textBoxes.forEach(selectedBox => {
                     selectedBox.bold = !selectedBox.bold;
                     updateTextBoxFont(selectedBox);
                 });
                 updateEditorStatus(`Applied bold to ${textBoxes.length} text boxes`);
             } else {
                 // Single box
                 box.bold = !box.bold;
                 updateTextBoxFont(box);
                 updateEditorStatus(`Bold ${box.bold ? 'enabled' : 'disabled'}`);
             }
         };
     }
     
     // Italic toggle
     const italicBtn = document.getElementById('italicBtn');
     if (italicBtn) {
         italicBtn.onclick = function() {
             if (selectedBoxes.length > 1) {
                 // Apply to all selected text boxes
                 const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
                 textBoxes.forEach(selectedBox => {
                     selectedBox.italic = !selectedBox.italic;
                     updateTextBoxFont(selectedBox);
                 });
                 updateEditorStatus(`Applied italic to ${textBoxes.length} text boxes`);
             } else {
                 // Single box
                 box.italic = !box.italic;
                 updateTextBoxFont(box);
                 updateEditorStatus(`Italic ${box.italic ? 'enabled' : 'disabled'}`);
             }
         };
     }
 }

 function duplicateSelectedBox() {
     if (!sessionState.selectedBox) return;

     const original = sessionState.selectedBox;
     const originalBoxObject = getSelectedBoxObject();
     
     if (original.style) {
         // DOM element - create a new DOM element
         const clone = original.cloneNode(true);
         clone.boxId = ++boxCounter;
         clone.boxType = originalBoxObject ? originalBoxObject.boxType : 'text';
         clone.fieldKey = originalBoxObject ? originalBoxObject.fieldKey : '';
         clone.imageSource = originalBoxObject ? originalBoxObject.imageSource : '';
         clone.imageUrl = originalBoxObject ? originalBoxObject.imageUrl : '';
         
         // Offset the clone
         const originalLeft = parseFloat(original.style.left) || 0;
         const originalTop = parseFloat(original.style.top) || 0;
         clone.style.left = (originalLeft + 20) + 'px';
         clone.style.top = (originalTop + 20) + 'px';
         

         
         // Add click handler for selection
         clone.addEventListener('click', function(e) {
             e.stopPropagation();
             // Remove selection from all boxes
             document.querySelectorAll('.draggable-image-box, .draggable-text-box').forEach(box => {
                 box.classList.remove('selected');
             });
             clone.classList.add('selected');
             sessionState.selectedBox = clone;
             currentBoxId = clone.boxId;
             updateBoxEditor();
             updateBoxEditorValues(clone);
         });
         
         // Add to PDF viewer and enable drag/resize
         const pdfViewer = document.getElementById('pdfViewer');
         pdfViewer.appendChild(clone);
         makeDraggable(clone);
         
         // Create a proper box object for the clone
         const cloneBoxObject = {
             boxId: clone.boxId,
             boxType: clone.boxType,
             fieldKey: clone.fieldKey,
             imageSource: clone.imageSource,
             imageUrl: clone.imageUrl,
             element: clone
         };
         
         sessionState.boxes.push(cloneBoxObject);
         sessionState.selectedBox = clone;
         currentBoxId = clone.boxId;
         updateBoxEditorValues(cloneBoxObject);
     } else {
         // Fabric.js object
         if (!editorCanvas) return;
     const clone = fabric.util.object.clone(original);
     
     // Offset the clone
     clone.set({
         left: original.left + 20,
         top: original.top + 20,
         boxId: ++boxCounter
     });

     // Copy custom properties
     clone.boxType = original.boxType;
                     clone.fieldKey = original.fieldKey;
     clone.staticText = original.staticText;
     clone.bold = original.bold;
     clone.italic = original.italic;
     clone.underline = original.underline;
     clone.imageSource = original.imageSource;
     clone.imageUrl = original.imageUrl;

     editorCanvas.add(clone);
     sessionState.boxes.push(clone);
     
     // Select the new clone
     sessionState.selectedBox = clone;
     currentBoxId = clone.boxId;
     updateBoxEditorValues(clone);
     }
     
     updateEditorStatus('Box duplicated');
     
     // Update download button state after duplication
     updateDownloadButtonState();
 }

 // Simple delete function based on MERGE-ONLINE approach
 function deleteSelectedBox() {
     if (!sessionState.selectedBox) return;

     // Save undo state before deleting
     saveUndoState('Delete Box');

     const selectedItem = sessionState.selectedBox;
     
     console.log('=== DELETE DEBUG ===');
     console.log('Selected item:', selectedItem);
     console.log('Selected item type:', typeof selectedItem);
     console.log('Selected item properties:', Object.keys(selectedItem));
     console.log('sessionState.boxes:', sessionState.boxes);
     console.log('Boxes length:', sessionState.boxes.length);
     
     // Determine if selectedItem is a box object or DOM element
     let boxObject = null;
     let domElement = null;
     
     if (selectedItem.element && selectedItem.boxId) {
         // It's a box object with an element property
         boxObject = selectedItem;
         domElement = selectedItem.element;
         console.log('Found box object with element property');
     } else if (selectedItem.classList && (selectedItem.classList.contains('draggable-text-box') || selectedItem.classList.contains('draggable-image-box'))) {
         // It's a DOM element, find the corresponding box object
         domElement = selectedItem;
         boxObject = sessionState.boxes.find(box => box.element === selectedItem);
         console.log('Found DOM element, looking for box object:', boxObject);
     } else {
         // It's a box object stored directly
         boxObject = selectedItem;
         domElement = selectedItem.element || null;
         console.log('Found box object stored directly');
     }
     
     if (boxObject) {
         console.log('Box object found, removing...');
         
         // Remove from DOM if we have a DOM element
         if (domElement && domElement.remove) {
             domElement.remove();
             console.log('DOM element removed');
         } else {
             console.log('No DOM element to remove or remove method not available');
         }
         
         // Remove from session state using ID (like MERGE-ONLINE)
         if (boxObject.boxId) {
             sessionState.boxes = sessionState.boxes.filter(box => box.boxId !== boxObject.boxId);
         } else if (boxObject.id) {
             sessionState.boxes = sessionState.boxes.filter(box => box.id !== boxObject.id);
         } else {
             // Remove by direct reference if no ID
             sessionState.boxes = sessionState.boxes.filter(box => box !== boxObject);
         }
         console.log('Box removed from sessionState.boxes');
     
     // Clear selection and remove selected class from all boxes
     document.querySelectorAll('.draggable-text-box.selected, .draggable-image-box.selected').forEach(box => {
         box.classList.remove('selected');
     });
     sessionState.selectedBox = null;
     
     // Hide record info when no box is selected
     // hideRecordInfo();
     
     // Keep transform controls visible after deleting a box
     showAllTransformControls();
     console.log('Box deleted - keeping transform controls visible');
     
     // Hide box editor
     updateBoxEditor();
     
     updateEditorStatus('Box deleted');
     
     // Update download button state after deletion
     updateDownloadButtonState();
     
     // Update box scaling after deletion
     // Camera zoom - no manual scaling needed
     // Camera zoom - no manual scaling needed
     
     // Show transform controls for remaining boxes
     showAllTransformControls();
     } else {
         console.error('Box not found in sessionState.boxes');
         console.log('Available boxes:', sessionState.boxes);
         updateEditorStatus('Error: Box not found');
     }
 }





 // Undo/Redo System
 let undoStack = [];
 let redoStack = [];
 const MAX_UNDO_STEPS = 50;

 // Initialize undo/redo system
 function initializeUndoSystem() {
     // Save initial state when app loads
     saveUndoState('Initial State');
 }

 // Save current state to undo stack
 function saveUndoState(action) {
     const state = {
         action: action,
         timestamp: Date.now(),
         boxes: JSON.parse(JSON.stringify(sessionState.boxes)),
         currentPage: currentPage,
         recordsPerPage: recordsPerPage
     };
     
     undoStack.push(state);
     
     // Limit undo stack size
     if (undoStack.length > MAX_UNDO_STEPS) {
         undoStack.shift();
     }
     
     // Clear redo stack when new action is performed
     redoStack = [];
     
     // Update undo/redo button states
     updateUndoRedoButtons();
     
     console.log(`Undo state saved: ${action} (${undoStack.length} states)`);
 }

 // Undo last action
 function undoLastAction() {
     if (undoStack.length <= 1) {
         console.log('Nothing to undo');
         return;
     }
     
     // Move current state to redo stack
     const currentState = undoStack.pop();
     redoStack.push(currentState);
     
     // Get previous state
     const previousState = undoStack[undoStack.length - 1];
     
     // Restore state
     restoreState(previousState);
     
     console.log(`Undone: ${currentState.action}`);
 }

 // Redo last undone action
 function redoLastAction() {
     if (redoStack.length === 0) {
         console.log('Nothing to redo');
         return;
     }
     
     // Get state from redo stack
     const stateToRedo = redoStack.pop();
     undoStack.push(stateToRedo);
     
     // Restore state
     restoreState(stateToRedo);
     
     console.log(`Redone: ${stateToRedo.action}`);
 }

 // Restore application state
 function restoreState(state) {
     // Clear current boxes
     clearAllBoxes();
     
     // Restore boxes from state
     state.boxes.forEach(boxData => {
         if (boxData.type === 'text') {
             restoreTextBox(boxData);
         } else if (boxData.type === 'image') {
             restoreImageBox(boxData);
         }
     });
     
     // Restore page state
     currentPage = state.currentPage;
     recordsPerPage = state.recordsPerPage;
     
     // Update UI
     updatePageNavigation();
     updateDownloadButtonState();
     updateAllBoxesWithCSVData();
     
     // Update undo/redo button states
     updateUndoRedoButtons();
     
     console.log(`State restored: ${state.action}`);
 }

 // Clear all boxes from the UI
 function clearAllBoxes() {
     // Remove all boxes from DOM
     document.querySelectorAll('.draggable-text-box, .draggable-image-box').forEach(box => {
         box.remove();
     });
     
     // Clear session state
     sessionState.boxes = [];
     sessionState.selectedBox = null;
 }

 // Restore text box from state
 function restoreTextBox(boxData) {
     const textBox = document.createElement('div');
     textBox.className = 'draggable-text-box';
     textBox.boxId = boxData.id;
     textBox.style.left = boxData.left + 'px';
     textBox.style.top = boxData.top + 'px';
     textBox.style.width = boxData.width + 'px';
     textBox.style.height = boxData.height + 'px';
     textBox.style.fontSize = boxData.fontSize + 'px';
     textBox.style.fontWeight = boxData.fontWeight;
     textBox.style.color = boxData.color;
     textBox.style.backgroundColor = boxData.backgroundColor;
     textBox.style.border = boxData.border;
     textBox.style.borderRadius = boxData.borderRadius;
     textBox.style.padding = boxData.padding;
     textBox.style.textAlign = boxData.textAlign;
     textBox.style.display = boxData.display;
     textBox.style.lineHeight = boxData.lineHeight;
     textBox.textContent = boxData.text;
     textBox.contentEditable = false;
     textBox.style.transform = '';
     
     // Add to overlay container
     const overlayContainer = document.getElementById('overlayContainer');
     if (overlayContainer) {
         overlayContainer.appendChild(textBox);
         makeDraggable(textBox);
         
         // Explicitly add resize handles for text boxes
         addResizeHandles(textBox);
     }
     
     // Add to session state
     sessionState.boxes.push({
         id: boxData.id,
         element: textBox,
         type: 'text',
         left: boxData.left,
         top: boxData.top,
         width: boxData.width,
         height: boxData.height,
         text: boxData.text,
         fontSize: boxData.fontSize,
         fontWeight: boxData.fontWeight,
         color: boxData.color,
         backgroundColor: boxData.backgroundColor,
         border: boxData.border,
         borderRadius: boxData.borderRadius,
         padding: boxData.padding,
         textAlign: boxData.textAlign,
         display: boxData.display,
         lineHeight: boxData.lineHeight
     });
 }

 // Restore image box from state
 function restoreImageBox(boxData) {
     const imageBox = document.createElement('div');
     imageBox.className = 'draggable-image-box';
     imageBox.boxId = boxData.id;
     imageBox.style.left = boxData.left + 'px';
     imageBox.style.top = boxData.top + 'px';
     imageBox.style.width = boxData.width + 'px';
     imageBox.style.height = boxData.height + 'px';
     imageBox.style.border = boxData.border;
     imageBox.style.borderRadius = boxData.borderRadius;
     imageBox.style.overflow = boxData.overflow;
     imageBox.style.display = boxData.display;
     imageBox.style.transform = '';
     
     // Restore image if it exists
     if (boxData.imageUrl) {
         const img = document.createElement('img');
         img.src = boxData.imageUrl;
         img.style.width = '100%';
         img.style.height = '100%';
         img.style.objectFit = 'cover';
         imageBox.appendChild(img);
     } else {
         imageBox.textContent = boxData.text || 'Image';
     }
     
     // Add to overlay container
     const overlayContainer = document.getElementById('overlayContainer');
     if (overlayContainer) {
         overlayContainer.appendChild(imageBox);
         enableDragResize(imageBox);
     }
     
     // Add to session state
     sessionState.boxes.push({
         id: boxData.id,
         element: imageBox,
         type: 'image',
         left: boxData.left,
         top: boxData.top,
         width: boxData.width,
         height: boxData.height,
         imageUrl: boxData.imageUrl,
         text: boxData.text,
         border: boxData.border,
         borderRadius: boxData.borderRadius,
         overflow: boxData.overflow,
         display: boxData.display
     });
 }

 // Update undo/redo button states
 function updateUndoRedoButtons() {
     const undoBtn = document.getElementById('undoBtn');
     const redoBtn = document.getElementById('redoBtn');
     
     if (undoBtn) {
         undoBtn.disabled = undoStack.length <= 1;
         undoBtn.title = undoStack.length <= 1 ? 'Nothing to undo' : `Undo: ${undoStack[undoStack.length - 1]?.action || 'Unknown'}`;
     }
     
     if (redoBtn) {
         redoBtn.disabled = redoStack.length === 0;
         redoBtn.title = redoStack.length === 0 ? 'Nothing to redo' : `Redo: ${redoStack[redoStack.length - 1]?.action || 'Unknown'}`;
     }
 }

 // Keyboard shortcuts for box management
 function setupKeyboardShortcuts() {
     document.addEventListener('keydown', function(e) {
         // Ctrl+Z for undo
         if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
             e.preventDefault();
             undoLastAction();
             return;
         }
         
         // Ctrl+Y or Ctrl+Shift+Z for redo
         if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
             e.preventDefault();
             redoLastAction();
             return;
         }
         
         // Delete key to delete selected box
         if (e.key === 'Delete' || e.key === 'Backspace') {
             if (sessionState.selectedBox) {
                 e.preventDefault();
                 deleteSelectedBox();
             }
         }
         
         // Escape key to deselect
         if (e.key === 'Escape') {
             if (sessionState.selectedBox) {
                 e.preventDefault();
                 document.querySelectorAll('.draggable-text-box.selected, .draggable-image-box.selected').forEach(box => {
                     box.classList.remove('selected');
                 });
                 sessionState.selectedBox = null;
                 
                 // Hide record info when no box is selected
                 // hideRecordInfo();
                 
                 // Keep transform controls visible when deselecting with Escape
                 showAllTransformControls();
                 console.log('Boxes deselected with Escape - keeping transform controls visible');
                 
                 updateBoxEditor();
             }
         }
         
         // Space key to show all transform controls
         if (e.key === ' ') {
             e.preventDefault();
             showAllTransformControls();
         }
         
         // P key to toggle preview mode
         if (e.key === 'p' || e.key === 'P') {
             e.preventDefault();
             togglePreviewMode();
         }
     });

     // Right-click context menu for boxes
     document.addEventListener('contextmenu', function(e) {
         const target = e.target;
         if (target.classList.contains('draggable-text-box') || target.classList.contains('draggable-image-box')) {
             e.preventDefault();
             
             // Don't allow context menu in preview mode
             if (isPreviewMode) {
                 console.log('Preview mode active - context menu disabled');
                 return;
             }
             
             // Select the box if not already selected
             if (!target.classList.contains('selected')) {
                 document.querySelectorAll('.draggable-text-box, .draggable-image-box').forEach(box => {
                     box.classList.remove('selected');
                 });
                 target.classList.add('selected');
                 
                 // Update session state
                 const boxObject = sessionState.boxes.find(b => b.element === target);
                 if (boxObject) {
                     sessionState.selectedBox = target; // Store the DOM element for consistency
                     updateBoxEditor();
                     updateBoxEditorValues(boxObject);
                     
                     // Show record info for the selected box
                     showRecordInfo(boxObject);
                 }
             }
             
             // Show context menu
             showBoxContextMenu(e.clientX, e.clientY, target);
         }
     });
 }

 // Context menu for boxes
 function showBoxContextMenu(x, y, boxElement) {
     // Remove existing context menu
     const existingMenu = document.getElementById('boxContextMenu');
     if (existingMenu) {
         existingMenu.remove();
     }
     
     // Create context menu
     const contextMenu = document.createElement('div');
     contextMenu.id = 'boxContextMenu';
     contextMenu.style.cssText = `
         position: fixed;
         top: ${y}px;
         left: ${x}px;
         background: white;
         border: 1px solid #ccc;
         border-radius: 4px;
         box-shadow: 0 2px 10px rgba(0,0,0,0.2);
         z-index: 1000;
         min-width: 150px;
         font-size: 14px;
     `;
     
     // Delete option
     const deleteOption = document.createElement('div');
     deleteOption.style.cssText = `
         padding: 8px 12px;
         cursor: pointer;
         border-bottom: 1px solid #eee;
         display: flex;
         align-items: center;
         gap: 8px;
     `;
     deleteOption.innerHTML = '🗑️ Delete Box';
     deleteOption.addEventListener('click', function() {
         deleteBox(boxElement);
         contextMenu.remove();
     });
     deleteOption.addEventListener('mouseenter', function() {
         this.style.background = '#f8f9fa';
     });
     deleteOption.addEventListener('mouseleave', function() {
         this.style.background = 'white';
     });
     
     // Duplicate option
     const duplicateOption = document.createElement('div');
     duplicateOption.style.cssText = `
         padding: 8px 12px;
         cursor: pointer;
         display: flex;
         align-items: center;
         gap: 8px;
     `;
     duplicateOption.innerHTML = '📋 Duplicate Box';
     duplicateOption.addEventListener('click', function() {
         duplicateSelectedBox();
         contextMenu.remove();
     });
     duplicateOption.addEventListener('mouseenter', function() {
         this.style.background = '#f8f9fa';
     });
     duplicateOption.addEventListener('mouseleave', function() {
         this.style.background = 'white';
     });
     
     contextMenu.appendChild(deleteOption);
     contextMenu.appendChild(duplicateOption);
     

     document.body.appendChild(contextMenu);
     
     // Close context menu when clicking outside
     setTimeout(() => {
         document.addEventListener('click', function closeMenu() {
             contextMenu.remove();
             document.removeEventListener('click', closeMenu);
         });
     }, 100);
 }

 // Simple drag functionality for text boxes
 function makeDraggable(element) {
     let isDragging = false;
     let isResizing = false;
     let currentX;
     let currentY;
     let initialX;
     let initialY;
     let xOffset = 0;
     let yOffset = 0;
     let initialWidth;
     let initialHeight;
     let resizeHandle = '';

     // Add resize handles
     addResizeHandles(element);

     // Use mousedown on the element itself
     element.addEventListener('mousedown', dragStart);
     
     // Use document-level events for better drag handling
     document.addEventListener('mousemove', drag);
     document.addEventListener('mouseup', dragEnd);

     function dragStart(e) {
         // Prevent event from bubbling to PDF viewer
         e.stopPropagation();
         
         // Check if clicking on resize handle
         if (e.target.classList.contains('transform-control')) {
             isResizing = true;
             isDragging = false;
             resizeHandle = e.target.dataset.handle;
             initialWidth = element.offsetWidth;
             initialHeight = element.offsetHeight;
             initialX = e.clientX;
             initialY = e.clientY;
             element.style.cursor = 'nwse-resize';
             element.classList.add('resizing');
             return;
         }

         // Normal dragging
         if (e.target === element) {
             isDragging = true;
             isResizing = false;
             
             // Get current position (accounting for any existing transform)
             const currentLeft = parseInt(element.style.left) || 0;
             const currentTop = parseInt(element.style.top) || 0;
             
             // Reset any existing transform
             element.style.transform = 'translate(0px, 0px)';
             
             // Initialize drag tracking
             initialX = e.clientX - currentLeft;
             initialY = e.clientY - currentTop;
             xOffset = currentLeft;
             yOffset = currentTop;
             
             element.style.cursor = 'grabbing';
             element.style.zIndex = '30';
         }
     }

     function drag(e) {
         if (isResizing) {
             e.preventDefault();
             e.stopPropagation();
             const deltaX = e.clientX - initialX;
             const deltaY = e.clientY - initialY;
             
             // Get the PDF canvas area for boundary constraints
             const pdfViewer = document.getElementById('pdfViewer');
             const pdfCanvas = document.getElementById('viewer');
             const viewerRect = pdfViewer.getBoundingClientRect();
             const canvasRect = pdfCanvas.getBoundingClientRect();
             const elementRect = element.getBoundingClientRect();
             
             // Calculate PDF canvas boundaries relative to viewer
             const canvasLeft = canvasRect.left - viewerRect.left;
             const canvasTop = canvasRect.top - viewerRect.top;
             const canvasRight = canvasLeft + canvasRect.width;
             const canvasBottom = canvasTop + canvasRect.height;
             
             // Calculate new dimensions and positions with constraints
             let newWidth = initialWidth;
             let newHeight = initialHeight;
             let newLeft = parseInt(element.style.left) || 0;
             let newTop = parseInt(element.style.top) || 0;
             
             // Handle right edge resize
             if (resizeHandle.includes('e')) {
                 newWidth = Math.max(20, initialWidth + deltaX);
                 // Constrain to PDF canvas width
                 const maxWidth = canvasRight - newLeft;
                 newWidth = Math.min(newWidth, maxWidth);
             }
             
             // Handle left edge resize
             if (resizeHandle.includes('w')) {
                 const proposedWidth = Math.max(20, initialWidth - deltaX);
                 const proposedLeft = newLeft + (initialWidth - proposedWidth);
                 
                 // Constrain to PDF canvas boundaries
                 if (proposedLeft >= canvasLeft && proposedLeft + proposedWidth <= canvasRight) {
                     newWidth = proposedWidth;
                     newLeft = proposedLeft;
                 }
             }
             
             // Handle bottom edge resize
             if (resizeHandle.includes('s')) {
                 newHeight = Math.max(15, initialHeight + deltaY);
                 // Constrain to PDF canvas height
                 const maxHeight = canvasBottom - newTop;
                 newHeight = Math.min(newHeight, maxHeight);
             }
             
             // Handle top edge resize
             if (resizeHandle.includes('n')) {
                 const proposedHeight = Math.max(15, initialHeight - deltaY);
                 const proposedTop = newTop + (initialHeight - proposedHeight);
                 
                 // Constrain to PDF canvas boundaries
                 if (proposedTop >= canvasTop && proposedTop + proposedHeight <= canvasBottom) {
                     newHeight = proposedHeight;
                     newTop = proposedTop;
                 }
             }
             
             // Apply the constrained values
             element.style.width = newWidth + 'px';
             element.style.height = newHeight + 'px';
             element.style.left = newLeft + 'px';
             element.style.top = newTop + 'px';
             
             // Update font size based on box size
             updateTextSize(element);
         } else if (isDragging) {
             e.preventDefault();
             e.stopPropagation();
             currentX = e.clientX - initialX;
             currentY = e.clientY - initialY;
             xOffset = currentX;
             yOffset = currentY;

             // Get the PDF canvas area for boundary constraints
             const pdfViewer = document.getElementById('pdfViewer');
             const pdfCanvas = document.getElementById('viewer');
             const viewerRect = pdfViewer.getBoundingClientRect();
             const canvasRect = pdfCanvas.getBoundingClientRect();
             const elementRect = element.getBoundingClientRect();
             
             // Calculate PDF canvas boundaries relative to viewer
             const canvasLeft = canvasRect.left - viewerRect.left;
             const canvasTop = canvasRect.top - viewerRect.top;
             const canvasRight = canvasLeft + canvasRect.width;
             const canvasBottom = canvasTop + canvasRect.height;
             
             // Constrain dragging within PDF canvas boundaries
             const maxX = canvasRight - elementRect.width;
             const maxY = canvasBottom - elementRect.height;
             
             currentX = Math.max(canvasLeft, Math.min(currentX, maxX));
             currentY = Math.max(canvasTop, Math.min(currentY, maxY));
             
             xOffset = currentX;
             yOffset = currentY;

             // Apply constrained position directly
             element.style.left = currentX + 'px';
             element.style.top = currentY + 'px';
         }
     }

     function dragEnd(e) {
         // Prevent event from bubbling to PDF viewer
         e.stopPropagation();
         
         if (isResizing) {
             isResizing = false;
             element.style.cursor = 'move';
             element.style.zIndex = '20';
             resizeHandle = '';
             element.classList.remove('resizing');
             
             // Update the box data in session state
             if (sessionState.selectedBox && sessionState.selectedBox.element === element) {
                 sessionState.selectedBox.width = parseInt(element.style.width);
                 sessionState.selectedBox.height = parseInt(element.style.height);
                 sessionState.selectedBox.x = parseInt(element.style.left);
                 sessionState.selectedBox.y = parseInt(element.style.top);
             }
             
         } else if (isDragging) {
             initialX = currentX;
             initialY = currentY;
             isDragging = false;
             element.style.cursor = 'move';
             element.style.zIndex = '20';
             clearSnapGuides();
             
             // Update the box data in session state
             if (sessionState.selectedBox && sessionState.selectedBox.element === element) {
                 sessionState.selectedBox.x = parseInt(element.style.left);
                 sessionState.selectedBox.y = parseInt(element.style.top);
             }
         }
     }
 }

 // Function to enable drag and resize for image boxes using interact.js (from backup)
 function enableDragResize(element) {
     // Make sure Interact.js is available
     if (typeof interact === 'undefined') {
         console.error('Interact.js not loaded');
         return;
     }

     // Enable dragging
     interact(element).draggable({
         listeners: {
             start: function(event) {
                 event.target.classList.add('dragging');
             },
             move: function(event) {
                 const target = event.target;
                 const left = parseFloat(target.style.left) + event.dx;
                 const top = parseFloat(target.style.top) + event.dy;
                 
                 if (snapToGridEnabled) {
                     // Apply snap-to-grid when enabled
                     const snappedPosition = snapToGrid(left, top, target);
                     target.style.left = snappedPosition.x + 'px';
                     target.style.top = snappedPosition.y + 'px';
                 } else {
                     // Free movement when snap-to-grid is disabled
                     target.style.left = left + 'px';
                     target.style.top = top + 'px';
                 }
             },
             end: function(event) {
                 event.target.classList.remove('dragging');
                 clearSnapGuides();
             }
         }
     });

     // Enable resizing
     interact(element).resizable({
         edges: { left: true, right: true, top: true, bottom: true },
         listeners: {
             move: function(event) {
                 const target = event.target;
                 let width = parseFloat(target.style.width);
                 let height = parseFloat(target.style.height);
                 let left = parseFloat(target.style.left);
                 let top = parseFloat(target.style.top);

                 // Update width and height
                 width += event.deltaRect.width;
                 height += event.deltaRect.height;
                 
                 // Update position for left and top edges
                 left += event.deltaRect.left;
                 top += event.deltaRect.top;

                 if (snapToGridEnabled) {
                     // Apply snap-to-grid when enabled
                     const snappedPosition = snapToGrid(left, top, target);
                     target.style.width = width + 'px';
                     target.style.height = height + 'px';
                     target.style.left = snappedPosition.x + 'px';
                     target.style.top = snappedPosition.y + 'px';
                 } else {
                     // Apply changes with free positioning
                     target.style.width = width + 'px';
                     target.style.height = height + 'px';
                     target.style.left = left + 'px';
                     target.style.top = top + 'px';
                 }
             
                 // Ensure images maintain aspect ratio after resize
                 if (target.classList.contains('draggable-image-box')) {
                     const img = target.querySelector('img');
                     if (img) {
                         img.style.objectFit = 'contain';
                         img.style.objectPosition = 'center';
                         img.style.aspectRatio = 'auto';
                         img.style.imageRendering = 'auto';
                     }
                 }
             }
         }
     });
 }

 // Function to load image from URL (from backup)
 function loadImageFromUrl(imageUrl, imageBox) {
     if (!imageUrl || imageUrl.trim() === '') {
         console.log('No image URL provided');
         return;
     }

     console.log('Loading image from URL:', imageUrl);
     
     // Create image element
     const img = document.createElement('img');
     img.crossOrigin = 'anonymous';
     
     // Clear existing content
     imageBox.innerHTML = '';
     
     // Add image only (no delete button for image boxes)
     imageBox.appendChild(img);
     
     // Load image with proper styling
     img.onload = function() {
         console.log('Image loaded successfully');
         
         // Apply MERGE-ONLINE style behavior
         img.style.width = '100%';
         img.style.height = '100%';
         img.style.objectFit = 'contain';
         img.style.objectPosition = 'center';
         img.style.display = 'block';
         img.style.aspectRatio = 'auto';
         img.style.imageRendering = 'auto';
         
         // Keep the box styling (don't remove border/background)
         imageBox.style.border = '2px dashed #007bff';
         imageBox.style.background = 'rgba(255,255,255,0.2)';
     };
     
     img.onerror = function() {
         console.error('Failed to load image:', imageUrl);
         imageBox.textContent = 'No Image';
         imageBox.style.color = '#666';
         imageBox.style.fontWeight = 'normal';
         imageBox.style.fontSize = '12px';
         imageBox.style.border = '2px dashed #007bff';
         imageBox.style.background = 'rgba(255,255,255,0.2)';
     };
     
     // Set image source using proxy
     img.src = `proxy_image.php?url=${encodeURIComponent(imageUrl)}`;
 }

 function addResizeHandles(element) {
     const handles = [
         { position: 'nw', cursor: 'nw-resize' },
         { position: 'n', cursor: 'n-resize' },
         { position: 'ne', cursor: 'ne-resize' },
         { position: 'e', cursor: 'e-resize' },
         { position: 'se', cursor: 'se-resize' },
         { position: 's', cursor: 's-resize' },
         { position: 'sw', cursor: 'sw-resize' },
         { position: 'w', cursor: 'w-resize' }
     ];

     handles.forEach(handle => {
         const handleElement = document.createElement('div');
         handleElement.className = 'transform-control';
         handleElement.dataset.handle = handle.position;
         handleElement.style.cssText = `
             position: absolute;
             width: 8px;
             height: 8px;
             background: #007bff;
             border: 1px solid rgba(255, 255, 255, 0.9);
             border-radius: 2px;
             cursor: ${handle.cursor};
             pointer-events: auto;
             z-index: 9999;
             box-shadow: 0 1px 3px rgba(0,0,0,0.4);
             transition: all 0.2s ease;
             opacity: 1;
             visibility: visible;
             display: block;
         `;

         // Position the handle - adjusted for smaller boxes
         switch (handle.position) {
             case 'nw': handleElement.style.top = '-4px'; handleElement.style.left = '-4px'; break;
             case 'n': handleElement.style.top = '-4px'; handleElement.style.left = '50%'; handleElement.style.transform = 'translateX(-50%)'; break;
             case 'ne': handleElement.style.top = '-4px'; handleElement.style.right = '-4px'; break;
             case 'e': handleElement.style.top = '50%'; handleElement.style.right = '-4px'; handleElement.style.transform = 'translateY(-50%)'; break;
             case 'se': handleElement.style.bottom = '-4px'; handleElement.style.right = '-4px'; break;
             case 's': handleElement.style.bottom = '-4px'; handleElement.style.left = '50%'; handleElement.style.transform = 'translateX(-50%)'; break;
             case 'sw': handleElement.style.bottom = '-4px'; handleElement.style.left = '-4px'; break;
             case 'w': handleElement.style.top = '50%'; handleElement.style.left = '-4px'; handleElement.style.transform = 'translateY(-50%)'; break;
         }

         // Add hover effect for better visibility when needed
         handleElement.addEventListener('mouseenter', function() {
             this.style.backgroundColor = '#0056b3';
             this.style.borderColor = 'rgba(255, 255, 255, 1)';
             this.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
             this.style.transform = this.style.transform + ' scale(1.2)';
             
             // Ensure parent box cursor is set to resize when over handle
             const parentBox = this.closest('.draggable-text-box, .draggable-image-box');
             if (parentBox) {
                 parentBox.style.cursor = this.style.cursor;
             }
         });
         
         handleElement.addEventListener('mouseleave', function() {
             this.style.backgroundColor = '#007bff';
             this.style.borderColor = 'rgba(255, 255, 255, 0.9)';
             this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.4)';
             this.style.transform = this.style.transform.replace(' scale(1.2)', '');
             
             // Reset parent box cursor to move when leaving handle
             const parentBox = this.closest('.draggable-text-box, .draggable-image-box');
             if (parentBox) {
                 parentBox.style.cursor = 'move';
             }
         });

         element.appendChild(handleElement);
     });
     
     // Add comprehensive cursor management to the box
     element.addEventListener('mouseenter', function() {
         // Only set move cursor if not over a resize handle
         if (!event.target.classList.contains('transform-control')) {
             this.style.cursor = 'move';
         }
     });
     
     element.addEventListener('mousemove', function(event) {
         // Check if mouse is over a resize handle
         const isOverHandle = event.target.classList.contains('transform-control');
         if (isOverHandle) {
             // Let the handle manage its own cursor
             return;
         } else {
             // Set move cursor for the box content
             this.style.cursor = 'move';
         }
     });
     
     element.addEventListener('mouseleave', function() {
         // Reset cursor when leaving the box entirely
         this.style.cursor = 'move';
     });
     
     // Orange transform controls are always visible as the main selection indicator
     // No need for click handlers to toggle them
     
     // Make the text content itself draggable, not the selection border
     if (element.classList.contains('draggable-text-box')) {
         // Create a transparent overlay that matches the exact text content size
         const textOverlay = document.createElement('div');
         textOverlay.className = 'text-drag-overlay';
         
         // Calculate the exact text dimensions using canvas for precise measurement
         const textContent = element.textContent || element.innerText || '';
         const fontSize = parseInt(element.style.fontSize) || 16;
         const fontFamily = element.style.fontFamily || 'Arial, sans-serif';
         
         // Create a temporary canvas to measure text precisely
         const canvas = document.createElement('canvas');
         const context = canvas.getContext('2d');
         context.font = `${fontSize}px ${fontFamily}`;
         const textMetrics = context.measureText(textContent);
         const textWidth = textMetrics.width;
         const textHeight = fontSize * 1.2; // Line height
         
         console.log('Text content:', textContent, 'Width:', textWidth, 'Height:', textHeight);
         
         textOverlay.style.cssText = `
             position: absolute;
             top: 0;
             left: 0;
             width: ${Math.max(textWidth, 20)}px;
             height: ${Math.max(textHeight, 15)}px;
             background: rgba(0, 255, 0, 0.1);
             cursor: move;
             pointer-events: auto;
             z-index: 10;
             border: 1px dashed rgba(0, 255, 0, 0.3);
             margin: 0;
             padding: 0;
         `;
         
         // Remove any existing text overlay
         const existingTextOverlay = element.querySelector('.text-drag-overlay');
         if (existingTextOverlay) {
             existingTextOverlay.remove();
         }
         
         element.appendChild(textOverlay);
         
         // Make the text overlay draggable instead of the main element
         makeDraggable(textOverlay);
         
         // Disable dragging on the main element (only the text overlay should be draggable)
         element.style.pointerEvents = 'none';
         textOverlay.style.pointerEvents = 'auto';
         
         console.log('Text overlay created for precise dragging on text content');
     }
     
     // Ensure very small text boxes have minimum draggable area
     if (element.classList.contains('draggable-text-box')) {
         // Force minimum draggable area for all text boxes
         element.style.minWidth = '5px';
         element.style.minHeight = '4px';
         
         // Ensure padding doesn't make the box too small to drag
         const currentPadding = parseInt(element.style.padding) || 5;
         if (currentPadding > 2) {
             element.style.padding = '2px';
         }
         
         // Force pointer events to be enabled for dragging
         element.style.pointerEvents = 'auto';
         element.style.cursor = 'move';
         
         // Make the text box size more precise to match actual text content
         const textContent = element.textContent || element.innerText || '';
         const fontSize = parseInt(element.style.fontSize) || 16;
         const textWidth = textContent.length * (fontSize * 0.6);
         const textHeight = fontSize * 1.2;
         
         // Resize the box to match the actual text content
         element.style.width = Math.max(textWidth + 10, 20) + 'px';
         element.style.height = Math.max(textHeight + 5, 15) + 'px';
         
         // Make the text content itself draggable (no overlay needed)
         element.style.cursor = 'move';
         element.style.pointerEvents = 'auto';
         
         // Remove any existing overlay (we don't need it anymore)
         const existingOverlay = element.querySelector('.drag-overlay');
         if (existingOverlay) {
             existingOverlay.remove();
         }
     }
 }
 
 // Function to show transform controls for a specific box
 function showTransformControls(element) {
     if (!element) {
         console.log('showTransformControls: No element provided');
         return;
     }
     
     const handles = element.querySelectorAll('.transform-control');
     console.log('showTransformControls: Found', handles.length, 'handles for element:', element);
     
     handles.forEach(handle => {
         handle.style.opacity = '1';
         handle.style.visibility = 'visible';
     });
     
     console.log('Transform controls shown for:', element);
 }
 
 // Function to hide transform controls for a specific box
 function hideTransformControls(element) {
     // Orange transform controls are always visible now
     // This function is kept for compatibility but does nothing
 }
 
 // Function to show transform controls for all boxes
 function showAllTransformControls() {
     const allHandles = document.querySelectorAll('.transform-control');
     allHandles.forEach(handle => {
         // Reset any interfering transforms
         handle.style.transform = handle.style.transform.replace(/scale\([^)]*\)/g, '');
         
         // Force visibility with multiple approaches
         handle.style.opacity = '1';
         handle.style.visibility = 'visible';
         handle.style.display = 'block';
         handle.style.zIndex = '9999';
         
         // Use !important to override any conflicting styles
         handle.style.setProperty('opacity', '1', 'important');
         handle.style.setProperty('visibility', 'visible', 'important');
         handle.style.setProperty('display', 'block', 'important');
         handle.style.setProperty('z-index', '9999', 'important');
         
         // Ensure the handle is positioned correctly
         handle.style.pointerEvents = 'auto';
         
         // Special handling for small boxes - make handles more visible
         const parentBox = handle.closest('.draggable-text-box, .draggable-image-box');
         if (parentBox) {
             const boxWidth = parentBox.offsetWidth;
             const boxHeight = parentBox.offsetHeight;
             
             // If box is very small, make handles more prominent
             if (boxWidth < 30 || boxHeight < 20) {
                 handle.style.backgroundColor = '#0056b3';
                 handle.style.border = '2px solid rgba(255, 255, 255, 1)';
                 handle.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.5)';
             }
         }
     });
     console.log('All transform controls shown - found', allHandles.length, 'handles');
 }
 
 // Function to hide all transform controls
 function hideAllTransformControls() {
     const allHandles = document.querySelectorAll('.transform-control');
     allHandles.forEach(handle => {
         handle.style.opacity = '0';
         handle.style.visibility = 'hidden';
         handle.style.display = 'none';
     });
     console.log('All transform controls hidden');
 }
 
 // Function to ensure transform controls are always visible (called periodically)
 function ensureTransformControlsVisible() {
     // Don't automatically show transform controls (only on double-click)
     // if (isEditorMode && !isPreviewMode) {
     //     showAllTransformControls();
     // }
 }
 
 // Function to resize text box to match its content
 function resizeTextBoxToContent(textBox) {
     if (!textBox || !textBox.classList.contains('draggable-text-box')) return;
     
     const textContent = textBox.textContent || textBox.innerText || '';
     const fontSize = parseInt(textBox.style.fontSize) || 16;
     
     // Calculate approximate text dimensions
     const textWidth = textContent.length * (fontSize * 0.6);
     const textHeight = fontSize * 1.2;
     
     // Set box size to match text content with minimal padding
     const newWidth = Math.max(textWidth + 8, 20);
     const newHeight = Math.max(textHeight + 4, 15);
     
     textBox.style.width = newWidth + 'px';
     textBox.style.height = newHeight + 'px';
     
     console.log('Resized text box to match content:', textContent, 'Size:', newWidth + 'x' + newHeight);
 }
 
 // Function to ensure all small boxes are draggable
 function ensureSmallBoxesDraggable() {
     const allBoxes = document.querySelectorAll('.draggable-text-box, .draggable-image-box');
     allBoxes.forEach(box => {
         // Check if box is small and might have dragging issues
         const width = box.offsetWidth;
         const height = box.offsetHeight;
         
         if (width < 30 || height < 20) {
             // Force draggable properties
             box.style.pointerEvents = 'auto';
             box.style.cursor = 'move';
             box.style.minWidth = '5px';
             box.style.minHeight = '4px';
             
             // Ensure Interact.js is properly applied
             if (typeof interact !== 'undefined') {
                 // Re-enable dragging for small boxes
                 interact(box).draggable({
                     listeners: {
                         start: function(event) {
                             if (isPreviewMode) return;
                             console.log('SMALL BOX DRAG START on:', event.target);
                             saveUndoState('Move Box');
                             event.target.classList.add('dragging');
                             event.target.style.cursor = 'move';
                             // Don't show transform controls during drag (only on double-click)
                             // showAllTransformControls();
                             // showTransformControls(event.target);
                         },
                         move: function(event) {
                             console.log('SMALL BOX DRAG MOVE - dx:', event.dx, 'dy:', event.dy);
                             const target = event.target;
                             const left = parseFloat(target.style.left) + event.dx;
                             const top = parseFloat(target.style.top) + event.dy;
                             
                             if (snapToGridEnabled) {
                                 const snappedPosition = snapToGrid(left, top, target);
                                 target.style.left = snappedPosition.x + 'px';
                                 target.style.top = snappedPosition.y + 'px';
                             } else {
                                 target.style.left = left + 'px';
                                 target.style.top = top + 'px';
                             }
                         },
                         end: function(event) {
                             event.target.classList.remove('dragging');
                             event.target.style.cursor = 'move';
                             clearSnapGuides();
                             // Don't show transform controls after drag (only on double-click)
                             // showAllTransformControls();
                         }
                     }
                 });
             }
         }
     });
 }
 
 // Set up periodic check to ensure transform controls stay visible
 setInterval(ensureTransformControlsVisible, 1000); // Check every second
 
 // Set up periodic check to ensure small boxes remain draggable
 setInterval(ensureSmallBoxesDraggable, 2000); // Check every 2 seconds
 
 // Preview Mode functionality
 let isPreviewMode = false;
 
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
         
         // Hide all box borders/outlines for clean preview
         sessionState.boxes.forEach(box => {
             if (box.element) {
                 // Remove all border styles and selection indicators
                 box.element.style.border = 'none';
                 box.element.style.outline = 'none';
                 box.element.style.boxShadow = 'none';
                 box.element.style.backgroundColor = '';
                 
                 // Remove selection classes
                 box.element.classList.remove('selected', 'multi-selected');
                 
                 // Hide any drag identifiers
                 const identifier = box.element.querySelector('.drag-identifier');
                 if (identifier) {
                     identifier.style.display = 'none';
                 }
             }
         });
         
         // Hide record info display in preview mode
         const recordInfoDisplay = document.getElementById('recordInfoDisplay');
         if (recordInfoDisplay) {
             recordInfoDisplay.style.display = 'none';
         }
         
         console.log('Preview mode activated - Clean PDF view');
         
     } else {
         // Exit Preview Mode - Return to editing
         previewBtn.textContent = 'Preview Mode';
         previewBtn.className = 'btn btn-outline-primary';
         
         // Remove preview mode styling
         mainContainer.classList.remove('preview-mode');
         
         // Show all transform controls
         showAllTransformControls();
         
         // Show record info if a box is selected
         if (sessionState.selectedBox) {
             const recordInfoDisplay = document.getElementById('recordInfoDisplay');
             if (recordInfoDisplay) {
                 recordInfoDisplay.style.display = 'block';
             }
         }
         
         console.log('Edit mode restored - All controls visible');
     }
 }
 

 

 

 
 // Function to update field key dropdown
 function updateFieldKeyDropdown(box) {
     const columnSelect = document.getElementById('boxColumnSelect');
     if (!columnSelect || !box) return;
     
     // Clear existing options
     columnSelect.innerHTML = '';
     
     // Add default option
     const defaultOption = document.createElement('option');
     defaultOption.value = '';
     defaultOption.textContent = 'Select Field Key';
     columnSelect.appendChild(defaultOption);
     
     // Add CSV columns as field keys
     if (sessionState.csvRows && sessionState.csvRows.length > 0) {
         const columns = Object.keys(sessionState.csvRows[0]);
         columns.forEach(header => {
             const option = document.createElement('option');
             option.value = header;
             option.textContent = header;
             
             // For multiple selection, show selected if all boxes have the same field key
             if (selectedBoxes.length > 1) {
                 const textBoxes = selectedBoxes.filter(b => b.type === 'text' || b.boxType === 'text');
                 const allSameFieldKey = textBoxes.every(b => b.fieldKey === header);
                 option.selected = allSameFieldKey;
             } else {
                 // Select if this is the current field key
                 option.selected = header === box.fieldKey;
             }
             
             columnSelect.appendChild(option);
         });
     }
 }
 
 // Function to hide transform controls for all boxes
 function hideAllTransformControls() {
     const allHandles = document.querySelectorAll('.transform-control');
     allHandles.forEach(handle => {
         handle.style.opacity = '0';
         handle.style.visibility = 'hidden';
     });
     console.log('All transform controls hidden');
 }
 
 // Function to ensure clean preview - hide all transform controls and highlighting
 function ensureCleanPreview(hideBorders = true) {
     showAllTransformControls();
     
     if (hideBorders) {
         clearAllHighlighting();
         
         // Hide all box borders/outlines for clean preview
         sessionState.boxes.forEach(box => {
             if (box.element) {
                 // Remove all border styles
                 box.element.style.border = 'none';
                 box.element.style.outline = 'none';
                 box.element.style.boxShadow = 'none';
             }
         });
         
         // Don't hide record info - keep it visible for selected box
         // hideRecordInfo();
         
         console.log('Clean preview mode activated - all controls, highlighting, and borders hidden');
     } else {
         console.log('Transform controls hidden only - borders and highlighting preserved');
     }
 }

 // Snap-to-Grid System
 const SNAP_THRESHOLD = 25; // Distance to snap in pixels (increased from 10 for gentler snapping)
 let snapToGridEnabled = false; // Toggle for snap-to-grid feature - DISABLED for free movement

 function toggleSnapToGrid() {
     snapToGridEnabled = document.getElementById('snapToGridToggle').checked;
     console.log('Snap-to-grid:', snapToGridEnabled ? 'ENABLED' : 'DISABLED');
 }

 function snapToGrid(x, y, element) {
     if (!snapToGridEnabled) {
         return { x: x, y: y };
     }
     
     const pdfViewer = document.getElementById('pdfViewer');
     const viewerRect = pdfViewer.getBoundingClientRect();
     
     // Get all other boxes for alignment guides
     const allBoxes = document.querySelectorAll('.draggable-text-box, .draggable-image-box');
     const otherBoxes = Array.from(allBoxes).filter(box => box !== element);
     
     let snappedX = x;
     let snappedY = y;
     
     // Snap to grid
     const gridX = Math.round(x / GRID_SIZE) * GRID_SIZE;
     const gridY = Math.round(y / GRID_SIZE) * GRID_SIZE;
     
     if (Math.abs(x - gridX) < SNAP_THRESHOLD) {
         snappedX = gridX;
     }
     if (Math.abs(y - gridY) < SNAP_THRESHOLD) {
         snappedY = gridY;
     }
     
     // Snap to other boxes (alignment guides)
     otherBoxes.forEach(box => {
         const boxRect = box.getBoundingClientRect();
         const elementRect = element.getBoundingClientRect();
         
         // Vertical alignment (left, center, right)
         const leftAlign = Math.abs((boxRect.left - viewerRect.left) - (elementRect.left - viewerRect.left + x));
         const centerAlign = Math.abs((boxRect.left + boxRect.width/2 - viewerRect.left) - (elementRect.left + elementRect.width/2 - viewerRect.left + x));
         const rightAlign = Math.abs((boxRect.right - viewerRect.left) - (elementRect.right - viewerRect.left + x));
         
         // Horizontal alignment (top, middle, bottom)
         const topAlign = Math.abs((boxRect.top - viewerRect.top) - (elementRect.top - viewerRect.top + y));
         const middleAlign = Math.abs((boxRect.top + boxRect.height/2 - viewerRect.top) - (elementRect.top + elementRect.height/2 - viewerRect.top + y));
         const bottomAlign = Math.abs((boxRect.bottom - viewerRect.top) - (elementRect.bottom - viewerRect.top + y));
         
         // Apply snapping with visual guides
         if (leftAlign < SNAP_THRESHOLD) {
             snappedX = (boxRect.left - viewerRect.left) - (elementRect.left - viewerRect.left);
             showSnapGuide('vertical', boxRect.left - viewerRect.left);
         } else if (centerAlign < SNAP_THRESHOLD) {
             snappedX = (boxRect.left + boxRect.width/2 - viewerRect.left) - (elementRect.left + elementRect.width/2 - viewerRect.left);
             showSnapGuide('vertical', boxRect.left + boxRect.width/2 - viewerRect.left);
         } else if (rightAlign < SNAP_THRESHOLD) {
             snappedX = (boxRect.right - viewerRect.left) - (elementRect.right - viewerRect.left);
             showSnapGuide('vertical', boxRect.right - viewerRect.left);
         }
         
         if (topAlign < SNAP_THRESHOLD) {
             snappedY = (boxRect.top - viewerRect.top) - (elementRect.top - viewerRect.top);
             showSnapGuide('horizontal', boxRect.top - viewerRect.top);
         } else if (middleAlign < SNAP_THRESHOLD) {
             snappedY = (boxRect.top + boxRect.height/2 - viewerRect.top) - (elementRect.top + elementRect.height/2 - viewerRect.top);
             showSnapGuide('horizontal', boxRect.top + boxRect.height/2 - viewerRect.top);
         } else if (bottomAlign < SNAP_THRESHOLD) {
             snappedY = (boxRect.bottom - viewerRect.top) - (elementRect.bottom - viewerRect.top);
             showSnapGuide('horizontal', boxRect.bottom - viewerRect.top);
         }
     });
     
     return { x: snappedX, y: snappedY };
 }

 function showSnapGuide(type, position) {
     // Remove existing guides
     clearSnapGuides();
     
     const guide = document.createElement('div');
     guide.className = `snap-guide ${type}`;
     guide.style.position = 'absolute';
     
     if (type === 'vertical') {
         guide.style.left = position + 'px';
         guide.style.top = '0';
         guide.style.height = '100%';
     } else {
         guide.style.top = position + 'px';
         guide.style.left = '0';
         guide.style.width = '100%';
     }
     
     document.getElementById('pdfViewer').appendChild(guide);
     
     // Remove guide after a short delay
     setTimeout(() => {
         if (guide.parentNode) {
             guide.parentNode.removeChild(guide);
         }
     }, 500);
 }

 function clearSnapGuides() {
     const guides = document.querySelectorAll('.snap-guide');
     guides.forEach(guide => guide.remove());
 }

 function updateTextSize(element) {
     if (element.classList.contains('draggable-text-box')) {
         const width = element.offsetWidth;
         const height = element.offsetHeight;
         
         // Adjust padding for very small text boxes to maintain draggability
         const padding = Math.max(1, Math.min(width, height) / 20);
         element.style.padding = padding + 'px';
         
         // Ensure minimum draggable area even for tiny text
         if (width < 10 || height < 8) {
             element.style.minWidth = '5px';
             element.style.minHeight = '4px';
         }
     }
 }

 // PDF Dragging and Zooming Functionality

 function initPDFDragging() {
     pdfViewer = document.getElementById('pdfViewer');
     pdfContent = document.getElementById('pdfContent');
     
     if (!pdfViewer || !pdfContent) return;

     // Mouse events for dragging
     pdfViewer.addEventListener('mousedown', startDragging);
     pdfViewer.addEventListener('mousemove', drag);
     pdfViewer.addEventListener('mouseup', stopDragging);
     pdfViewer.addEventListener('mouseleave', stopDragging);
     
     // Add click handler to deselect text boxes when clicking on empty space
     pdfViewer.addEventListener('click', function(e) {
         // Only deselect if we're clicking on the viewer itself (not on a text box)
         if (e.target === pdfViewer || e.target.id === 'viewer' || e.target.id === 'pdfContent') {
             document.querySelectorAll('.draggable-text-box, .draggable-image-box').forEach(box => {
                 box.classList.remove('selected');
             });
             sessionState.selectedBox = null;
             
             // Hide record info when no box is selected
             // hideRecordInfo();
             
             // Keep transform controls visible when deselecting
             showAllTransformControls();
             console.log('Boxes deselected - keeping transform controls visible');
             
             updateBoxEditor();
         }
     });
     
     // Touch events for mobile
     pdfViewer.addEventListener('touchstart', startDraggingTouch);
     pdfViewer.addEventListener('touchmove', dragTouch);
     pdfViewer.addEventListener('touchend', stopDragging);
     
     // Wheel event for zooming
     pdfViewer.addEventListener('wheel', handleWheel);
     
     // Prevent context menu
     pdfViewer.addEventListener('contextmenu', e => e.preventDefault());
 }

 function startDragging(e) {
     // Don't start dragging if clicking on controls, if we're in editor mode, or if PDF is locked
     if (e.target.closest('.pdf-controls') || isEditorMode || pdfLocked) return;
     
     isDragging = true;
     lastMousePos = { x: e.clientX, y: e.clientY };
     pdfViewer.classList.add('dragging');
     e.preventDefault();
 }

 function startDraggingTouch(e) {
     if (e.target.closest('.pdf-controls') || isEditorMode || pdfLocked) return;
     
     isDragging = true;
     lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
     pdfViewer.classList.add('dragging');
     e.preventDefault();
 }

 function drag(e) {
     if (!isDragging) return;
     
     const currentPos = { x: e.clientX, y: e.clientY };
     const deltaX = currentPos.x - lastMousePos.x;
     const deltaY = currentPos.y - lastMousePos.y;
     
     currentTransform.x += deltaX;
     currentTransform.y += deltaY;
     
     updatePDFTransform();
     lastMousePos = currentPos;
     e.preventDefault();
 }

 function dragTouch(e) {
     if (!isDragging) return;
     
     const currentPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
     const deltaX = currentPos.x - lastMousePos.x;
     const deltaY = currentPos.y - lastMousePos.y;
     
     currentTransform.x += deltaX;
     currentTransform.y += deltaY;
     
     updatePDFTransform();
     lastMousePos = currentPos;
     e.preventDefault();
 }

 function stopDragging() {
     isDragging = false;
     pdfViewer.classList.remove('dragging');
 }

 function handleWheel(e) {
     if (isEditorMode || pdfLocked) return; // Don't zoom when editing or if PDF is locked
     
     e.preventDefault();
     
     // Adobe Illustrator-style smooth zoom
     const zoomSpeed = 0.1; // Adjust for sensitivity
     const zoomFactor = e.deltaY > 0 ? (1 - zoomSpeed) : (1 + zoomSpeed);
     const newScale = Math.max(0.05, Math.min(10, currentTransform.scale * zoomFactor));
     
     // Get mouse position relative to the PDF content container
     const rect = pdfContent.getBoundingClientRect();
     const mouseX = e.clientX - rect.left;
     const mouseY = e.clientY - rect.top;
     
     // Calculate zoom center point (like Illustrator)
     const scaleChange = newScale / currentTransform.scale;
     
     // Zoom to mouse cursor position - objects stay in their absolute positions
     currentTransform.x = mouseX - (mouseX - currentTransform.x) * scaleChange;
     currentTransform.y = mouseY - (mouseY - currentTransform.y) * scaleChange;
     currentTransform.scale = newScale;
     
     updatePDFTransform();
     
     // Update zoom display to show current percentage
     updateZoomDisplay();
 }

 function updatePDFTransform() {
     if (!pdfContent) return;
     
     // Pure camera zoom - transform the entire PDF container
     pdfContent.style.transform = `translate(${currentTransform.x}px, ${currentTransform.y}px) scale(${currentTransform.scale})`;
     
     // CRITICAL FIX: Reset resize handles to prevent transform interference
     const allHandles = document.querySelectorAll('.transform-control');
     allHandles.forEach(handle => {
         // Reset any transform that might interfere with positioning
         handle.style.transform = handle.style.transform.replace(/scale\([^)]*\)/g, '');
         // Ensure handles are visible and properly positioned
         handle.style.opacity = '1';
         handle.style.visibility = 'visible';
         handle.style.display = 'block';
         handle.style.zIndex = '9999'; // Ensure handles are on top
     });
     
     // Update zoom display
     const zoomDisplay = document.getElementById('zoomDisplay');
     if (zoomDisplay) {
         zoomDisplay.textContent = Math.round(currentTransform.scale * 100) + '%';
     }
     
     // Update editor canvas if it exists
     if (editorCanvas) {
         editorCanvas.setZoom(currentTransform.scale);
         editorCanvas.renderAll();
     }
     
     // Update canvas interaction system zoom
     if (canvasInteractionSystem) {
         canvasInteractionSystem.setZoom(currentTransform.scale);
     }
     
     // Update PDF area outline to match transform
     updatePdfAreaOutline();
     
     // Force show all transform controls after zoom
     setTimeout(() => {
         showAllTransformControls();
     }, 10);
 }
 
 // Camera zoom approach - no need to update individual boxes
 // All boxes are children of pdfContent and will automatically scale with it
 
 // Camera zoom - boxes automatically scale with their parent container
 
 // Adobe Illustrator-style smooth zoom functionality
 function setupMouseWheelZoom() {
     const pdfViewer = document.getElementById('pdfViewer');
     if (!pdfViewer) return;
     
     pdfViewer.addEventListener('wheel', function(e) {
         // Always allow smooth zoom (like Illustrator) - no Ctrl key required
         handleWheel(e);
     });
 }
 
 // Function to validate PDF file format
 function isValidPdfFile(arrayBuffer) {
     try {
         const uint8Array = new Uint8Array(arrayBuffer);
         const header = String.fromCharCode.apply(null, uint8Array.slice(0, 8));
         
         // Check for PDF header
         if (!header.startsWith('%PDF-')) {
             console.error('Invalid PDF header:', header);
             return false;
         }
         
         // Check file size (minimum 100 bytes, maximum 100MB)
         if (arrayBuffer.byteLength < 100 || arrayBuffer.byteLength > 100 * 1024 * 1024) {
             console.error('Invalid PDF file size:', arrayBuffer.byteLength);
             return false;
         }
         
         // Check for PDF trailer
         const tail = String.fromCharCode.apply(null, uint8Array.slice(-100));
         if (!tail.includes('%%EOF')) {
             console.warn('PDF may be corrupted - no EOF marker found');
             // Don't reject, just warn - some PDFs might still work
         }
         
         console.log('PDF validation passed');
         return true;
     } catch (error) {
         console.error('PDF validation error:', error);
         return false;
     }
 }

 // Enhanced image loading with better error handling and retry logic
 async function loadImageWithRetry(imageUrl, maxRetries = 3, timeout = 10000) {
     const proxiedUrl = 'proxy_image.php?url=' + encodeURIComponent(imageUrl);
     const errorLog = {
         url: imageUrl,
         attempts: [],
         finalError: null,
         timestamp: new Date().toISOString()
     };
     
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
         const attemptLog = {
             attempt: attempt,
             url: attempt === 1 ? proxiedUrl : imageUrl,
             startTime: new Date().toISOString(),
             error: null,
             success: false
         };
         
         try {
             console.log(`Loading image attempt ${attempt}/${maxRetries}:`, imageUrl);
             
             const img = new Image();
             img.crossOrigin = 'anonymous';
             
             // Create a promise that resolves when image loads or rejects on timeout
             const loadPromise = new Promise((resolve, reject) => {
                 const timeoutId = setTimeout(() => {
                     const timeoutError = `Image load timeout after ${timeout}ms`;
                     attemptLog.error = timeoutError;
                     attemptLog.endTime = new Date().toISOString();
                     reject(new Error(timeoutError));
                 }, timeout);
                 
                 img.onload = () => {
                     clearTimeout(timeoutId);
                     attemptLog.success = true;
                     attemptLog.endTime = new Date().toISOString();
                     resolve(img);
                 };
                 
                 img.onerror = (error) => {
                     clearTimeout(timeoutId);
                     const loadError = `Image load failed: ${error.message || 'Unknown error'}`;
                     attemptLog.error = loadError;
                     attemptLog.endTime = new Date().toISOString();
                     reject(new Error(loadError));
                 };
             });
             
             // Try proxied URL first
             if (attempt === 1) {
                 img.src = proxiedUrl;
             } else {
                 // Fallback to direct URL on retry
                 img.src = imageUrl;
             }
             
             const loadedImg = await loadPromise;
             console.log(`Image loaded successfully on attempt ${attempt}:`, imageUrl);
             
             // Log successful attempt
             errorLog.attempts.push(attemptLog);
             return loadedImg;
             
         } catch (error) {
             console.warn(`Image load attempt ${attempt} failed:`, error.message);
             attemptLog.error = error.message;
             attemptLog.endTime = new Date().toISOString();
             errorLog.attempts.push(attemptLog);
             
             if (attempt === maxRetries) {
                 errorLog.finalError = `Failed to load image after ${maxRetries} attempts: ${imageUrl}`;
                 // Log the complete error details
                 logImageLoadError(errorLog);
                 throw new Error(errorLog.finalError);
             }
             
             // Wait before retry (exponential backoff)
             await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
         }
     }
 }

 // Function to log detailed image loading errors
 function logImageLoadError(errorLog) {
     console.group('🚨 IMAGE LOAD ERROR DETAILS');
     console.log('📅 Timestamp:', errorLog.timestamp);
     console.log('🔗 Original URL:', errorLog.url);
     console.log('❌ Final Error:', errorLog.finalError);
     console.log('📊 Attempts:', errorLog.attempts.length);
     
     errorLog.attempts.forEach((attempt, index) => {
         console.group(`Attempt ${attempt.attempt}:`);
         console.log('⏰ Start:', attempt.startTime);
         console.log('⏰ End:', attempt.endTime);
         console.log('🔗 URL Used:', attempt.url);
         console.log('✅ Success:', attempt.success);
         if (attempt.error) {
             console.log('❌ Error:', attempt.error);
         }
         console.groupEnd();
     });
     
     console.groupEnd();
     
     // Store error in session for later analysis
     if (!window.imageLoadErrors) {
         window.imageLoadErrors = [];
     }
     window.imageLoadErrors.push(errorLog);
     
     // Show user-friendly error notification
     showImageLoadErrorNotification(errorLog);
 }

 // Function to show user-friendly error notification
 function showImageLoadErrorNotification(errorLog) {
     // Create or update error notification
     let errorNotification = document.getElementById('imageLoadErrorNotification');
     if (!errorNotification) {
         errorNotification = document.createElement('div');
         errorNotification.id = 'imageLoadErrorNotification';
         errorNotification.style.cssText = `
             position: fixed;
             top: 20px;
             right: 20px;
             background: #dc3545;
             color: white;
             padding: 15px 20px;
             border-radius: 8px;
             box-shadow: 0 4px 12px rgba(0,0,0,0.3);
             z-index: 10000;
             max-width: 400px;
             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             font-size: 14px;
             line-height: 1.4;
         `;
         document.body.appendChild(errorNotification);
     }
     
     const errorCount = window.imageLoadErrors ? window.imageLoadErrors.length : 1;
     errorNotification.innerHTML = `
         <div style="font-weight: bold; margin-bottom: 8px;">
             🚨 Image Load Error (${errorCount})
         </div>
         <div style="margin-bottom: 8px;">
             Failed to load: ${errorLog.url.length > 50 ? errorLog.url.substring(0, 50) + '...' : errorLog.url}
         </div>
         <div style="font-size: 12px; opacity: 0.9;">
             Check console for detailed logs
         </div>
         <button onclick="this.parentElement.remove()" style="
             position: absolute;
             top: 5px;
             right: 10px;
             background: none;
             border: none;
             color: white;
             font-size: 18px;
             cursor: pointer;
         ">×</button>
     `;
     
     // Auto-remove after 10 seconds
     setTimeout(() => {
         if (errorNotification && errorNotification.parentElement) {
             errorNotification.remove();
         }
     }, 10000);
 }
 
 // Function to pre-load all images for html2canvas capture with progress bar
 async function preloadAllImages() {
     const imageBoxes = document.querySelectorAll('.draggable-image-box img');
     
     if (imageBoxes.length === 0) {
         console.log('No images to preload');
         return;
     }

     // Show progress overlay
     const overlay = document.getElementById('imageLoadingOverlay');
     const progressBar = document.getElementById('imageProgressBar');
     const progressText = document.getElementById('imageProgressText');
     const subtitle = document.getElementById('imageLoadingSubtitle');
     
     overlay.classList.add('active');
     subtitle.textContent = `Loading ${imageBoxes.length} image${imageBoxes.length > 1 ? 's' : ''}...`;
     
     let loadedCount = 0;
     let failedCount = 0;
     const totalImages = imageBoxes.length;
     
     const imagePromises = Array.from(imageBoxes).map(async (img, index) => {
         try {
             if (img.complete && img.naturalWidth > 0) {
                 // Image already loaded
                 loadedCount++;
                 updateProgress(loadedCount, totalImages, progressBar, progressText);
                 return;
             }
             
             // Get the original image URL from the img element or its parent
             let imageUrl = img.src;
             if (imageUrl.includes('proxy_image.php')) {
                 // Extract original URL from proxy
                 const urlMatch = imageUrl.match(/url=([^&]+)/);
                 if (urlMatch) {
                     imageUrl = decodeURIComponent(urlMatch[1]);
                 }
             }
             
             // Use enhanced image loading with retry logic
             const loadedImg = await loadImageWithRetry(imageUrl, 3, 15000);
             
             // Update the original img element with the loaded image
             img.src = loadedImg.src;
             img.crossOrigin = 'anonymous';
             
                     loadedCount++;
                     updateProgress(loadedCount, totalImages, progressBar, progressText);
             
         } catch (error) {
             console.error(`Failed to load image ${index + 1}:`, error.message);
             failedCount++;
                     loadedCount++;
                     updateProgress(loadedCount, totalImages, progressBar, progressText);
             
             // Show error state for failed images
             if (img.parentElement) {
                 img.parentElement.innerHTML = `<div style="color: #dc3545; text-align: center; padding: 10px; font-size: 12px; font-weight: bold;">Image Load Failed<br><span style="font-size: 10px; color: #6c757d;">${error.message}</span></div>`;
             }
         }
     });
     
     // Wait for all images to load (with timeout)
     await Promise.allSettled(imagePromises);
     
     // Additional wait to ensure images are fully rendered
     subtitle.textContent = `Finalizing image preparation... (${failedCount} failed)`;
     await new Promise(resolve => setTimeout(resolve, 200));
     
     // Hide progress overlay
     overlay.classList.remove('active');
     
     console.log(`Image preloading complete: ${loadedCount - failedCount}/${totalImages} loaded successfully, ${failedCount} failed`);
     
     if (failedCount > 0) {
         console.warn(`${failedCount} images failed to load. PDF generation may have missing images.`);
         
         // Log summary of failed images
         console.group('📊 IMAGE LOADING SUMMARY');
         console.log(`✅ Successfully loaded: ${loadedCount - failedCount}/${totalImages}`);
         console.log(`❌ Failed to load: ${failedCount}/${totalImages}`);
         console.log(`📈 Success rate: ${Math.round(((loadedCount - failedCount) / totalImages) * 100)}%`);
         console.groupEnd();
         
         // Show warning notification
         showImageLoadWarningNotification(failedCount, totalImages);
     }
 }

 // Function to show warning notification for failed images
 function showImageLoadWarningNotification(failedCount, totalImages) {
     const warningNotification = document.createElement('div');
     warningNotification.style.cssText = `
         position: fixed;
         top: 20px;
         left: 20px;
         background: #ffc107;
         color: #212529;
         padding: 15px 20px;
         border-radius: 8px;
         box-shadow: 0 4px 12px rgba(0,0,0,0.3);
         z-index: 10000;
         max-width: 400px;
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         font-size: 14px;
         line-height: 1.4;
     `;
     
     const successRate = Math.round(((totalImages - failedCount) / totalImages) * 100);
     warningNotification.innerHTML = `
         <div style="font-weight: bold; margin-bottom: 8px;">
             ⚠️ Image Loading Warning
         </div>
         <div style="margin-bottom: 8px;">
             ${failedCount} of ${totalImages} images failed to load (${successRate}% success rate)
         </div>
         <div style="font-size: 12px; margin-bottom: 10px;">
             PDF generation will continue with available images
         </div>
         <button onclick="exportImageErrorLogs()" style="
             background: #dc3545;
             color: white;
             border: none;
             padding: 5px 10px;
             border-radius: 4px;
             cursor: pointer;
             font-size: 12px;
             margin-right: 10px;
         ">Export Error Logs</button>
         <button onclick="this.parentElement.remove()" style="
             background: #6c757d;
             color: white;
             border: none;
             padding: 5px 10px;
             border-radius: 4px;
             cursor: pointer;
             font-size: 12px;
         ">Dismiss</button>
     `;
     
     document.body.appendChild(warningNotification);
     
     // Auto-remove after 15 seconds
     setTimeout(() => {
         if (warningNotification && warningNotification.parentElement) {
             warningNotification.remove();
         }
     }, 15000);
 }

 // Function to export image error logs
 function exportImageErrorLogs() {
     if (!window.imageLoadErrors || window.imageLoadErrors.length === 0) {
         alert('No image loading errors to export.');
         return;
     }
     
     const errorReport = {
         exportDate: new Date().toISOString(),
         totalErrors: window.imageLoadErrors.length,
         errors: window.imageLoadErrors,
         summary: {
             uniqueUrls: [...new Set(window.imageLoadErrors.map(e => e.url))].length,
             commonErrors: getCommonErrors(window.imageLoadErrors)
         }
     };
     
     const blob = new Blob([JSON.stringify(errorReport, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `image-load-errors-${new Date().toISOString().split('T')[0]}.json`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
     
     console.log('📁 Image error logs exported successfully');
 }

 // Function to export PDF generation logs
 function exportPDFGenerationLogs() {
     if (!window.pdfGenerationLogs || window.pdfGenerationLogs.length === 0) {
         alert('No PDF generation logs to export.');
         return;
     }
     
     const report = {
         exportDate: new Date().toISOString(),
         totalGenerations: window.pdfGenerationLogs.length,
         generations: window.pdfGenerationLogs,
         summary: {
             averageImageSuccessRate: Math.round(
                 window.pdfGenerationLogs.reduce((sum, log) => sum + log.imageSuccessRate, 0) / 
                 window.pdfGenerationLogs.length
             ),
             totalFailedImages: window.pdfGenerationLogs.reduce((sum, log) => sum + log.failedImages, 0),
             totalSuccessfulImages: window.pdfGenerationLogs.reduce((sum, log) => sum + log.successfulImages, 0)
         }
     };
     
     const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `pdf-generation-logs-${new Date().toISOString().split('T')[0]}.json`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
     
     console.log('📁 PDF generation logs exported successfully');
 }

 // Function to show error logs dashboard
 function showErrorLogsDashboard() {
     const dashboard = document.createElement('div');
     dashboard.style.cssText = `
         position: fixed;
         top: 50%;
         left: 50%;
         transform: translate(-50%, -50%);
         background: white;
         border-radius: 12px;
         box-shadow: 0 8px 32px rgba(0,0,0,0.3);
         z-index: 10001;
         max-width: 600px;
         width: 90%;
         max-height: 80vh;
         overflow-y: auto;
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         padding: 20px;
     `;
     
     const imageErrors = window.imageLoadErrors || [];
     const pdfLogs = window.pdfGenerationLogs || [];
     
     dashboard.innerHTML = `
         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
             <h2 style="margin: 0; color: #333;">📊 Error Logs Dashboard</h2>
             <button onclick="this.closest('div').remove()" style="
                 background: none;
                 border: none;
                 font-size: 24px;
                 cursor: pointer;
                 color: #666;
             ">×</button>
         </div>
         
         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
             <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                 <h3 style="margin: 0 0 10px 0; color: #dc3545;">🚨 Image Load Errors</h3>
                 <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${imageErrors.length}</div>
                 <div style="font-size: 12px; color: #666;">Total failed image loads</div>
             </div>
             
             <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                 <h3 style="margin: 0 0 10px 0; color: #007bff;">📄 PDF Generations</h3>
                 <div style="font-size: 24px; font-weight: bold; color: #007bff;">${pdfLogs.length}</div>
                 <div style="font-size: 12px; color: #666;">Total PDF generations</div>
             </div>
         </div>
         
         <div style="margin-bottom: 20px;">
             <button onclick="exportImageErrorLogs()" style="
                 background: #dc3545;
                 color: white;
                 border: none;
                 padding: 10px 15px;
                 border-radius: 6px;
                 cursor: pointer;
                 margin-right: 10px;
                 font-size: 14px;
             ">Export Image Errors</button>
             
             <button onclick="exportPDFGenerationLogs()" style="
                 background: #007bff;
                 color: white;
                 border: none;
                 padding: 10px 15px;
                 border-radius: 6px;
                 cursor: pointer;
                 margin-right: 10px;
                 font-size: 14px;
             ">Export PDF Logs</button>
             
             <button onclick="clearAllLogs()" style="
                 background: #6c757d;
                 color: white;
                 border: none;
                 padding: 10px 15px;
                 border-radius: 6px;
                 cursor: pointer;
                 font-size: 14px;
             ">Clear All Logs</button>
         </div>
         
         ${imageErrors.length > 0 ? `
         <div style="margin-bottom: 20px;">
             <h3 style="color: #dc3545; margin-bottom: 10px;">Recent Image Errors:</h3>
             <div style="max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 6px;">
                 ${imageErrors.slice(-5).map(error => `
                     <div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; font-size: 12px;">
                         <div style="font-weight: bold;">${error.url.length > 50 ? error.url.substring(0, 50) + '...' : error.url}</div>
                         <div style="color: #666;">${error.timestamp}</div>
                     </div>
                 `).join('')}
             </div>
         </div>
         ` : ''}
         
         ${pdfLogs.length > 0 ? `
         <div>
             <h3 style="color: #007bff; margin-bottom: 10px;">Recent PDF Generations:</h3>
             <div style="max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 6px;">
                 ${pdfLogs.slice(-5).map(log => `
                     <div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; font-size: 12px;">
                         <div style="font-weight: bold;">${log.mode} - ${log.totalRecords} records</div>
                         <div style="color: #666;">Images: ${log.successfulImages}/${log.totalImageBoxes} (${log.imageSuccessRate}%)</div>
                         <div style="color: #666;">${log.timestamp}</div>
                     </div>
                 `).join('')}
             </div>
         </div>
         ` : ''}
     `;
     
     document.body.appendChild(dashboard);
 }

 // Function to clear all logs
 function clearAllLogs() {
     if (confirm('Are you sure you want to clear all error logs? This action cannot be undone.')) {
         window.imageLoadErrors = [];
         window.pdfGenerationLogs = [];
         console.log('🧹 All error logs cleared');
         alert('All error logs have been cleared.');
     }
 }

 // Function to get common error patterns
 function getCommonErrors(errors) {
     const errorCounts = {};
     errors.forEach(error => {
         const finalError = error.finalError || 'Unknown error';
         const errorType = finalError.includes('timeout') ? 'Timeout' :
                         finalError.includes('CORS') ? 'CORS Error' :
                         finalError.includes('404') ? 'Not Found' :
                         finalError.includes('403') ? 'Forbidden' :
                         'Other';
         errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
     });
     return errorCounts;
 }

 // Function to log PDF generation summary
 function logPDFGenerationSummary(totalRecords, mode) {
     const imageBoxes = document.querySelectorAll('.draggable-image-box');
     const failedImages = document.querySelectorAll('.draggable-image-box[style*="border: 2px dashed #dc3545"]');
     const successfulImages = imageBoxes.length - failedImages.length;
     
     console.group('📊 PDF GENERATION SUMMARY');
     console.log('📅 Timestamp:', new Date().toISOString());
     console.log('📄 Mode:', mode);
     console.log('📊 Total Records:', totalRecords);
     console.log('🖼️ Total Image Boxes:', imageBoxes.length);
     console.log('✅ Successful Images:', successfulImages);
     console.log('❌ Failed Images:', failedImages.length);
     console.log('📈 Image Success Rate:', imageBoxes.length > 0 ? Math.round((successfulImages / imageBoxes.length) * 100) + '%' : 'N/A');
     
     if (failedImages.length > 0) {
         console.group('❌ Failed Images Details:');
         failedImages.forEach((box, index) => {
             const errorText = box.textContent;
             const fieldKey = box.getAttribute('data-field-key') || 'Unknown field';
             console.log(`${index + 1}. Field: ${fieldKey}, Error: ${errorText}`);
         });
         console.groupEnd();
     }
     
     if (window.imageLoadErrors && window.imageLoadErrors.length > 0) {
         console.group('🚨 Image Load Errors:');
         console.log('Total errors:', window.imageLoadErrors.length);
         const errorSummary = getCommonErrors(window.imageLoadErrors);
         console.log('Error types:', errorSummary);
         console.groupEnd();
     }
     
     console.groupEnd();
     
     // Store PDF generation log
     if (!window.pdfGenerationLogs) {
         window.pdfGenerationLogs = [];
     }
     
     window.pdfGenerationLogs.push({
         timestamp: new Date().toISOString(),
         mode: mode,
         totalRecords: totalRecords,
         totalImageBoxes: imageBoxes.length,
         successfulImages: successfulImages,
         failedImages: failedImages.length,
         imageSuccessRate: imageBoxes.length > 0 ? Math.round((successfulImages / imageBoxes.length) * 100) : 0,
         imageLoadErrors: window.imageLoadErrors ? window.imageLoadErrors.length : 0
     });
 }

 // Helper function to update progress bar
 function updateProgress(loaded, total, progressBar, progressText) {
     const percentage = Math.round((loaded / total) * 100);
     progressBar.style.width = percentage + '%';
     progressText.textContent = `${percentage}% (${loaded}/${total})`;
 }
 
 // Function to style image boxes for html2canvas capture - matching MERGE-ONLINE behavior
 function styleImageBoxForCapture(img) {
     if (img) {
         // Use natural image dimensions for download (like MERGE-ONLINE)
         img.style.width = img.naturalWidth + 'px';
         img.style.height = img.naturalHeight + 'px';
         img.style.maxWidth = 'none';
         img.style.maxHeight = 'none';
         img.style.objectFit = 'none';
         img.style.display = 'block';
         // Force image to be visible and loaded
         img.style.opacity = '1';
         img.style.visibility = 'visible';
         // Ensure cross-origin is set for html2canvas
         img.crossOrigin = 'anonymous';
         // Remove any transform that might affect capture
         img.style.transform = 'none';
         // Ensure image is fully loaded and rendered
         img.style.imageRendering = 'auto';
         img.style.imageRendering = 'crisp-edges';
     }
 }
 
 // Function to hide UI elements for html2canvas capture
 function hideUIElementsForCapture(clonedViewer) {
     // Remove resize handles
     const resizeHandles = clonedViewer.querySelectorAll('.transform-control');
     resizeHandles.forEach(handle => {
         handle.style.display = 'none';
     });
     
     // Hide any other UI elements that shouldn't be captured
     const uiElements = clonedViewer.querySelectorAll('.transform-control, .pdf-controls');
     uiElements.forEach(element => {
         element.style.display = 'none';
     });
 }

 function togglePDFLock() {
     pdfLocked = !pdfLocked;
     
     // Update cursor style
     if (pdfViewer) {
         pdfViewer.style.cursor = pdfLocked ? 'default' : 'grab';
     }
     
     // Update lock status display
     updatePDFLockStatus();
 }

 function updatePDFLockStatus() {
     // Create or update lock status indicator
     let lockIndicator = document.getElementById('pdfLockIndicator');
     if (!lockIndicator) {
         lockIndicator = document.createElement('div');
         lockIndicator.id = 'pdfLockIndicator';
         lockIndicator.style.cssText = `
             position: absolute;
             top: 10px;
             left: 10px;
             background: rgba(0, 0, 0, 0.7);
             color: white;
             padding: 4px 8px;
             border-radius: 3px;
             font-size: 10px;
             z-index: 100;
         `;
         document.querySelector('.pdf-viewer').appendChild(lockIndicator);
     }
     
     lockIndicator.textContent = pdfLocked ? 'PDF Locked' : 'PDF Unlocked';
     lockIndicator.style.background = pdfLocked ? 'rgba(220, 53, 69, 0.8)' : 'rgba(40, 167, 69, 0.8)';
     lockIndicator.style.display = 'none'; // Hide lock indicator by default
     
     // Update lock button
     const lockBtn = document.getElementById('pdfLockBtn');
     if (lockBtn) {
         lockBtn.textContent = pdfLocked ? '🔒' : '🔓';
         lockBtn.title = pdfLocked ? 'Unlock PDF' : 'Lock PDF';
     }
 }

 function resetView() {
     // Reset to 100% zoom (index 3)
     setZoomLevel(3);
     currentTransform = { x: 0, y: 0, scale: 1.0 };
     updatePDFTransform();
     
     // Clear any stored original positions since we're using transform-based scaling
     clearStoredBoxPositions();
 }

 // Function to clear stored box positions since we're using transform-based scaling
 function clearStoredBoxPositions() {
     const allBoxes = document.querySelectorAll('.draggable-text-box, .draggable-image-box');
     allBoxes.forEach(box => {
         // Remove stored original position data attributes
         box.removeAttribute('data-original-left');
         box.removeAttribute('data-original-top');
         box.removeAttribute('data-original-width');
         box.removeAttribute('data-original-height');
     });
 }
 
 function fitToWindow() {
     if (!currentPdf) return;
     
     // Get the base viewport to calculate fit scale
     currentPdf.getPage(1).then(page => {
         const baseViewport = page.getViewport({scale: 1.0});
         const viewerContainer = document.querySelector('.viewer-container');
         const containerWidth = viewerContainer.clientWidth;
         const containerHeight = viewerContainer.clientHeight;
         
         // Calculate scale to fit the container
         const scaleX = containerWidth / baseViewport.width;
         const scaleY = containerHeight / baseViewport.height;
         const fitScale = Math.min(scaleX, scaleY, 1.0); // Don't scale up beyond 100%
         
         // Find the closest predefined zoom level
         let closestIndex = 3; // Default to 100%
         let closestDiff = Math.abs(fitScale - 1.0);
         
         for (let i = 0; i < ZOOM_LEVELS.length; i++) {
             const diff = Math.abs(fitScale - ZOOM_LEVELS[i].scale);
             if (diff < closestDiff) {
                 closestDiff = diff;
                 closestIndex = i;
             }
         }
         
         // Set to the closest predefined zoom level
         setZoomLevel(closestIndex);
         currentTransform = { x: 0, y: 0, scale: ZOOM_LEVELS[closestIndex].scale };
         updatePDFTransform();
         updateOutlineOnZoom();
     });
 }
 
 function showZoomHelpIndicator() {
     const zoomHelpIndicator = document.getElementById('zoomHelpIndicator');
     if (zoomHelpIndicator) {
         zoomHelpIndicator.classList.add('show');
         setTimeout(() => {
             zoomHelpIndicator.classList.remove('show');
         }, 4000);
     }
 }
 
 function toggleGrid() {
     const gridOverlay = document.getElementById('gridOverlay');
     const gridBtn = document.getElementById('gridBtn');
     
     if (gridOverlay && gridBtn) {
         const isVisible = gridOverlay.classList.contains('show');
         if (isVisible) {
             gridOverlay.classList.remove('show');
             gridBtn.style.background = 'rgba(0, 0, 0, 0.7)';
             gridBtn.title = 'Show Grid';
         } else {
             gridOverlay.classList.add('show');
             gridBtn.style.background = 'rgba(0, 123, 255, 0.8)';
             gridBtn.title = 'Hide Grid';
         }
     }
 }
 
 // Function to reset all boxes to their original positions and sizes
 function resetAllBoxesToOriginal() {
     const allBoxes = document.querySelectorAll('.draggable-text-box, .draggable-image-box');
     allBoxes.forEach(box => {
         // Remove any existing transforms
         box.style.transform = '';
         box.style.transition = 'none';
         
         // Restore original positions and sizes if they were stored
         if (box.hasAttribute('data-original-left')) {
             box.style.left = box.getAttribute('data-original-left');
             box.style.top = box.getAttribute('data-original-top');
             box.style.width = box.getAttribute('data-original-width');
             box.style.height = box.getAttribute('data-original-height');
         }
     });
 }

 // Predefined zoom levels for consistent positioning
 const ZOOM_LEVELS = [
     { scale: 0.25, name: '25%', description: 'Overview' },
     { scale: 0.5, name: '50%', description: 'Small' },
     { scale: 0.75, name: '75%', description: 'Medium' },
     { scale: 1.0, name: '100%', description: 'Actual Size' },
     { scale: 1.25, name: '125%', description: 'Large' },
     { scale: 1.5, name: '150%', description: 'Detail' },
     { scale: 2.0, name: '200%', description: 'Fine Detail' },
     { scale: 3.0, name: '300%', description: 'Precision' }
 ];
 
 let currentZoomIndex = 3; // Start at 100%

 function zoomIn() {
     if (currentZoomIndex < ZOOM_LEVELS.length - 1) {
         currentZoomIndex++;
         const newScale = ZOOM_LEVELS[currentZoomIndex].scale;
         currentTransform.scale = newScale;
         updatePDFTransform();
         updateOutlineOnZoom();
         updateZoomDisplay();
         
         // Show zoom help indicator when zoomed in
         if (newScale > 1.5) {
             showZoomHelpIndicator();
         }
     }
 }

 function zoomOut() {
     if (currentZoomIndex > 0) {
         currentZoomIndex--;
         const newScale = ZOOM_LEVELS[currentZoomIndex].scale;
         currentTransform.scale = newScale;
         updatePDFTransform();
         updateOutlineOnZoom();
         updateZoomDisplay();
     }
 }
 
 function setZoomLevel(levelIndex) {
     if (levelIndex >= 0 && levelIndex < ZOOM_LEVELS.length) {
         currentZoomIndex = levelIndex;
         const newScale = ZOOM_LEVELS[currentZoomIndex].scale;
         currentTransform.scale = newScale;
         updatePDFTransform();
         updateOutlineOnZoom();
         updateZoomDisplay();
     }
 }
 
 function updateZoomDisplay() {
     // Update zoom percentage display
     const zoomDisplay = document.getElementById('zoomDisplay');
     if (zoomDisplay) {
         zoomDisplay.textContent = Math.round(currentTransform.scale * 100) + '%';
     }
     
     // Update zoom dropdown to closest predefined level (for reference)
     const zoomSelect = document.getElementById('zoomSelect');
     if (zoomSelect) {
         // Find closest predefined zoom level
         let closestIndex = 3; // Default to 100%
         let closestDiff = Math.abs(currentTransform.scale - 1.0);
         
         for (let i = 0; i < ZOOM_LEVELS.length; i++) {
             const diff = Math.abs(currentTransform.scale - ZOOM_LEVELS[i].scale);
             if (diff < closestDiff) {
                 closestDiff = diff;
                 closestIndex = i;
             }
         }
         
         zoomSelect.value = closestIndex;
     }
 }

 function updateEditorStatus(message) {
     // Create status element if it doesn't exist
     let statusElement = document.getElementById('editorStatus');
     if (!statusElement) {
         statusElement = document.createElement('div');
         statusElement.id = 'editorStatus';
         statusElement.className = 'editor-status';
         document.querySelector('.viewer-container').appendChild(statusElement);
     }
     statusElement.textContent = message;
 }

 function saveLayout() {
     if (!editorCanvas) return;

     const layout = {
         page: {
             size: 'A4',
             orient: 'portrait'
         },
         objects: []
     };

     // Collect all objects
     editorCanvas.getObjects().forEach(obj => {
         const objectData = {
             type: obj.type,
             left: Math.round(obj.left),
             top: Math.round(obj.top),
             width: Math.round(obj.width || obj.scaleX * 100),
             height: Math.round(obj.height || obj.scaleY * 100),
             meta: obj.meta || {}
         };

         // Add type-specific properties
         if (obj.type === 'text') {
             objectData.text = obj.text;
             objectData.fontSize = obj.fontSize;
             objectData.fontFamily = obj.fontFamily;
             objectData.fill = obj.fill;
         } else if (obj.type === 'group') {
             objectData.groupType = 'imagePlaceholder';
         }

         layout.objects.push(objectData);
     });

     // Create and download JSON file
     const jsonString = JSON.stringify(layout, null, 2);
     const blob = new Blob([jsonString], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     
     const link = document.createElement('a');
     link.href = url;
     link.download = `layout-A4-portrait-${Date.now()}.json`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     
     URL.revokeObjectURL(url);
     
     updateEditorStatus('Layout saved as JSON');
 }

 // Generate Sample PDF function
 async function generateSamplePDF() {
     try {
         // Create a new PDF document
         const pdfDoc = await PDFLib.PDFDocument.create();
         
         // Add a page
         const page = pdfDoc.addPage([595, 842]); // A4 size
         
         // Get the current ISO timestamp
         const timestamp = new Date().toISOString();
         
         // Add text to the page
         page.drawText(`Generated at ${timestamp}`, {
             x: 50,
             y: 750,
             size: 20,
             color: PDFLib.rgb(0, 0, 0)
         });
         
         // Add some sample content
         page.drawText('This is a sample PDF generated by PDF-lib', {
             x: 50,
             y: 700,
             size: 14,
             color: PDFLib.rgb(0.2, 0.2, 0.2)
         });
         
         page.drawText('You can use this as a template for testing', {
             x: 50,
             y: 670,
             size: 12,
             color: PDFLib.rgb(0.4, 0.4, 0.4)
         });
         
         // Save the PDF as bytes
         const pdfBytes = await pdfDoc.save();
         
         // Create a blob and download link
         const blob = new Blob([pdfBytes], { type: 'application/pdf' });
         const url = URL.createObjectURL(blob);
         
         // Create and trigger download
         const link = document.createElement('a');
         link.href = url;
         link.download = `sample-${Date.now()}.pdf`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         
         // Clean up the URL
         URL.revokeObjectURL(url);
         
     } catch (error) {
         console.error('Error generating sample PDF:', error);
         alert('Error generating sample PDF: ' + error.message);
     }
 }

 // Download PDFs function - Hybrid High Quality (All Records in ZIP)
 async function downloadPdfs() {
     try {
         console.log(`=== HYBRID HIGH QUALITY PDF GENERATION (ALL RECORDS IN ZIP) ===`);
         
         // Step 1: Validate inputs
         console.log('Step 1: Validating inputs...');
         if (!sessionState.templatePdfBytes) {
             throw new Error('No PDF template loaded');
         }
         if (!sessionState.csvRows || sessionState.csvRows.length === 0) {
             throw new Error('No CSV data loaded');
         }
         if (!sessionState.boxes || sessionState.boxes.length === 0) {
             throw new Error('No boxes configured');
         }
         
         // Check if we have at least some boxes with CSV data
                     const hasTextBoxes = sessionState.boxes.some(box => box.type === 'text' && box.fieldKey);
     const hasImageBoxes = sessionState.boxes.some(box => box.boxType === 'image' && box.fieldKey);
         
         if (!hasTextBoxes && !hasImageBoxes) {
             throw new Error('No boxes with CSV data configured. Please add text boxes or image boxes with CSV field bindings.');
         }
         
         console.log(`✓ Inputs valid: ${sessionState.csvRows.length} CSV rows, ${sessionState.boxes.length} total boxes (${hasTextBoxes ? 'text' : ''}${hasTextBoxes && hasImageBoxes ? ' + ' : ''}${hasImageBoxes ? 'image' : ''})`);

         const downloadBtn = document.getElementById('downloadPdfsBtn');
         downloadBtn.disabled = true;
         downloadBtn.textContent = `Generating All PDFs...`;

         // Step 2: Load JSZip
         console.log('Step 2: Loading JSZip...');
         const JSZipScript = document.getElementById('jszip-cdn');
         if (!window.JSZip && !JSZipScript) {
             const script = document.createElement('script');
             script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
             script.id = 'jszip-cdn';
             document.body.appendChild(script);
             await new Promise(res => { script.onload = res; });
         } else if (!window.JSZip && JSZipScript) {
             await new Promise(res => { JSZipScript.onload = res; });
         }
         console.log('✓ JSZip loaded');

         const zip = new JSZip();
         const totalRecords = sessionState.csvRows.length;
         
         // Create unified progress bar for entire process
         const progressOverlay = document.createElement('div');
         progressOverlay.style.cssText = `
             position: fixed;
             top: 0;
             left: 0;
             width: 100%;
             height: 100%;
             background: rgba(0, 0, 0, 0.7);
             display: flex;
             justify-content: center;
             align-items: center;
             z-index: 9999;
         `;
         
         const progressContent = document.createElement('div');
         progressContent.style.cssText = `
             background: white;
             border-radius: 8px;
             padding: 30px;
             text-align: center;
             box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
             max-width: 400px;
             width: 90%;
         `;
         
         const progressTitle = document.createElement('div');
         progressTitle.style.cssText = `
             font-size: 18px;
             font-weight: 600;
             color: #333;
             margin-bottom: 20px;
         `;
         progressTitle.textContent = `Generating Single Record PDFs`;
         
         const progressSubtitle = document.createElement('div');
         progressSubtitle.style.cssText = `
             font-size: 14px;
             color: #666;
             margin-bottom: 25px;
         `;
         progressSubtitle.textContent = `Processing ${totalRecords} records...`;
         
         const progressContainer = document.createElement('div');
         progressContainer.style.cssText = `
             background: #f0f0f0;
             border-radius: 20px;
             height: 8px;
             margin-bottom: 15px;
             overflow: hidden;
         `;
         
         const progressBar = document.createElement('div');
         progressBar.style.cssText = `
             background: linear-gradient(90deg, #007bff, #0056b3);
             height: 100%;
             width: 0%;
             transition: width 0.3s ease;
             border-radius: 20px;
         `;
         
         const progressText = document.createElement('div');
         progressText.style.cssText = `
             font-size: 12px;
             color: #666;
             margin-bottom: 10px;
         `;
         progressText.textContent = '0%';
         
         const progressDetails = document.createElement('div');
         progressDetails.style.cssText = `
             font-size: 11px;
             color: #999;
         `;
         progressDetails.textContent = `0 of ${totalRecords} records processed`;
         
         // Assemble progress bar
         progressContainer.appendChild(progressBar);
         progressContent.appendChild(progressTitle);
         progressContent.appendChild(progressSubtitle);
         progressContent.appendChild(progressContainer);
         progressContent.appendChild(progressText);
         progressContent.appendChild(progressDetails);
         progressOverlay.appendChild(progressContent);
         document.body.appendChild(progressOverlay);
         
         // Progress tracking function
         let processedRecords = 0;
         const updateProgress = (step = 1, stepDescription = '') => {
             processedRecords += step;
             const percentage = Math.round((processedRecords / totalRecords) * 100);
             progressBar.style.width = percentage + '%';
             progressText.textContent = `${percentage}%`;
             progressDetails.textContent = `${processedRecords} of ${totalRecords} records processed${stepDescription ? ` - ${stepDescription}` : ''}`;
         };

         try {
             // SINGLE RECORD MODE: One PDF per record
             console.log('=== SINGLE RECORD MODE ===');
                 
                 for (let recordIndex = 0; recordIndex < totalRecords; recordIndex++) {
                     console.log(`\n--- Processing Record ${recordIndex + 1}/${totalRecords} ---`);
                     
                     const row = sessionState.csvRows[recordIndex];
                     console.log(`Processing record: ${JSON.stringify(row)}`);

                     // Step 3a: Load the template PDF (crisp vector background)
                     console.log('Step 3a: Loading template PDF...');
                     const pdfDoc = await PDFLib.PDFDocument.load(sessionState.templatePdfBytes);
                     
                     // Get the first page
                     const pages = pdfDoc.getPages();
                     if (pages.length === 0) {
                         throw new Error('Template PDF has no pages');
                     }
                     
                     const page = pages[0];
                     
                     // Step 3b: Update UI to show current record data
                     console.log('Step 3b: Updating UI for overlay capture...');
                     
                     // Set current record for this PDF
                     currentRecord = recordIndex;
                     
                     // Update text boxes and image boxes with current record data (single record mode)
                     updateAllTextBoxesForSingleRecord(recordIndex);
                     
                     // Wait for UI to update and ensure images are loaded
                     await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 150ms
                     
                     // Pre-load all images to ensure they're ready for capture
                     progressSubtitle.textContent = 'Loading images...';
                     await preloadAllImages();
                     progressSubtitle.textContent = `Processing ${totalRecords} records...`;
                     
                     // Step 3c: Capture high-resolution overlay (text boxes and image boxes)
                     console.log('Step 3c: Capturing high-res overlays...');
                     const pdfViewer = document.getElementById('pdfViewer');
                     const canvas = document.getElementById('viewer');
                     
                     if (!pdfViewer || !canvas) {
                         throw new Error('PDF viewer not found');
                     }
                     
                     // Get PDF area dimensions
                     const canvasRect = canvas.getBoundingClientRect();
                     const viewerRect = pdfViewer.getBoundingClientRect();
                     const pdfAreaX = canvasRect.left - viewerRect.left;
                     const pdfAreaY = canvasRect.top - viewerRect.top;
                     const pdfAreaWidth = canvasRect.width;
                     const pdfAreaHeight = canvasRect.height;
                     
                     // Calculate optimized scale factor for overlays (balanced quality/speed)
                     let scale = 4; // Reduced from 8 for better performance
                     const img = canvas.querySelector('img');
                     if (img && img.naturalWidth && img.width) {
                         const originalScale = img.naturalWidth / img.width;
                         scale = Math.max(3, originalScale * 1.5); // Reduced multiplier for speed
                     }
                     scale = Math.max(2, Math.min(8, scale)); // Reduced range for faster processing
                     
                     // Capture only the overlay elements with transparency
                     const overlayCanvas = await html2canvas(pdfViewer, {
                         scale: scale,
                         useCORS: true,
                         allowTaint: true,
                         backgroundColor: null, // Transparent background
                         logging: false,
                         x: pdfAreaX,
                         y: pdfAreaY,
                         width: pdfAreaWidth,
                         height: pdfAreaHeight,
                         onclone: (clonedDoc) => {
                             const clonedViewer = clonedDoc.getElementById('pdfViewer');
                             if (clonedViewer) {
                                 // Hide the PDF background completely
                                 const pdfCanvas = clonedDoc.getElementById('viewer');
                                 if (pdfCanvas) {
                                     pdfCanvas.style.display = 'none';
                                 }
                                 
                                 // Hide UI elements
                                 const outline = clonedDoc.getElementById('pdfAreaOutline');
                                 if (outline) outline.style.display = 'none';
                                 
                                 const lockIndicator = clonedViewer.querySelector('.pdf-lock-indicator');
                                 if (lockIndicator) lockIndicator.style.display = 'none';
                                 
                                 // Keep only text boxes and image boxes with their styling
                                 const allBoxes = clonedViewer.querySelectorAll('.draggable-text-box, .draggable-image-box');
                                 allBoxes.forEach(box => {
                                     if (box.classList.contains('draggable-text-box')) {
                                         // Text box styling
                                         box.style.border = 'none';
                                         box.style.background = 'transparent';
                                         box.style.boxShadow = 'none';
                                         box.style.outline = 'none';
                                         // Keep font styling for quality
                                         box.style.fontFamily = box.style.fontFamily || 'Arial, sans-serif';
                                         box.style.fontSize = box.style.fontSize || '16px';
                                         box.style.fontWeight = box.style.fontWeight || 'normal';
                                         box.style.color = box.style.color || '#000000';
                                     } else if (box.classList.contains('draggable-image-box')) {
                                         // Image box styling
                                         box.style.border = 'none';
                                         box.style.background = 'transparent';
                                         box.style.boxShadow = 'none';
                                         box.style.outline = 'none';
                                         // Ensure images are visible and properly sized
                                         const img = box.querySelector('img');
                                         if (img) {
                                             img.style.width = '100%';
                                             img.style.height = '100%';
                                             img.style.objectFit = 'contain';
                                             img.style.display = 'block';
                                         }
                                     }
                                 });
                                 
                                 // Remove resize handles (use !important to override CSS)
                                 const resizeHandles = clonedViewer.querySelectorAll('.transform-control');
                                 resizeHandles.forEach(handle => {
                                     handle.style.setProperty('display', 'none', 'important');
                                     handle.style.setProperty('opacity', '0', 'important');
                                 });
                                 
                                 // Hide "No Image" text in downloaded PDFs
                                 const imageBoxes = clonedViewer.querySelectorAll('.draggable-image-box');
                                 imageBoxes.forEach(box => {
                                     if (box.textContent === 'No Image') {
                                         box.textContent = '';
                                     }
                                 });
                                 
                                 // Make background transparent
                                 clonedViewer.style.background = 'transparent';
                                 
                                 // Hide PDF controls (top right corner buttons)
                                 const pdfControls = clonedViewer.querySelector('.pdf-controls');
                                 if (pdfControls) pdfControls.style.display = 'none';
                                 
                                 // Fix image stretching for all image boxes before capture
                                 const imageImgs = clonedViewer.querySelectorAll('.draggable-image-box img');
                                 imageImgs.forEach(img => {
                                     if (img.naturalWidth && img.naturalHeight) {
                                         const naturalWidth = img.naturalWidth;
                                         const naturalHeight = img.naturalHeight;
                                         const boxWidth = img.parentElement.offsetWidth;
                                         const boxHeight = img.parentElement.offsetHeight;
                                         
                                         const imageAspect = naturalWidth / naturalHeight;
                                         const boxAspect = boxWidth / boxHeight;
                                         
                                         if (imageAspect > boxAspect) {
                                             img.style.width = '100%';
                                             img.style.height = 'auto';
                                         } else {
                                             img.style.width = 'auto';
                                             img.style.height = '100%';
                                         }
                                         
                                         img.style.objectFit = 'none';
                                         img.style.objectPosition = 'center';
                                     }
                                 });
                             }
                         }
                     });
                     

                     
                     // Step 3d: Convert overlay to PNG with transparency
                     console.log('Step 3d: Converting overlay to PNG...');
                     const overlayPngDataUrl = overlayCanvas.toDataURL('image/png', 1.0);
                     
                     // Step 3e: Embed overlay image into PDF
                     console.log('Step 3e: Embedding overlay into PDF...');
                     const overlayImage = await pdfDoc.embedPng(overlayPngDataUrl);
                     
                     // Get page dimensions
                     const { width: pageWidth, height: pageHeight } = page.getSize();
                     
                     // Add overlay image to page (full page coverage)
                     page.drawImage(overlayImage, {
                         x: 0,
                         y: 0,
                         width: pageWidth,
                         height: pageHeight,
                     });
                     
                     // Step 3f: Save the hybrid PDF
                     console.log('Step 3f: Saving hybrid PDF...');
                     const pdfBytes = await pdfDoc.save();
                     
                     // Step 3g: Add to zip with record-specific naming
                     const recordNumber = recordIndex + 1;
                     const fileName = `single_record_${recordNumber}_of_${totalRecords}.pdf`;
                     zip.file(fileName, pdfBytes);
                     
                     console.log(`✓ Single record ${recordNumber} added to zip: ${fileName}`);
                     
                     // Update progress
                     updateProgress(1, 'PDF generated');
                 }
             
             // Step 4: Download zip file
             console.log('Step 4: Generating zip file...');
             progressSubtitle.textContent = 'Creating zip file...';
             const zipBlob = await zip.generateAsync({ type: 'blob' });
             
             // Create download link with single record naming
             const url = URL.createObjectURL(zipBlob);
             const a = document.createElement('a');
             a.href = url;
             a.download = `single_record_high_quality_pdfs_${totalRecords}_records.zip`;
             document.body.appendChild(a);
             a.click();
             document.body.removeChild(a);
             URL.revokeObjectURL(url);
             
             console.log(`✓ Single Record high-quality download complete!`);
             
         // Log PDF generation summary
         logPDFGenerationSummary(totalRecords, 'Single Record Mode');
             
         } catch (error) {
             console.error('Error during PDF generation:', error);
             
             // Remove progress overlay on error
             if (progressOverlay && progressOverlay.parentNode) {
                 progressOverlay.parentNode.removeChild(progressOverlay);
             }
             
             throw error;
         } finally {
             // Restore original state
             currentPage = 0;
             await updateAllBoxesWithCSVData();
             
             // Remove progress overlay
             if (progressOverlay && progressOverlay.parentNode) {
                 progressOverlay.parentNode.removeChild(progressOverlay);
             }
         }
         
     } catch (error) {
         console.error('Download failed:', error);
         alert('Error generating PDFs: ' + error.message);
             
             // Remove progress overlay on error
             if (progressOverlay && progressOverlay.parentNode) {
                 progressOverlay.parentNode.removeChild(progressOverlay);
             }
     } finally {
             // Remove progress overlay
             if (progressOverlay && progressOverlay.parentNode) {
                 progressOverlay.parentNode.removeChild(progressOverlay);
             }
             
         // Restore button state
         const downloadBtn = document.getElementById('downloadPdfsBtn');
         downloadBtn.disabled = false;
         downloadBtn.textContent = '📦 Download All PDFs (ZIP)';
     }
 }

 // Take Screenshot function
 async function takeScreenshot() {
     try {
         const pdfViewer = document.getElementById('pdfViewer');
         const canvas = document.getElementById('viewer');
         
         if (!pdfViewer || !canvas) {
             alert('No PDF viewer found. Please upload a PDF first.');
             return;
         }

         // Show loading state
         const screenshotBtn = document.getElementById('screenshotBtn');
         const originalText = screenshotBtn.textContent;
         screenshotBtn.textContent = '📸 Taking Screenshot...';
         screenshotBtn.disabled = true;

         // Get PDF area dimensions (same as download function)
         const canvasRect = canvas.getBoundingClientRect();
         const viewerRect = pdfViewer.getBoundingClientRect();
         const pdfAreaX = canvasRect.left - viewerRect.left;
         const pdfAreaY = canvasRect.top - viewerRect.top;
         const pdfAreaWidth = canvasRect.width;
         const pdfAreaHeight = canvasRect.height;

         // Calculate high-quality scale factor (same as download function)
         let scale = 6;
         const img = canvas.querySelector('img');
         if (img && img.naturalWidth && img.width) {
             const originalScale = img.naturalWidth / img.width;
             scale = Math.max(6, originalScale * 1.5);
         }
         scale = Math.max(4, Math.min(12, scale));

         // Use html2canvas to capture only the PDF area
         const capturedCanvas = await html2canvas(pdfViewer, {
             scale: scale,
             useCORS: true,
             allowTaint: true,
             backgroundColor: '#ffffff',
             logging: false,
             x: pdfAreaX,
             y: pdfAreaY,
             width: pdfAreaWidth,
             height: pdfAreaHeight,
             onclone: (clonedDoc) => {
                 const clonedViewer = clonedDoc.getElementById('pdfViewer');
                 if (clonedViewer) {
                     // Hide UI elements that shouldn't be in screenshot
                     const outline = clonedDoc.getElementById('pdfAreaOutline');
                     if (outline) outline.style.display = 'none';
                     
                     const lockIndicator = clonedViewer.querySelector('.pdf-lock-indicator');
                     if (lockIndicator) lockIndicator.style.display = 'none';
                     
                     // Hide PDF controls (top right corner buttons)
                     const pdfControls = clonedViewer.querySelector('.pdf-controls');
                     if (pdfControls) pdfControls.style.display = 'none';
                     
                     // Remove borders and backgrounds from text boxes for clean screenshot
                     const allBoxes = clonedViewer.querySelectorAll('.draggable-text-box');
                     allBoxes.forEach(box => {
                         box.style.border = 'none';
                         box.style.background = 'transparent';
                         box.style.boxShadow = 'none';
                         box.style.outline = 'none';
                     });
                     
                     // Remove resize handles
                     const resizeHandles = clonedViewer.querySelectorAll('.transform-control');
                     resizeHandles.forEach(handle => {
                         handle.style.display = 'none';
                     });
                 }
             }
         });

         // Convert canvas to blob
         capturedCanvas.toBlob((blob) => {
             // Create download link
             const url = URL.createObjectURL(blob);
             const link = document.createElement('a');
             link.href = url;
             link.download = `pdf-screenshot-${Date.now()}.png`;
             
             // Trigger download
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
             
             // Clean up
             URL.revokeObjectURL(url);
             
             // Restore button state
             screenshotBtn.textContent = originalText;
             screenshotBtn.disabled = false;
             
             console.log('Screenshot taken and downloaded successfully');
         }, 'image/png', 0.95);

     } catch (error) {
         console.error('Screenshot failed:', error);
         alert('Error taking screenshot: ' + error.message);
         
         // Restore button state on error
         const screenshotBtn = document.getElementById('screenshotBtn');
         screenshotBtn.textContent = '📸 TAKE SCREENSHOT';
         screenshotBtn.disabled = false;
     }
 }

 // Download Current PDF function
 async function downloadCurrentPdf() {
     try {
         if (!sessionState.templatePdfBytes) {
             alert('Please upload a PDF template first');
             return;
         }

         // Show loading state
         const downloadBtn = document.getElementById('screenshotBtn');
         const originalText = downloadBtn.textContent;
         downloadBtn.textContent = '📄 Generating PDF...';
         downloadBtn.disabled = true;

         // Step 1: Load the template PDF
         console.log('Step 1: Loading template PDF...');
         const pdfDoc = await PDFLib.PDFDocument.load(sessionState.templatePdfBytes);
         const page = pdfDoc.getPages()[0];

         // Step 2: Pre-load all images
         console.log('Step 2: Pre-loading images...');
         await preloadAllImages();

         // Step 3: Capture high-resolution overlay (text boxes and image boxes)
         console.log('Step 3: Capturing high-res overlays...');
         const pdfViewer = document.getElementById('pdfViewer');
         const canvas = document.getElementById('viewer');
         
         if (!pdfViewer || !canvas) {
             throw new Error('PDF viewer not found');
         }

         // Wait for UI to update
         await new Promise(resolve => setTimeout(resolve, 100));

         // Get PDF area dimensions (same as multi-page function)
         const canvasRect = canvas.getBoundingClientRect();
         const viewerRect = pdfViewer.getBoundingClientRect();
         const pdfAreaX = canvasRect.left - viewerRect.left;
         const pdfAreaY = canvasRect.top - viewerRect.top;
         const pdfAreaWidth = canvasRect.width;
         const pdfAreaHeight = canvasRect.height;
         
         // Calculate optimized scale factor for overlays (same as multi-page function)
         let scale = 4;
         const img = canvas.querySelector('img');
         if (img && img.naturalWidth && img.width) {
             const originalScale = img.naturalWidth / img.width;
             scale = Math.max(3, originalScale * 1.5);
         }
         scale = Math.max(2, Math.min(8, scale));
         
         // Capture only the overlay elements with transparency (same as multi-page function)
         const overlayCanvas = await html2canvas(pdfViewer, {
             scale: scale,
             useCORS: true,
             allowTaint: true,
             backgroundColor: null,
             logging: false,
             x: pdfAreaX,
             y: pdfAreaY,
             width: pdfAreaWidth,
             height: pdfAreaHeight,
             onclone: (clonedDoc) => {
                 const clonedViewer = clonedDoc.getElementById('pdfViewer');
                 if (clonedViewer) {
                     // Hide the PDF background completely
                     const pdfCanvas = clonedDoc.getElementById('viewer');
                     if (pdfCanvas) {
                         pdfCanvas.style.display = 'none';
                     }
                     
                     // Hide UI elements
                     const outline = clonedDoc.getElementById('pdfAreaOutline');
                     if (outline) outline.style.display = 'none';
                     
                     const lockIndicator = clonedViewer.querySelector('.pdf-lock-indicator');
                     if (lockIndicator) lockIndicator.style.display = 'none';
                     
                     // Keep only text boxes and image boxes with their styling
                     const allBoxes = clonedViewer.querySelectorAll('.draggable-text-box, .draggable-image-box');
                     allBoxes.forEach(box => {
                         if (box.classList.contains('draggable-text-box')) {
                             // Text box styling
                             box.style.border = 'none';
                             box.style.background = 'transparent';
                             box.style.boxShadow = 'none';
                             box.style.outline = 'none';
                             // Keep font styling for quality
                             box.style.fontFamily = box.style.fontFamily || 'Arial, sans-serif';
                             box.style.fontSize = box.style.fontSize || '16px';
                             box.style.fontWeight = box.style.fontWeight || 'normal';
                             box.style.color = box.style.color || '#000000';
                         } else if (box.classList.contains('draggable-image-box')) {
                             // Image box styling
                             box.style.border = 'none';
                             box.style.background = 'transparent';
                             box.style.boxShadow = 'none';
                             box.style.outline = 'none';
                             // Ensure images are visible and properly sized
                             const img = box.querySelector('img');
                             if (img) {
                                 // Use natural dimensions to prevent stretching
                                 const naturalWidth = img.naturalWidth;
                                 const naturalHeight = img.naturalHeight;
                                 const boxWidth = box.offsetWidth;
                                 const boxHeight = box.offsetHeight;
                                 
                                 // Calculate aspect ratio and fit image properly
                                 const imageAspect = naturalWidth / naturalHeight;
                                 const boxAspect = boxWidth / boxHeight;
                                 
                                 if (imageAspect > boxAspect) {
                                     // Image is wider than box - fit to width
                                     img.style.width = '100%';
                                     img.style.height = 'auto';
                                 } else {
                                     // Image is taller than box - fit to height
                                     img.style.width = 'auto';
                                     img.style.height = '100%';
                                 }
                                 
                                 img.style.objectFit = 'none';
                                 img.style.objectPosition = 'center';
                                 img.style.display = 'block';
                             }
                             
                             // Hide "No Image" text in downloaded PDFs
                             if (box.textContent === 'No Image') {
                                 box.textContent = '';
                             }
                         }
                     });
                     
                     // Remove resize handles (use !important to override CSS)
                     const resizeHandles = clonedViewer.querySelectorAll('.transform-control');
                     resizeHandles.forEach(handle => {
                         handle.style.setProperty('display', 'none', 'important');
                         handle.style.setProperty('opacity', '0', 'important');
                     });
                     
                     // Hide "No Image" text in downloaded PDFs
                     const imageBoxes = clonedViewer.querySelectorAll('.draggable-image-box');
                     imageBoxes.forEach(box => {
                         if (box.textContent === 'No Image') {
                             box.textContent = '';
                         }
                     });
                     
                     // Make background transparent
                     clonedViewer.style.background = 'transparent';
                     
                     // Hide PDF controls (top right corner buttons)
                     const pdfControls = clonedViewer.querySelector('.pdf-controls');
                     if (pdfControls) pdfControls.style.display = 'none';
                 }
             }
         });

         // Step 4: Convert overlay to PNG with transparency
         console.log('Step 4: Converting overlay to PNG...');
         const overlayPngDataUrl = overlayCanvas.toDataURL('image/png', 1.0);

         // Step 5: Embed overlay image into PDF
         console.log('Step 5: Embedding overlay into PDF...');
         const overlayImage = await pdfDoc.embedPng(overlayPngDataUrl);

         // Get page dimensions
         const { width: pageWidth, height: pageHeight } = page.getSize();

         // Add overlay image to page (full page coverage)
         page.drawImage(overlayImage, {
             x: 0,
             y: 0,
             width: pageWidth,
             height: pageHeight,
         });

         // Step 6: Save and download
         console.log('Step 6: Saving and downloading...');
         const pdfBytes = await pdfDoc.save();
         
         // Create download link
         const blob = new Blob([pdfBytes], { type: 'application/pdf' });
         const url = URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = url;
         link.download = `current-pdf-${Date.now()}.pdf`;
         
         // Trigger download
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         
         // Clean up
         URL.revokeObjectURL(url);
         
         // Restore button state
         downloadBtn.textContent = originalText;
         downloadBtn.disabled = false;
         
         console.log('Current PDF downloaded successfully');
         
     } catch (error) {
         console.error('Download failed:', error);
         alert('Error downloading PDF: ' + error.message);
         
         // Restore button state on error
         const downloadBtn = document.getElementById('screenshotBtn');
         downloadBtn.textContent = '📄 Download Current PDF';
         downloadBtn.disabled = false;
     }
 }

 // Helper function to convert hex color to RGB
 function hexToRgb(hex) {
     const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
     return result ? {
         r: parseInt(result[1], 16),
         g: parseInt(result[2], 16),
         b: parseInt(result[3], 16)
     } : { r: 0, g: 0, b: 0 };
 }

 // Generate From Template function
 async function generateFromTemplate() {
     try {
         if (!sessionState.templatePdfBytes) {
             alert('Please select a PDF template first');
             return;
         }

         // Load the template PDF using the Uint8Array copy
         const pdfDoc = await PDFLib.PDFDocument.load(sessionState.templatePdfBytes);
         
         // Embed the Helvetica Bold font
         const helveticaBoldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
         
         // Get the first page
         const pages = pdfDoc.getPages();
         if (pages.length === 0) {
             throw new Error('Template PDF has no pages');
         }
         
         const page = pages[0];
         
         // Get current timestamp for demo data
         const timestamp = new Date().toISOString();
         const dateStr = new Date().toLocaleDateString();
         
         // Add text overlay at fixed positions
         page.drawText('TICKET #12345', {
             x: 100,
             y: 700,
             size: 16,
             font: helveticaBoldFont,
             color: PDFLib.rgb(0, 0, 0)
         });
         
         page.drawText(`Date: ${dateStr}`, {
             x: 100,
             y: 650,
             size: 12,
             font: helveticaBoldFont,
             color: PDFLib.rgb(0.2, 0.2, 0.2)
         });
         
         page.drawText(`Generated: ${timestamp}`, {
             x: 100,
             y: 620,
             size: 10,
             font: helveticaBoldFont,
             color: PDFLib.rgb(0.4, 0.4, 0.4)
         });
         
         // Add some sample fields
         page.drawText('Customer: John Doe', {
             x: 100,
             y: 580,
             size: 12,
             font: helveticaBoldFont,
             color: PDFLib.rgb(0, 0, 0)
         });
         
         page.drawText('Amount: $99.99', {
             x: 100,
             y: 550,
             size: 14,
             font: helveticaBoldFont,
             color: PDFLib.rgb(0.8, 0, 0)
         });
         
         page.drawText('Status: PAID', {
             x: 100,
             y: 520,
             size: 12,
             font: helveticaBoldFont,
             color: PDFLib.rgb(0, 0.6, 0)
         });
         
         // Save the modified PDF
         const pdfBytes = await pdfDoc.save();
         
         // Create a blob and download link
         const blob = new Blob([pdfBytes], { type: 'application/pdf' });
         const url = URL.createObjectURL(blob);
         
         // Create and trigger download
         const link = document.createElement('a');
         link.href = url;
         link.download = `template-generated-${Date.now()}.pdf`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         
         // Clean up the URL
         URL.revokeObjectURL(url);
         
     } catch (error) {
         console.error('Error generating from template:', error);
         alert('Error generating from template: ' + error.message);
     }
 }



 function parseCSVFile(file) {
     console.log('parseCSVFile function called with file:', file);
     console.log('Parsing CSV file:', file.name, file.size);
     Papa.parse(file, {
         header: true,
         skipEmptyLines: true,
         complete: async function(results) {
             console.log('CSV parsing complete:', results);
             if (results.errors.length > 0) {
                 console.error('CSV parsing errors:', results.errors);
                 alert('Error parsing CSV file. Please check the file format.');
                 return;
             }

             // Store CSV data in session state and global variable
             sessionState.csv = file;
             sessionState.csvRows = results.data;
             csvData = results.data;
             
             // Add columns property to csvData for compatibility with MERGE-ONLINE
             if (results.data && results.data.length > 0) {
                 csvData.columns = Object.keys(results.data[0]);
                 sessionState.csvColumns = Object.keys(results.data[0]); // Add this line
                 
                                     // Debug: Check for malformed URLs in image columns
             const imageColumns = Object.keys(results.data[0]).filter(col => 
                 col.toLowerCase().includes('image') || 
                 col.toLowerCase().includes('img') || 
                 col.toLowerCase().includes('photo') ||
                 col.toLowerCase().includes('url')
             );
             
             if (imageColumns.length > 0) {
                 console.log('Found potential image columns:', imageColumns);
                 // Check first few rows for malformed URLs
                 for (let i = 0; i < Math.min(3, results.data.length); i++) {
                     imageColumns.forEach(col => {
                         const url = results.data[i][col];
                         if (url && url.includes('http')) {
                             console.log(`Row ${i}, Column ${col}:`, url);
                             if (url.includes('http') && url.split('http').length > 2) {
                                 console.warn(`⚠️ MALFORMED URL DETECTED in row ${i}, column ${col}:`, url);
                             }
                         }
                     });
                 }
             } else {
                 console.warn('⚠️ No image columns found in CSV. Available columns:', Object.keys(results.data[0]));
                 console.warn('⚠️ For image boxes to work, you need a column containing image URLs');
             }
             }
             
             currentRecord = 0;
             

             

             
             // Display preview
             displayCSVPreview(results.data);
             
             // Show record navigation
             showRecordNavigation();
             
             // Update file label
             document.getElementById('csvLabel').textContent = file.name;
             
             // Update box editor if a box is selected
             if (sessionState.selectedBox) {
                 updateBoxEditorValues(sessionState.selectedBox);
             }
             
             // Update all text boxes with CSV data
             await updateAllBoxesWithCSVData();
             
             // Update download button state
             updateDownloadButtonState();
             
             // Update records info
             updateRecordsInfo();
             
             // Initialize page navigation
             updatePageNavigation();
             
             // Update create records button state
             updateCreateRecordsButtonState();
     
     // Update page navigation to recalculate recordsPerPage
     updatePageNavigation();
     
     // Show all transform controls after CSV is loaded
     showAllTransformControls();
     
     console.log('Text box creation complete. Total boxes in sessionState:', sessionState.boxes.length);
         },
         error: function(error) {
             console.error('CSV parsing error:', error);
             alert('Error reading CSV file: ' + error.message);
         }
     });
 }

 function displayCSVPreview(data) {
     console.log('Displaying CSV preview with data:', data);
     if (!data || data.length === 0) {
         console.log('No CSV data to display');
         return;
     }

     // CSV preview section was removed, so we just log the data
     console.log('CSV loaded successfully:', data.length, 'rows');
     console.log('CSV columns:', Object.keys(data[0]));
     
     // Check for malformed URLs and provide user feedback
     const malformedUrls = findMalformedUrls(data);
     if (malformedUrls.length > 0) {
         console.warn('⚠️ MALFORMED URLs detected in CSV:', malformedUrls.length, 'issues found');
         showMalformedUrlWarning(malformedUrls);
     }
 }
 
 function findMalformedUrls(data) {
     const malformed = [];
     const imageColumns = Object.keys(data[0]).filter(col => 
         col.toLowerCase().includes('image') || 
         col.toLowerCase().includes('img') || 
         col.toLowerCase().includes('photo') ||
         col.toLowerCase().includes('url')
     );
     
     data.forEach((row, index) => {
         imageColumns.forEach(col => {
             const url = row[col];
             if (url && typeof url === 'string' && url.includes('http')) {
                 if (url.includes('http') && url.split('http').length > 2) {
                     malformed.push({
                         row: index + 1,
                         column: col,
                         url: url,
                         type: 'concatenated_urls'
                     });
                 } else if (url.includes('...') && url.includes(':')) {
                     malformed.push({
                         row: index + 1,
                         column: col,
                         url: url,
                         type: 'domain_concat'
                     });
                 }
             }
         });
     });
     
     return malformed;
 }
 
 function showMalformedUrlWarning(malformedUrls) {
     const warningDiv = document.createElement('div');
     warningDiv.style.cssText = `
         position: fixed;
         top: 20px;
         right: 20px;
         background: #fff3cd;
         border: 1px solid #ffeaa7;
         border-radius: 5px;
         padding: 15px;
         max-width: 400px;
         box-shadow: 0 2px 10px rgba(0,0,0,0.1);
         z-index: 10000;
         font-family: Arial, sans-serif;
     `;
     
     warningDiv.innerHTML = `
         <div style="display: flex; align-items: center; margin-bottom: 10px;">
             <span style="font-size: 20px; margin-right: 10px;">⚠️</span>
             <strong>CSV URL Issues Detected</strong>
         </div>
         <p style="margin: 0 0 10px 0; font-size: 14px;">
             Found ${malformedUrls.length} malformed image URLs in your CSV file. 
             The app will attempt to fix these automatically, but you may want to clean your CSV file.
         </p>
         <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
             <strong>Issues found:</strong><br>
             ${malformedUrls.slice(0, 3).map(issue => 
                 `Row ${issue.row}, ${issue.column}: ${issue.url.substring(0, 50)}...`
             ).join('<br>')}
             ${malformedUrls.length > 3 ? `<br>... and ${malformedUrls.length - 3} more` : ''}
         </div>
         <button onclick="this.parentElement.remove()" style="
             background: #007bff;
             color: white;
             border: none;
             padding: 5px 15px;
             border-radius: 3px;
             cursor: pointer;
             font-size: 12px;
         ">Dismiss</button>
     `;
     
     document.body.appendChild(warningDiv);
     
     // Auto-remove after 10 seconds
     setTimeout(() => {
         if (warningDiv.parentElement) {
             warningDiv.remove();
         }
     }, 10000);
 }

 function toggleCSVPreview() {
     // CSV preview functionality was removed
 }

 function resetSession() {
     // Cancel any ongoing PDF rendering operations
     if (window.currentRenderTask) {
         try {
             window.currentRenderTask.cancel();
             console.log('Cancelled render task during session reset');
         } catch (cancelError) {
             console.log('Render task already completed or cancelled');
         }
         window.currentRenderTask = null;
     }
     
     // Clear session state
     sessionState = {
         templatePdf: null,
         templatePdfBytes: null,
         csv: null,
         csvRows: [],
         layout: null,
         boxes: [],
         selectedBox: null,
         // Preserve file metadata for change detection
         pdfMetadata: sessionState.pdfMetadata,
         csvMetadata: sessionState.csvMetadata,
         // Preserve live monitoring setting
         liveMonitoringEnabled: sessionState.liveMonitoringEnabled
     };
     
     // Reset box counter
     boxCounter = 0;
     currentBoxId = null;
     
     // Clear editor canvas
     if (editorCanvas) {
         editorCanvas.clear();
     }
     
     // Hide box editor
     updateBoxEditor();

     // Clear current variables
     currentPdf = null;
     currentFile = null;
     serverPdfUrl = null;
     
     // Clear PDF metadata when PDF is removed
     sessionState.pdfMetadata = null;

     // Reset UI
     const fileLabel = document.getElementById('fileLabel');
     const downloadLink = document.getElementById('downloadLink');
     const noPdf = document.getElementById('noPdf');
     const loadingPdf = document.getElementById('loadingPdf');
     const viewer = document.getElementById('viewer');
     
     if (fileLabel) fileLabel.textContent = 'Click to select PDF file';
     if (downloadLink) downloadLink.style.display = 'none';
     if (noPdf) {
         noPdf.style.display = 'block';
         noPdf.innerHTML = `
         <h3>No PDF selected</h3>
         <p>Choose a PDF file to start viewing</p>
     `;
     }
     if (loadingPdf) loadingPdf.style.display = 'none';
     if (viewer) viewer.style.display = 'none';

     // Clear file inputs
     const pdfFileInput = document.getElementById('pdfFile');
     const csvFileInput = document.getElementById('csvFile');
     const csvLabel = document.getElementById('csvLabel');
     
     if (pdfFileInput) pdfFileInput.value = '';
     if (csvFileInput) csvFileInput.value = '';
     if (csvLabel) csvLabel.textContent = 'Click to select CSV file';
     
     // Clear file metadata when files are removed
     sessionState.pdfMetadata = null;
     sessionState.csvMetadata = null;
     // csvPreview element was removed

     // Disable Generate From Template button
                     // generateFromTemplateBtn was removed
     
     // Update download button state
     updateDownloadButtonState();



     // Revoke any ObjectURLs if they exist
     if (serverPdfUrl && serverPdfUrl.startsWith('blob:')) {
         URL.revokeObjectURL(serverPdfUrl);
     }
 }

 function toggleSidebar() {
     const sidebar = document.querySelector('.sidebar');
     sidebar.classList.toggle('collapsed');
 }

 // Font Management Functions
 function initializeFontHandling() {
     const fontUploadArea = document.getElementById('fontUploadArea');
     const fontUploadInput = document.getElementById('fontUploadInput');
     const addFontUrlBtn = document.getElementById('addFontUrlBtn');
     const fontUrlInput = document.getElementById('fontUrlInput');

     if (fontUploadArea && fontUploadInput) {
         fontUploadArea.addEventListener('click', () => fontUploadInput.click());
         fontUploadArea.addEventListener('dragover', e => {
             e.preventDefault();
             fontUploadArea.classList.add('dragover');
         });
         fontUploadArea.addEventListener('dragleave', e => {
             e.preventDefault();
             fontUploadArea.classList.remove('dragover');
         });
         fontUploadArea.addEventListener('drop', e => {
             e.preventDefault();
             fontUploadArea.classList.remove('dragover');
             if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                 handleFontUpload(e.dataTransfer.files[0]);
             }
         });
         fontUploadInput.addEventListener('change', e => {
             if (fontUploadInput.files && fontUploadInput.files[0]) {
                 handleFontUpload(fontUploadInput.files[0]);
             }
         });
     }

     if (addFontUrlBtn && fontUrlInput) {
         addFontUrlBtn.addEventListener('click', handleGoogleFontUrl);
     }
     
     // Initialize font dropdowns
     updateFontDropdowns();
 }

 function handleFontUpload(file) {
     const status = document.getElementById('fontUploadStatus');
     
     if (!file.name.match(/\.(ttf|otf)$/i)) {
         status.textContent = 'Only .ttf and .otf files are allowed.';
         status.className = 'font-status error';
         return;
     }
     
     status.textContent = 'Processing font...';
     status.className = 'font-status';
     
     const reader = new FileReader();
     reader.onload = function(e) {
         try {
             const base64 = e.target.result.split(',')[1];
             const fontName = file.name.replace(/\.(ttf|otf)$/i, '');
             const fileExtension = file.name.match(/\.(ttf|otf)$/i)[1].toLowerCase();
             const format = fileExtension === 'ttf' ? 'truetype' : 'opentype';
             
             // Remove existing font-face if it exists
             const existingStyle = document.getElementById(`font-face-${fontName}`);
             if (existingStyle) {
                 existingStyle.remove();
             }
             
             // Create @font-face rule with data URL
             const style = document.createElement('style');
             style.id = `font-face-${fontName}`;
             style.textContent = `
                 @font-face {
                     font-family: '${fontName}';
                     src: url(data:font/${fileExtension};base64,${base64}) format('${format}');
                     font-display: swap;
                 }
             `;
             document.head.appendChild(style);
             
             // Add to available fonts if not already present
             if (!sessionState.availableFonts) {
                 sessionState.availableFonts = [];
             }
             if (!sessionState.availableFonts.includes(fontName)) {
                 sessionState.availableFonts.push(fontName);
                 updateFontDropdowns();
             }
             
             // Set as default font for new text boxes
             sessionState.defaultFontFamily = fontName;
             
             // Update existing text boxes that use the old default
             sessionState.boxes.forEach(box => {
                 if (box.boxType === 'text' && (!box.fontFamily || box.fontFamily === 'Arial')) {
                     box.fontFamily = fontName;
                     if (box.element) {
                         box.element.style.fontFamily = `'${fontName}', Arial, sans-serif`;
                     }
                 }
             });
             
             // Update the format all dropdown to show the new font
             const formatAllFontFamily = document.getElementById('formatAllFontFamily');
             if (formatAllFontFamily) {
                 formatAllFontFamily.value = fontName;
             }
             
             // Update current text box if selected
             if (sessionState.selectedBox && sessionState.selectedBox.boxType === 'text') {
                 sessionState.selectedBox.fontFamily = fontName;
                 updateTextBoxFont(sessionState.selectedBox);
                 // Update the dropdown to show the new font
                 const boxFontFamily = document.getElementById('boxFontFamily');
                 if (boxFontFamily) {
                     boxFontFamily.value = fontName;
                 }
             }
             
             status.textContent = `Font "${fontName}" loaded successfully and applied to text boxes!`;
             status.className = 'font-status success';
             
         } catch (error) {
             console.error('Error processing font:', error);
             status.textContent = 'Error processing font file.';
             status.className = 'font-status error';
         }
     };
     
     reader.onerror = function() {
         status.textContent = 'Error reading font file.';
         status.className = 'font-status error';
     };
     
     reader.readAsDataURL(file);
 }

 async function handleGoogleFontUrl() {
     const urlInput = document.getElementById('fontUrlInput');
     const status = document.getElementById('fontUrlStatus');
     const url = urlInput.value.trim();
     
     if (!url) {
         status.textContent = 'Please paste a Google Fonts URL.';
         status.className = 'font-status error';
         return;
     }
     
     if (url.includes('fonts.google.com/share')) {
         status.textContent = 'This is a share link. Please use the "Use on the web" link from Google Fonts.';
         status.className = 'font-status error';
         return;
     }
     
     status.textContent = 'Adding font...';
     status.className = 'font-status';
     
     if (url.startsWith('http') && url.includes('fonts.googleapis.com')) {
         let fontName = await getFontFamilyFromGoogleFontsUrl(url);
         if (!fontName) {
             status.textContent = 'Could not determine font name. Please check the URL.';
             status.className = 'font-status error';
             return;
         }
         
         if (!document.querySelector(`link[href="${url}"]`)) {
             const link = document.createElement('link');
             link.rel = 'stylesheet';
             link.href = url;
             document.head.appendChild(link);
         }
         
         if (!availableFonts.includes(fontName)) {
             availableFonts.push(fontName);
             updateFontDropdown();
         }
         
         // Update current text box if selected
         if (sessionState.selectedBox && sessionState.selectedBox.type === 'text') {
             sessionState.selectedBox.fontFamily = fontName;
             updateTextBoxFont(sessionState.selectedBox);
             // Update the dropdown to show the new font
             document.getElementById('boxFontFamily').value = fontName;
         }
         
         status.textContent = `Font "${fontName}" added successfully!`;
         status.className = 'font-status success';
         urlInput.value = '';
         
     } else {
         status.textContent = 'Please enter a valid Google Fonts URL.';
         status.className = 'font-status error';
     }
 }

 async function getFontFamilyFromGoogleFontsUrl(url) {
     try {
         const res = await fetch(url);
         const css = await res.text();
         const match = css.match(/font-family:\s*'([^']+)'/);
         if (match) {
             return match[1];
         }
     } catch (e) {
         console.warn('Could not fetch Google Fonts CSS:', e);
     }
     
     // Fallback: try to parse from URL
     const urlMatch = url.match(/family=([^:&]+)/);
     if (urlMatch) {
         return decodeURIComponent(urlMatch[1]).replace(/\+/g, ' ').split(':')[0];
     }
     return '';
 }

 function updateFontDropdown() {
     const fontSelect = document.getElementById('boxFontFamily');
     if (!fontSelect) return;
     
     // Store current selection
     const currentValue = fontSelect.value;
     
     // Clear and rebuild options
     fontSelect.innerHTML = '';
     availableFonts.forEach(font => {
         const option = document.createElement('option');
         option.value = font;
         option.textContent = font;
         option.selected = font === currentValue;
         fontSelect.appendChild(option);
     });
 }

 function updateTextBoxFont(box) {
     if (!box || box.type !== 'text') return;
     
     const element = box.element;
     if (element) {
         element.style.fontFamily = `'${box.fontFamily}', Arial, sans-serif`;
         element.style.fontSize = (box.fontSize || 16) + 'px';
         element.style.color = box.color || '#000000';
         element.style.fontWeight = box.bold ? 'bold' : 'normal';
         element.style.fontStyle = box.italic ? 'italic' : 'normal';
         element.style.textDecoration = box.underline ? 'underline' : 'none';
         
         // Set text alignment and flex properties for consistent positioning
         element.style.textAlign = box.textAlign || 'center';
         element.style.justifyContent = box.textAlign === 'left' ? 'flex-start' : 
                                      box.textAlign === 'right' ? 'flex-end' : 'center';
         
         // Don't auto-resize - let user manually resize to reveal hidden text
         // This keeps text position consistent regardless of content length
     }
 }

 // CSV Data Binding Functions
 function showRecordNavigation() {
     // Record navigation was moved to the main interface
     // This function is kept for compatibility but does nothing
 }

 function updateRecordInfo() {
     // recordInfo element was removed with the CSV Data drawer
     // This function is kept for compatibility but does nothing
 }

 async function updateAllBoxesWithCSVData() {
     console.log('Updating all boxes with CSV data. Current page:', currentPage, 'Records per page:', recordsPerPage);
     console.log('Total boxes:', sessionState.boxes.length);
     console.log('CSV data available:', sessionState.csvRows ? sessionState.csvRows.length : 0, 'rows');
     
     // Calculate which records should be shown on the current page
     const startRecord = currentPage * recordsPerPage;
     const endRecord = Math.min(startRecord + recordsPerPage, sessionState.csvRows ? sessionState.csvRows.length : 0);
     
     console.log(`Page ${currentPage + 1}: Showing records ${startRecord + 1}-${endRecord}`);
     
     // Process all boxes with unified record index calculation
     sessionState.boxes.forEach(async (box, boxIndex) => {
         if (box.type === 'text' && box.fieldKey) {
             // Calculate record index using localIndex (position within page layout)
             const localIndex = boxIndex % recordsPerPage;
             const recordIndex = currentPage * recordsPerPage + localIndex;
             console.log(`Text box ${boxIndex} - Local index: ${localIndex}, Record index: ${recordIndex}, Field key: ${box.fieldKey}`);
             updateTextBoxWithCSVData(box, recordIndex);
         } else if (box.boxType === 'image' && box.fieldKey) {
             // Calculate record index using localIndex (position within page layout)
             const localIndex = boxIndex % recordsPerPage;
             const recordIndex = currentPage * recordsPerPage + localIndex;
             console.log(`Image box ${boxIndex} - Local index: ${localIndex}, Record index: ${recordIndex}, Field key: ${box.fieldKey}`);
             await updateImageBoxWithCSVData(box, recordIndex);
         }
     });
 }

 function updateAllTextBoxesForSingleRecord(recordIndex) {
     sessionState.boxes.forEach(box => {
         if (box.type === 'text' && box.fieldKey) {
             // In single record mode, all text boxes show the same record
             updateTextBoxForSingleRecord(box, recordIndex);
         } else if (box.boxType === 'image' && box.fieldKey) {
             // In single record mode, all image boxes show the same record
             updateImageBoxForSingleRecord(box, recordIndex);
         }
     });
 }

 function updateTextBoxWithCSVData(box, recordIndex) {
     if (!box || !box.element || !sessionState.csvRows) return;
     
     console.log(`Text box update - Record index: ${recordIndex}, Field key: ${box.fieldKey}`);
     
     if (recordIndex >= sessionState.csvRows.length) {
         // No more records, show empty
         console.log(`No more records available for text box, showing empty`);
         updateTextBoxContentSafely(box.element, '');
         return;
     }
     
     const row = sessionState.csvRows[recordIndex];
     const text = row[box.fieldKey] || '';
     
     console.log(`Text box - Record ${recordIndex}: "${text}"`);
     
     // Update the text content while preserving resize handles
     updateTextBoxContentSafely(box.element, text);
     
     // Apply formatting
     updateTextBoxFont(box);
 }

 function updateTextBoxForSingleRecord(box, recordIndex) {
     if (!box || !box.element || !sessionState.csvRows) return;
     
     if (recordIndex >= sessionState.csvRows.length) {
         // No more records, show empty
         updateTextBoxContentSafely(box.element, '');
         return;
     }
     
     const row = sessionState.csvRows[recordIndex];
     const text = row[box.fieldKey] || '';
     
     // Update the text content while preserving resize handles
     updateTextBoxContentSafely(box.element, text);
     
     // Apply formatting
     updateTextBoxFont(box);
 }

 function updateImageBoxForSingleRecord(box, recordIndex) {
     if (!box || !box.element || !sessionState.csvRows) return;
     
     if (recordIndex >= sessionState.csvRows.length) {
         // No more records, show placeholder
         box.element.textContent = 'No Image';
         box.element.style.border = '2px dashed #ccc';
         box.element.style.background = 'transparent';
         return;
     }
     
     const row = sessionState.csvRows[recordIndex];
     const imageUrl = row[box.fieldKey] || '';
     
     // Load the new image using proxy to handle CORS
     if (imageUrl && imageUrl.trim() !== '') {
         console.log('Loading image for single record:', imageUrl);
         
         // Clean the URL first (remove extra spaces, newlines, etc.)
         let cleanedUrl = imageUrl.trim().replace(/[\r\n\s]+/g, '_');
         console.log('Original single record URL:', imageUrl);
         console.log('Cleaned single record URL:', cleanedUrl);
         
         // Convert Google Drive URLs to direct download URLs
         cleanedUrl = convertGoogleDriveUrl(cleanedUrl);
         console.log('After Google Drive conversion:', cleanedUrl);
         
         // Try proxy first, then fallback to direct URL
         const proxiedUrl = 'proxy_image.php?url=' + encodeURIComponent(cleanedUrl);
         console.log('Proxied URL for single record image:', proxiedUrl);
         
         // Create image element
         const img = document.createElement('img');
         img.crossOrigin = 'anonymous';
         img.src = proxiedUrl;
         
         // Add fallback for when proxy fails
         img.onerror = function() {
             console.log('Proxy failed for single record image, trying direct URL:', cleanedUrl);
             this.crossOrigin = 'anonymous';
             this.src = cleanedUrl;
         };
         img.style.width = '100%';
         img.style.height = '100%';
         img.style.objectFit = 'contain';
         img.style.objectPosition = 'center';
         
         // Add error handling
         img.onerror = function() {
             console.error('Failed to load image for single record:', imageUrl);
             box.element.textContent = 'Load Failed';
             box.element.style.color = '#ffc107';
             box.element.style.fontWeight = 'bold';
             box.element.style.fontSize = '12px';
             box.element.style.border = '2px dashed #ffc107';
             box.element.style.background = 'rgba(255, 193, 7, 0.1)';
         };
         
         img.onload = function() {
             console.log('Image loaded successfully for single record:', imageUrl);
         };
         
         // Clear existing content and add image
         box.element.innerHTML = '';
         box.element.style.background = 'transparent';
         box.element.style.border = '2px dashed #ccc';
         
         // Remove any existing images to prevent accumulation
         const existingImages = box.element.querySelectorAll('img');
         existingImages.forEach(existingImg => existingImg.remove());
         
         box.element.appendChild(img);
     } else {
         // Show placeholder if no image URL
         box.element.textContent = 'No Image';
         box.element.style.border = '2px dashed #ccc';
         box.element.style.background = 'transparent';
     }
 }
 
 function updateTextBoxWithMappedCSVData(box) {
     if (!box || !box.element || !sessionState.csvRows) return;
     
     // Use the unified record index calculation instead of old mapping system
     const boxIndex = sessionState.boxes.indexOf(box);
     const recordIndex = currentPage * recordsPerPage + (boxIndex % recordsPerPage);
     
     if (recordIndex >= sessionState.csvRows.length) return;
     
     const row = sessionState.csvRows[recordIndex];
     const text = row[box.fieldKey] || '';
     
     // Update the text content while preserving resize handles
     updateTextBoxContentSafely(box.element, text);
     
     // Apply formatting
     updateTextBoxFont(box);
 }

 function updateTextBoxContent(box) {
     if (!box || !box.element) return;
     
     let text = '';
     
     if (box.fieldKey && sessionState.csvRows) {
         // Calculate the record index for this box using unified calculation
         const boxIndex = sessionState.boxes.indexOf(box);
         const recordIndex = currentPage * recordsPerPage + (boxIndex % recordsPerPage);
         
         if (sessionState.csvRows[recordIndex]) {
             // Use CSV data
             text = sessionState.csvRows[recordIndex][box.fieldKey] || '';
         } else {
             // Use static text
             text = box.staticText || 'Sample Text';
         }
     } else {
         // Use static text
         text = box.staticText || 'Sample Text';
     }
     
     updateTextBoxContentSafely(box.element, text);
     updateTextBoxFont(box);
 }



 function updateTextBoxContentSafely(element, text) {
     if (!element) return;
     
     // Store resize handles
     const resizeHandles = Array.from(element.querySelectorAll('.transform-control'));
     
     // Update text content
     element.textContent = text;
     
     // Restore resize handles
     resizeHandles.forEach(handle => {
         element.appendChild(handle);
     });
 }

 function autoResizeTextBox(box) {
     if (!box || !box.element) return;
     
     const element = box.element;
     const text = element.textContent;
     
     if (!text) return;
     
     // Create a temporary element to measure text dimensions
     const tempElement = document.createElement('div');
     tempElement.style.cssText = `
         position: absolute;
         visibility: hidden;
         white-space: nowrap;
         font-family: ${element.style.fontFamily || 'Arial, sans-serif'};
         font-size: ${element.style.fontSize || '16px'};
         font-weight: ${element.style.fontWeight || 'normal'};
         font-style: ${element.style.fontStyle || 'normal'};
         padding: ${element.style.padding || '5px'};
         box-sizing: border-box;
     `;
     tempElement.textContent = text;
     
     document.body.appendChild(tempElement);
     
     // Get the measured dimensions
     const textWidth = tempElement.offsetWidth;
     const textHeight = tempElement.offsetHeight;
     
     // Remove the temporary element
     document.body.removeChild(tempElement);
     
     // Calculate new box dimensions with some padding
     const padding = 10;
     const newWidth = Math.max(20, textWidth + padding * 2);
     const newHeight = Math.max(15, textHeight + padding * 2);
     
     // Update the box dimensions
     element.style.width = newWidth + 'px';
     element.style.height = newHeight + 'px';
     
     // Update the box data
     box.width = newWidth;
     box.height = newHeight;
     
     // Update the position inputs in the editor
     const widthInput = document.getElementById('boxWidth');
     const heightInput = document.getElementById('boxHeight');
     if (widthInput) widthInput.value = newWidth;
     if (heightInput) heightInput.value = newHeight;
 }

 // Canvas-based interaction system (like the reference implementation)
 class CanvasInteractionSystem {
     constructor() {
         this.canvas = null;
         this.ctx = null;
         this.zoomLevel = 1.0;
         this.minZoom = 0.1;
         this.maxZoom = 5.0;
         this.zoomStep = 0.1;
         
         // Interaction state
         this.isDragging = false;
         this.isResizing = false;
         this.dragOffset = { x: 0, y: 0 };
         this.resizeHandle = null;
         this.selectedBox = null;
         this.cursor = 'default';
         
         // Resize handle size
         this.handleSize = 8;
         
         // Boxes array (will sync with sessionState.boxes)
         this.boxes = [];
         
         this.initializeCanvas();
         this.setupEventListeners();
     }
     
     initializeCanvas() {
         this.canvas = document.getElementById('interactionCanvas');
         if (!this.canvas) {
             console.error('Interaction canvas not found');
             return;
         }
         
         this.ctx = this.canvas.getContext('2d');
         this.resizeCanvas();
         
         // Listen for window resize
         window.addEventListener('resize', () => this.resizeCanvas());
     }
     
     resizeCanvas() {
         if (!this.canvas) return;
         
         const pdfCanvas = document.getElementById('viewer');
         if (pdfCanvas) {
             const rect = pdfCanvas.getBoundingClientRect();
             this.canvas.width = rect.width;
             this.canvas.height = rect.height;
             this.canvas.style.width = rect.width + 'px';
             this.canvas.style.height = rect.height + 'px';
         }
     }
     
     setupEventListeners() {
         if (!this.canvas) return;
         
         this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
         this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
         this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
         this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
     }
     
     getMousePos(e) {
         const rect = this.canvas.getBoundingClientRect();
         return {
             x: (e.clientX - rect.left) / this.zoomLevel,
             y: (e.clientY - rect.top) / this.zoomLevel
         };
     }
     
     syncBoxes() {
         // Sync with sessionState.boxes
         this.boxes = sessionState.boxes.map(box => {
             if (box.element) {
                 const rect = box.element.getBoundingClientRect();
                 const canvasRect = this.canvas.getBoundingClientRect();
                 return {
                     id: box.id,
                     type: box.boxType,
                     x: rect.left - canvasRect.left,
                     y: rect.top - canvasRect.top,
                     width: rect.width,
                     height: rect.height,
                     text: box.element.textContent || '',
                     fontSize: parseInt(box.element.style.fontSize) || 16,
                     color: box.element.style.color || '#000000',
                     backgroundColor: box.element.style.backgroundColor || 'transparent',
                     borderColor: box.element.style.borderColor || '#333333'
                 };
             }
             return null;
         }).filter(box => box !== null);
     }
     
     isPointInBox(x, y, box) {
         return x >= box.x && 
                x <= box.x + box.width &&
                y >= box.y && 
                y <= box.y + box.height;
     }
     
     getResizeHandle(x, y, box) {
         const handles = [
             { name: 'nw', x: box.x, y: box.y },
             { name: 'ne', x: box.x + box.width, y: box.y },
             { name: 'sw', x: box.x, y: box.y + box.height },
             { name: 'se', x: box.x + box.width, y: box.y + box.height }
         ];
         
         for (let handle of handles) {
             if (Math.abs(x - handle.x) <= this.handleSize && 
                 Math.abs(y - handle.y) <= this.handleSize) {
                 return handle.name;
             }
         }
         return null;
     }
     
     getCursorForHandle(handle) {
         const cursors = {
             'nw': 'nw-resize',
             'ne': 'ne-resize',
             'sw': 'sw-resize',
             'se': 'se-resize'
         };
         return cursors[handle] || 'default';
     }
     
     handleMouseDown(e) {
         const mousePos = this.getMousePos(e);
         this.syncBoxes();
         
         // Check for resize handles first
         for (let box of this.boxes) {
             const handle = this.getResizeHandle(mousePos.x, mousePos.y, box);
             if (handle) {
                 this.isResizing = true;
                 this.resizeHandle = handle;
                 this.selectedBox = box;
                 this.canvas.style.cursor = this.getCursorForHandle(handle);
                 return;
             }
         }
         
         // Check for box selection
         for (let box of this.boxes) {
             if (this.isPointInBox(mousePos.x, mousePos.y, box)) {
                 this.isDragging = true;
                 this.selectedBox = box;
                 this.dragOffset = {
                     x: mousePos.x - box.x,
                     y: mousePos.y - box.y
                 };
                 this.canvas.style.cursor = 'grabbing';
                 return;
             }
         }
     }
     
     handleMouseMove(e) {
         const mousePos = this.getMousePos(e);
         
         if (this.isResizing && this.resizeHandle && this.selectedBox) {
             this.resizeBox(mousePos.x, mousePos.y);
         } else if (this.isDragging && this.selectedBox) {
             this.selectedBox.x = mousePos.x - this.dragOffset.x;
             this.selectedBox.y = mousePos.y - this.dragOffset.y;
             this.updateDOMBox(this.selectedBox);
             this.draw();
         } else {
             // Update cursor based on hover
             this.syncBoxes();
             let handle = null;
             let hoveredBox = null;
             
             for (let box of this.boxes) {
                 handle = this.getResizeHandle(mousePos.x, mousePos.y, box);
                 if (handle) {
                     this.canvas.style.cursor = this.getCursorForHandle(handle);
                     return;
                 }
                 if (this.isPointInBox(mousePos.x, mousePos.y, box)) {
                     hoveredBox = box;
                 }
             }
             
             if (hoveredBox) {
                 this.canvas.style.cursor = 'grab';
             } else {
                 this.canvas.style.cursor = 'default';
             }
         }
     }
     
     handleMouseUp(e) {
         this.isDragging = false;
         this.isResizing = false;
         this.resizeHandle = null;
         this.selectedBox = null;
         this.canvas.style.cursor = 'default';
     }
     
     resizeBox(x, y) {
         if (!this.selectedBox) return;
         
         const minSize = 20;
         const box = this.selectedBox;
         
         switch (this.resizeHandle) {
             case 'nw':
                 const newWidth = box.width + (box.x - x);
                 const newHeight = box.height + (box.y - y);
                 if (newWidth >= minSize && newHeight >= minSize) {
                     box.x = x;
                     box.y = y;
                     box.width = newWidth;
                     box.height = newHeight;
                 }
                 break;
                 
             case 'ne':
                 const newWidthNE = x - box.x;
                 const newHeightNE = box.height + (box.y - y);
                 if (newWidthNE >= minSize && newHeightNE >= minSize) {
                     box.y = y;
                     box.width = newWidthNE;
                     box.height = newHeightNE;
                 }
                 break;
                 
             case 'sw':
                 const newWidthSW = box.width + (box.x - x);
                 const newHeightSW = y - box.y;
                 if (newWidthSW >= minSize && newHeightSW >= minSize) {
                     box.x = x;
                     box.width = newWidthSW;
                     box.height = newHeightSW;
                 }
                 break;
                 
             case 'se':
                 const newWidthSE = x - box.x;
                 const newHeightSE = y - box.y;
                 if (newWidthSE >= minSize && newHeightSE >= minSize) {
                     box.width = newWidthSE;
                     box.height = newHeightSE;
                 }
                 break;
         }
         
         this.updateDOMBox(box);
         this.draw();
     }
     
     updateDOMBox(canvasBox) {
         // Find the corresponding DOM box and update its position
         const domBox = sessionState.boxes.find(box => box.id === canvasBox.id);
         if (domBox && domBox.element) {
             domBox.element.style.left = canvasBox.x + 'px';
             domBox.element.style.top = canvasBox.y + 'px';
             domBox.element.style.width = canvasBox.width + 'px';
             domBox.element.style.height = canvasBox.height + 'px';
         }
     }
     
     draw() {
         if (!this.ctx) return;
         
         // Clear canvas
         this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
         
         // Save the current context state
         this.ctx.save();
         
         // Apply zoom transformation
         this.ctx.scale(this.zoomLevel, this.zoomLevel);
         
         // Draw boxes
         this.syncBoxes();
         for (let box of this.boxes) {
             this.drawBox(box);
         }
         
         // Draw resize handles
         this.drawResizeHandles();
         
         // Restore the context state
         this.ctx.restore();
     }
     
     drawBox(box) {
         // Draw box background
         this.ctx.fillStyle = box.backgroundColor;
         this.ctx.fillRect(box.x, box.y, box.width, box.height);
         
         // Draw box border
         this.ctx.strokeStyle = box.borderColor;
         this.ctx.lineWidth = 2 / this.zoomLevel;
         this.ctx.strokeRect(box.x, box.y, box.width, box.height);
         
         // Draw text
         if (box.type === 'text' && box.text) {
             this.ctx.fillStyle = box.color;
             this.ctx.font = `${box.fontSize}px Arial`;
             this.ctx.textAlign = 'center';
             this.ctx.textBaseline = 'middle';
             this.ctx.fillText(
                 box.text,
                 box.x + box.width / 2,
                 box.y + box.height / 2
             );
         }
     }
     
     drawResizeHandles() {
         this.ctx.fillStyle = '#007bff';
         this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
         this.ctx.lineWidth = 2 / this.zoomLevel;
         
         for (let box of this.boxes) {
             const handles = [
                 { x: box.x, y: box.y },
                 { x: box.x + box.width, y: box.y },
                 { x: box.x, y: box.y + box.height },
                 { x: box.x + box.width, y: box.y + box.height }
             ];
             
             handles.forEach(handle => {
                 this.ctx.fillRect(
                     handle.x - this.handleSize/2, 
                     handle.y - this.handleSize/2, 
                     this.handleSize, 
                     this.handleSize
                 );
                 this.ctx.strokeRect(
                     handle.x - this.handleSize/2, 
                     handle.y - this.handleSize/2, 
                     this.handleSize, 
                     this.handleSize
                 );
             });
         }
     }
     
     setZoom(zoomLevel) {
         this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, zoomLevel));
         this.draw();
     }
 }
 
 // Global instance
 let canvasInteractionSystem = null;
 
 // Function to toggle between DOM and Canvas interaction modes
 function toggleInteractionMode(useCanvas = true) {
     if (useCanvas) {
         // Hide DOM boxes and show canvas
         document.querySelectorAll('.draggable-text-box, .draggable-image-box').forEach(box => {
             box.style.display = 'none';
         });
         if (canvasInteractionSystem) {
             canvasInteractionSystem.canvas.style.display = 'block';
             canvasInteractionSystem.draw();
         }
     } else {
         // Show DOM boxes and hide canvas
         document.querySelectorAll('.draggable-text-box, .draggable-image-box').forEach(box => {
             box.style.display = 'block';
         });
         if (canvasInteractionSystem) {
             canvasInteractionSystem.canvas.style.display = 'none';
         }
     }
 }
 
 // Function to sync DOM boxes to canvas (for initial setup)
 function syncDOMToCanvas() {
     if (canvasInteractionSystem) {
         canvasInteractionSystem.draw();
     }
 }

