// ── Aurora: YouTube Summarizer ────────────────────────────────
// 유튜브 /watch 페이지에서 "Aurora 영상 요약" 버튼을 주입합니다.

export function initYouTubeSummarizer(): void {
  if (!window.location.hostname.includes('youtube.com')) return

  let lastHref = location.href

  // ── 버튼 주입 ───────────────────────────────────────────────
  const tryInject = (): void => {
    if (!location.pathname.startsWith('/watch')) return
    if (document.getElementById('aurora-yt-summary-btn')) return

    // 제목 컨테이너가 렌더링될 때까지 대기
    const titleEl = document.querySelector<HTMLElement>('#title h1')
      ?? document.querySelector<HTMLElement>('h1.ytd-watch-metadata')
    if (!titleEl) return

    const insertParent = titleEl.closest<HTMLElement>('#title, ytd-video-primary-info-renderer')
      ?? titleEl.parentElement
    if (!insertParent) return

    // ── 버튼 생성 ────────────────────────────────────────────
    const btn = document.createElement('button')
    btn.id = 'aurora-yt-summary-btn'
    btn.innerHTML = `
      <svg viewBox="0 0 100 100" width="13" height="13" fill="none" style="flex-shrink:0;display:block">
        <defs>
          <linearGradient id="ayt-g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fff" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#fff" stop-opacity="0.75"/>
          </linearGradient>
        </defs>
        <path d="M20 80L50 20L80 80" stroke="url(#ayt-g)" stroke-width="10"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M35 80L50 50L65 80" stroke="white" stroke-width="5"
              stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
      </svg>
      Aurora 영상 요약
    `

    Object.assign(btn.style, {
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '6px',
      marginTop:     '10px',
      marginBottom:  '4px',
      padding:       '7px 16px',
      background:    'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
      color:         '#fff',
      border:        'none',
      borderRadius:  '20px',
      fontSize:      '13px',
      fontWeight:    '600',
      fontFamily:    'system-ui, -apple-system, sans-serif',
      cursor:        'pointer',
      boxShadow:     '0 2px 12px rgba(139,92,246,0.45)',
      transition:    'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
      letterSpacing: '0.015em',
      lineHeight:    '1',
      whiteSpace:    'nowrap',
    })
    btn.style.setProperty('z-index', '9999', 'important')

    btn.addEventListener('mouseenter', () => {
      btn.style.opacity   = '0.9'
      btn.style.transform = 'translateY(-1px)'
      btn.style.boxShadow = '0 4px 18px rgba(139,92,246,0.6)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity   = '1'
      btn.style.transform = 'translateY(0)'
      btn.style.boxShadow = '0 2px 12px rgba(139,92,246,0.45)'
    })
    btn.addEventListener('mousedown', () => { btn.style.transform = 'translateY(0) scale(0.97)' })
    btn.addEventListener('mouseup',   () => { btn.style.transform = 'translateY(-1px) scale(1)' })

    // ── 클릭: 메타데이터 추출 → background로 전송 ────────────
    btn.addEventListener('click', () => {
      const title = (
        document.querySelector<HTMLElement>('#title h1 yt-formatted-string')?.textContent
        ?? document.querySelector<HTMLElement>('h1.ytd-watch-metadata yt-formatted-string')?.textContent
        ?? document.querySelector<HTMLElement>('#title h1')?.textContent
        ?? document.title
      ).trim()

      const channel = (
        document.querySelector<HTMLElement>('ytd-channel-name#channel-name yt-formatted-string a')?.textContent
        ?? document.querySelector<HTMLElement>('#channel-name a')?.textContent
        ?? document.querySelector<HTMLElement>('ytd-channel-name a')?.textContent
        ?? ''
      ).trim()

      const descEl =
        document.querySelector<HTMLElement>('#description-inline-expander yt-attributed-string')
        ?? document.querySelector<HTMLElement>('ytd-text-inline-expander yt-attributed-string')
        ?? document.querySelector<HTMLElement>('#description')
      const description = (descEl?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 500)

      try {
        chrome.runtime.sendMessage({
          type:    'YOUTUBE_SUMMARY_REQUEST',
          payload: { title, channel, description },
        })
      } catch { /* extension context invalidated */ }
    })

    insertParent.appendChild(btn)
  }

  // ── MutationObserver: 렌더링 완료 + SPA 이동 감지 ─────────
  const observer = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href
      document.getElementById('aurora-yt-summary-btn')?.remove()
      // 새 페이지 DOM이 안정될 때까지 짧게 대기
      setTimeout(tryInject, 1000)
    } else {
      tryInject()
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  tryInject()
}
