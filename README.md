# webrtc-p2p-poc
P2P 방식 WebRTC의 다대다 연결 성능 검증 프로젝트


## 📋 프로젝트 목표

**스터디 플랫폼에서 P2P WebRTC로 몇 명까지 안정적인 화상통화가 가능한지 실제 데이터로 검증**

- 개발 기간(3.5주)과 인프라 제약(AWS 프리티어) 고려시 P2P vs SFU 기술적 의사결정 필요
- 이론이 아닌 **실제 측정 데이터** 기반으로 최대 수용 인원 결정
- 팀 전체가 납득할 수 있는 구체적 근거 자료 확보

## 🛠️ 기술 스택

- **Backend**: Spring Boot, WebSocket, STOMP
- **Frontend**: HTML5, JavaScript, WebRTC API
- **Test**: Performance Monitoring, WebRTC Stats API
- **Infrastructure**: 로컬 개발 환경

## 📊 핵심 테스트 결과

### 2명 연결 - 우수
⇒ 우수 ✅
(https://github.com/user-attachments/assets/8c91f7c2-948f-425a-aa1b-cb0019bd7bdd)

### 4명 연결 - 안정적
⇒ 종종 양호 또는 불량으로 바뀔 때가 있으나 대부분 우수 ✅
(https://github.com/user-attachments/assets/00904a40-66ef-4fab-bcbb-3ab5ecd69593)

### 5명 연결 - 경계선
⇒ 우수와 불량 상태 계속 반복됨
(https://github.com/user-attachments/assets/06c79756-5579-44a8-8ec7-765ab7052af4) 
(https://github.com/user-attachments/assets/16d8367e-8038-4da6-9a16-0cbd32587dc6)

### 6명 연결 - 한계 도달
⇒ 우수/양호/보통으로 바뀔 때가 있으나 대체로 불량 ❌
(https://github.com/user-attachments/assets/824ebf97-2c10-4e81-adb8-535cece44913)

### 6명 연결 (오디오만) - 안정적
⇒ 가끔 불량으로 바뀔 때가 있으나 대부분 우수 ✅
(https://github.com/user-attachments/assets/020a2443-e9fa-4303-87d1-6f0ff2e4de18)


## 🎯 최종 결론

### ✅ 권장 사항
**P2P WebRTC 방식 채택, 최대 4명 제한**
- 4명까지는 안정적인 성능 (지연시간 21ms)
- 6명부터 사용성이 급격히 떨어짐 (3초 이상 지연)
- 현재 인프라와 개발 기간에 최적화된 선택

### 📈 비즈니스 임팩트
- **타겟**: 소규모 집중 스터디 그룹
- **차별점**: "4명 이하 고품질 스터디" 컨셉
- **기술 리스크**: 최소화 (검증된 기술 스택)

## 🚀 Quick Start

### 1. 백엔드 실행
BackApplication.main() 실행 (Spring Boot 서버 시작)


### 2. 테스트 진행
1. `http://localhost:8080/index.html` 접속
2. 첫 번째 탭에서 방 입장
3. 추가 탭으로 순차적 참여 (최대 6명)
4. 실시간 성능 지표 모니터링

## 📁 프로젝트 구조

```
webrtc-p2p-poc/
├── src/main/java/com/back/
│   ├── config/                 # WebSocket, CORS 설정
│   ├── controller/             # WebRTC 메시지 중계
│   ├── dto/                    # 메시지 객체들
│   └── service/                # 방 관리 로직
└── src/main/resources/static/
    ├── index.html              # 메인 UI
    ├── css/style.css
    └── js/                     # WebRTC, WebSocket 클라이언트
        ├── webrtc-client.js
        ├── websocket-client.js
        └── performance-monitor.js
```

## 🔧 핵심 구현 사항

### WebSocket 시그널링
- STOMP 프로토콜 기반 실시간 메시지 교환
- 방 토픽 브로드캐스트 + 클라이언트 필터링 방식
- Offer/Answer/ICE Candidate 중계

### P2P 연결 관리
- RTCPeerConnection 다중 관리
- 자동 미디어 스트림 추가/제거
- 연결 상태 모니터링 및 재연결

### 실시간 성능 측정
- WebRTC Stats API 활용
- 네트워크 사용량, 지연시간, 품질 지표
- 브라우저 Performance API 연동

## 🐛 주요 해결 이슈

### WebSocket 메시지 라우팅 문제
**문제**: 개인 메시지 큐(`/user/queue/webrtc`)로 전송한 Offer/Answer가 클라이언트에 도달하지 않음

**해결**: 방 토픽(`/topic/room/{roomId}`) + 타겟 사용자 지정 방식으로 변경
```java
// Before (실패)
messagingTemplate.convertAndSendToUser(userId, "/queue/webrtc", message);

// After (성공)
signalData.put("targetUserId", targetUserId);
messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
```