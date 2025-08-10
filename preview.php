<?php
if(!extension_loaded('imagick')){ http_response_code(500); exit('Imagick required'); }
$token = preg_replace('~[^a-f0-9]~','',$_GET['token'] ?? '');
$page  = max(1, (int)($_GET['page'] ?? 1));
$file  = __DIR__."/runtime/$token.pdf";
if(!$token || !is_file($file)){ http_response_code(404); exit; }
$img = new Imagick();
$img->setResolution(144,144);
$img->readImage($file."[".($page-1)."]");
$img->setImageFormat('png');
$img = $img->mergeImageLayers(Imagick::LAYERMETHOD_FLATTEN);
header('Content-Type: image/png');
echo $img;
