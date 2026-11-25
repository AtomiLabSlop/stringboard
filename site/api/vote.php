<?php
// Stringboard vote API. No database: one JSON file, locked while writing.
// GET  -> current results
// POST {"id":"<title id>"}            toggle a vote for a catalog title
// POST {"cat":"<category>","name":"…"} toggle a vote for a write-in title
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const WRITEIN_MIN_SHOWN = 2;   // write-ins appear publicly once this many people named them
const MAX_ACTIONS_PER_DAY = 60;
const CATS = ['game', 'series', 'movie', 'book'];

function fail(int $code, string $msg): void { http_response_code($code); echo json_encode(['error' => $msg]); exit; }

// Keep the data outside the public web folder when the host allows it.
function dataDir(): string {
  foreach ([dirname(__DIR__, 3) . '/stringboard-data', dirname(__DIR__) . '/.data'] as $d) {
    if (is_dir($d) || @mkdir($d, 0750, true)) {
      if (strpos($d, "/.data") !== false && !file_exists("$d/.htaccess")) @file_put_contents("$d/.htaccess", "Require all denied\nDeny from all\n");
      if (is_writable($d)) return $d;
    }
  }
  fail(500, 'storage unavailable');
}

function catalogIds(): array {
  $c = json_decode((string)@file_get_contents(dirname(__DIR__) . '/data/catalog.json'), true);
  $ids = [];
  foreach (($c['titles'] ?? []) as $t) if (($t['status'] ?? '') === 'soon') $ids[$t['id']] = $t['type'];
  return $ids;
}

function publicView(array $db): array {
  $other = [];
  foreach (CATS as $cat) {
    $list = [];
    foreach (($db['other'][$cat] ?? []) as $key => $w) {
      $n = count($w['voters']);
      if ($n >= WRITEIN_MIN_SHOWN) $list[] = ['key' => $key, 'name' => $w['name'], 'n' => $n];
    }
    usort($list, fn($a, $b) => $b['n'] <=> $a['n'] ?: strcmp($a['name'], $b['name']));
    $other[$cat] = $list;
  }
  $counts = [];
  foreach (($db['titles'] ?? []) as $id => $voters) $counts[$id] = count($voters);
  return ['counts' => $counts, 'other' => $other, 'minShown' => WRITEIN_MIN_SHOWN];
}

$dir = dataDir();
$file = "$dir/votes.json";
$fh = fopen($file, 'c+');
if (!$fh) fail(500, 'storage unavailable');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  flock($fh, LOCK_SH);
  $db = json_decode(stream_get_contents($fh) ?: '{}', true) ?: [];
  flock($fh, LOCK_UN);
  echo json_encode(publicView($db));
  exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'method not allowed');

$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) fail(400, 'bad request');

// Voters are stored only as salted hashes of their address.
$saltFile = "$dir/salt";
if (!file_exists($saltFile)) @file_put_contents($saltFile, bin2hex(random_bytes(16)));
$who = substr(hash('sha256', trim((string)@file_get_contents($saltFile)) . '|' . ($_SERVER['REMOTE_ADDR'] ?? '')), 0, 20);

flock($fh, LOCK_EX);
$db = json_decode(stream_get_contents($fh) ?: '{}', true) ?: [];

$today = gmdate('Y-m-d');
if (($db['rate']['day'] ?? '') !== $today) $db['rate'] = ['day' => $today, 'n' => []];
$db['rate']['n'][$who] = ($db['rate']['n'][$who] ?? 0) + 1;
if ($db['rate']['n'][$who] > MAX_ACTIONS_PER_DAY) { flock($fh, LOCK_UN); fail(429, 'too many votes today'); }

$voted = null;
if (isset($in['id'])) {
  $id = (string)$in['id'];
  if (!isset(catalogIds()[$id])) { flock($fh, LOCK_UN); fail(400, 'unknown title'); }
  $v = $db['titles'][$id] ?? [];
  $i = array_search($who, $v, true);
  if ($i === false) { $v[] = $who; $voted = true; } else { array_splice($v, $i, 1); $voted = false; }
  $db['titles'][$id] = $v;
} elseif (isset($in['cat'], $in['name'])) {
  $cat = (string)$in['cat'];
  if (!in_array($cat, CATS, true)) { flock($fh, LOCK_UN); fail(400, 'unknown category'); }
  $name = preg_replace('/[\p{C}<>]+/u', '', strip_tags((string)$in['name']));
  $name = trim(preg_replace('/\s+/u', ' ', $name));
  if (mb_strlen($name) < 2 || mb_strlen($name) > 60) { flock($fh, LOCK_UN); fail(400, 'name must be 2–60 characters'); }
  $key = mb_strtolower(preg_replace('/[^\p{L}\p{N}]+/u', '', $name));
  if ($key === '') { flock($fh, LOCK_UN); fail(400, 'bad name'); }
  $w = $db['other'][$cat][$key] ?? ['name' => $name, 'voters' => []];
  $i = array_search($who, $w['voters'], true);
  if ($i === false) { $w['voters'][] = $who; $voted = true; } else { array_splice($w['voters'], $i, 1); $voted = false; }
  if ($w['voters']) $db['other'][$cat][$key] = $w; else unset($db['other'][$cat][$key]);
} else { flock($fh, LOCK_UN); fail(400, 'bad request'); }

ftruncate($fh, 0); rewind($fh);
fwrite($fh, json_encode($db));
fflush($fh);
flock($fh, LOCK_UN);
echo json_encode(['voted' => $voted] + publicView($db));
