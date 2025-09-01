<?php
// Test script to verify proxy functionality
echo "<h1>Proxy Test</h1>";

// Test 1: Check if cURL is available
echo "<h2>Test 1: cURL Availability</h2>";
if (function_exists('curl_init')) {
    echo "✅ cURL is available<br>";
} else {
    echo "❌ cURL is NOT available<br>";
    exit("cURL is required for the proxy to work");
}

// Test 2: Test proxy endpoint
echo "<h2>Test 2: Proxy Endpoint Test</h2>";
$testUrl = "https://httpbin.org/image/png";
echo "Testing proxy with: $testUrl<br>";

$proxyUrl = "proxy_image.php?url=" . urlencode($testUrl);
echo "Proxy URL: $proxyUrl<br>";

// Test 3: Test actual image loading
echo "<h2>Test 3: Image Loading Test</h2>";
echo "Testing with a simple image...<br>";

// Use a simple test image
$testImageUrl = "https://via.placeholder.com/150x150/007bff/ffffff?text=Test";
$proxyImageUrl = "proxy_image.php?url=" . urlencode($testImageUrl);

echo "Test Image URL: $testImageUrl<br>";
echo "Proxy Image URL: $proxyImageUrl<br>";
echo "<br>";
echo "<strong>If you see an image below, the proxy is working:</strong><br>";
echo "<img src='$proxyImageUrl' alt='Test Image' style='border: 2px solid #ccc;'><br>";

// Test 4: Check error handling
echo "<h2>Test 4: Error Handling Test</h2>";
$invalidUrl = "https://invalid-domain-that-does-not-exist-12345.com/image.jpg";
$proxyInvalidUrl = "proxy_image.php?url=" . urlencode($invalidUrl);

echo "Testing with invalid URL: $invalidUrl<br>";
echo "This should show an error or fail gracefully.<br>";

// Test 5: CORS headers
echo "<h2>Test 5: CORS Headers Test</h2>";
echo "Check the Network tab in your browser's Developer Tools to see if CORS headers are properly set.<br>";
echo "Look for: Access-Control-Allow-Origin: *<br>";

echo "<hr>";
echo "<p><strong>Note:</strong> If you see any errors above, check your PHP error logs and ensure cURL is properly configured.</p>";
?>
