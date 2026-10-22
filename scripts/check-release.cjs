'use strict';
// 不访问网络、不修改文件：检查源码和可发布静态包的结构。
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const references = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(m => m[1]);
assert.ok(references.length >= 10, '缺少预期资源');
for (const ref of references) {
  const target = path.resolve(root, ref);
  assert.ok(target.startsWith(root + path.sep), `资源越出项目：${ref}`);
  assert.ok(fs.existsSync(target), `缺少资源：${ref}`);
  // 保留相对结构后，任意仓库名都应映射到同一路径。
  const deployed = new URL(ref, 'https://example.invalid/custom-repository/');
  assert.equal(deployed.pathname, '/custom-repository/' + ref.slice(2));
}
assert.ok(!/<(?:script|link)\b[^>]*(?:src|href)="(?:https?:|\/)/.test(html), '运行资源不得依赖根路径或外部 CDN');
assert.ok(fs.existsSync(path.join(root, '.nojekyll')), '缺少 .nojekyll');
const scripts = references.filter(ref => ref.endsWith('.js'));
for (const ref of scripts) {
  const check = spawnSync(process.execPath, ['--check', path.resolve(root, ref)], { encoding: 'utf8' });
  assert.equal(check.status, 0, `语法检查失败：${ref}\n${check.stderr}`);
}
for (const file of ['README.md', ...fs.readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.md')).map(f => 'docs/' + f)]) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(?:https?:|#)/.test(target)) continue;
    const resolved = path.resolve(path.dirname(path.join(root, file)), target.split('#')[0]);
    assert.ok(fs.existsSync(resolved), `${file} 引用了缺失文件：${target}`);
  }
}
assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), /尚未发布到 GitHub Pages/);
console.log(`通过：${references.length} 个相对资源、${scripts.length} 个脚本语法、文档内部链接和静态发布标记。`);
console.log('路径检查不代表真实 GitHub Pages 已部署；PDF 成品仍待验收。');
