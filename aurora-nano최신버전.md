[상황 및 목표]
나는 현재 Chrome 146 이상 버전에서 내장 AI (Gemini Nano, LanguageModel API)를 활용하는 'Aurora(오로라)'라는 크롬 확장 프로그램을 개발 중이야. 기존 코드의 문제점을 수정하고, 아키텍처를 최적화해 줘.

[수정 요청 사항 1: Nano 다국어 경고 우회 및 메타 프롬프팅 적용]
기존에는 Nano 호출 시 outputLanguage를 'ko' 또는 'ja'로 직접 설정했으나, 크롬 콘솔에서 미지원 언어 경고가 발생해. 이를 해결하기 위해 다음 전략을 코드에 적용해 줘.

API 호출 규격을 최신 포맷인 expectedOutputs: [{ type: "text", languages: ["en"] }]으로 변경해서 경고를 원천 차단해 줘.

언어를 영어(en)로 설정했기 때문에, AI가 한국어로 대답하도록 강력한 systemPrompt를 영어로 부여해 줘. (예: "You are a brilliant AI assistant. Think in English for optimal logic, but you MUST output your final answer entirely in Korean.")

사용자의 한국어 질문을 받아 영어 지시문(캡슐) 안에 넣어서 session.prompt()에 전달하는 래퍼(Wrapper) 함수 로직으로 코드를 수정해 줘.

[수정 요청 사항 2: TypeScript 확장자 로드 오류 해결]
현재 확장 프로그램을 크롬에 로드할 때 manifest.json에서 src/background/index.ts 등 .ts 파일을 직접 호출하여 Invalid script mime type 에러 (Status code: 11)가 발생하고 있어.
크롬 브라우저는 .ts 파일을 직접 읽을 수 없으므로, 현재 내 프로젝트 환경(Vite, Webpack, 혹은 tsc 등)에 맞춰서 코드를 .js로 올바르게 빌드(Build)하고 적용할 수 있는 정확한 해결책과 수정된 manifest.json 코드를 제시해 줘.