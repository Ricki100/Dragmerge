<?php
// Simple test for the exact URL that's failing
echo "<h1>Simple Proxy Test</h1>";

$problematicUrl = "https://raines.africa/wp-content/uploads/2024/11/freepik br 03cf44f7-d8f9-4512-a212-a2860eb6d105.png";
echo "<h2>Testing Problematic URL</h2>";
echo "Original URL: <code>$problematicUrl</code><br><br>";

// Test the proxy directly
$proxyUrl = "proxy_image.php?url=" . urlencode($problematicUrl);
echo "Proxy URL: <code>$proxyUrl</code><br><br>";

echo "<strong>Testing image loading:</strong><br>";
echo "<img src='$proxyUrl' alt='Test Image' style='border: 2px solid #ccc; width: 200px; height: 200px;'><br>";

echo "<hr>";
echo "<p><strong>Check the browser console and network tab for any errors.</strong></p>";
echo "<p><strong>Also check your PHP error logs for proxy activity.</strong></p>";
?>
