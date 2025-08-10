<?php
require __DIR__.'/vendor/autoload.php';
use League\Csv\Reader;
use setasign\Fpdi\Tcpdf\Fpdi;

session_start();
header('Content-Type: text/html; charset=utf-8');

function upload($key,$dir='uploads'){
  if(!isset($_FILES[$key]) || $_FILES[$key]['error']!==UPLOAD_ERR_OK) return null;
  if(!is_dir($dir)) mkdir($dir,0777,true);
  $ext = pathinfo($_FILES[$key]['name'], PATHINFO_EXTENSION);
  $name = uniqid($key.'_').'.'.strtolower($ext);
  $path = $dir.'/'.$name; move_uploaded_file($_FILES[$key]['tmp_name'],$path); return $path;
}
function layoutFor($size,$orient,$ippOverride=null){
  $map = ['P'=>['A4'=>5,'A5'=>3,'A6'=>1],'L'=>['A4'=>6,'A5'=>4,'A6'=>2],];
  $ipp = $ippOverride ?: $map[$orient][$size];
  $sizes = ['A4'=>[210,297],'A5'=>[148,210],'A6'=>[105,148]];
  [$pw,$ph] = $sizes[$size]; if($orient==='L'){ [$pw,$ph]=[$ph,$pw]; }
  $margin=10; $usableW=$pw-2*$margin; $usableH=$ph-2*$margin;
  $rows = max(1, $ipp); // simple stacked rows as placeholders (editor is preferred)
  $rows = $ipp<=2? $ipp : ($ipp<=3?3 : ($ipp<=4?4 : 5));
  $slotH = $usableH / $rows; $slotW = $usableW;
  $slots=[];
  for($r=0;$r<$rows;$r++){
    $y=$margin + $r*$slotH + 2;
    $slots[]=['x'=>$margin,'y'=>$y,'w'=>$slotW,'h'=>$slotH-4];
    if(count($slots)===$ipp) break;
  }
  return [$ipp,$slots,[$pw,$ph]];
}

$csvPath      = upload('csv');
$templatePath = upload('template');
$size   = $_POST['pagesize'] ?? 'A4';
$orient = $_POST['orient'] ?? 'P';
$ipp    = isset($_POST['ipp']) && $_POST['ipp']!=='' ? (int)$_POST['ipp'] : null;
$mode   = $_POST['mode'] ?? 'preview';

if(!$csvPath){ http_response_code(400); exit('CSV required'); }

$csv = Reader::createFromPath($csvPath,'r'); $csv->setHeaderOffset(0);
$rows = iterator_to_array($csv->getRecords());

class PDF extends Fpdi {}
[$itemsPerPage,$slots,$dims] = layoutFor($size,$orient,$ipp);
$pdf = new PDF($orient,'mm',$size,true,'UTF-8',false);
$pdf->SetMargins(10,10,10); $pdf->SetAutoPageBreak(true,10);
$pdf->SetCreator('Data Merge'); $pdf->SetTitle('Merged Products');

$useTemplate=false;$tid=null;
if($templatePath && file_exists($templatePath)){
  $useTemplate=true; $pdf->setSourceFile($templatePath); $tid=$pdf->importPage(1);
}
function drawProduct($pdf,$slot,$row){
  $pad=3; $x=$slot['x'];$y=$slot['y'];$w=$slot['w'];$h=$slot['h'];
  $imgW = min(60,$w*0.30); $imgH=$h-2*$pad; $textX=$x+$imgW+2*$pad; $textW=$w-$imgW-3*$pad;
  if(!empty($row['image'])){
    $img=$row['image'];
    if(preg_match('~^https?://~',$img)){ $tmp=tempnam(sys_get_temp_dir(),'img'); @file_put_contents($tmp,@file_get_contents($img)); $img=$tmp; }
    if(is_file($img)){ [$iw,$ih]=@getimagesize($img)?:[0,0];
      if($iw&&$ih){ $ratio=min($imgW/$iw*25.4,$imgH/$ih*25.4); $dw=$iw*$ratio/25.4; $dh=$ih*$ratio/25.4;
        $ix=$x+$pad+max(0,($imgW-$dw)/2); $iy=$y+$pad+max(0,($imgH-$dh)/2);
        $pdf->Image($img,$ix,$iy,$dw,$dh,'','', '', true, 300);
      }
    }
  }
  $title=$row['title']??''; $subtitle=$row['subtitle']??''; $price=$row['price']??''; $features=$row['features']??'';
  $pdf->SetFont('helvetica','B', ($w>140?12:11)); $pdf->SetXY($textX,$y+$pad); $pdf->MultiCell($textW,6,$title,0,'L',false,1);
  if($subtitle!==''){ $pdf->SetFont('helvetica','',9.5); $pdf->SetX($textX); $pdf->MultiCell($textW,5,$subtitle,0,'L',false,1); }
  if($price!==''){ $pdf->SetFont('helvetica','B', ($w>140?13:12)); $pdf->SetTextColor(20,120,255); $pdf->SetX($textX);
    $pdf->MultiCell($textW,6,'$'.number_format((float)$price,2),0,'L',false,1); $pdf->SetTextColor(0,0,0);
  }
  if($features!==''){ $pdf->SetFont('helvetica','',9); $pdf->SetX($textX);
    $list=is_array($features)?$features:explode('|',$features);
    $pdf->MultiCell($textW,4.5,implode("\n",array_map(fn($f)=>'• '.trim($f),$list)),0,'L',false,1);
  }
}

$idx=0; $total=count($rows);
while($idx<$total){
  $pdf->AddPage();
  if($useTemplate){ $pdf->useTemplate($tid,0,0,0,0,true); }
  for($s=0;$s<min($itemsPerPage,count($slots));$s++){
    if($idx>=$total) break;
    drawProduct($pdf,$slots[$s],$rows[$idx]); $idx++;
  }
}
if(!is_dir('runtime')) mkdir('runtime',0777,true);
$token = bin2hex(random_bytes(8));
$file = "runtime/$token.pdf";
$pdf->Output($file,'F');
$totalPages = $pdf->getNumPages();
if($mode==='preview'){
  echo "<script>parent.postMessage(".json_encode(['token'=>$token,'total'=>$totalPages]).",'*');</script>";
  exit;
}
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename=\"merged_'.date('Ymd_His').'.pdf\"');
readfile($file);
