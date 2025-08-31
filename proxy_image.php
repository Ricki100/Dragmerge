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

// Log the request for debugging
error_log("Proxy request for URL: " . ($_GET['url'] ?? 'none'));

if (!isset($_GET['url'])) {
    http_response_code(400);
    exit('No URL provided');
}

$url = $_GET['url'];

// Handle local file paths (local:// protocol)
if (strpos($url, 'local://') === 0) {
    // Remove 'local://' prefix and extract the path
    $path = substr($url, 8); // Remove 'local://'
    
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
if (!preg_match('/^https?:\/\//', $url)) {
    http_response_code(400);
    exit('Invalid URL format');
}

// Set error handling
error_reporting(0);
ini_set('display_errors', 0);

try {
    $headers = get_headers($url, 1);
    if ($headers === false) {
        http_response_code(404);
        exit('Failed to fetch image');
    }
    
    $contentType = isset($headers['Content-Type']) ? $headers['Content-Type'] : 'image/png';
    header('Content-Type: ' . $contentType);
    header('Access-Control-Allow-Origin: *');
    header('Cache-Control: public, max-age=3600');
    
    $imageContent = file_get_contents($url);
    if ($imageContent === false) {
        http_response_code(404);
        exit('Failed to load image');
    }
    
    echo $imageContent;
} catch (Exception $e) {
    http_response_code(500);
    exit('Error loading image');
}
?>
