<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Get the JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['action']) || $input['action'] !== 'cleanup') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

$folders = $input['folders'] ?? ['uploads', 'layouts', 'runtime'];
$deletedFiles = [];
$errors = [];

function deleteDirectoryContents($dir) {
    global $deletedFiles, $errors;
    
    if (!is_dir($dir)) {
        return;
    }
    
    $files = scandir($dir);
    
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') {
            continue;
        }
        
        $path = $dir . DIRECTORY_SEPARATOR . $file;
        
        if (is_dir($path)) {
            // Recursively delete subdirectory contents
            deleteDirectoryContents($path);
            
            // Try to remove the empty directory
            if (count(scandir($path)) <= 2) { // Only . and .. remain
                if (rmdir($path)) {
                    $deletedFiles[] = "Directory: $path";
                } else {
                    $errors[] = "Could not remove directory: $path";
                }
            }
        } else {
            // Delete file
            if (unlink($path)) {
                $deletedFiles[] = "File: $path";
            } else {
                $errors[] = "Could not delete file: $path";
            }
        }
    }
}

// Process each folder
foreach ($folders as $folder) {
    $folderPath = __DIR__ . DIRECTORY_SEPARATOR . $folder;
    
    if (is_dir($folderPath)) {
        deleteDirectoryContents($folderPath);
    }
}

// Prepare response
$response = [
    'success' => true,
    'message' => 'Cleanup completed',
    'deletedFiles' => $deletedFiles,
    'errors' => $errors,
    'totalDeleted' => count($deletedFiles),
    'totalErrors' => count($errors)
];

echo json_encode($response);
?>
