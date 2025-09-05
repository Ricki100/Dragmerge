<?php
// Live server optimized proxy for image loading
// Disable error reporting for production
error_reporting(0);
ini_set('display_errors', 0);

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

// Check if URL parameter exists
if (!isset($_GET['url'])) {
    http_response_code(400);
    exit('No URL provided');
}

$url = $_GET['url'];

// Validate URL format - must be HTTP/HTTPS
if (!preg_match('/^https?:\/\//', $url)) {
    http_response_code(400);
    exit('Invalid URL format');
}

// Additional validation for common image extensions or known image services
$imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
$hasImageExtension = false;
foreach ($imageExtensions as $ext) {
    if (stripos($url, '.' . $ext) !== false) {
        $hasImageExtension = true;
        break;
    }
}

// Allow URLs without extensions for Google Drive and other services
$allowedDomains = ['drive.google.com', 'docs.google.com', 'dropbox.com', 'imgur.com', 'flickr.com', 'via.placeholder.com'];
$isAllowedDomain = false;
foreach ($allowedDomains as $domain) {
    if (stripos($url, $domain) !== false) {
        $isAllowedDomain = true;
        break;
    }
}

// If no image extension and not an allowed domain, reject
if (!$hasImageExtension && !$isAllowedDomain) {
    http_response_code(400);
    exit('URL does not appear to be an image');
}

try {
    // Initialize cURL with enhanced settings for live server compatibility
    $ch = curl_init();
    
    // Basic cURL options
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    
    // Enhanced user agent and headers
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: image/*,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.9',
        'Accept-Encoding: gzip, deflate',
        'Cache-Control: no-cache',
        'Pragma: no-cache'
    ]);
    
    // Special handling for Google Drive URLs
    if (strpos($url, 'drive.google.com') !== false) {
        // Convert Google Drive sharing URL to direct download URL
        if (preg_match('/\/d\/([a-zA-Z0-9-_]+)/', $url, $matches)) {
            $fileId = $matches[1];
            $url = "https://drive.google.com/uc?export=download&id=" . $fileId;
            curl_setopt($ch, CURLOPT_URL, $url);
        }
        
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: image/*',
            'Accept-Language: en-US,en;q=0.9',
            'Cache-Control: no-cache'
        ]);
    }
    
    // Execute the request
    $imageContent = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    // Check for cURL errors
    if ($error) {
        throw new Exception('cURL error: ' . $error);
    }
    
    // Check HTTP response code
    if ($httpCode !== 200) {
        throw new Exception('HTTP request failed with code: ' . $httpCode);
    }
    
    // Validate that we got image content
    if ($imageContent === false || empty($imageContent)) {
        throw new Exception('No image content received');
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
    
    // Return a 1x1 transparent PNG on error instead of text
    $transparentPng = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    header('Content-Type: image/png');
    header('Content-Length: ' . strlen($transparentPng));
    echo $transparentPng;
}
