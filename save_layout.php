<?php
$data = json_decode(file_get_contents('php://input'), true);
if(!$data){ http_response_code(400); echo json_encode(['ok'=>0,'error'=>'No JSON']); exit; }
if(!is_dir('layouts')) mkdir('layouts',0777,true);
$name = 'layout_'.date('Ymd_His').'.json';
file_put_contents('layouts/'.$name, json_encode($data, JSON_PRETTY_PRINT));
header('Content-Type: application/json');
echo json_encode(['ok'=>1,'layout'=>$name]);
