<?php
// CSV URL Converter - Convert local file paths to web URLs

// Configuration
$inputCsv = 'input.csv'; // Your original CSV file
$outputCsv = 'output_web_urls.csv'; // New CSV with web URLs
$webBaseUrl = 'http://localhost:8000/uploads/images/'; // Base URL for your images

echo "CSV URL Converter\n";
echo "==================\n\n";

// Check if input file exists
if (!file_exists($inputCsv)) {
    echo "❌ Input CSV file '$inputCsv' not found!\n";
    echo "Please place your CSV file in this directory and update the \$inputCsv variable.\n";
    exit;
}

// Read the CSV file
$csvData = array_map('str_getcsv', file($inputCsv));
if (empty($csvData)) {
    echo "❌ CSV file is empty or couldn't be read!\n";
    exit;
}

// Get headers
$headers = array_shift($csvData);
echo "📋 CSV Headers: " . implode(', ', $headers) . "\n\n";

// Find image column (look for common image-related column names)
$imageColumnIndex = null;
$imageColumnName = null;

$imageKeywords = ['image', 'img', 'photo', 'picture', 'url', 'link', 'file'];
foreach ($headers as $index => $header) {
    $headerLower = strtolower($header);
    foreach ($imageKeywords as $keyword) {
        if (strpos($headerLower, $keyword) !== false) {
            $imageColumnIndex = $index;
            $imageColumnName = $header;
            break 2;
        }
    }
}

if ($imageColumnIndex === null) {
    echo "❌ No image column found! Looking for columns with: " . implode(', ', $imageKeywords) . "\n";
    echo "Available columns: " . implode(', ', $headers) . "\n";
    exit;
}

echo "✅ Found image column: '$imageColumnName' (index: $imageColumnIndex)\n\n";

// Process each row
$convertedRows = 0;
$skippedRows = 0;

foreach ($csvData as $rowIndex => $row) {
    if (empty($row[$imageColumnIndex])) {
        continue; // Skip empty image URLs
    }
    
    $originalUrl = $row[$imageColumnIndex];
    
    // Check if it's a local file path
    if (preg_match('/^file:\/\/([A-Z]:[\/\\](.*))/i', $originalUrl, $matches)) {
        $drive = $matches[1];
        $path = $matches[2];
        
        // Extract filename from path
        $filename = basename($path);
        
        // Create web URL
        $webUrl = $webBaseUrl . $filename;
        
        // Update the row
        $row[$imageColumnIndex] = $webUrl;
        
        echo "🔄 Row " . ($rowIndex + 1) . ": $originalUrl → $webUrl\n";
        $convertedRows++;
        
        // Verify image exists in uploads folder
        $imagePath = "uploads/images/$filename";
        if (file_exists($imagePath)) {
            echo "   ✅ Image found: $imagePath\n";
        } else {
            echo "   ⚠️  Warning: Image not found: $imagePath\n";
        }
    } else {
        echo "⏭️  Row " . ($rowIndex + 1) . ": Skipped (not a local file path): $originalUrl\n";
        $skippedRows++;
    }
    
    // Add the processed row to output
    $csvData[$rowIndex] = $row;
}

echo "\n📊 Conversion Summary:\n";
echo "=====================\n";
echo "✅ Converted: $convertedRows rows\n";
echo "⏭️  Skipped: $skippedRows rows\n";
echo "📁 Total processed: " . count($csvData) . " rows\n\n";

// Write the converted CSV
$outputFile = fopen($outputCsv, 'w');

// Write headers
fputcsv($outputFile, $headers);

// Write data rows
foreach ($csvData as $row) {
    fputcsv($outputFile, $row);
}

fclose($outputFile);

echo "💾 Output saved to: $outputCsv\n\n";

echo "🎯 Next Steps:\n";
echo "1. Use the new CSV file ($outputCsv) in your application\n";
echo "2. Make sure your web server is running on port 8000\n";
echo "3. Your images should now load from web URLs!\n\n";

echo "🔗 Example converted URLs:\n";
foreach (glob("uploads/images/*.png") as $imageFile) {
    $filename = basename($imageFile);
    echo "   $filename → $webBaseUrl$filename\n";
}
?>
