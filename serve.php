<?php
// Secure file serving script
if (isset($_GET['file'])) {
    $filename = $_GET['file'];
    
    // Security: only allow PDF files with UUID pattern
    if (!preg_match('/^[a-f0-9]{32}\.pdf$/i', $filename)) {
        http_response_code(403);
        die('Access denied');
    }
    
    $filepath = '../uploads/' . $filename;
    
    if (file_exists($filepath)) {
        // Set proper headers for PDF
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($filepath));
        header('Cache-Control: public, max-age=3600');
        
        // Output the file
        readfile($filepath);
        exit;
    }
}

// File not found
http_response_code(404);
echo 'File not found';
?>
