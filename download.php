<?php
$token = preg_replace('~[^a-f0-9]~','',$_GET['token'] ?? '');
$file  = __DIR__."/runtime/$token.pdf";
if(!$token || !is_file($file)){ http_response_code(404); exit('Missing'); }
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename=\"merged_'.date('Ymd_His').'.pdf\"');
readfile($file);
