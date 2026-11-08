// 서버 주소와 공개 키(Supabase 프로젝트 설정 → API의 Project URL과 anon public key). 비어 있으면 테스트 서버(이 브라우저 안)로 돈다.
// 공개 키만 넣는다. service_role 키는 절대 넣지 않는다(docs/SUPABASE.md)
const SERVER_CONFIG = {
    url: '',
    anonKey: ''
};
