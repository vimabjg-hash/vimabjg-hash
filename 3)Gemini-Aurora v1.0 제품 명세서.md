Aurora v1.0 제품 명세서 (Product Specification)
1. 프로젝트 개요
프로젝트명: Aurora (오로라)

플랫폼: Google Chrome Extension (Manifest V3)

핵심 가치: 웹 서핑, 문서 작성, 영상 시청 등 사용자의 모든 브라우저 경험을 보조하는 '나만의 올인원 개인 AI 비서'

지원 AI 모델: * Cloud AI: Gemini 2.5 Flash (빠르고 강력한 추론)

Local AI: Gemini Nano (크롬 내장 온디바이스 AI, 오프라인/무료 작동)

2. 핵심 기능 명세 (Core Features)
① 스마트 드래그 & 팝업 툴바 (Selection Toolbar)
기능: 웹페이지에서 텍스트를 드래그(마우스)하거나 키보드(Shift+방향키, Ctrl+A)로 선택 시 즉시 플로팅 툴바 제공.

스마트 모드 전환:

읽기 모드 (Read Mode): 일반 웹페이지 텍스트 선택 시 요약, 번역, 설명 등 정보 획득 도구 제공.

쓰기 모드 (Write Mode): 입력창(input, textarea, Notion/ChatGPT 등 contenteditable 요소)에서 텍스트 선택 시 문법 교정, 톤앤매너 변경, 이어서 쓰기 도구 제공 및 [바꾸기] 기능 지원.

결과 출력: 플로팅 쉘(Floating Shell) 팝업을 통해 화면 전환 없이 그 자리에서 즉시 AI 답변 확인.

② 사이드패널 챗 & 히스토리 (Side Panel Chat)
기능: 브라우저 우측에 상시 띄워놓고 대화할 수 있는 persistent 채팅 인터페이스.

대화 기록 저장: chrome.storage.local을 활용해 이전 대화 내역(Session)을 영구 보관.

히스토리 관리: 상단 [🕒 기록] 버튼으로 과거 대화 열람, [✨ 새 채팅] 버튼으로 대화방 초기화.

③ 빠른 검색 론처 (Quick Launcher / Spotlight)
기능: 단축키 Alt + J 입력 시 화면 정중앙에 호출되는 Mac Spotlight 형태의 초고속 검색창.

UX 고도화:

화면 중앙 팝업 후 외부 클릭 시 유지 (작업 흐름 방해 방지).

마우스 드래그로 위치 이동 및 우측 하단 리사이징 지원.

ESC 키 또는 [X] 버튼으로 즉시 종료.

(참고: 크롬 보안 정책상 론처에서는 Gemini Nano 직접 호출이 제한되며, 우회 안내 메시지 제공)

④ 맥락 인식 기능 (Context Awareness)
현재 페이지 읽기 (Chat with Webpage): 사이드패널 하단 [📄 현재 페이지 컨텍스트 포함] 체크박스 활성화 시, 백그라운드에서 현재 탭의 텍스트를 최대 3만 자까지 추출하여 AI에게 문맥으로 전달.

유튜브 비디오 요약 (YouTube Summarizer): 유튜브 영상(youtube.com/watch) 시청 중 제목 하단에 주입된 [✨ Aurora 영상 요약] 버튼 클릭 시, 영상 메타데이터(제목, 채널명, 설명)를 추출하여 사이드패널에서 즉시 자동 요약 진행.

⑤ 초고속 액션 (Quick Actions)
우클릭 컨텍스트 메뉴: 텍스트 선택 후 마우스 우클릭 시 [✨ Aurora로 요약하기], [🌐 Aurora로 번역하기] 메뉴 제공. 클릭 시 사이드패널이 열리며 자동 실행.

슬래시 명령어 (Slash Commands): 채팅 입력창에서 특정 키워드 입력 후 스페이스바를 누르면 완성형 프롬프트로 자동 치환.

/요약  → "다음 텍스트의 핵심 내용을 3줄로 요약해 줘:\n\n"

/번역  → "다음 텍스트를 자연스럽고 매끄러운 한국어로 번역해 줘:\n\n"

/코드  → "다음 코드의 동작 원리를 초보자도 이해하기 쉽게 단계별로 설명해 줘:\n\n"

/메일  → "다음 내용을 바탕으로 정중하고 프로페셔널한 비즈니스 이메일을 작성해 줘:\n\n"

3. UI/UX 및 디자인 시스템 (Rendering)
다크 테마 기반: #1e1e2e, #313244 등의 세련된 다크 테마 팔레트 적용 (Sider / Notion 스타일).

마크다운 및 코드 하이라이팅: * marked, highlight.js를 사용해 AI 답변을 완벽한 마크다운 UI(표, 굵은 글씨, 목록 등)로 렌더링.

코드 블록 시각화 보장 (DOMPurify 보안 필터 우회 설정 및 인라인 스타일 강제 주입).

코드 복사 버튼: 생성된 코드 블록 우측 상단에 [복사] 버튼을 부착하여 1-Click 클립보드 복사 지원 (복사 시 "✔ 복사됨" 피드백 제공).

4. 기술 스택 및 주요 권한 (Tech Stack & Permissions)
언어 및 도구: TypeScript, Node.js (npm run build), Claude Code (AI 코딩 어시스턴트)

주요 라이브러리: marked (마크다운 파싱), highlight.js (문법 색칠), DOMPurify (XSS 보안 처리)

Chrome 확장 프로그램 권한 (manifest.json):

sidePanel: 사이드패널 UI 제공

storage: 설정 값 및 채팅 기록 로컬 저장

scripting & tabs: 활성 탭 텍스트 추출 (페이지 컨텍스트)

contextMenus: 우클릭 메뉴 추가

host_permissions ("<all_urls>"): 모든 웹사이트에서 툴바 팝업 및 DOM 접근 권한 획득