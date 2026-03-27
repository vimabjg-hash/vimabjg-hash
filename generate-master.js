// generate-master.js
const fs = require('fs');
const path = require('path');

// 🚫 AI에게 먹이면 안 되는(토큰만 낭비하는) 폴더와 파일들
const IGNORE_DIRS = ['node_modules', 'dist', '.git', '.vscode'];
const IGNORE_FILES = ['package-lock.json', 'yarn.lock', 'generate-master.js', 'aurora_master.md', 'README.md'];

// ✅ AI에게 읽힐 파일 확장자 지정
const ALLOWED_EXTENSIONS = ['.ts', '.html', '.json', '.css'];

const ROOT_DIR = __dirname;
const OUTPUT_FILE = path.join(ROOT_DIR, 'aurora_master.md');

// 파일 내용을 읽어서 마크다운 형식으로 변환하는 함수
function getFileExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.ts') return 'typescript';
  if (ext === '.json') return 'json';
  if (ext === '.html') return 'html';
  if (ext === '.css') return 'css';
  return '';
}

function traverseDirectory(currentPath, relativePath = '') {
  let output = '';
  const items = fs.readdirSync(currentPath);

  for (const item of items) {
    const itemPath = path.join(currentPath, item);
    const itemRelativePath = path.join(relativePath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(item)) {
        output += traverseDirectory(itemPath, itemRelativePath);
      }
    } else {
      const ext = path.extname(item).toLowerCase();
      if (!IGNORE_FILES.includes(item) && ALLOWED_EXTENSIONS.includes(ext)) {
        const content = fs.readFileSync(itemPath, 'utf8');
        const lang = getFileExtension(item);
        
        // AI가 인식하기 가장 좋은 마크다운 포맷으로 합치기
        output += `\n## File: \`${itemRelativePath.replace(/\\/g, '/')}\`\n`;
        output += `\`\`\`${lang}\n`;
        output += content;
        output += `\n\`\`\`\n`;
      }
    }
  }
  return output;
}

console.log('🚀 오로라 마스터 파일 생성을 시작합니다...');
const finalMarkdown = `# Aurora Project Master Code\n\n` + traverseDirectory(ROOT_DIR);
fs.writeFileSync(OUTPUT_FILE, finalMarkdown, 'utf8');
console.log(`✅ 생성 완료! [ ${OUTPUT_FILE} ] 파일을 AI Studio에 드래그하세요.`);