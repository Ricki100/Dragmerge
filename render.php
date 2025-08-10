<?php
require __DIR__.'/vendor/autoload.php';
use League\Csv\Reader;
use setasign\Fpdi\Tcpdf\Fpdi;

$layoutFile = $_GET['layout'] ?? '';
$csvFile    = $_GET['csv'] ?? '';
$template   = $_GET['template'] ?? '';

if(!$layoutFile || !$csvFile){ http_response_code(400); exit('layout & csv required'); }

$layoutPath = __DIR__.'/layouts/'.$layoutFile;
if(!is_file($layoutPath)){ http_response_code(404); exit('layout not found'); }

$layout = json_decode(file_get_contents($layoutPath), true);
$csv    = Reader::createFromPath($csvFile,'r'); $csv->setHeaderOffset(0);
$dataRows   = iterator_to_array($csv->getRecords());

class PDF extends Fpdi {}
$s = $layout['page']['size']; $o=$layout['page']['orient'];
$pdf = new PDF($o,'mm',$s,true,'UTF-8',false);
$pdf->SetMargins(0,0,0); $pdf->SetAutoPageBreak(false);

$repArea = null; $objs = $layout['objects'];
foreach($objs as $obj){ if(($obj['meta']['type'] ?? '')==='repeaterArea'){ $repArea = $obj; break; } }
if(!$repArea){ http_response_code(400); exit('No repeater area in layout'); }

$cardObjs = [];
foreach($objs as $obj){ if(($obj['meta']['type']??'')==='card' || isset($obj['meta']['bind']) || ($obj['text'] ?? '')) $cardObjs[]=$obj; }

$cardBox = ['x'=>1e9,'y'=>1e9,'w'=>0,'h'=>0];
foreach($cardObjs as $o2){
  $cardBox['x']=min($cardBox['x'],$o2['left']);
  $cardBox['y']=min($cardBox['y'],$o2['top']);
  $cardBox['w']=max($cardBox['w'],$o2['left']+$o2['width']);
  $cardBox['h']=max($cardBox['h'],$o2['top']+$o2['height']);
}
$cardBox['w'] -= $cardBox['x']; $cardBox['h'] -= $cardBox['y'];
$cols = max(1, floor($repArea['width']  / $cardBox['w']));
$rows = max(1, floor($repArea['height'] / $cardBox['h']));
if(isset($repArea['meta']['cols'])) $cols = (int)$repArea['meta']['cols'];
if(isset($repArea['meta']['rows'])) $rows = (int)$repArea['meta']['rows'];
$perPage = $cols*$rows;

$templateId = null;
if($template && is_file($template)){ $pdf->setSourceFile($template); $templateId=$pdf->importPage(1); }

$i=0; $total=count($dataRows);
while($i<$total){
  $pdf->AddPage();
  if($templateId){ $pdf->useTemplate($templateId,0,0,0,0,true); }
  for($rr=0;$rr<$rows && $i<$total; $rr++){
    for($cc=0;$cc<$cols && $i<$total; $cc++){
      $offX = px2mm($repArea['left']) + $cc*px2mm($cardBox['w']);
      $offY = px2mm($repArea['top'])  + $rr*px2mm($cardBox['h']);
      placeCard($pdf,$cardObjs,$dataRows[$i],$offX,$offY,$cardBox);
      $i++;
    }
  }
}
$pdf->Output('merged.pdf','D');

function placeCard($pdf,$objects,$data,$offX,$offY,$box){
  foreach($objects as $o){
    $x = px2mm($o['left'] - $box['x']) + $offX;
    $y = px2mm($o['top']  - $box['y']) + $offY;
    $w = px2mm($o['width']); $h=px2mm($o['height']);
    if(($o['meta']['bind']??'')==='image'){
      $img = $data['image'] ?? ''; if(!$img) continue;
      if(preg_match('~^https?://~',$img)){ $tmp=tempnam(sys_get_temp_dir(),'img'); @file_put_contents($tmp,@file_get_contents($img)); $img=$tmp; }
      if(!is_file($img)) continue;
      [$iw,$ih]=@getimagesize($img)?:[0,0]; if(!$iw||!$ih) continue;
      $r=min($w/$iw*25.4,$h/$ih*25.4); $dw=$iw*$r/25.4; $dh=$ih*$r/25.4;
      $ix=$x+max(0,($w-$dw)/2); $iy=$y+max(0,($h-$dh)/2);
      $pdf->Image($img,$ix,$iy,$dw,$dh,'','', '', true, 300);
    } else {
      $text = $o['meta']['bind'] ? ($data[$o['meta']['bind']] ?? '') : ($o['meta']['static'] ?? $o['text'] ?? '');
      $pdf->SetFont('helvetica','',10);
      $pdf->SetXY($x,$y); $pdf->MultiCell($w,5,(string)$text,0,'L',false,1);
    }
  }
}
function px2mm($v){ return $v / (96/25.4); }
