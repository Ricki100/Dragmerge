<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Test endpoint to verify proxy is working
if (isset($_GET['test'])) {
    echo "Proxy is working!";
    exit;
}

// Debug endpoint to test regex matching
if (isset($_GET['debug'])) {
    $testUrl = $_GET['debug'];
    if (strpos($testUrl, 'local://') === 0) {
        $path = substr($testUrl, 8); // Remove 'local://'
        
        if (preg_match('/^([A-Z]:\/)(.*)/i', $path, $matches)) {
            $drive = $matches[1];
            $path = $matches[2];
            $localPath = rtrim($drive, '/') . '\\' . str_replace('/', '\\', $path);
            echo "URL: $testUrl<br>";
            echo "Drive: $drive<br>";
            echo "Path: $path<br>";
            echo "Local Path: $localPath<br>";
            echo "File exists: " . (file_exists($localPath) ? 'Yes' : 'No') . "<br>";
        } else {
            echo "URL: $testUrl<br>";
            echo "Path pattern failed<br>";
        }
    } else {
        echo "URL: $testUrl<br>";
        echo "Not a file:/// URL<br>";
    }
    exit;
}

// Function to clean and fix malformed URLs
function cleanImageUrl($url) {
    if (empty($url)) return null;
    
    // Trim whitespace
    $url = trim($url);
    
    // Remove newlines and extra spaces
    $url = preg_replace('/[\r\n\s]+/', ' ', $url);
    
    // Handle URLs with spaces in filenames - encode spaces properly
    if (strpos($url, ' ') !== false) {
        // Split URL into parts
        $parts = parse_url($url);
        if ($parts && isset($parts['path'])) {
            // Encode the path properly, especially spaces in filenames
            $pathParts = explode('/', $parts['path']);
            $encodedPathParts = array_map('urlencode', $pathParts);
            $parts['path'] = implode('/', $encodedPathParts);
            
            // Rebuild URL
            $scheme = isset($parts['scheme']) ? $parts['scheme'] . '://' : '';
            $host = isset($parts['host']) ? $parts['host'] : '';
            $port = isset($parts['port']) ? ':' . $parts['port'] : '';
            $path = $parts['path'];
            $query = isset($parts['query']) ? '?' . $parts['query'] : '';
            $fragment = isset($parts['fragment']) ? '#' . $parts['fragment'] : '';
            
            $url = $scheme . $host . $port . $path . $query . $fragment;
        }
    }
    
    // Handle concatenated URLs (common issue with CSV data)
    if (preg_match('/https?:\/\/[^\s]+\.\.\.[^\s]+/', $url)) {
        // Extract the first complete URL
        if (preg_match('/https?:\/\/[^\s]+/', $url, $matches)) {
            $url = $matches[0];
        }
    }
    
    // Ensure URL is properly formatted
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        // Try to fix common issues
        if (strpos($url, 'http') !== 0) {
            $url = 'https://' . $url;
        }
    }
    
    return $url;
}

// Log the request for debugging
error_log("Proxy request for URL: " . ($_GET['url'] ?? 'none'));

if (!isset($_GET['url'])) {
    http_response_code(400);
    exit('No URL provided');
}

$url = $_GET['url'];

// Clean the URL first
$cleanedUrl = cleanImageUrl($url);
if (!$cleanedUrl) {
    http_response_code(400);
    exit('Invalid URL format');
}

// Log the cleaned URL
error_log("Cleaned URL: " . $cleanedUrl);

// Handle local file paths (local:// protocol)
if (strpos($cleanedUrl, 'local://') === 0) {
    // Remove 'local://' prefix and extract the path
    $path = substr($cleanedUrl, 8); // Remove 'local://'
    
    // Match the drive letter and remaining path
    if (preg_match('/^([A-Z]:\/)(.*)/i', $path, $matches)) {
        $drive = $matches[1];
        $path = $matches[2];
        
        // Convert to Windows path format
        $localPath = rtrim($drive, '/') . '\\' . str_replace('/', '\\', $path);
        
        error_log("Local file path detected: " . $localPath);
        error_log("Drive: " . $drive . ", Path: " . $path);
        
        // Security check: only allow access to specific directories
        $allowedDirs = [
            'C:\\Users\\26377\\Documents\\Currentwork\\R\\Raines\\links',
            'C:\\Users\\26377\\Documents\\Currentwork\\R\\Raines',
            'C:\\Users\\26377\\Documents\\Currentwork\\R'
        ];
        
        error_log("Checking security for path: " . $localPath);
        error_log("Allowed directories:");
        foreach ($allowedDirs as $allowedDir) {
            error_log("  - " . $allowedDir);
        }
        
        $isAllowed = false;
        foreach ($allowedDirs as $allowedDir) {
            error_log("Checking if '" . $localPath . "' starts with '" . $allowedDir . "'");
            if (stripos($localPath, $allowedDir) === 0) {
                $isAllowed = true;
                error_log("Access allowed for directory: " . $allowedDir);
                break;
            } else {
                error_log("  - stripos result: " . stripos($localPath, $allowedDir));
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
}

// Handle HTTP/HTTPS URLs
if (!preg_match('/^https?:\/\//', $cleanedUrl)) {
    http_response_code(400);
    exit('Invalid URL format');
}

// Set error handling
error_reporting(0);
ini_set('display_errors', 0);

try {
    // Use cURL for better HTTP handling
    $ch = curl_init();
    
    // Set cURL options
    curl_setopt($ch, CURLOPT_URL, $cleanedUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: image/*,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.5',
        'Accept-Encoding: gzip, deflate',
        'Connection: keep-alive',
        'Upgrade-Insecure-Requests: 1'
    ]);
    
    // Get the response
    $imageContent = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    
    if (curl_errno($ch)) {
        error_log("cURL error: " . curl_error($ch));
        http_response_code(500);
        exit('Failed to fetch image: ' . curl_error($ch));
    }
    
    curl_close($ch);
    
    // Check if we got a successful response
    if ($httpCode !== 200 || $imageContent === false) {
        error_log("HTTP request failed with code: " . $httpCode . " for URL: " . $cleanedUrl);
        http_response_code($httpCode ?: 500);
        exit('Failed to load image (HTTP ' . $httpCode . ')');
    }
    
    // Set appropriate headers
    if ($contentType) {
        header('Content-Type: ' . $contentType);
    } else {
        // Fallback content type based on URL extension
        $extension = strtolower(pathinfo(parse_url($cleanedUrl, PHP_URL_PATH), PATHINFO_EXTENSION));
        $contentTypes = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'bmp' => 'image/bmp',
            'svg' => 'image/svg+xml'
        ];
        $fallbackType = $contentTypes[$extension] ?? 'image/png';
        header('Content-Type: ' . $fallbackType);
    }
    
    // Set CORS and caching headers
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Cache-Control: public, max-age=3600');
    header('Content-Length: ' . strlen($imageContent));
    
    // Output the image content
    echo $imageContent;
    
} catch (Exception $e) {
    error_log("Exception in proxy: " . $e->getMessage());
    http_response_code(500);
    exit('Error loading image: ' . $e->getMessage());
}
?>
