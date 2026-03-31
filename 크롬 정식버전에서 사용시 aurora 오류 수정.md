<<user>>
심호흡을 하고 체계적으로 작업해 주십시오. 당신은 상위 1%의 최고 수준 전문 AI 프롬프트 엔지니어이자 시니어 프론트엔드 확장 프로그램 개발자입니다. 

[Context]
나는 현재 "Aurora"라는 개인 전용 올인원 Chrome 확장 프로그램을 개발 중이다. (MV3, Vanilla TS, Vite 환경)
제공된 `Aurora_마스터_명세서_v1.md`와 `aurora_master.md` 코드를 완벽하게 숙지하라.
나의 최종 목표는 배포가 아닌 개인 사용이며, Sider, Monica, Merlin, MaxAI 등의 핵심 편의 기능과 아이디어를 참고하여 Aurora를 고도화하는 것이다.

[Intent]
첫 번째 최우선 과제는 **"정식 버전 Chrome 환경에서의 LanguageModel API 구동 오류(경고 누적 및 실행 실패) 해결"**이다.
명세서의 '규칙 1'에 명시된 바와 같이, 일반 Chrome 환경에서는 `outputLanguage: 'ko'`를 사용하면 에러가 발생하므로 이를 `'ja'`로 변경하고 `systemPrompt`에 `STRICT_LANGUAGE_RULE`을 주입하여 한국어 출력을 강제해야 한다. 
현재 코드베이스(`floating-shell.ts`, `sidepanel-app.ts`, `quick-launcher.ts` 등)를 스캔하여 해당 문제를 완벽하게 수정하라.
이 버그 수정이 완료되면, 향후 Sider/Monica/MaxAI에서 차용할 만한 매력적인 기능들을 제안하라.

[Constraints]
- 코드를 수정할 때는 기존의 바닐라 TS 및 DOM 조작 방식을 엄격히 유지하라 (React 등 도입 금지).
- 명세서의 절대 규칙 1~8을 무조건 준수하라.
- 답변 시 불필요한 서론이나 인사말은 생략하라.

[Internal Reasoning & Methodology]
- **QTM(쿼리 변환 모듈):** 내 요청을 'Chrome 안정화 버그 픽스'와 'UX/기능 확장 제안' 두 가지 핵심 포인트로 논리적으로 분해하여 접근하라.
- **AutoDSPy 원리 & BoT(사고 버퍼):** 단순히 코드를 고치는 것을 넘어, 과거 Chrome 내장 AI API 대응 경험을 인스턴스화하여 '어떻게 하면 가장 부작용 없이 systemPrompt로 한국어를 강제할 수 있는지' 연쇄 사고(CoT)를 통해 먼저 검증하라.

[Format]
답변은 반드시 아래의 XML 구조를 엄격하게 따르라. 

<reasoning>
1. 현재 코드에서 Chrome 정식 버전 오류를 유발하는 부분 스캔 및 원인 분석 결과.
2. 수정을 위한 최적의 코드 변경 전략 (어떤 파일의 어느 부분을 수정할 것인지 명시).
</reasoning>

<conclusion>
1. **[버그 픽스 코드]**: 수정이 필요한 파일명과 정확한 코드 블록(전체 코드가 아닌 수정된 함수나 블록만 제공).
2. **[기능 확장 제안]**: Chrome 에러 해결 이후 단계로 진행할, Sider/Monica/Merlin/MaxAI 기반의 Aurora 맞춤형 신규 기능 아이디어 3가지 (UI/UX 측면 포함).
</conclusion>
<<end>>