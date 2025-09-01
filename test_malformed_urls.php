<?php
// Test script for malformed URLs
echo "<h1>Malformed URL Test</h1>";

// Test 1: URL with spaces in filename
echo "<h2>Test 1: URL with Spaces in Filename</h2>";
$malformedUrl = "https://raines.africa/wp-content/uploads/2024/12/freepik br d83bfb56-be24-4b80-a1d0-e5a8b0cfe3cb.png";
echo "Original URL: $malformedUrl<br>";

$proxyUrl = "proxy_image.php?url=" . urlencode($malformedUrl);
echo "Proxy URL: $proxyUrl<br>";

echo "<br>";
echo "<strong>Testing image loading:</strong><br>";
echo "<img src='$proxyUrl' alt='Test Malformed URL' style='border: 2px solid #ccc; width: 200px; height: 200px;'><br>";

// Test 2: URL with newlines
echo "<h2>Test 2: URL with Newlines</h2>";
$newlineUrl = "https://raines.africa/wp-content/uploads/2024/12/freepik\nbr\nd83bfb56-be24-4b80-a1d0-e5a8b0cfe3cb.png";
echo "Original URL with newlines: " . str_replace("\n", "\\n", $newlineUrl) . "<br>";

$proxyUrl2 = "proxy_image.php?url=" . urlencode($newlineUrl);
echo "Proxy URL: $proxyUrl2<br>";

echo "<br>";
echo "<strong>Testing image loading:</strong><br>";
echo "<img src='$proxyUrl2' alt='Test Newline URL' style='border: 2px solid #ccc; width: 200px; height: 200px;'><br>";

// Test 3: Concatenated URLs
echo "<h2>Test 3: Concatenated URLs</h2>";
$concatenatedUrl = "https://raines.africa/wp-content/uploads/2024/12/freepik...br d83bfb56-be24-4b80-a1d0-e5a8b0cfe3cb.png";
echo "Original concatenated URL: $concatenatedUrl<br>";

$proxyUrl3 = "proxy_image.php?url=" . urlencode($concatenatedUrl);
echo "Proxy URL: $proxyUrl3<br>";

echo "<br>";
echo "<strong>Testing image loading:</strong><br>";
echo "<img src='$proxyUrl3' alt='Test Concatenated URL' style='border: 2px solid #ccc; width: 200px; height: 200px;'><br>";

// Test 4: Check proxy logs
echo "<h2>Test 4: Proxy Logs</h2>";
echo "Check your PHP error logs for proxy activity.<br>";
echo "Look for lines like 'Cleaned URL:' and 'Proxy request for URL:'<br>";

echo "<hr>";
echo "<p><strong>Note:</strong> If you see broken image icons above, check the browser console for errors and your PHP error logs for proxy activity.</p>";
?>
