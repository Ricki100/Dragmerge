<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Create uploads directory if it doesn't exist
$uploadDir = '../uploads/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
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

    if ($file['type'] !== 'application/pdf') {
        throw new Exception('File must be a PDF');
    }

    if ($file['size'] > 25 * 1024 * 1024) { // 25MB limit
        throw new Exception('File too large (max 25MB)');
    }

    // Generate unique filename
    $uuid = bin2hex(random_bytes(16));
    $filename = $uuid . '.pdf';
    $filepath = $uploadDir . $filename;

    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        throw new Exception('Failed to save file');
    }

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
