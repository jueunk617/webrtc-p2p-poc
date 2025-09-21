class WebSocketClient {
    constructor() {
        this.stompClient = null;
        this.connected = false;
        this.currentUserId = null;
        this.currentRoomId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    // WebSocket 연결
    async connect(userId, roomId) {
        return new Promise((resolve, reject) => {
            try {
                // SockJS 연결 생성 (상대 경로 사용)
                const socket = new SockJS('/ws');
                this.stompClient = Stomp.over(socket);

                // 디버그 로그 비활성화 (운영 환경용)
                this.stompClient.debug = null;

                // 연결 헤더에 사용자 정보 추가
                const connectHeaders = {
                    'userId': userId,
                    'roomId': roomId
                };

                // 연결 시도
                this.stompClient.connect(connectHeaders,
                    (frame) => {
                        log('✅ WebSocket 연결 성공: ' + frame);
                        this.connected = true;
                        this.currentUserId = userId;
                        this.currentRoomId = roomId;
                        this.reconnectAttempts = 0;

                        this.setupSubscriptions();
                        resolve();
                    },
                    (error) => {
                        log('❌ WebSocket 연결 실패: ' + error);
                        this.connected = false;
                        this.handleConnectionError(error);
                        reject(error);
                    }
                );

            } catch (error) {
                log('❌ WebSocket 연결 초기화 실패: ' + error.message);
                reject(error);
            }
        });
    }

    // 구독 설정
    setupSubscriptions() {
        if (!this.stompClient || !this.connected) return;

        try {
            // this 컨텍스트를 보존하기 위해 변수에 저장
            const self = this;

            // 개인 WebRTC 메시지 구독
            this.stompClient.subscribe('/user/queue/webrtc', function(message) {
                const data = JSON.parse(message.body);
                log(`📨 WebRTC 메시지 수신: ${data.type} from ${data.fromUserId}`);
                self.handleWebRTCMessage(data);
            });

            // 개인 룸 메시지 구독
            this.stompClient.subscribe('/user/queue/room', function(message) {
                const data = JSON.parse(message.body);
                log(`📨 룸 메시지 수신: ${data.type}`);
                self.handleRoomMessage(data);
            });

            // 에러 메시지 구독
            this.stompClient.subscribe('/user/queue/error', function(message) {
                const data = JSON.parse(message.body);
                self.handleErrorMessage(data);
            });

            // 방 토픽 구독
            if (this.currentRoomId) {
                this.stompClient.subscribe(`/topic/room/${this.currentRoomId}`, function(message) {
                    const data = JSON.parse(message.body);
                    log(`📺 룸 토픽 메시지: ${data.type} from ${data.fromUserId}`);
                    self.handleRoomTopicMessage(data);
                });
            }

            log('✅ 모든 구독 설정 완료');

        } catch (error) {
            log('❌ 구독 설정 실패: ' + error.message);
        }
    }

    // 방 입장 요청
    joinRoom(userId, roomId) {
        if (!this.stompClient || !this.connected) {
            log('❌ WebSocket 연결이 없습니다.');
            return;
        }

        try {
            const joinRequest = {
                userId: userId,
                roomId: roomId,
                userAgent: navigator.userAgent
            };

            this.stompClient.send('/app/room/join', {}, JSON.stringify(joinRequest));
            log(`📤 방 입장 요청 전송 - Room: ${roomId}, User: ${userId}`);

        } catch (error) {
            log('❌ 방 입장 요청 실패: ' + error.message);
        }
    }

    // 방 퇴장 요청
    leaveRoom() {
        if (!this.stompClient || !this.connected) return;

        try {
            const leaveRequest = {
                userId: this.currentUserId,
                roomId: this.currentRoomId
            };

            this.stompClient.send('/app/room/leave', {}, JSON.stringify(leaveRequest));
            log(`📤 방 퇴장 요청 전송 - Room: ${this.currentRoomId}, User: ${this.currentUserId}`);

        } catch (error) {
            log('❌ 방 퇴장 요청 실패: ' + error.message);
        }
    }

    // WebRTC Offer 전송
    sendOffer(toUserId, sdp) {
        if (!this.stompClient || !this.connected) return;

        try {
            const offerMessage = {
                fromUserId: this.currentUserId,
                toUserId: toUserId,
                sdp: sdp,
                roomId: this.currentRoomId
            };

            this.stompClient.send('/app/webrtc/offer', {}, JSON.stringify(offerMessage));
            log(`📤 Offer 전송 - To: ${toUserId}`);

        } catch (error) {
            log('❌ Offer 전송 실패: ' + error.message);
        }
    }

    // WebRTC Answer 전송
    sendAnswer(toUserId, sdp) {
        if (!this.stompClient || !this.connected) return;

        try {
            const answerMessage = {
                fromUserId: this.currentUserId,
                toUserId: toUserId,
                sdp: sdp,
                roomId: this.currentRoomId
            };

            this.stompClient.send('/app/webrtc/answer', {}, JSON.stringify(answerMessage));
            log(`📤 Answer 전송 - To: ${toUserId}`);

        } catch (error) {
            log('❌ Answer 전송 실패: ' + error.message);
        }
    }

    // ICE Candidate 전송
    sendIceCandidate(toUserId, candidate) {
        if (!this.stompClient || !this.connected) return;

        try {
            const candidateMessage = {
                fromUserId: this.currentUserId,
                toUserId: toUserId,
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMLineIndex,
                roomId: this.currentRoomId
            };

            this.stompClient.send('/app/webrtc/ice-candidate', {}, JSON.stringify(candidateMessage));
            log(`📤 ICE Candidate 전송 - To: ${toUserId}`);

        } catch (error) {
            log('❌ ICE Candidate 전송 실패: ' + error.message);
        }
    }

    // WebRTC 메시지 처리
    handleWebRTCMessage(message) {
        log(`📨 WebRTC 메시지 수신: ${message.type} from ${message.fromUserId}`);

        if (window.webrtcClient) {
            window.webrtcClient.handleSignalingMessage(message);
        }
    }

    // 룸 메시지 처리
    handleRoomMessage(message) {
        log(`📨 룸 메시지 수신: ${message.type}`);

        switch (message.type) {
            case 'room-state':
                this.handleRoomState(message.data);
                break;
            default:
                log(`⚠️ 알 수 없는 룸 메시지: ${message.type}`);
        }
    }

    // 룸 토픽 메시지 처리
    handleRoomTopicMessage(message) {
        const { type, fromUserId, data } = message;
        log(`📺 룸 토픽 메시지: ${type} from ${fromUserId}`);

        switch (type) {
            case 'user-joined':
                this.handleUserJoined(message);
                break;
            case 'user-left':
            case 'user-disconnected':
                this.handleUserLeft(message);
                break;
            case 'webrtc-signal':
                // WebRTC 시그널 메시지 처리
                this.handleWebRTCSignal(message);
                break;
            default:
                log(`⚠️ 알 수 없는 토픽 메시지: ${type}`);
        }
    }

    // WebRTC 시그널 메시지 처리 (새로 추가)
    handleWebRTCSignal(message) {
        const { fromUserId, data } = message;
        const { signalType, targetUserId, sdp, candidate, sdpMid, sdpMLineIndex } = data;

        // 나에게 온 메시지인지 확인
        if (targetUserId !== this.currentUserId) {
            log(`📝 다른 사용자용 WebRTC 메시지 무시: ${signalType} to ${targetUserId}`);
            return;
        }

        log(`📨 WebRTC 메시지 수신: ${signalType} from ${fromUserId}`);

        // WebRTC 클라이언트가 준비되었는지 확인
        if (!window.webrtcClient) {
            log('❌ WebRTC 클라이언트가 초기화되지 않았습니다.');
            return;
        }

        try {
            // 시그널 타입에 따라 메시지 변환
            let webrtcMessage;

            switch (signalType) {
                case 'offer':
                    webrtcMessage = {
                        type: 'offer',
                        fromUserId: fromUserId,
                        toUserId: targetUserId,
                        data: { sdp: sdp }
                    };
                    break;

                case 'answer':
                    webrtcMessage = {
                        type: 'answer',
                        fromUserId: fromUserId,
                        toUserId: targetUserId,
                        data: { sdp: sdp }
                    };
                    break;

                case 'ice-candidate':
                    webrtcMessage = {
                        type: 'ice-candidate',
                        fromUserId: fromUserId,
                        toUserId: targetUserId,
                        data: {
                            candidate: candidate,
                            sdpMid: sdpMid,
                            sdpMLineIndex: sdpMLineIndex
                        }
                    };
                    break;

                default:
                    log(`⚠️ 알 수 없는 WebRTC 시그널 타입: ${signalType}`);
                    return;
            }

            // WebRTC 클라이언트로 메시지 전달
            window.webrtcClient.handleSignalingMessage(webrtcMessage);

        } catch (error) {
            log('❌ WebRTC 시그널 처리 오류: ' + error.message);
            console.error('WebRTC 시그널 처리 오류:', error);
        }
    }

    // 사용자 입장 처리
    handleUserJoined(message) {
        const { fromUserId, data } = message;

        if (fromUserId === this.currentUserId) {
            // 내가 입장한 경우
            updateParticipants(data.participants);
            updateConnectionStatus(true);
        } else {
            // 다른 사용자가 입장한 경우
            updateParticipants(data.participants);

            if (window.webrtcClient) {
                window.webrtcClient.handleUserJoined(fromUserId);
            }
        }
    }

    // 사용자 퇴장 처리
    handleUserLeft(message) {
        const { fromUserId } = message;

        if (fromUserId !== this.currentUserId) {
            log(`👋 사용자 퇴장: ${fromUserId}`);

            if (window.webrtcClient) {
                window.webrtcClient.handleUserLeft(fromUserId);
            }
        }
    }

    // 룸 상태 처리
    handleRoomState(data) {
        const { participants, roomId, yourUserId } = data;

        log(`📊 룸 상태 업데이트 - Room: ${roomId}, 참여자: ${participants.length}명`);
        updateParticipants(participants);
    }

    // 에러 메시지 처리
    handleErrorMessage(message) {
        const { data } = message;
        const { error } = data;

        log(`❌ 서버 에러: ${error.message} (${error.code})`);
        alert(`에러: ${error.message}`);
    }

    // 연결 에러 처리
    handleConnectionError(error) {
        log(`🔄 연결 에러 처리: ${error}`);

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000; // 지수 백오프

            log(`🔄 ${delay/1000}초 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
                if (this.currentUserId && this.currentRoomId) {
                    this.connect(this.currentUserId, this.currentRoomId);
                }
            }, delay);
        } else {
            log('❌ 최대 재연결 시도 횟수 초과');
            updateConnectionStatus(false);
            alert('서버 연결에 실패했습니다. 페이지를 새로고침해주세요.');
        }
    }

    // 연결 해제
    disconnect() {
        if (this.stompClient && this.connected) {
            try {
                this.stompClient.disconnect(() => {
                    log('✅ WebSocket 연결 해제 완료');
                });
            } catch (error) {
                log('⚠️ 연결 해제 중 오류: ' + error.message);
            }
        }

        this.connected = false;
        this.currentUserId = null;
        this.currentRoomId = null;
        this.stompClient = null;
    }

    // 연결 상태 확인
    isConnected() {
        return this.connected && this.stompClient;
    }

    // 현재 사용자 ID 반환
    getCurrentUserId() {
        return this.currentUserId;
    }

    // 현재 방 ID 반환
    getCurrentRoomId() {
        return this.currentRoomId;
    }
}

// 전역 WebSocket 클라이언트 인스턴스
window.wsClient = new WebSocketClient();

// 로그 함수
function log(message) {
    const logContainer = document.getElementById('logContainer');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;

    logContainer.innerHTML += logEntry + '\n';
    logContainer.scrollTop = logContainer.scrollHeight;

    console.log(logEntry);
}

// UI 업데이트 함수들
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    const leaveBtn = document.getElementById('leaveBtn');
    const audioBtn = document.getElementById('audioBtn');
    const videoBtn = document.getElementById('videoBtn');

    if (connected) {
        statusEl.textContent = `🟢 연결됨 - 방: ${window.wsClient.getCurrentRoomId()}, 사용자: ${window.wsClient.getCurrentUserId()}`;
        statusEl.className = 'status connected';
        leaveBtn.disabled = false;
        audioBtn.disabled = false;
        videoBtn.disabled = false;
    } else {
        statusEl.textContent = '🔴 연결 안됨';
        statusEl.className = 'status disconnected';
        leaveBtn.disabled = true;
        audioBtn.disabled = true;
        videoBtn.disabled = true;
    }
}

function updateParticipants(participants) {
    const participantEl = document.getElementById('participantInfo');
    participantEl.textContent = `참여자 (${participants.length}명): ${participants.join(', ')}`;

    // 연결 수 업데이트
    if (window.performanceMonitor) {
        window.performanceMonitor.updateConnectionCount(participants.length - 1); // 자신 제외
    }
}