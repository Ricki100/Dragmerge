<?php
if (!isset($_GET['url'])) {
    http_response_code(400);
    exit('No URL provided');
}

$url = $_GET['url'];
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
