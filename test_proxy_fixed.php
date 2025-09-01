<!DOCTYPE html>
<html>
<head>
    <title>Test Fixed Proxy</title>
</head>
<body>
    <h1>Testing Fixed Proxy</h1>
    
    <h2>Test 1: Original URL with spaces</h2>
    <p>Original: https://raines.africa/wp-content/uploads/2024/12/freepik br d83bfb56-be24-4b80-a1d0-e5a8b0cfe3cb.png</p>
    <p>Expected cleaned: https://raines.africa/wp-content/uploads/2024/12/freepik_br_d83bfb56-be24-4b80-a1d0-e5a8b0cfe3cb.png</p>
    
    <h2>Test 2: Image via Proxy</h2>
    <img src="proxy_image.php?url=https://raines.africa/wp-content/uploads/2024/12/freepik%20br%20d83bfb56-be24-4b80-a1d0-e5a8b0cfe3cb.png" 
         style="max-width: 300px; border: 1px solid #ccc;" 
         onerror="this.style.display='none'; this.nextSibling.style.display='block';"
         onload="this.nextSibling.style.display='none';">
    <div style="display:none; color: red; padding: 10px; border: 1px solid red;">
        Image failed to load. Check console for details.
    </div>
    
    <h2>Test 3: Cleaned URL via Proxy</h2>
    <img src="proxy_image.php?url=https://raines.africa/wp-content/uploads/2024/12/freepik_br_d83bfb56-be24-4b80-a1d0-e5a8b0cfe3cb.png" 
         style="max-width: 300px; border: 1px solid #ccc;" 
         onerror="this.style.display='none'; this.nextSibling.style.display='block';"
         onload="this.nextSibling.style.display='none';">
    <div style="display:none; color: red; padding: 10px; border: 1px solid red;">
        Image failed to load. Check console for details.
    </div>
    
    <script>
        console.log('Testing proxy functionality...');
        
        // Test URL cleaning logic
        function testUrlCleaning() {
            const testUrl = 'https://raines.africa/wp-content/uploads/2024/12/freepik br d83bfb56-be24-4b80-a1d0-e5a8b0cfe3cb.png';
            const cleanedUrl = testUrl.trim().replace(/[\r\n\s]+/g, '_');
            console.log('Original URL:', testUrl);
            console.log('Cleaned URL:', cleanedUrl);
            console.log('Expected:', 'https://raines.africa/wp-content/uploads/2024/12/freepik_br_d83bfb56-be24-4b80-a1d0-e5a8b0cfe3cb.png');
        }
        
        testUrlCleaning();
    </script>
</body>
</html>
