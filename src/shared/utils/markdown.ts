// ── Aurora: Markdown → Safe HTML ─────────────────────────────
// marked v12 : 마크다운 → HTML 변환
// highlight.js : 코드 블록 신택스 하이라이팅
// DOMPurify   : XSS 방지 새니타이즈

import { marked, Renderer } from 'marked'
import hljs from 'highlight.js/lib/core'
import DOMPurify from 'dompurify'

// 자주 쓰이는 언어만 등록 (번들 크기 최소화)
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python     from 'highlight.js/lib/languages/python'
import bash       from 'highlight.js/lib/languages/bash'
import json       from 'highlight.js/lib/languages/json'
import css        from 'highlight.js/lib/languages/css'
import xml        from 'highlight.js/lib/languages/xml'
import sql        from 'highlight.js/lib/languages/sql'
import markdown   from 'highlight.js/lib/languages/markdown'
import plaintext  from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js',         javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts',         typescript)
hljs.registerLanguage('python',     python)
hljs.registerLanguage('py',         python)
hljs.registerLanguage('bash',       bash)
hljs.registerLanguage('sh',         bash)
hljs.registerLanguage('json',       json)
hljs.registerLanguage('css',        css)
hljs.registerLanguage('html',       xml)
hljs.registerLanguage('xml',        xml)
hljs.registerLanguage('sql',        sql)
hljs.registerLanguage('markdown',   markdown)
hljs.registerLanguage('plaintext',  plaintext)

// highlight.js 다크 테마 CSS
import 'highlight.js/styles/github-dark.css'

// ── 코드 블록 투명화 방지 CSS 강제 주입 ──────────────────────
;(function injectHljsOverride() {
  const ID = 'aurora-hljs-override'
  if (document.getElementById(ID)) return
  const style = document.createElement('style')
  style.id = ID
  style.textContent = `
    pre { background: #181825 !important; border-radius: 8px; padding: 12px 14px; overflow-x: auto; margin: 8px 0; }
    pre code, pre code span { color: #cdd6f4 !important; }
    pre code.hljs, pre code { background: transparent !important; display: block; text-shadow: none; }
  `
  ;(document.head ?? document.documentElement).appendChild(style)
})()

// ── marked v12 렌더러 (순수 객체 방식 — 타입 충돌 없음) ──────
function highlight(code: string, lang: string | undefined): string {
  if (!code) return ''
  try {
    const validLang = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language: validLang }).value
  } catch {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}

// marked v12+ Token 객체 대응 렌더러 (new Renderer() 방식)
const renderer = new marked.Renderer()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
renderer.code = function(token: any): string {
  // marked v12+는 code()에 문자열이 아닌 Token 객체를 전달함
  let codeText = ''
  let lang     = 'plaintext'

  if (typeof token === 'object' && token !== null) {
    codeText = token.text  || ''
    lang     = token.lang  || 'plaintext'
  } else {
    codeText = typeof token === 'string' ? token : ''
  }

  const validLang = hljs.getLanguage(lang) ? lang : 'plaintext'
  let highlighted  = codeText
  try {
    highlighted = hljs.highlight(codeText, { language: validLang }).value
  } catch (e) {
    console.error('[Aurora] 하이라이팅 에러:', e)
  }

  return (
    `<div class="aurora-code-block" style="position:relative;margin:10px 0;">` +
      `<button class="aurora-copy-btn" style="position:absolute;top:8px;right:8px;background:#313244;color:#a6adc8;border:1px solid #45475a;border-radius:4px;padding:4px 8px;font-size:12px;cursor:pointer;z-index:10;">복사</button>` +
      `<pre style="background:#1e1e2e;padding:12px;padding-top:35px;border-radius:8px;overflow-x:auto;margin:0;">` +
        `<code class="hljs ${validLang}" style="color:#cdd6f4;display:block;">${highlighted}</code>` +
      `</pre>` +
    `</div>`
  )
}

marked.use({ renderer, gfm: true, breaks: true })

// ── 공개 API ──────────────────────────────────────────────────
export function renderMarkdown(rawText: string): string {
  if (!rawText) return ''
  const html = marked.parse(rawText) as string
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a',
      'p', 'br', 'u', 's', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'pre', 'code',
      'hr', 'span',
      'div', 'button',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    // ALLOWED_ATTR로 전체 명시 — ADD_ATTR과 달리 class/style이 절대 지워지지 않음
    ALLOWED_ATTR: ['href', 'title', 'class', 'className', 'style', 'target'],
    KEEP_CONTENT: true,
  })
}
