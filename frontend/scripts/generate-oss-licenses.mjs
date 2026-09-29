/**
 * 앱에 실려 나가는 오픈소스의 고지 파일을 만든다.
 *
 * MIT·Apache·BSD 등 대부분의 라이선스가 **배포할 때 저작권 표시와 라이선스 전문을
 * 함께 전달**하도록 요구한다. 설정 > 오픈소스 라이선스 화면이 그 의무를 지키는 자리다.
 *
 * 손으로 관리하면 의존성이 바뀔 때마다 낡는다(지금도 전이 의존성까지 200개가 넘는다).
 * 그래서 package-lock 과 node_modules 를 읽어 매번 새로 뽑는다.
 *
 *   node scripts/generate-oss-licenses.mjs
 *
 * 개발 전용 의존성(vite, eslint 등)은 앱에 실리지 않으므로 제외한다.
 * 고지 의무는 '배포' 에 붙기 때문이다. 서버(backend/) 의존성도 같은 이유로 대상이 아니다.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// public/ 에 둔다. src/ 에 두면 JS 번들에 900KB 가 통째로 실려 첫 화면이 느려진다.
// 여기 두면 라이선스 화면을 열 때만 받아 간다.
const OUT = join(root, 'public/oss-licenses.json');

/** 라이선스 전문이 담겼을 법한 파일 이름들 */
const LICENSE_FILES = /^(LICENSE|LICENCE|COPYING|NOTICE)(\..*)?$/i;

function readLicenseText(pkgDir) {
  if (!existsSync(pkgDir)) return null;
  const name = readdirSync(pkgDir).find((f) => LICENSE_FILES.test(f));
  if (!name) return null;
  try {
    return readFileSync(join(pkgDir, name), 'utf8').trim();
  } catch {
    return null;
  }
}

/** package.json 의 license 필드는 문자열이거나 옛 형식(객체/배열)일 수 있다 */
function licenseId(meta) {
  if (typeof meta.license === 'string') return meta.license;
  if (meta.license?.type) return meta.license.type;
  if (Array.isArray(meta.licenses) && meta.licenses[0]?.type) return meta.licenses[0].type;
  return 'UNKNOWN';
}

function authorOf(meta) {
  const a = meta.author;
  if (!a) return null;
  return typeof a === 'string' ? a : [a.name, a.email && `<${a.email}>`].filter(Boolean).join(' ');
}

const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));

const packages = [];
const seen = new Set();

for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  // 루트 자신과 개발 전용 의존성은 건너뛴다
  if (!path || entry.dev) continue;

  const pkgDir = join(root, path);
  const pkgJson = join(pkgDir, 'package.json');
  if (!existsSync(pkgJson)) continue;

  const meta = JSON.parse(readFileSync(pkgJson, 'utf8'));
  const key = `${meta.name}@${meta.version}`;
  if (seen.has(key)) continue;
  seen.add(key);

  packages.push({
    name: meta.name,
    version: meta.version,
    license: licenseId(meta),
    author: authorOf(meta),
    homepage: meta.homepage ?? meta.repository?.url ?? null,
    text: readLicenseText(pkgDir),
  });
}

// ── 전문이 없는 패키지 메우기 ──────────────────────────────
//
// 일부 패키지는 LICENSE 파일 없이 배포된다(@firebase/* 45개 등).
// Apache-2.0 은 전문 포함이 의무인데 파일이 없으니 그대로 두면 고지가 불완전하다.
//
// Apache-2.0 은 전문이 정형문이라 같은 라이선스를 쓰는 다른 패키지의 것을 써도 정확하다
// (저작권자는 전문이 아니라 NOTICE·헤더에 적힌다).
// 반면 MIT·BSD 는 **전문 안에 저작권자 이름이 들어간다.** 남의 것을 복사하면
// 저작권자를 틀리게 표시하게 되므로, 그런 건 표시만 남기고 직접 확인하게 둔다.
const BOILERPLATE = new Set(['Apache-2.0', 'MPL-2.0', '0BSD']);

const canonical = new Map();
for (const p of packages) {
  if (!p.text) continue;
  const best = canonical.get(p.license);
  if (!best || p.text.length > best.length) canonical.set(p.license, p.text);
}

for (const p of packages) {
  if (p.text) {
    p.textSource = 'package';
    continue;
  }
  if (BOILERPLATE.has(p.license) && canonical.has(p.license)) {
    p.text = canonical.get(p.license);
    p.textSource = 'spdx'; // 정형문이라 다른 패키지 것과 동일
  } else {
    p.textSource = 'missing'; // 사람이 확인해야 한다
  }
}

packages.sort((a, b) => a.name.localeCompare(b.name));

const missing = packages.filter((p) => p.textSource === 'missing');
const unknown = packages.filter((p) => p.license === 'UNKNOWN');
const filled = packages.filter((p) => p.textSource === 'spdx');

// 내용이 그대로면 다시 쓰지 않는다. 빌드할 때마다 도는 스크립트라,
// 시각만 바꿔 쓰면 git 이 매번 '수정됨' 으로 잡혀 작업 트리가 더러워진다.
const next = JSON.stringify({ packages }, null, 2) + '\n';
const changed = !existsSync(OUT) || readFileSync(OUT, 'utf8') !== next;
if (changed) writeFileSync(OUT, next);

console.log(`오픈소스 고지 ${packages.length}개 ${changed ? '갱신' : '그대로'} → ${OUT}`);
if (filled.length) {
  console.log(`   전문이 없어 표준 전문으로 채운 패키지 ${filled.length}개 (정형문이라 동일)`);
}
if (missing.length) {
  console.warn(`⚠️  라이선스 전문을 못 찾은 패키지 ${missing.length}개 — 직접 확인 필요:`);
  console.warn('   ' + missing.map((p) => `${p.name} (${p.license})`).join(', '));
  console.warn('   MIT·BSD 는 전문에 저작권자가 들어가서 다른 패키지 것을 쓸 수 없다.');
}
if (unknown.length) {
  console.warn(`⚠️  라이선스를 알 수 없는 패키지 ${unknown.length}개 — 직접 확인 필요:`);
  console.warn('   ' + unknown.map((p) => p.name).join(', '));
}
