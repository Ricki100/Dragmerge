
DragMerge — Visual Data‑Merge PDF (PHP)
======================================

What’s inside
-------------
- **editor.html** — Drag/drop editor (Fabric.js). Create a card layout, set a repeater area, bind fields.
- **save_layout.php** — Saves layout JSON into `/layouts`.
- **public/index.php** — CSV + template upload page with live PDF page preview and download.
- **merge.php** — Quick generator (no custom layout; stacked rows). Good for fast tests.
- **render.php** — Uses saved layout JSON to render CSV rows into a paginated PDF.
- **preview.php** — Renders a PDF page to PNG (for previews).
- **download.php** — Serves the generated PDF by token.
- **uploads/**, **layouts/**, **runtime/** — working folders.
- **composer.json** — PHP deps (TCPDF, FPDI, league/csv).

Requirements
------------
- PHP 8.x with `mbstring`, `gd`, `imagick` (for previews).
- ImageMagick + Ghostscript installed (so Imagick can rasterize PDF).
- Composer packages:
  ```bash
  composer install
  ```

Quick start
-----------
1. Deploy the folder to your PHP host (or run locally via `php -S localhost:8080 -t /path`).
2. Run `composer install` inside the folder.
3. Open `public/index.php` to try the simple generator + previews.
4. Open `editor.html` to design your custom layout. Click **Save Layout**.
5. Render with:
   ```
   http://yourhost/render.php?layout=layouts/<your_layout.json>&csv=uploads/<your.csv>&template=uploads/<template.pdf>
   ```

CSV format example
------------------
```
title,subtitle,price,features,image
Samsung 85" QLED,4K QLED,1944.00,"Quantum Processor Lite 4K|Tizen OS|3x HDMI|2x USB",/absolute/path/sam85.jpg
Hisense 75" QLED,4K QLED,1078.00,"Quantum Dot Color|Dolby Vision|Vidaa|3x HDMI",/absolute/path/his75.jpg
```

Notes
-----
- Units: Editor uses px at ~96dpi; renderer converts to mm for TCPDF.
- Repeater area auto-calculates rows/cols based on your card size; override by setting `meta.rows`/`meta.cols` in layout JSON if needed.
- Template: upload a designed PDF background to overlay content on.
