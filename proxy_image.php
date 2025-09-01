<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Handle preflight OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit;
}

// Test endpoint to verify proxy is working
if (isset($_GET['test'])) {
    echo "Proxy is working!";
    exit;
}

// Debug endpoint to test regex matching
if (isset($_GET['debug'])) {
    $testUrl = $_GET['debug'];
    if (preg_match('/^file:\/\/([A-Z]:[\/\\\\](.*))/i', $testUrl, $matches)) {
        $drive = $matches[1];
        $path = $matches[2];
        $localPath = $drive . '\\' . str_replace('/', '\\', $path);
        echo "URL: $testUrl<br>";
        echo "Drive: $drive<br>";
        echo "Path: $path<br>";
        echo "Local Path: $localPath<br>";
        echo "File exists: " . (file_exists($localPath) ? 'Yes' : 'No') . "<br>";
    } else {
        echo "URL: $testUrl<br>";
        echo "No match found<br>";
    }
    exit;
}

// Log the request for debugging
error_log("Proxy request for URL: " . ($_GET['url'] ?? 'none'));

// Check if URL parameter exists
if (!isset($_GET['url'])) {
    http_response_code(400);
    exit('No URL provided');
}

$url = $_GET['url'];

// Handle local file paths (file:/// protocol)
if (preg_match('/^file:\/\/([A-Z]:[\/\\\\](.*))/i', $url, $matches)) {
    $drive = $matches[1];
    $path = $matches[2];
    
    // Convert to Windows path format
    $localPath = $drive . '\\' . str_replace('/', '\\', $path);
    
    error_log("Local file path detected: " . $localPath);
    error_log("Drive: " . $drive . ", Path: " . $path);
    
    // Security check: only allow access to specific directories
    $allowedDirs = [
        'C:\\Users\\26377\\Documents\\Currentwork\\R\\Raines\\links',
        'C:\\Users\\26377\\Documents\\Currentwork\\R\\Raines',
        'C:\\Users\\26377\\Documents\\Currentwork\\R'
    ];
    
    $isAllowed = false;
    foreach ($allowedDirs as $allowedDir) {
        if (stripos($localPath, $allowedDir) === 0) {
            $isAllowed = true;
            error_log("Access allowed for directory: " . $allowedDir);
            break;
        }
    }
    
    if (!$isAllowed) {
        error_log("Access denied to directory: " . $localPath);
        http_response_code(403);
        exit('Access denied to this directory');
    }
    
    if (!file_exists($localPath)) {
        error_log("File not found: " . $localPath);
        http_response_code(404);
        exit('File not found');
    }
    
    error_log("File found and access granted: " . $localPath);
    
    // Get file info
    $fileInfo = pathinfo($localPath);
    $extension = strtolower($fileInfo['extension']);
    
    error_log("File extension: " . $extension);
    
    // Set appropriate content type
    $contentTypes = [
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp'
    ];
    
    $contentType = $contentTypes[$extension] ?? 'application/octet-stream';
    
    error_log("Setting content type: " . $contentType);
    
    header('Content-Type: ' . $contentType);
    header('Access-Control-Allow-Origin: *');
    header('Cache-Control: public, max-age=3600');
    
    // Output the file
    error_log("Outputting file: " . $localPath);
    readfile($localPath);
    exit;
}

// Handle HTTP/HTTPS URLs
if (!preg_match('/^https?:\/\//', $url)) {
    http_response_code(400);
    exit('Invalid URL format');
}

// Set error handling
error_reporting(0);
ini_set('display_errors', 0);

try {
    // Use cURL for better Google Drive support
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Special handling for Google Drive URLs
    if (strpos($url, 'drive.google.com') !== false) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: image/*',
            'Accept-Language: en-US,en;q=0.9',
            'Cache-Control: no-cache'
        ]);
    }
    
    $imageContent = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    
    if (curl_errno($ch)) {
        throw new Exception('cURL error: ' . curl_error($ch));
    }
    
    curl_close($ch);
    
    // Check if request was successful
    if ($httpCode !== 200 || $imageContent === false) {
        throw new Exception('HTTP request failed with code: ' . $httpCode);
    }
    
    // Set content type
    if ($contentType) {
        header('Content-Type: ' . $contentType);
    } else {
        // Fallback based on file extension
        $extension = strtolower(pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));
        $fallbackTypes = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'bmp' => 'image/bmp',
            'svg' => 'image/svg+xml'
        ];
        $fallbackType = $fallbackTypes[$extension] ?? 'image/png';
        header('Content-Type: ' . $fallbackType);
    }
    
    // Set CORS and caching headers
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Cache-Control: public, max-age=3600');
    header('Content-Length: ' . strlen($imageContent));
    
    // Output the image
    echo $imageContent;
    
} catch (Exception $e) {
    http_response_code(500);
    exit('Error: ' . $e->getMessage());
}
