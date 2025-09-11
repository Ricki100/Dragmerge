// CSV Handlers - All CSV-related functionality
// This file contains functions for parsing, processing, and managing CSV data

// CSV data management
let currentRecord = 0;
let csvData = null;

// CSV File Parsing
function parseCSVFile(file) {
    console.log('parseCSVFile function called with file:', file);
    
    if (!file) {
        console.error('No file provided to parseCSVFile');
        return;
    }
    
    // Store file metadata for change detection
    sessionState.csvMetadata = {
        name: file.name,
        lastModified: file.lastModified,
        size: file.size
    };
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            console.log('CSV file read successfully, length:', csvText.length);
            
            // Parse CSV using PapaParse
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    console.log('CSV parsing completed:', results);
                    
                    if (results.errors.length > 0) {
                        console.warn('CSV parsing warnings:', results.errors);
                    }
                    
                    if (results.data.length === 0) {
                        alert('CSV file is empty or has no valid data rows.');
                        return;
                    }
                    
                    // Store CSV data
                    csvData = results.data;
                    sessionState.csv = results.data;
                    sessionState.csvRows = results.data;
                    
                    console.log('CSV data stored:', {
                        rows: results.data.length,
                        columns: Object.keys(results.data[0] || {}),
                        firstRow: results.data[0]
                    });
                    
                    // Update CSV column dropdown
                    updateCSVColumnDropdown();
                    
                    // Display CSV preview
                    displayCSVPreview(results.data);
                    
                    // Check for malformed URLs
                    const malformedUrls = findMalformedUrls(results.data);
                    if (malformedUrls.length > 0) {
                        showMalformedUrlWarning(malformedUrls);
                    }
                    
                    // Update download button state
                    updateDownloadButtonState();
                    
                    // Update records info
                    updateRecordsInfo();
                    
                    // Update page navigation
                    updatePageNavigation();
                    
                    // Update all boxes with CSV data
                    updateAllBoxesWithCSVData();
                    
                },
                error: function(error) {
                    console.error('CSV parsing error:', error);
                    alert('Error parsing CSV file: ' + error.message);
                }
            });
            
        } catch (error) {
            console.error('Error reading CSV file:', error);
            alert('Error reading CSV file: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        console.error('FileReader error');
        alert('Error reading CSV file');
    };
    
    reader.readAsText(file);
}

// CSV Preview and Display
function displayCSVPreview(data) {
    const previewContainer = document.getElementById('csvPreview');
    if (!previewContainer) return;
    
    if (!data || data.length === 0) {
        previewContainer.innerHTML = '<p>No CSV data to preview</p>';
        return;
    }
    
    const columns = Object.keys(data[0] || {});
    const previewRows = data.slice(0, 5); // Show first 5 rows
    
    let previewHTML = `
        <div class="csv-preview">
            <h4>CSV Preview (${data.length} records)</h4>
            <table class="csv-table">
                <thead>
                    <tr>
                        ${columns.map(col => `<th>${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${previewRows.map(row => `
                        <tr>
                            ${columns.map(col => `<td>${row[col] || ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${data.length > 5 ? `<p>... and ${data.length - 5} more rows</p>` : ''}
        </div>
    `;
    
    previewContainer.innerHTML = previewHTML;
}

// CSV URL Validation
function findMalformedUrls(data) {
    const malformedUrls = [];
    const urlColumns = [];
    
    // Find columns that might contain URLs
    if (data.length > 0) {
        const firstRow = data[0];
        Object.keys(firstRow).forEach(column => {
            const value = firstRow[column];
            if (typeof value === 'string' && (
                value.includes('http://') || 
                value.includes('https://') || 
                value.includes('www.') ||
                value.includes('.com') ||
                value.includes('.org') ||
                value.includes('.net')
            )) {
                urlColumns.push(column);
            }
        });
    }
    
    // Check each URL column for malformed URLs
    urlColumns.forEach(column => {
        data.forEach((row, index) => {
            const url = row[column];
            if (url && typeof url === 'string') {
                try {
                    new URL(url);
                } catch (e) {
                    malformedUrls.push({
                        row: index + 1,
                        column: column,
                        url: url,
                        error: e.message
                    });
                }
            }
        });
    });
    
    return malformedUrls;
}

function showMalformedUrlWarning(malformedUrls) {
    if (malformedUrls.length === 0) return;
    
    const warningHTML = `
        <div class="malformed-url-warning" style="
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
            color: #856404;
        ">
            <h4>⚠️ Malformed URLs Found</h4>
            <p>Found ${malformedUrls.length} malformed URLs in your CSV data:</p>
            <ul>
                ${malformedUrls.slice(0, 5).map(item => 
                    `<li>Row ${item.row}, Column "${item.column}": ${item.url}</li>`
                ).join('')}
                ${malformedUrls.length > 5 ? `<li>... and ${malformedUrls.length - 5} more</li>` : ''}
            </ul>
            <p><strong>Note:</strong> These URLs may not load properly in generated PDFs.</p>
        </div>
    `;
    
    // Insert warning after CSV preview
    const csvPreview = document.getElementById('csvPreview');
    if (csvPreview) {
        csvPreview.insertAdjacentHTML('afterend', warningHTML);
    }
}

// CSV Controls
function toggleCSVPreview() {
    // Toggle CSV preview visibility
    const preview = document.getElementById('csvPreview');
    if (preview) {
        preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
    }
}

// CSV Data Updates
async function updateAllBoxesWithCSVData() {
    if (!sessionState.csvRows || sessionState.csvRows.length === 0) {
        console.log('No CSV data available for box updates');
        return;
    }
    
    console.log('Updating all boxes with CSV data...');
    
    // Update all text boxes
    sessionState.boxes.forEach(box => {
        if (box.type === 'text' || box.boxType === 'text') {
            updateTextBoxWithCSVData(box, currentRecord);
        } else if (box.type === 'image' || box.boxType === 'image') {
            updateImageBoxWithCSVData(box, currentRecord);
        }
    });
    
    console.log('All boxes updated with CSV data');
}

function updateAllTextBoxesForSingleRecord(recordIndex) {
    if (!sessionState.csvRows || recordIndex >= sessionState.csvRows.length) {
        console.log('Invalid record index or no CSV data');
        return;
    }
    
    sessionState.boxes.forEach(box => {
        if (box.type === 'text' || box.boxType === 'text') {
            updateTextBoxForSingleRecord(box, recordIndex);
        }
    });
}

function updateTextBoxWithCSVData(box, recordIndex) {
    if (!sessionState.csvRows || recordIndex >= sessionState.csvRows.length) {
        console.log('No CSV data available for text box update');
        return;
    }
    
    const record = sessionState.csvRows[recordIndex];
    if (!record || !box.fieldKey) {
        return;
    }
    
    const csvText = record[box.fieldKey] || '';
    updateTextBoxContent(box, csvText);
}

function updateTextBoxForSingleRecord(box, recordIndex) {
    if (!sessionState.csvRows || recordIndex >= sessionState.csvRows.length) {
        return;
    }
    
    const record = sessionState.csvRows[recordIndex];
    if (!record || !box.fieldKey) {
        return;
    }
    
    const csvText = record[box.fieldKey] || '';
    updateTextBoxContent(box, csvText);
}

function updateImageBoxForSingleRecord(box, recordIndex) {
    if (!sessionState.csvRows || recordIndex >= sessionState.csvRows.length) {
        return;
    }
    
    const record = sessionState.csvRows[recordIndex];
    if (!record || !box.fieldKey) {
        return;
    }
    
    const imageUrl = record[box.fieldKey] || '';
    if (imageUrl) {
        loadImageFromUrl(imageUrl, box);
    }
}

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

function updateTextBoxWithMappedCSVData(box) {
    if (!sessionState.csvRows || sessionState.csvRows.length === 0) {
        return;
    }
    
    const recordIndex = currentRecord;
    if (recordIndex >= sessionState.csvRows.length) {
        return;
    }
    
    const record = sessionState.csvRows[recordIndex];
    if (!record || !box.fieldKey) {
        return;
    }
    
    const csvText = record[box.fieldKey] || '';
    updateTextBoxContent(box, csvText);
}

// CSV Content Updates
function updateTextBoxContent(box) {
    if (!sessionState.csvRows || sessionState.csvRows.length === 0) {
        return;
    }
    
    const recordIndex = currentRecord;
    if (recordIndex >= sessionState.csvRows.length) {
        return;
    }
    
    const record = sessionState.csvRows[recordIndex];
    if (!record || !box.fieldKey) {
        return;
    }
    
    const csvText = record[box.fieldKey] || '';
    updateTextBoxContentSafely(box.element, csvText);
}

function updateTextBoxContentSafely(element, text) {
    if (!element) return;
    
    try {
        // Safely update text content
        element.textContent = text;
        
        // Auto-resize if needed
        if (element.classList.contains('draggable-text-box')) {
            autoResizeTextBox({ element: element });
        }
        
    } catch (error) {
        console.error('Error updating text box content:', error);
    }
}

// CSV Column Management
function updateCSVColumnDropdown() {
    const dropdown = document.getElementById('boxColumnSelect');
    if (!dropdown || !sessionState.csvRows || sessionState.csvRows.length === 0) {
        return;
    }
    
    // Clear existing options
    dropdown.innerHTML = '<option value="">Select CSV column...</option>';
    
    // Add CSV columns
    const columns = Object.keys(sessionState.csvRows[0] || {});
    columns.forEach(column => {
        const option = document.createElement('option');
        option.value = column;
        option.textContent = column;
        dropdown.appendChild(option);
    });
    
    console.log('CSV column dropdown updated with', columns.length, 'columns');
}

// Field Selection Modal
function showFieldSelectionModal(csvColumns, boxCount, boxType) {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    modalContent.innerHTML = `
        <h3>Select CSV Fields for ${boxCount} ${boxType} Box${boxCount > 1 ? 'es' : ''}</h3>
        <div id="fieldMappings"></div>
        <div style="margin-top: 20px; text-align: right;">
            <button id="cancelFieldSelection" style="margin-right: 10px;">Cancel</button>
            <button id="confirmFieldSelection">Create Boxes</button>
        </div>
    `;
    
    // Create field mappings
    const fieldMappings = document.getElementById('fieldMappings');
    for (let i = 0; i < boxCount; i++) {
        const mappingDiv = document.createElement('div');
        mappingDiv.style.cssText = 'margin-bottom: 15px;';
        mappingDiv.innerHTML = `
            <label>Box ${i + 1}:</label>
            <select class="field-select" data-box-index="${i}">
                <option value="">None (Static)</option>
                ${csvColumns.map(col => `<option value="${col}">${col}</option>`).join('')}
            </select>
        `;
        fieldMappings.appendChild(mappingDiv);
    }
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Add event listeners
    document.getElementById('cancelFieldSelection').addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });
    
    document.getElementById('confirmFieldSelection').addEventListener('click', () => {
        const fieldSelections = [];
        const selects = modalContent.querySelectorAll('.field-select');
        selects.forEach(select => {
            fieldSelections.push(select.value);
        });
        
        // Create boxes with field mappings
        createBoxesWithFieldMappings(boxCount, boxType, fieldSelections);
        
        document.body.removeChild(modalOverlay);
    });
}

// Helper function to create boxes with field mappings
function createBoxesWithFieldMappings(boxCount, boxType, fieldMappings) {
    for (let i = 0; i < boxCount; i++) {
        const fieldKey = fieldMappings[i];
        
        if (boxType === 'text') {
            addTextWithField(fieldKey);
        } else if (boxType === 'image') {
            addImageWithField(fieldKey);
        }
    }
}

// Helper functions for adding boxes with specific fields
function addTextWithField(fieldKey) {
    // This would call the main addText function with field mapping
    // Implementation depends on the main addText function
    console.log('Adding text box with field:', fieldKey);
}

function addImageWithField(fieldKey) {
    // This would call the main addImagePlaceholder function with field mapping
    // Implementation depends on the main addImagePlaceholder function
    console.log('Adding image box with field:', fieldKey);
}
