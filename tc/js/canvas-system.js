// Canvas System - All canvas, interaction, and box management functionality
// This file contains functions for canvas operations, drag & drop, box management, and interactions

// Canvas and Editor Management
let editorCanvas = null;
let canvasInteractionSystem = null;

// Box Management
let boxCounter = 0;
let currentBoxId = null;
let selectedBoxes = [];

// Snap-to-Grid System
let snapToGridEnabled = false;
let snapGuides = [];

// Initialize Editor Canvas
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
    editorCanvas = new fabric.Canvas(canvasElement, {
        selection: true,
        preserveObjectStacking: true,
        renderOnAddRemove: true,
        skipTargetFind: false,
        skipOffscreen: false
    });
    
    // Add event listeners
    editorCanvas.on('selection:created', onEditorObjectSelected);
    editorCanvas.on('selection:updated', onEditorObjectSelected);
    editorCanvas.on('selection:cleared', onEditorObjectDeselected);
    editorCanvas.on('object:modified', onEditorObjectModified);
    editorCanvas.on('object:moving', onEditorObjectMoving);
    editorCanvas.on('object:scaling', onEditorObjectScaling);
    
    console.log('Editor canvas initialized');
}

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

// Canvas Event Handlers
function onEditorObjectSelected(e) {
    const selectedObjects = e.selected || [e.target];
    if (selectedObjects.length > 0) {
        updateEditorSidebar();
    }
}

function onEditorObjectDeselected() {
    updateEditorSidebar();
}

function onEditorObjectModified(e) {
    updateEditorObjectMeta();
    updateEditorObjectPosition();
    updateEditorObjectSize();
}

function onEditorObjectMoving(e) {
    // Handle object moving
    if (snapToGridEnabled) {
        const obj = e.target;
        const snapped = snapToGrid(obj.left, obj.top, obj);
        if (snapped.x !== obj.left || snapped.y !== obj.top) {
            obj.set({ left: snapped.x, top: snapped.y });
            editorCanvas.renderAll();
        }
    }
}

function onEditorObjectScaling(e) {
    // Handle object scaling
    updateEditorObjectSize();
}

// Editor Sidebar Management
function updateEditorSidebar() {
    const sidebar = document.getElementById('editorSidebar');
    if (!sidebar) return;
    
    const activeObjects = editorCanvas.getActiveObjects();
    if (activeObjects.length === 1) {
        sidebar.classList.add('active');
        updateEditorObjectMeta();
        updateEditorObjectPosition();
        updateEditorObjectSize();
    } else {
        sidebar.classList.remove('active');
    }
}

function updateEditorObjectMeta() {
    const activeObjects = editorCanvas.getActiveObjects();
    if (activeObjects.length !== 1) return;
    
    const obj = activeObjects[0];
    
    // Update bind field
    const bindField = document.getElementById('bindField');
    if (bindField) {
        bindField.value = obj.fieldKey || '';
    }
    
    // Update static content
    const staticContent = document.getElementById('staticContent');
    if (staticContent) {
        staticContent.value = obj.text || '';
    }
}

function updateEditorObjectPosition() {
    const activeObjects = editorCanvas.getActiveObjects();
    if (activeObjects.length !== 1) return;
    
    const obj = activeObjects[0];
    
    // Update position inputs
    const posX = document.getElementById('posX');
    const posY = document.getElementById('posY');
    
    if (posX) posX.value = Math.round(obj.left);
    if (posY) posY.value = Math.round(obj.top);
}

function updateEditorObjectSize() {
    const activeObjects = editorCanvas.getActiveObjects();
    if (activeObjects.length !== 1) return;
    
    const obj = activeObjects[0];
    
    // Update size inputs
    const width = document.getElementById('width');
    const height = document.getElementById('height');
    
    if (width) width.value = Math.round(obj.width * obj.scaleX);
    if (height) height.value = Math.round(obj.height * obj.scaleY);
}

function updateEditorButtonStates(enabled) {
    const editorButtons = document.querySelectorAll('#editorSidebar button, #editorSidebar input, #editorSidebar select, #editorSidebar textarea');
    editorButtons.forEach(button => {
        button.disabled = !enabled;
    });
}

// Canvas Operations
function clearCanvas() {
    if (editorCanvas) {
        editorCanvas.clear();
        editorCanvas.renderAll();
    }
}

// Box Management Functions
async function addText() {
    const boxCount = parseInt(document.getElementById('boxCountSelect')?.value || '1');
    const boxType = 'text';
    
    // Check if we have CSV data for field selection
    if (sessionState.csvRows && sessionState.csvRows.length > 0) {
        const csvColumns = Object.keys(sessionState.csvRows[0] || {});
        showFieldSelectionModal(csvColumns, boxCount, boxType);
        return;
    }
    
    // Create boxes without field mapping
    for (let i = 0; i < boxCount; i++) {
        await createTextBox();
    }
}

async function addImagePlaceholder() {
    const boxCount = parseInt(document.getElementById('boxCountSelect')?.value || '1');
    const boxType = 'image';
    
    // Check if we have CSV data for field selection
    if (sessionState.csvRows && sessionState.csvRows.length > 0) {
        const csvColumns = Object.keys(sessionState.csvRows[0] || {});
        showFieldSelectionModal(csvColumns, boxCount, boxType);
        return;
    }
    
    // Create boxes without field mapping
    for (let i = 0; i < boxCount; i++) {
        await createImageBox();
    }
}

async function createTextBox() {
    const boxId = `textbox-${++boxCounter}`;
    const position = calculateOptimalBoxPosition('text');
    
    // Create text box element
    const textBox = document.createElement('div');
    textBox.id = boxId;
    textBox.className = 'draggable-text-box';
    textBox.style.cssText = `
        position: absolute;
        left: ${position.x}px;
        top: ${position.y}px;
        width: 200px;
        height: 50px;
        background: transparent;
        border: 1px solid #28a745;
        padding: 5px;
        cursor: move;
        font-family: Arial, sans-serif;
        font-size: 16px;
        color: #000;
        text-align: center;
        user-select: none;
        z-index: 20;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        overflow: visible;
        word-wrap: break-word;
        white-space: normal;
        line-height: 1.2;
    `;
    textBox.textContent = 'Text Box';
    textBox.contentEditable = true;
    
    // Add to PDF content
    const pdfContent = document.getElementById('pdfContent');
    if (pdfContent) {
        pdfContent.appendChild(textBox);
    }
    
    // Create box data
    const boxData = {
        id: boxId,
        type: 'text',
        element: textBox,
        x: position.x,
        y: position.y,
        width: 200,
        height: 50,
        originalX: position.x,
        originalY: position.y,
        originalWidth: 200,
        originalHeight: 50,
        fieldKey: '',
        fontFamily: 'Arial',
        fontSize: 16,
        textColor: '#000000',
        textAlign: 'center',
        isBold: false,
        isItalic: false,
        isUnderline: false
    };
    
    // Add to session state
    sessionState.boxes.push(boxData);
    
    // Make draggable
    makeDraggable(textBox);
    
    // Add event listeners
    addBoxEditorEventListeners(boxData);
    
    console.log('Text box created:', boxId);
    return boxData;
}

async function createImageBox() {
    const boxId = `imagebox-${++boxCounter}`;
    const position = calculateOptimalBoxPosition('image');
    
    // Create image box element
    const imageBox = document.createElement('div');
    imageBox.id = boxId;
    imageBox.className = 'draggable-image-box';
    imageBox.style.cssText = `
        position: absolute;
        left: ${position.x}px;
        top: ${position.y}px;
        width: 200px;
        height: 150px;
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
    imageBox.innerHTML = '<div style="color: #007bff; font-size: 12px;">Image Box</div>';
    
    // Add to PDF content
    const pdfContent = document.getElementById('pdfContent');
    if (pdfContent) {
        pdfContent.appendChild(imageBox);
    }
    
    // Create box data
    const boxData = {
        id: boxId,
        type: 'image',
        element: imageBox,
        x: position.x,
        y: position.y,
        width: 200,
        height: 150,
        originalX: position.x,
        originalY: position.y,
        originalWidth: 200,
        originalHeight: 150,
        fieldKey: '',
        imageUrl: ''
    };
    
    // Add to session state
    sessionState.boxes.push(boxData);
    
    // Make draggable
    makeDraggable(imageBox);
    
    // Add event listeners
    addBoxEditorEventListeners(boxData);
    
    console.log('Image box created:', boxId);
    return boxData;
}

// Box Position Calculation
function calculateOptimalBoxPosition(boxType) {
    const existingBoxes = sessionState.boxes || [];
    const containerWidth = 800; // Approximate container width
    const containerHeight = 600; // Approximate container height
    
    const boxWidth = boxType === 'text' ? 200 : 200;
    const boxHeight = boxType === 'text' ? 50 : 150;
    
    // Try to find an empty position
    for (let y = 50; y < containerHeight - boxHeight; y += 60) {
        for (let x = 50; x < containerWidth - boxWidth; x += 220) {
            if (isPositionAvailable(x, y, boxWidth, boxHeight, existingBoxes)) {
                return { x, y };
            }
        }
    }
    
    // If no empty position found, use default
    return { x: 50, y: 50 };
}

function isPositionAvailable(x, y, width, height, existingBoxes) {
    const margin = 10; // Minimum margin between boxes
    
    for (const box of existingBoxes) {
        const boxLeft = box.x;
        const boxTop = box.y;
        const boxRight = boxLeft + box.width;
        const boxBottom = boxTop + box.height;
        
        const newLeft = x;
        const newTop = y;
        const newRight = x + width;
        const newBottom = y + height;
        
        // Check for overlap with margin
        if (!(newRight + margin < boxLeft || 
              newLeft - margin > boxRight || 
              newBottom + margin < boxTop || 
              newTop - margin > boxBottom)) {
            return false;
        }
    }
    
    return true;
}

// Drag and Drop System
function makeDraggable(element) {
    if (!element) return;
    
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    function dragStart(e) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(element.style.left) || 0;
        startTop = parseInt(element.style.top) || 0;
        
        element.classList.add('dragging');
        element.style.zIndex = '1000';
        
        // Show box identifier
        const box = sessionState.boxes.find(b => b.element === element);
        if (box) {
            showBoxIdentifier(box, true);
        }
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;
        
        // Apply snap to grid if enabled
        if (snapToGridEnabled) {
            const snapped = snapToGrid(newLeft, newTop, element);
            newLeft = snapped.x;
            newTop = snapped.y;
        }
        
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
        
        // Update box data
        const box = sessionState.boxes.find(b => b.element === element);
        if (box) {
            box.x = newLeft;
            box.y = newTop;
        }
    }
    
    function dragEnd() {
        isDragging = false;
        element.classList.remove('dragging');
        element.style.zIndex = '';
        
        // Hide box identifier
        const box = sessionState.boxes.find(b => b.element === element);
        if (box) {
            showBoxIdentifier(box, false);
        }
        
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', dragEnd);
    }
    
    element.addEventListener('mousedown', dragStart);
}

// Transform Controls
function showTransformControls(element) {
    if (!element) return;
    
    // Add resize handles
    addResizeHandles(element);
    
    // Show selection border
    element.classList.add('selected');
    element.style.border = '2px solid #28a745';
    element.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.3)';
}

function hideTransformControls(element) {
    if (!element) return;
    
    // Remove resize handles
    const handles = element.querySelectorAll('.transform-control');
    handles.forEach(handle => handle.remove());
    
    // Hide selection border
    element.classList.remove('selected');
    element.style.border = '';
    element.style.boxShadow = '';
}

function showAllTransformControls() {
    sessionState.boxes.forEach(box => {
        if (box.element) {
            showTransformControls(box.element);
        }
    });
}

function hideAllTransformControls() {
    sessionState.boxes.forEach(box => {
        if (box.element) {
            hideTransformControls(box.element);
        }
    });
}

function ensureTransformControlsVisible() {
    // Ensure transform controls are visible for all boxes
    showAllTransformControls();
}

// Resize Handles
function addResizeHandles(element) {
    // Remove existing handles
    const existingHandles = element.querySelectorAll('.transform-control');
    existingHandles.forEach(handle => handle.remove());
    
    const handleSize = 8;
    const positions = [
        { name: 'nw', x: -handleSize/2, y: -handleSize/2, cursor: 'nw-resize' },
        { name: 'ne', x: '100%', y: -handleSize/2, cursor: 'ne-resize' },
        { name: 'sw', x: -handleSize/2, y: '100%', cursor: 'sw-resize' },
        { name: 'se', x: '100%', y: '100%', cursor: 'se-resize' }
    ];
    
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'transform-control';
        handle.style.cssText = `
            position: absolute;
            width: ${handleSize}px;
            height: ${handleSize}px;
            background: #007bff;
            border: 1px solid rgba(255, 255, 255, 0.9);
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
            cursor: ${pos.cursor};
            z-index: 99999;
            left: ${pos.x}px;
            top: ${pos.y}px;
            transform: translate(-50%, -50%);
        `;
        
        element.appendChild(handle);
        
        // Add resize functionality
        enableDragResize(handle, pos.name);
    });
}

function enableDragResize(handle, direction) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    
    function resizeStart(e) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const element = handle.parentElement;
        startWidth = parseInt(element.style.width) || 200;
        startHeight = parseInt(element.style.height) || 50;
        startLeft = parseInt(element.style.left) || 0;
        startTop = parseInt(element.style.top) || 0;
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', resizeEnd);
    }
    
    function resize(e) {
        if (!isResizing) return;
        
        e.preventDefault();
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const element = handle.parentElement;
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        switch (direction) {
            case 'se':
                newWidth = Math.max(20, startWidth + deltaX);
                newHeight = Math.max(20, startHeight + deltaY);
                break;
            case 'sw':
                newWidth = Math.max(20, startWidth - deltaX);
                newHeight = Math.max(20, startHeight + deltaY);
                newLeft = startLeft + (startWidth - newWidth);
                break;
            case 'ne':
                newWidth = Math.max(20, startWidth + deltaX);
                newHeight = Math.max(20, startHeight - deltaY);
                newTop = startTop + (startHeight - newHeight);
                break;
            case 'nw':
                newWidth = Math.max(20, startWidth - deltaX);
                newHeight = Math.max(20, startHeight - deltaY);
                newLeft = startLeft + (startWidth - newWidth);
                newTop = startTop + (startHeight - newHeight);
                break;
        }
        
        element.style.width = newWidth + 'px';
        element.style.height = newHeight + 'px';
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
        
        // Update box data
        const box = sessionState.boxes.find(b => b.element === element);
        if (box) {
            box.width = newWidth;
            box.height = newHeight;
            box.x = newLeft;
            box.y = newTop;
        }
    }
    
    function resizeEnd() {
        isResizing = false;
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', resizeEnd);
    }
    
    handle.addEventListener('mousedown', resizeStart);
}

// Snap to Grid System
function snapToGrid(x, y, element) {
    if (!snapToGridEnabled) return { x, y };
    
    const gridSize = 20;
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;
    
    // Show snap guides if position changed
    if (snappedX !== x || snappedY !== y) {
        showSnapGuide('vertical', snappedX);
        showSnapGuide('horizontal', snappedY);
    }
    
    return { x: snappedX, y: snappedY };
}

function showSnapGuide(type, position) {
    // Remove existing guides
    clearSnapGuides();
    
    const guide = document.createElement('div');
    guide.className = `snap-guide ${type}`;
    guide.style.cssText = `
        position: absolute;
        background: #007bff;
        opacity: 0.6;
        z-index: 1000;
        pointer-events: none;
        transition: opacity 0.1s ease;
    `;
    
    if (type === 'vertical') {
        guide.style.left = position + 'px';
        guide.style.top = '0';
        guide.style.width = '1px';
        guide.style.height = '100%';
    } else {
        guide.style.left = '0';
        guide.style.top = position + 'px';
        guide.style.width = '100%';
        guide.style.height = '1px';
    }
    
    const pdfContent = document.getElementById('pdfContent');
    if (pdfContent) {
        pdfContent.appendChild(guide);
        snapGuides.push(guide);
        
        // Remove guide after a short delay
        setTimeout(() => {
            if (guide.parentElement) {
                guide.parentElement.removeChild(guide);
            }
            const index = snapGuides.indexOf(guide);
            if (index > -1) {
                snapGuides.splice(index, 1);
            }
        }, 200);
    }
}

function clearSnapGuides() {
    snapGuides.forEach(guide => {
        if (guide.parentElement) {
            guide.parentElement.removeChild(guide);
        }
    });
    snapGuides = [];
}

// Box Selection and Highlighting
function showBoxIdentifier(box, isDragging) {
    // Show identifier popup for the box
    const identifier = document.createElement('div');
    identifier.className = 'box-identifier';
    identifier.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        animation: identifierPop 0.2s ease-out;
    `;
    identifier.textContent = `Box ${box.id}`;
    
    const rect = box.element.getBoundingClientRect();
    const pdfContent = document.getElementById('pdfContent');
    const pdfRect = pdfContent.getBoundingClientRect();
    
    identifier.style.left = (rect.left - pdfRect.left + rect.width / 2) + 'px';
    identifier.style.top = (rect.top - pdfRect.top - 30) + 'px';
    identifier.style.transform = 'translateX(-50%)';
    
    pdfContent.appendChild(identifier);
    
    // Remove identifier after delay
    setTimeout(() => {
        if (identifier.parentElement) {
            identifier.parentElement.removeChild(identifier);
        }
    }, 1000);
}

function clearAllHighlighting() {
    // Clear all box highlighting
    sessionState.boxes.forEach(box => {
        if (box.element) {
            box.element.classList.remove('selected', 'highlighted');
            box.element.style.border = '';
            box.element.style.boxShadow = '';
        }
    });
    
    // Clear multiple selection
    clearMultipleSelection();
}

function addToMultipleSelection(box) {
    if (!selectedBoxes.includes(box)) {
        selectedBoxes.push(box);
        box.element.classList.add('highlighted');
        box.element.style.border = '2px solid #ffc107';
        box.element.style.boxShadow = '0 0 10px rgba(255, 193, 7, 0.5)';
    }
}

function removeFromMultipleSelection(box) {
    const index = selectedBoxes.indexOf(box);
    if (index > -1) {
        selectedBoxes.splice(index, 1);
        box.element.classList.remove('highlighted');
        box.element.style.border = '';
        box.element.style.boxShadow = '';
    }
}

function clearMultipleSelection() {
    selectedBoxes.forEach(box => {
        if (box.element) {
            box.element.classList.remove('highlighted');
            box.element.style.border = '';
            box.element.style.boxShadow = '';
        }
    });
    selectedBoxes = [];
}

// Box Operations
function deleteSelectedBox() {
    if (!sessionState.selectedBox) {
        console.log('No box selected for deletion');
        return;
    }
    
    const box = sessionState.selectedBox;
    const boxElement = box.element;
    
    if (boxElement && boxElement.parentElement) {
        boxElement.parentElement.removeChild(boxElement);
    }
    
    // Remove from session state
    const index = sessionState.boxes.indexOf(box);
    if (index > -1) {
        sessionState.boxes.splice(index, 1);
    }
    
    // Clear selection
    sessionState.selectedBox = null;
    
    // Update download button state
    updateDownloadButtonState();
    
    console.log('Box deleted:', box.id);
}

function duplicateSelectedBox() {
    if (!sessionState.selectedBox) {
        console.log('No box selected for duplication');
        return;
    }
    
    const originalBox = sessionState.selectedBox;
    const newBox = {
        ...originalBox,
        id: `${originalBox.type}box-${++boxCounter}`,
        x: originalBox.x + 20,
        y: originalBox.y + 20
    };
    
    // Create new element
    const newElement = originalBox.element.cloneNode(true);
    newElement.id = newBox.id;
    newElement.style.left = newBox.x + 'px';
    newElement.style.top = newBox.y + 'px';
    
    // Add to DOM
    const pdfContent = document.getElementById('pdfContent');
    if (pdfContent) {
        pdfContent.appendChild(newElement);
    }
    
    // Update box data
    newBox.element = newElement;
    sessionState.boxes.push(newBox);
    
    // Make draggable
    makeDraggable(newElement);
    
    // Add event listeners
    addBoxEditorEventListeners(newBox);
    
    console.log('Box duplicated:', newBox.id);
}

function clearAllBoxes() {
    // Remove all box elements from DOM
    sessionState.boxes.forEach(box => {
        if (box.element && box.element.parentElement) {
            box.element.parentElement.removeChild(box.element);
        }
    });
    
    // Clear session state
    sessionState.boxes = [];
    sessionState.selectedBox = null;
    selectedBoxes = [];
    
    // Update download button state
    updateDownloadButtonState();
    
    console.log('All boxes cleared');
}

// Box Editor Event Listeners
function addBoxEditorEventListeners(box) {
    if (!box || !box.element) return;
    
    // Click to select
    box.element.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Remove selected class from all boxes
        sessionState.boxes.forEach(b => {
            if (b.element) b.element.classList.remove('selected');
        });
        
        // Add selected class to this box
        box.element.classList.add('selected');
        sessionState.selectedBox = box;
        
        // Show transform controls
        showTransformControls(box.element);
        
        // Update box editor
        updateBoxEditor(box);
    });
    
    // Double-click to edit text
    if (box.type === 'text') {
        box.element.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            box.element.focus();
        });
    }
}

// Box Editor Management
function updateBoxEditor(box) {
    if (!box) return;
    
    // Update editor sidebar values
    const bindField = document.getElementById('bindField');
    const staticContent = document.getElementById('staticContent');
    const posX = document.getElementById('posX');
    const posY = document.getElementById('posY');
    const width = document.getElementById('width');
    const height = document.getElementById('height');
    
    if (bindField) bindField.value = box.fieldKey || '';
    if (staticContent) staticContent.value = box.element.textContent || '';
    if (posX) posX.value = box.x;
    if (posY) posY.value = box.y;
    if (width) width.value = box.width;
    if (height) height.value = box.height;
}

// Canvas Interaction System
class CanvasInteractionSystem {
    constructor() {
        this.canvas = document.getElementById('interactionCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isActive = false;
        
        this.setupCanvas();
    }
    
    setupCanvas() {
        if (!this.canvas) return;
        
        // Set canvas size to match PDF viewer
        this.resizeCanvas();
        
        // Add event listeners
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        if (!this.canvas) return;
        
        const pdfViewer = document.getElementById('pdfViewer');
        if (pdfViewer) {
            const rect = pdfViewer.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
        }
    }
    
    draw() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw interaction elements
        this.drawBoxes();
    }
    
    drawBoxes() {
        sessionState.boxes.forEach(box => {
            if (box.element) {
                const rect = box.element.getBoundingClientRect();
                const pdfRect = this.canvas.getBoundingClientRect();
                
                this.ctx.strokeStyle = box.type === 'text' ? '#28a745' : '#007bff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(
                    rect.left - pdfRect.left,
                    rect.top - pdfRect.top,
                    rect.width,
                    rect.height
                );
            }
        });
    }
}

// Sync DOM to Canvas
function syncDOMToCanvas() {
    if (canvasInteractionSystem) {
        canvasInteractionSystem.draw();
    }
}
