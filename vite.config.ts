import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

// ════════════════════════════════════════════════════════════
//  AURORA 빌드 진입점 (Entry Points) 관리
// ════════════════════════════════════════════════════════════
//
//  새 UI 페이지를 추가할 때 이 객체에만 한 줄 추가하면 됩니다.
//  예시:
//    popup:   'src/popup/popup.html',
//    options: 'src/options/options.html',
//    youtube: 'src/content/youtube-enhancer.ts',
//
//  추가 후 반드시 npm run build 실행!
//
//  ┌────────────────────────────────────────────────────┐
//  │  현재 활성화된 진입점                               │
//  │  sidepanel → Aurora Chat 메인 UI                   │
//  └────────────────────────────────────────────────────┘
// ════════════════════════════════════════════════════════════

const ENTRIES: Record<string, string> = {
  // ── 현재 활성 ─────────────────────────────────────────
  sidepanel: 'src/sidepanel/sidepanel.html',

  // ── PHASE 2: 필요할 때 주석 해제 ─────────────────────

  // popup: 'src/popup/popup.html',
  // ↑ 크롬 툴바 Aurora 아이콘 클릭 시 뜨는 팝업
  //   (여러 AI 빠른 접근, 설정 단축키 등)
  //   주의: manifest.json의 "action" 에 "default_popup" 도 추가 필요

  // options: 'src/options/options.html',
  // ↑ Aurora 설정 페이지
  //   (Notion API 키, OpenAI 키, 테마 설정 등)
  //   주의: manifest.json의 "options_page" 에도 경로 추가 필요
}

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: ENTRIES,
    },
  },
})
