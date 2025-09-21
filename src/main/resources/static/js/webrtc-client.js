class WebRTCClient {
    constructor() {
        this.localStream = null;
        this.peerConnections = new Map(); // userId -> RTCPeerConnection
        this.iceServers = [];
        this.isAudioEnabled = true;
        this.isVideoEnabled = true;
    }

    // ICE 서버 설정 로드
    async loadIceServers() {
        try {
            const response = await fetch('/api/webrtc/ice-servers');
            const config = await response.json();
            this.iceServers = config.iceServers;
            log(`✅ ICE 서버 설정 로드 완료 - ${this.iceServers.length}개 서버`);
        } catch (error) {
            log('❌ ICE 서버 설정 로드 실패: ' + error.message);
            // 기본 STUN 서버 사용
            this.iceServers = [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ];
        }
    }

    // 로컬 미디어 스트림 획득
    async setupLocalMedia() {
        try {
            log('🎥 로컬 미디어 스트림 요청 중...');

            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // 로컬 비디오 표시
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;

            log('✅ 로컬 미디어 스트림 획득 성공');

        } catch (error) {
            log('❌ 미디어 스트림 획득 실패: ' + error.message);
            throw error;
        }
    }

    // 새 사용자 입장 처리
    async handleUserJoined(userId) {
        log(`👤 새 사용자 입장 처리: ${userId}`);

        try {
            const pc = await this.createPeerConnection(userId);

            // Offer 생성 및 전송
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            await pc.setLocalDescription(offer);

            // WebSocket을 통해 Offer 전송
            window.wsClient.sendOffer(userId, offer.sdp);

            log(`📤 Offer 생성 및 전송 완료 - To: ${userId}`);

        } catch (error) {
            log(`❌ 사용자 입장 처리 실패 - ${userId}: ${error.message}`);
        }
    }

    // 사용자 퇴장 처리
    handleUserLeft(userId) {
        log(`👋 사용자 퇴장 처리: ${userId}`);

        const pc = this.peerConnections.get(userId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(userId);
        }

        this.removePeerVideo(userId);
    }

    // 시그널링 메시지 처리
    async handleSignalingMessage(message) {
        const { type, fromUserId, data } = message;

        try {
            switch (type) {
                case 'offer':
                    await this.handleOffer(fromUserId, data.sdp);
                    break;
                case 'answer':
                    await this.handleAnswer(fromUserId, data.sdp);
                    break;
                case 'ice-candidate':
                    await this.handleIceCandidate(fromUserId, data);
                    break;
                default:
                    log(`⚠️ 알 수 없는 시그널링 메시지: ${type}`);
            }
        } catch (error) {
            log(`❌ 시그널링 메시지 처리 실패 - ${type} from ${fromUserId}: ${error.message}`);
        }
    }

    // Offer 처리
    async handleOffer(fromUserId, sdp) {
        log(`📥 Offer 수신 및 처리 - From: ${fromUserId}`);

        try {
            // 기존 연결이 있으면 정리
            if (this.peerConnections.has(fromUserId)) {
                const existingPc = this.peerConnections.get(fromUserId);
                existingPc.close();
                this.peerConnections.delete(fromUserId);
                log(`🔄 기존 연결 정리 완료 - ${fromUserId}`);
            }

            // 새 PeerConnection 생성
            const pc = await this.createPeerConnection(fromUserId);

            // 원격 SDP 설정 (에러 처리 강화)
            try {
                await pc.setRemoteDescription({
                    type: 'offer',
                    sdp: sdp
                });
                log(`✅ Remote Description 설정 완료 - From: ${fromUserId}`);
            } catch (sdpError) {
                log(`❌ Remote Description 설정 실패 - From: ${fromUserId}: ${sdpError.message}`);
                throw new Error(`SDP 파싱 실패: ${sdpError.message}`);
            }

            // Answer 생성
            let answer;
            try {
                answer = await pc.createAnswer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                log(`✅ Answer 생성 완료 - To: ${fromUserId}`);
            } catch (answerError) {
                log(`❌ Answer 생성 실패 - To: ${fromUserId}: ${answerError.message}`);
                throw new Error(`Answer 생성 실패: ${answerError.message}`);
            }

            // Local Description 설정
            try {
                await pc.setLocalDescription(answer);
                log(`✅ Local Description 설정 완료 - To: ${fromUserId}`);
            } catch (localError) {
                log(`❌ Local Description 설정 실패 - To: ${fromUserId}: ${localError.message}`);
                throw new Error(`Local Description 설정 실패: ${localError.message}`);
            }

            // Answer 전송 (WebSocket 연결 확인)
            if (!window.wsClient || !window.wsClient.isConnected()) {
                throw new Error('WebSocket 연결이 없습니다');
            }

            try {
                window.wsClient.sendAnswer(fromUserId, answer.sdp);
                log(`📤 Answer 전송 완료 - To: ${fromUserId}`);
            } catch (sendError) {
                log(`❌ Answer 전송 실패 - To: ${fromUserId}: ${sendError.message}`);
                throw new Error(`Answer 전송 실패: ${sendError.message}`);
            }

        } catch (error) {
            log(`❌ Offer 처리 전체 실패 - From: ${fromUserId}: ${error.message}`);

            // 실패한 연결 정리
            if (this.peerConnections.has(fromUserId)) {
                const failedPc = this.peerConnections.get(fromUserId);
                failedPc.close();
                this.peerConnections.delete(fromUserId);
            }

            // 에러를 다시 던지지 않고 로그만 남김 (연결 재시도 가능하도록)
            console.error('Offer 처리 상세 에러:', error);
        }
    }

    // Answer 처리
    async handleAnswer(fromUserId, sdp) {
        log(`📥 Answer 수신 및 처리 - From: ${fromUserId}`);

        const pc = this.peerConnections.get(fromUserId);
        if (pc) {
            await pc.setRemoteDescription({ type: 'answer', sdp: sdp });
            log(`✅ Answer 적용 완료 - From: ${fromUserId}`);
        } else {
            log(`⚠️ PeerConnection을 찾을 수 없음 - ${fromUserId}`);
        }
    }

    // ICE Candidate 처리
    async handleIceCandidate(fromUserId, candidateData) {
        const pc = this.peerConnections.get(fromUserId);

        if (pc && candidateData.candidate) {
            try {
                await pc.addIceCandidate({
                    candidate: candidateData.candidate,
                    sdpMid: candidateData.sdpMid,
                    sdpMLineIndex: candidateData.sdpMLineIndex
                });

                log(`🧊 ICE Candidate 적용 완료 - From: ${fromUserId}`);

            } catch (error) {
                log(`❌ ICE Candidate 적용 실패 - From: ${fromUserId}: ${error.message}`);
            }
        }
    }

    // PeerConnection 생성
    async createPeerConnection(userId) {
        log(`🔗 PeerConnection 생성 - User: ${userId}`);

        const pc = new RTCPeerConnection({
            iceServers: this.iceServers,
            iceCandidatePoolSize: 10
        });

        // 로컬 스트림 추가
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        // ICE candidate 이벤트
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                window.wsClient.sendIceCandidate(userId, event.candidate);
            }
        };

        // 원격 스트림 처리
        pc.ontrack = (event) => {
            log(`🎥 원격 스트림 수신 - From: ${userId}`);
            this.addPeerVideo(userId, event.streams[0]);
        };

        // 연결 상태 모니터링
        pc.onconnectionstatechange = () => {
            log(`🔗 연결 상태 변경 - ${userId}: ${pc.connectionState}`);

            if (pc.connectionState === 'failed') {
                log(`❌ 연결 실패 - ${userId}`);
                // 재연결 시도 로직 추가 가능
            }

            // 성능 모니터링 업데이트
            if (window.performanceMonitor) {
                window.performanceMonitor.updateConnectionState(userId, pc.connectionState);
            }
        };

        // ICE 연결 상태 모니터링
        pc.oniceconnectionstatechange = () => {
            log(`🧊 ICE 연결 상태 - ${userId}: ${pc.iceConnectionState}`);
        };

        // 통계 수집을 위한 이벤트
        pc.onstatsended = () => {
            if (window.performanceMonitor) {
                window.performanceMonitor.collectPeerStats(userId, pc);
            }
        };

        this.peerConnections.set(userId, pc);
        return pc;
    }

    // 피어 비디오 추가
    addPeerVideo(userId, stream) {
        let videoContainer = document.getElementById(`video-${userId}`);

        if (!videoContainer) {
            videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';
            videoContainer.id = `video-${userId}`;

            const video = document.createElement('video');
            video.autoplay = true;
            video.playsinline = true;
            video.srcObject = stream;

            const label = document.createElement('div');
            label.className = 'video-label';
            label.textContent = userId;

            const controls = document.createElement('div');
            controls.className = 'video-controls';

            const muteBtn = document.createElement('button');
            muteBtn.className = 'control-btn';
            muteBtn.textContent = '🔇';
            muteBtn.onclick = () => this.toggleRemoteAudio(userId, video);

            controls.appendChild(muteBtn);

            videoContainer.appendChild(video);
            videoContainer.appendChild(label);
            videoContainer.appendChild(controls);

            document.getElementById('videoGrid').appendChild(videoContainer);

            log(`✅ 피어 비디오 추가 완료 - ${userId}`);
        }
    }

    // 피어 비디오 제거
    removePeerVideo(userId) {
        const videoContainer = document.getElementById(`video-${userId}`);
        if (videoContainer) {
            videoContainer.remove();
            log(`✅ 피어 비디오 제거 완료 - ${userId}`);
        }
    }

    // 로컬 오디오 토글
    toggleLocalAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                this.isAudioEnabled = !this.isAudioEnabled;
                audioTrack.enabled = this.isAudioEnabled;

                const audioBtn = document.getElementById('audioBtn');
                audioBtn.textContent = this.isAudioEnabled ? '🎤 음소거' : '🔇 음소거 해제';

                log(`🎤 로컬 오디오 ${this.isAudioEnabled ? '활성화' : '비활성화'}`);
            }
        }
    }

    // 로컬 비디오 토글
    toggleLocalVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                this.isVideoEnabled = !this.isVideoEnabled;
                videoTrack.enabled = this.isVideoEnabled;

                const videoBtn = document.getElementById('videoBtn');
                videoBtn.textContent = this.isVideoEnabled ? '📹 비디오' : '📹 비디오 끄기';

                log(`📹 로컬 비디오 ${this.isVideoEnabled ? '활성화' : '비활성화'}`);
            }
        }
    }

    // 원격 오디오 토글
    toggleRemoteAudio(userId, videoElement) {
        videoElement.muted = !videoElement.muted;
        const muteBtn = videoElement.parentElement.querySelector('.control-btn');
        muteBtn.textContent = videoElement.muted ? '🔇' : '🔊';

        log(`🔊 원격 오디오 ${videoElement.muted ? '음소거' : '음소거 해제'} - ${userId}`);
    }

    // 모든 연결 정리
    cleanup() {
        log('🗑️ WebRTC 연결 정리 시작');

        // 모든 피어 연결 종료
        this.peerConnections.forEach((pc, userId) => {
            pc.close();
            this.removePeerVideo(userId);
        });
        this.peerConnections.clear();

        // 로컬 스트림 정리
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
        }

        // 로컬 비디오 정리
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = null;
        }

        log('✅ WebRTC 연결 정리 완료');
    }

    // 연결 통계 수집
    async getConnectionStats() {
        const stats = {};

        for (const [userId, pc] of this.peerConnections) {
            if (pc.connectionState === 'connected') {
                try {
                    const pcStats = await pc.getStats();
                    stats[userId] = this.parseRTCStats(pcStats);
                } catch (error) {
                    log(`⚠️ 통계 수집 실패 - ${userId}: ${error.message}`);
                }
            }
        }

        return stats;
    }

    // RTC 통계 파싱
    parseRTCStats(stats) {
        const parsed = {
            bytesReceived: 0,
            bytesSent: 0,
            packetsReceived: 0,
            packetsSent: 0,
            roundTripTime: 0,
            videoFramesDecoded: 0,
            videoFramesEncoded: 0
        };

        stats.forEach(report => {
            if (report.type === 'inbound-rtp') {
                parsed.bytesReceived += report.bytesReceived || 0;
                parsed.packetsReceived += report.packetsReceived || 0;
                if (report.mediaType === 'video') {
                    parsed.videoFramesDecoded += report.framesDecoded || 0;
                }
            } else if (report.type === 'outbound-rtp') {
                parsed.bytesSent += report.bytesSent || 0;
                parsed.packetsSent += report.packetsSent || 0;
                if (report.mediaType === 'video') {
                    parsed.videoFramesEncoded += report.framesEncoded || 0;
                }
            } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                parsed.roundTripTime = report.currentRoundTripTime || 0;
            }
        });

        return parsed;
    }
}

// 전역 WebRTC 클라이언트 인스턴스
window.webrtcClient = new WebRTCClient();

// 글로벌 함수들
function toggleAudio() {
    window.webrtcClient.toggleLocalAudio();
}

function toggleVideo() {
    window.webrtcClient.toggleLocalVideo();
}

function toggleLocalAudio() {
    window.webrtcClient.toggleLocalAudio();
}

function toggleLocalVideo() {
    window.webrtcClient.toggleLocalVideo();
}