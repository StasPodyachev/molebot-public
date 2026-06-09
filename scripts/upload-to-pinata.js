/**
 * upload-to-pinata.js — Molebot NFT IPFS upload via Pinata + kubo.
 *
 * Flow:
 *  1. Install kubo (IPFS CLI) — caches on runner
 *  2. Upload PNG images → ipfs add --wrap-with-directory → images Folder CID
 *  3. Update JSON metadata with real images CID
 *  4. Upload JSON metadata → ipfs add --wrap-with-directory → meta Folder CID (BASE_URI)
 *  5. Pin both folder CIDs on Pinata for persistence
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const PINATA_JWT = process.env.PINATA_JWT;
const NFT_DIR = path.resolve(__dirname, '../nft-collection');
const DRY_RUN = process.argv.includes('--dry-run');

if (!PINATA_JWT && !DRY_RUN) {
  console.error('❌ PINATA_JWT не задан');
  process.exit(1);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: opts.silent ? 'pipe' : 'inherit', encoding: 'utf-8', ...opts });
}

function httpsPost(host, endpoint, body, contentType) {
  return new Promise((resolve, reject) => {
    const data = body instanceof Buffer ? body : JSON.stringify(body);
    const req = https.request({
      hostname: host, path: endpoint, method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        'Content-Type': contentType || 'application/json',
        'Content-Length': data.length,
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(d)); } catch { resolve(d); }
        } else {
          reject({ status: res.statusCode, body: d.slice(0, 300) });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

function uploadToPinata(filePath, name) {
  const boundary = `----PinataBoundary${Date.now()}`;
  const content = fs.readFileSync(filePath);
  const fname = path.basename(filePath);

  const parts = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fname}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="pinataMetadata"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: name || fname })}\r\n--${boundary}--\r\n`),
  ];

  return httpsPost('api.pinata.cloud', '/pinning/pinFileToIPFS',
    Buffer.concat(parts),
    `multipart/form-data; boundary=${boundary}`);
}

async function pinCid(cid, name) {
  try {
    await httpsPost('api.pinata.cloud', '/pinning/pinByHash', { hashToPin: cid, name: name || cid });
    return true;
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Step 1: Install kubo                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function ensureIpfs() {
  try {
    run('ipfs version --enc=json', { silent: true });
    console.log('   ✅ IPFS CLI уже установлен');
    return;
  } catch { /* install */ }

  if (DRY_RUN) {
    console.log('   🧪 DRY RUN — пропускаю установку kubo');
    return;
  }

  console.log('   📦 Устанавливаю IPFS CLI (kubo)...');
  run([
    'wget -q https://dist.ipfs.tech/kubo/v0.32.0/kubo_v0.32.0_linux-amd64.tar.gz -O /tmp/kubo.tar.gz &&',
    'tar xzf /tmp/kubo.tar.gz -C /tmp &&',
    'sudo mv /tmp/kubo/ipfs /usr/local/bin/ &&',
    'rm -rf /tmp/kubo /tmp/kubo.tar.gz',
  ].join(' '));
  run('ipfs init', { silent: true });
  console.log('   ✅ IPFS CLI установлен');
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Step 2: Upload PNG images — get images Folder CID                           */
/* ─────────────────────────────────────────────────────────────────────────── */

function uploadImages() {
  const imgDir = path.join(NFT_DIR, 'output', 'images');
  const files = fs.readdirSync(imgDir).filter(f => f.endsWith('.png')).sort();

  if (DRY_RUN) {
    console.log('   🧪 DRY RUN — mock images CID');
    return { cid: 'QmDryRunImagesCID', count: files.length };
  }

  // ipfs add all PNG files with --wrap-with-directory → single Folder CID
  const result = run(`cd "${imgDir}" && ipfs add --wrap-with-directory --cid-version=1 -Q *.png`, { silent: true });
  const cid = result.trim();
  console.log(`   ✅ ${files.length} PNG → Folder CID: ${cid}`);
  return { cid, count: files.length };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Step 3: Update JSON metadata with real images CID                           */
/* ─────────────────────────────────────────────────────────────────────────── */

function prepareJson(imagesCid) {
  const jsonDir = path.join(NFT_DIR, 'output', 'json');
  const jsonFiles = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json')).sort();
  const outDir = path.join(NFT_DIR, 'output', 'json_updated');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const file of jsonFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(jsonDir, file), 'utf-8'));
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.image && item.edition) item.image = `ipfs://${imagesCid}/${item.edition}.png`;
      }
    } else if (data.image) {
      data.image = `ipfs://${imagesCid}/${data.edition || parseInt(file)}.png`;
    }
    fs.writeFileSync(path.join(outDir, file), JSON.stringify(data, null, 2));
  }

  return { files: jsonFiles, count: jsonFiles.length, outDir };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Main                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

async function main() {
  console.log('🚀 Molebot NFT → Pinata IPFS (full pipeline)\n');

  // ── Step 1: Install kubo ────────────────────────────────────
  console.log('[1/5] IPFS CLI check...');
  ensureIpfs();

  // ── Step 2: Upload PNG images ──────────────────────────────
  console.log('\n[2/5] Загружаю PNG изображения...');
  const { cid: imagesCid, count: imagesCount } = uploadImages();
  console.log(`   📌 IMAGES CID: ${imagesCid}`);

  // ── Step 3: Update JSON metadata ───────────────────────────
  console.log('\n[3/5] Обновляю JSON metadata с images CID...');
  const jsonMeta = prepareJson(imagesCid);
  console.log(`   ✅ ${jsonMeta.count} JSON файлов с image = ipfs://${imagesCid}/<edition>.png`);

  // ── Step 4: Create IPFS directory for JSON ────────────────
  console.log('\n[4/5] Создаю IPFS директорию метаданных...');
  let metaCid;

  if (DRY_RUN) {
    metaCid = 'QmDryRunMetaCID';
    console.log('   🧪 DRY RUN — mock CID');
  } else {
    const result = run(`cd "${jsonMeta.outDir}" && ipfs add --wrap-with-directory --cid-version=1 -Q *.json`, { silent: true });
    metaCid = result.trim();
    console.log(`   ✅ Meta Folder CID: ${metaCid}`);
  }

  // ── Step 5: Pin on Pinata for persistence ─────────────────
  console.log('\n[5/5] Закрепляю на Pinata...');

  let pinnedCount = 0;
  let imagesPinned = false;
  let metaPinned = false;

  if (!DRY_RUN) {
    // Pin individual JSON files on Pinata
    for (const file of jsonMeta.files) {
      const filePath = path.join(jsonMeta.outDir, file);
      try {
        await uploadToPinata(filePath, `molebot-${file.replace('.json', '')}`);
        pinnedCount++;
      } catch (err) {
        process.stdout.write(`   ⚠ ${file}: ${err.status || err.message} — skip\n`);
      }
    }

    // Pin images folder CID
    imagesPinned = await pinCid(imagesCid, 'molebot-images');
    console.log(`   ${imagesPinned ? '✅' : '⚠'} Images CID pin: ${imagesPinned ? 'OK' : 'free plan — files in IPFS network'}`);

    // Pin metadata folder CID
    metaPinned = await pinCid(metaCid, 'molebot-metadata');
    console.log(`   ${metaPinned ? '✅' : '⚠'} Meta  CID pin: ${metaPinned ? 'OK' : 'free plan — files in IPFS network'}`);
  } else {
    console.log('   🧪 DRY RUN — пропускаю');
  }

  // ── Result ─────────────────────────────────────────────────
  const BASE_URI = `ipfs://${metaCid}/`;

  console.log('\n═══════════════════════════════════════════');
  console.log('✅ NFT коллекция на IPFS!');
  console.log('═══════════════════════════════════════════');
  console.log(`\n🖼  Images Folder CID:  ${imagesCid}`);
  console.log(`📋 Meta  Folder CID:   ${metaCid}`);
  console.log(`📌 Pinned JSON files:  ${pinnedCount}/${jsonMeta.count}`);
  console.log(`\n📋 BASE_URI:           ${BASE_URI}`);
  console.log(`📋 Gateway (test):     https://ipfs.io/ipfs/${metaCid}/1.json`);
  console.log(`🖼 Gateway (images):   https://ipfs.io/ipfs/${imagesCid}/1.png`);

  // Save result
  const result = `# Molebot NFT — результат IPFS

| Параметр | Значение |
|---|---|
| Images Folder CID | \`${imagesCid}\` |
| Metadata Folder CID | \`${metaCid}\` |
| BASE_URI | \`${BASE_URI}\` |
| Pinned JSON files | ${pinnedCount}/${jsonMeta.count} |
| Дата | ${new Date().toISOString()} |

## Для контракта

\`\`\`solidity
string public constant BASE_URI = "${BASE_URI}";
\`\`\`

## Проверка

- https://ipfs.io/ipfs/${metaCid}/1.json
- https://ipfs.io/ipfs/${imagesCid}/1.png
`;
  fs.writeFileSync(path.resolve(__dirname, '../NFT_RESULT.md'), result);
  console.log('\n📄 Результат сохранён в NFT_RESULT.md');
}

main().catch(err => {
  console.error('\n❌ Fatal:', err);
  process.exit(1);
});
