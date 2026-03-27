현재 UI/UX 고도화 작업을 위해, 다른 AI(특히 Claude Code 등)에게 전달하기 좋도록 **Aurora 프로젝트의 현재 상태와 핵심 변경 사항**을 정리해 드립니다. 이 내용을 복사해서 사용하시면 됩니다.

---

```
# 🛠️ Aurora 프로젝트 현황 요약 (AI 전달용)

## 1. 프로젝트 개요 및 기술 스택

- **이름:** Aurora (개인용 AI 비서 크롬 확장 프로그램)
    
- **기술 스택:** TypeScript, Vite, @crxjs/vite-plugin, Manifest V3 (MV3)
    
- **UI 원칙:** **No React**. 순수 DOM 조작(Vanilla TS)만 사용하며, `css()` 헬퍼 함수로 인라인 스타일 관리
    
- **핵심 엔진:** Chrome 내장 Gemini Nano (`LanguageModel` API)
    

## 2. 주요 UI/UX 구현 상태 (기존 작업 완료 내용)

현재 Aurora는 웹페이지 내 팝업(Floating Shell)과 사이드패널(Sidepanel)이 유기적으로 연결된 구조입니다.

- **선택 툴바 (Selection Toolbar):** 웹페이지에서 텍스트 드래그 시 `mouseup` 이벤트로 등장. 번역, 요약, 다듬기, 질문, 저장 아이콘 제공
    
- **AI 팝업 카드 (Floating Shell):** - 드래그 영역 바로 근처에 생성되며 드래그 이동 가능
    
    - **로딩 애니메이션:** "● ● ●" 형태의 점 바운스 애니메이션 적용
        
    - **결과 제어:** 답변 복사, 원문과 바꾸기, "패널에서 계속" 버튼 포함
        
    - **추가 질문:** 결과 하단에 바로 질문을 이어갈 수 있는 입력창 내장
        
- **사이드패널 (Aurora Chat):** - 채팅 말풍선 UI 기반
    
    - 팝업에서 "패널에서 계속" 클릭 시, `chrome.storage.local`을 통해 맥락(Context)을 전달받아 대화 연결
        
    - **히스토리 뷰:** 저장한 하이라이트 목록 확인 및 삭제 기능
        
- **슬림 사이드바:** 사이드패널 우측에 채팅/히스토리/설정 탭 전환을 위한 60px 너비의 고정 바
    

## 3. 핵심 로직 및 AI 프롬프팅 규칙 (중요)

다른 AI가 코드를 수정할 때 반드시 지켜야 할 Aurora만의 규칙입니다.

- **언어 설정:** - 기존에는 에러 방지를 위해 `outputLanguage: 'ja'`를 사용했으나, 현재 **Chrome Canary (Enabled Multilingual 플래그)** 환경에서는 `outputLanguage: 'ko'`를 사용해도 경고만 뜨고 정상 작동함
    
    - **한국어 강제:** `STRICT_LANGUAGE_RULE`을 시스템 프롬프트에 주입하여 모델이 일본어를 섞지 않고 100% 한국어로만 답변하게 강제함
        
- **응답 추출 (`[RESULT]` 태그):** AI 응답의 서론/결론을 제거하고 핵심만 출력하기 위해 `[RESULT]`와 `[/RESULT]` 태그 사이에만 답변하도록 강제하고, 이를 정규식으로 추출함
    
- **인칭 보존 (Identity Guard):** 한국어 답변 시 AI가 '나/너'를 '저/당신'으로 임의 수정하는 것을 방지하는 자가 교정 로직 포함
    
- **리소스 관리:** `session.destroy()`를 반드시 `try/finally` 문 안에서 호출하여 메모리 누수 방지
    

## 4. 메시징 및 데이터 흐름

- **Background Service Worker:** 메시지 라우터 핸들러 패턴(`HANDLERS` 객체)을 사용하여 기능 확장이 용이하도록 설계됨
    
- **외부 API 차단:** MV3 보안 정책에 따라 Content Script에서 직접 `fetch` 하지 않고, 반드시 Background를 통해 외부 요청(Notion 등)을 중계함
    
```

---

**AI에게 작업 요청 시 팁:** 위 내용과 함께 이전에 제공해 드린 **`Aurora_ClaudeCode_작업명세서.md`** 파일을 같이 전달하면, AI가 프로젝트의 설계 원칙을 완벽하게 이해하고 UI/UX 고도화 작업을 진행할 수 있습니다.