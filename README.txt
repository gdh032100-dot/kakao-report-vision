점포 보고서 Vision 서버 버전

중요:
이 버전은 OpenAI API 키가 있어야 작동합니다.
API 키는 index.html에 넣지 말고 Netlify 환경변수로 설정해야 합니다.

배포:
1. ZIP 압축을 풉니다.
2. 폴더 전체를 GitHub 저장소에 올립니다.
3. Netlify에서 Add new site > Import an existing project로 GitHub 저장소를 연결합니다.
4. Netlify > Site configuration > Environment variables에서 추가:
   OPENAI_API_KEY = 본인의 OpenAI API 키
   선택: OPENAI_VISION_MODEL = gpt-4.1-mini
5. Deploy site 또는 Trigger deploy를 실행합니다.

주의:
- 기존 Netlify 수동 ZIP 배포로는 서버 함수가 정상 배포되지 않을 수 있어 GitHub 연결 배포를 권장합니다.
- OpenAI API 사용료가 발생합니다.
- 사진은 분석을 위해 OpenAI API로 전송됩니다.
