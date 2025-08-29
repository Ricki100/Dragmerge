<?php
// Security headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');

// Simple rate limiting (1 upload per 5 seconds per IP)
session_start();
$ip = $_SERVER['REMOTE_ADDR'];
$rateLimitKey = 'upload_' . $ip;
$currentTime = time();

if (isset($_SESSION[$rateLimitKey]) && ($currentTime - $_SESSION[$rateLimitKey]) < 5) {
    http_response_code(429);
    echo json_encode([
        'ok' => 0,
        'error' => 'Rate limit exceeded. Please wait 5 seconds between uploads.'
    ]);
    exit;
}

// Create uploads directory if it doesn't exist
$uploadDir = '../uploads/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Add .htaccess to uploads directory for additional protection
$htaccessPath = $uploadDir . '.htaccess';
if (!file_exists($htaccessPath)) {
    $htaccessContent = "Order deny,allow\nDeny from all\n<FilesMatch \"\\.pdf$\">\nAllow from all\n</FilesMatch>";
    file_put_contents($htaccessPath, $htaccessContent);
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Only POST requests allowed');
    }

    if (!isset($_FILES['file'])) {
        throw new Exception('No file uploaded');
    }

    $file = $_FILES['file'];
    
    // Validate file
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Upload error: ' . $file['error']);
    }

    // Enhanced file type validation
    $allowedTypes = ['application/pdf'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowedTypes)) {
        throw new Exception('Invalid file type. Only PDF files are allowed.');
    }

    // Check file extension
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if ($extension !== 'pdf') {
        throw new Exception('File must have .pdf extension');
    }

    if ($file['size'] > 25 * 1024 * 1024) { // 25MB limit
        throw new Exception('File too large (max 25MB)');
    }

    // Additional security: check if file is actually a PDF
    $fileContent = file_get_contents($file['tmp_name'], false, null, 0, 4);
    if ($fileContent !== '%PDF') {
        throw new Exception('File is not a valid PDF');
    }

    // Generate unique filename with timestamp
    $uuid = bin2hex(random_bytes(16));
    $timestamp = time();
    $filename = $timestamp . '_' . $uuid . '.pdf';
    $filepath = $uploadDir . $filename;

    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        throw new Exception('Failed to save file');
    }

    // Set rate limit
    $_SESSION[$rateLimitKey] = $currentTime;

    // Return success response
    $response = [
        'ok' => 1,
        'url' => '/uploads/' . $filename,
        'name' => $file['name']
    ];

    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => 0,
        'error' => $e->getMessage()
    ]);
}
?>
