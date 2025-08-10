<?php // /public/index.php
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DragMerge - PDF Data Merge</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .header {
            text-align: center;
            margin-bottom: 3rem;
            color: white;
        }

        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .editor-link {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            color: white;
            text-decoration: none;
            padding: 0.75rem 1.5rem;
            border-radius: 25px;
            margin-top: 1rem;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.3);
        }

        .editor-link:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }

        .main-card {
            background: white;
            border-radius: 20px;
            padding: 2.5rem;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        }

        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .form-section {
            background: #f8fafc;
            padding: 1.5rem;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        }

        .form-section h3 {
            color: #1a202c;
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .form-section h3::before {
            content: '';
            width: 4px;
            height: 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 2px;
        }

        .file-upload {
            position: relative;
            margin-bottom: 1rem;
        }

        .file-upload input[type="file"] {
            position: absolute;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
        }

        .file-upload-label {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            border: 2px dashed #cbd5e0;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .file-upload-label:hover {
            border-color: #667eea;
            background: #f7fafc;
        }

        .file-upload-label svg {
            width: 24px;
            height: 24px;
            color: #667eea;
        }

        .file-info {
            flex: 1;
        }

        .file-name {
            font-weight: 500;
            color: #2d3748;
        }

        .file-hint {
            font-size: 0.875rem;
            color: #718096;
        }

        .config-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
        }

        .form-group {
            margin-bottom: 1rem;
        }

        .form-group label {
            display: block;
            font-weight: 500;
            color: #4a5568;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
        }

        .form-control {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 0.875rem;
            transition: all 0.3s ease;
            background: white;
        }

        .form-control:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-top: 2rem;
        }

        .btn {
            padding: 1rem 2rem;
            border: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            text-decoration: none;
        }

        .btn-primary {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }

        .btn-secondary {
            background: #f7fafc;
            color: #4a5568;
            border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover {
            background: #edf2f7;
            transform: translateY(-2px);
        }

        .preview-section {
            display: none;
            margin-top: 2rem;
            background: #f8fafc;
            border-radius: 12px;
            padding: 1.5rem;
            border: 1px solid #e2e8f0;
        }

        .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .preview-controls {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .preview-nav {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .preview-nav button {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 0.5rem 0.75rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .preview-nav button:hover {
            background: #f7fafc;
        }

        .preview-nav button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .page-info {
            font-weight: 500;
            color: #4a5568;
        }

        .preview-image {
            width: 100%;
            max-width: 800px;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            margin: 0 auto;
            display: block;
        }

        .loading {
            display: none;
            text-align: center;
            padding: 2rem;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .main-card {
                padding: 1.5rem;
            }
            
            .form-grid {
                grid-template-columns: 1fr;
            }
            
            .actions {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DragMerge</h1>
            <p>Transform your data into beautiful PDF documents</p>
            <a href="../editor.html" class="editor-link">🎨 Open Visual Editor</a>
        </div>

        <div class="main-card">
            <form id="mergeForm" action="../merge.php" method="post" enctype="multipart/form-data" target="work">
                <div class="form-grid">
                    <div class="form-section">
                        <h3>📁 Upload Files</h3>
                        
                        <div class="file-upload">
                            <input type="file" name="csv" accept=".csv" required id="csvFile">
                            <label for="csvFile" class="file-upload-label">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <div class="file-info">
                                    <div class="file-name" id="csvFileName">Choose CSV file</div>
                                    <div class="file-hint">Your data file with headers</div>
                                </div>
                            </label>
                        </div>

                        <div class="file-upload">
                            <input type="file" name="template" accept="application/pdf" id="templateFile">
                            <label for="templateFile" class="file-upload-label">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                                </svg>
                                <div class="file-info">
                                    <div class="file-name" id="templateFileName">Choose template PDF (optional)</div>
                                    <div class="file-hint">Background template for your design</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>⚙️ Page Settings</h3>
                        
                        <div class="config-grid">
                            <div class="form-group">
                                <label for="pagesize">Page Size</label>
                                <select name="pagesize" id="pagesize" class="form-control">
                                    <option value="A4">A4 (210×297mm)</option>
                                    <option value="A5">A5 (148×210mm)</option>
                                    <option value="A6">A6 (105×148mm)</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="orient">Orientation</label>
                                <select name="orient" id="orient" class="form-control">
                                    <option value="P">Portrait</option>
                                    <option value="L">Landscape</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="ipp">Items per Page</label>
                                <input type="number" name="ipp" id="ipp" min="1" max="20" placeholder="Auto" class="form-control">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="actions">
                    <button type="submit" name="mode" value="preview" class="btn btn-secondary">
                        👁️ Generate Preview
                    </button>
                    <button type="submit" name="mode" value="download" class="btn btn-primary">
                        📥 Generate & Download
                    </button>
                </div>
            </form>

            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p>Generating your PDF...</p>
            </div>

            <div class="preview-section" id="previewWrap">
                <div class="preview-header">
                    <h3>📄 Preview</h3>
                    <div class="preview-controls">
                        <div class="preview-nav">
                            <button id="prevBtn" type="button">◀</button>
                            <span class="page-info">Page <span id="cur">1</span> of <span id="tot">1</span></span>
                            <button id="nextBtn" type="button">▶</button>
                        </div>
                        <button id="dlBtn" class="btn btn-primary" type="button">📥 Download PDF</button>
                    </div>
                </div>
                <img id="previewImg" src="" alt="PDF Preview" class="preview-image">
            </div>
        </div>
    </div>

    <iframe name="work" style="display:none"></iframe>

    <script>
        let total = 1, page = 1, token = null;

        // File upload handlers
        document.getElementById('csvFile').addEventListener('change', function(e) {
            const fileName = e.target.files[0]?.name || 'Choose CSV file';
            document.getElementById('csvFileName').textContent = fileName;
        });

        document.getElementById('templateFile').addEventListener('change', function(e) {
            const fileName = e.target.files[0]?.name || 'Choose template PDF (optional)';
            document.getElementById('templateFileName').textContent = fileName;
        });

        // Form submission
        document.getElementById('mergeForm').addEventListener('submit', function() {
            document.getElementById('loading').style.display = 'block';
            document.getElementById('previewWrap').style.display = 'none';
        });

        function showPage() {
            document.getElementById('cur').textContent = page;
            document.getElementById('tot').textContent = total;
            document.getElementById('previewImg').src = '../preview.php?token=' + encodeURIComponent(token) + '&page=' + page + '&_=' + (Date.now());
            document.getElementById('previewWrap').style.display = 'block';
            document.getElementById('loading').style.display = 'none';
        }

        // Message handling
        window.addEventListener('message', function(e) {
            if (!e.data || !e.data.token) return;
            token = e.data.token;
            total = e.data.total;
            page = 1;
            showPage();
        });

        // Navigation
        document.getElementById('prevBtn').onclick = function() {
            if (page > 1) {
                page--;
                showPage();
            }
        };

        document.getElementById('nextBtn').onclick = function() {
            if (page < total) {
                page++;
                showPage();
            }
        };

        document.getElementById('dlBtn').onclick = function() {
            if (token) {
                window.location = '../download.php?token=' + encodeURIComponent(token);
            }
        };
    </script>
</body>
</html>
