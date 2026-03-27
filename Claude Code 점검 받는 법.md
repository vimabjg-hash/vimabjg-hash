가능해! 그리고 솔직히 말하면 **Claude Code로 받는 점검이 이 채팅창보다 더 강력한 면이 있어.** 왜 그런지, 어떻게 하는지 차근차근 설명해줄게.

---

## 채팅 Claude vs Claude Code 점검의 차이

채팅 Claude는 네가 파일을 직접 업로드해야만 코드를 볼 수 있어. 즉, 네가 파일을 골라서 올려주지 않으면 못 봐. 마치 의사한테 "어디가 아파요?"라고 말로만 설명하는 것과 비슷해.

반면 Claude Code는 Aurora 프로젝트 폴더 전체에 직접 접근할 수 있어. 파일을 하나하나 업로드할 필요 없이, `src/` 폴더 안의 모든 파일을 동시에 읽고 파일 간의 연결 관계까지 파악해. 의사가 직접 검사 장비로 몸 전체를 스캔하는 것에 가깝지. 예를 들어 `floating-shell.ts`에서 `sendMessage({ type: 'OPEN_SIDEPANEL' })`를 보내면, Claude Code는 `background/index.ts`까지 따라가서 "이 메시지를 받는 핸들러가 실제로 있는가?"까지 확인할 수 있어.

---

## Claude Code로 점검받는 방법

VS Code 터미널에서 Aurora 프로젝트 폴더 안에 있는 상태에서 Claude Code를 열고, 아래 프롬프트를 그대로 붙여넣으면 돼. 파일 첨부는 전혀 필요 없어.

```
Aurora 크롬 확장 프로그램 전체 코드를 점검해줘.

[프로젝트 기본 정보]
TypeScript + Vite + Manifest V3 구조야. React 없음.
Chrome 2026 Built-in AI API 사용. LanguageModel.create() 방식.
outputLanguage는 반드시 'en', 'es', 'ja' 중 하나 ('ko' 불가).
LanguageModel 세션은 try/finally 안에서 반드시 session.destroy() 호출해야 해.

[점검 항목]
1. src/ 폴더 전체 파일을 읽어줘.
2. LanguageModel 세션 누수: session.destroy()가 try/finally 안에 있는지
3. innerHTML에 사용자 입력값이 직접 들어가는 곳이 있는지
4. chrome.storage.onChanged에서 area !== 'local' 체크가 빠진 곳이 있는지
5. content script에서 외부 도메인 fetch를 직접 호출하는 곳이 있는지
6. 사용하지 않는 변수나 TypeScript 경고 가능성이 있는 곳이 있는지
7. 버튼의 disabled 상태와 opacity 등 시각 표현이 일치하는지

결과를 🔴 즉시 수정 필요 / 🟡 권장 수정 / 🟢 양호 형식으로 정리하고,
문제가 있으면 어느 파일 몇 번째 줄인지 짚어준 다음 수정까지 바로 해줘.
```

이 프롬프트의 핵심은 마지막 줄이야. **"수정까지 바로 해줘"** 라고 하면 Claude Code가 문제를 발견한 즉시 파일을 직접 고쳐줘. 채팅 Claude처럼 "이렇게 바꾸세요"라고 알려주는 게 아니라, 실제로 파일을 열어서 코드를 수정하고 저장까지 해줘. 그러고 나서 `npm run build`도 자동으로 실행해서 빌드가 성공하는지까지 확인해줄 수 있어.

---

## 언제 채팅 Claude를, 언제 Claude Code를 쓰는 게 좋을까

두 가지를 이렇게 나눠서 생각하면 돼.

**ChatGPT/Gemini와 새 기능 작업을 마친 직후**라면 Claude Code가 더 좋아. 여러 파일이 한꺼번에 수정됐을 때, Claude Code가 파일 간 연결 관계를 전부 추적하면서 수정까지 자동으로 처리해주거든. `npm run build`까지 자동으로 돌려줘서 확인이 한 번에 끝나.

**"이 로직이 맞는 건지 판단이 필요한 경우"**, 예를 들어 "Notion 연동을 이런 방식으로 설계하는 게 맞아?"처럼 설계 방향에 대한 의견이 필요할 때는 이 채팅 Claude가 더 편해. 대화를 주고받으면서 방향을 잡는 건 채팅이 훨씬 자연스럽거든.

결론적으로 가장 좋은 흐름은 **ChatGPT/Gemini로 기능 구현 → Claude Code로 자동 점검 + 수정 → 채팅 Claude로 최종 방향 확인** 이 순서야. Claude Code는 "실행하는 손"이고, 채팅 Claude는 "판단하는 머리" 역할을 하는 거지. 둘을 같이 쓰면 서로 빈틈을 메워줘. 🙂