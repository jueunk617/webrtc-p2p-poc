class PerformanceMonitor {
    constructor() {
        this.isMonitoring = false;
        this.statsInterval = null;
        this.startTime = null;
        this.lastNetworkStats = { bytesReceived: 0, bytesSent: 0 };
        this.connectionStates = new Map();
        this.performanceHistory = [];
    }

    // 모니터링 시작
    start() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.startTime = Date.now();
        this.lastNetworkStats = { bytesReceived: 0, bytesSent: 0 };

        // 1초마다 성능 데이터 수집
        this.statsInterval = setInterval(() => {
            this.collectPerformanceData();
        }, 1000);

        log('📊 성능 모니터링 시작');
    }

    // 모니터링 중지
    stop() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;

        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }

        log('📊 성능 모니터링 중지');
    }

    // 성능 데이터 수집
    async collectPerformanceData() {
        try {
            // WebRTC 통계 수집
            const webrtcStats = await this.collectWebRTCStats();

            // 시스템 메모리 사용량 (근사치)
            const memoryUsage = this.getMemoryUsage();

            // 네트워크 통계 계산
            const networkStats = this.calculateNetworkStats(webrtcStats);

            // UI 업데이트
            this.updateUI({
                connectionCount: this.connectionStates.size,
                memoryUsage: memoryUsage,
                networkOut: networkStats.sentKbps,
                networkIn: networkStats.receivedKbps,
                avgLatency: networkStats.avgLatency,
                qualityStatus: this.getQualityStatus(networkStats)
            });

            // 성능 히스토리 저장
            this.savePerformanceHistory({
                timestamp: Date.now(),
                ...webrtcStats,
                ...networkStats,
                memoryUsage: memoryUsage
            });

        } catch (error) {
            log('⚠️ 성능 데이터 수집 오류: ' + error.message);
        }
    }

    // WebRTC 통계 수집
    async collectWebRTCStats() {
        if (!window.webrtcClient) {
            return { totalBytesReceived: 0, totalBytesSent: 0, avgRoundTripTime: 0 };
        }

        try {
            const stats = await window.webrtcClient.getConnectionStats();

            let totalBytesReceived = 0;
            let totalBytesSent = 0;
            let totalRoundTripTime = 0;
            let validConnections = 0;

            Object.values(stats).forEach(peerStats => {
                totalBytesReceived += peerStats.bytesReceived;
                totalBytesSent += peerStats.bytesSent;

                if (peerStats.roundTripTime > 0) {
                    totalRoundTripTime += peerStats.roundTripTime;
                    validConnections++;
                }
            });

            return {
                totalBytesReceived,
                totalBytesSent,
                avgRoundTripTime: validConnections > 0 ? totalRoundTripTime / validConnections : 0,
                validConnections
            };

        } catch (error) {
            log('⚠️ WebRTC 통계 수집 실패: ' + error.message);
            return { totalBytesReceived: 0, totalBytesSent: 0, avgRoundTripTime: 0 };
        }
    }

    // 메모리 사용량 측정
    getMemoryUsage() {
        if ('memory' in performance) {
            // Chrome/Chromium 기반 브라우저
            return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        } else {
            // 다른 브라우저는 추정치
            const connections = this.connectionStates.size;
            return Math.round(50 + (connections * 30)); // 기본 50MB + 연결당 30MB
        }
    }

    // 네트워크 통계 계산
    calculateNetworkStats(webrtcStats) {
        const currentTime = Date.now();
        const timeDiff = (currentTime - (this.lastUpdateTime || currentTime)) / 1000;

        let receivedKbps = 0;
        let sentKbps = 0;

        if (this.lastNetworkStats && timeDiff > 0) {
            const receivedDiff = webrtcStats.totalBytesReceived - this.lastNetworkStats.bytesReceived;
            const sentDiff = webrtcStats.totalBytesSent - this.lastNetworkStats.bytesSent;

            receivedKbps = Math.round((receivedDiff / 1024) / timeDiff);
            sentKbps = Math.round((sentDiff / 1024) / timeDiff);
        }

        // 현재 값 저장
        this.lastNetworkStats = {
            bytesReceived: webrtcStats.totalBytesReceived,
            bytesSent: webrtcStats.totalBytesSent
        };
        this.lastUpdateTime = currentTime;

        return {
            receivedKbps: Math.max(0, receivedKbps),
            sentKbps: Math.max(0, sentKbps),
            avgLatency: Math.round(webrtcStats.avgRoundTripTime * 1000) // ms 변환
        };
    }

    // 품질 상태 평가
    getQualityStatus(networkStats) {
        const { avgLatency } = networkStats;
        const connectionCount = this.connectionStates.size;

        if (connectionCount === 0) return '대기';

        if (avgLatency < 100) return '우수';
        else if (avgLatency < 200) return '양호';
        else if (avgLatency < 300) return '보통';
        else return '불량';
    }

    // UI 업데이트
    updateUI(data) {
        // 연결 수
        const connectionCountEl = document.getElementById('connectionCount');
        if (connectionCountEl) {
            connectionCountEl.textContent = data.connectionCount;
        }

        // 메모리 사용량
        const memoryUsageEl = document.getElementById('memoryUsage');
        if (memoryUsageEl) {
            memoryUsageEl.textContent = `${data.memoryUsage} MB`;
        }

        // 네트워크 송신
        const networkOutEl = document.getElementById('networkOut');
        if (networkOutEl) {
            networkOutEl.textContent = `${data.networkOut} KB/s`;
        }

        // 네트워크 수신
        const networkInEl = document.getElementById('networkIn');
        if (networkInEl) {
            networkInEl.textContent = `${data.networkIn} KB/s`;
        }

        // 평균 지연시간
        const avgLatencyEl = document.getElementById('avgLatency');
        if (avgLatencyEl) {
            avgLatencyEl.textContent = `${data.avgLatency} ms`;
        }

        // 품질 상태
        const qualityStatusEl = document.getElementById('qualityStatus');
        if (qualityStatusEl) {
            qualityStatusEl.textContent = data.qualityStatus;

            // 품질에 따른 색상 변경
            qualityStatusEl.className = 'stat-value';
            if (data.qualityStatus === '우수') qualityStatusEl.style.color = '#28a745';
            else if (data.qualityStatus === '양호') qualityStatusEl.style.color = '#ffc107';
            else if (data.qualityStatus === '보통') qualityStatusEl.style.color = '#fd7e14';
            else if (data.qualityStatus === '불량') qualityStatusEl.style.color = '#dc3545';
            else qualityStatusEl.style.color = '#6c757d';
        }
    }

    // 연결 수 업데이트
    updateConnectionCount(count) {
        this.connectionStates.clear();
        for (let i = 0; i < count; i++) {
            this.connectionStates.set(`peer-${i}`, 'connected');
        }
    }

    // 연결 상태 업데이트
    updateConnectionState(userId, state) {
        if (state === 'connected') {
            this.connectionStates.set(userId, state);
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            this.connectionStates.delete(userId);
        }
    }

    // 성능 히스토리 저장
    savePerformanceHistory(data) {
        this.performanceHistory.push(data);

        // 최대 100개 데이터만 유지 (메모리 절약)
        if (this.performanceHistory.length > 100) {
            this.performanceHistory.shift();
        }
    }

    // 성능 리포트 생성
    generatePerformanceReport() {
        if (this.performanceHistory.length === 0) {
            return '성능 데이터가 없습니다.';
        }

        const history = this.performanceHistory;
        const totalDuration = (history[history.length - 1].timestamp - history[0].timestamp) / 1000;

        // 평균값 계산
        const avgMemory = history.reduce((sum, data) => sum + data.memoryUsage, 0) / history.length;
        const maxLatency = Math.max(...history.map(data => data.avgLatency));
        const avgNetworkOut = history.reduce((sum, data) => sum + data.sentKbps, 0) / history.length;
        const avgNetworkIn = history.reduce((sum, data) => sum + data.receivedKbps, 0) / history.length;

        // 품질 분석
        const qualityDistribution = {};
        history.forEach(data => {
            const quality = this.getQualityStatus({ avgLatency: data.avgLatency });
            qualityDistribution[quality] = (qualityDistribution[quality] || 0) + 1;
        });

        const report = {
            testDuration: `${Math.round(totalDuration)}초`,
            averageMemoryUsage: `${Math.round(avgMemory)} MB`,
            maxLatency: `${maxLatency} ms`,
            averageNetworkOut: `${Math.round(avgNetworkOut)} KB/s`,
            averageNetworkIn: `${Math.round(avgNetworkIn)} KB/s`,
            qualityDistribution: qualityDistribution,
            totalDataPoints: history.length,
            recommendations: this.generateRecommendations(avgMemory, maxLatency, avgNetworkOut + avgNetworkIn)
        };

        return report;
    }

    // 권장사항 생성
    generateRecommendations(avgMemory, maxLatency, totalNetworkUsage) {
        const recommendations = [];

        if (avgMemory > 500) {
            recommendations.push('메모리 사용량이 높습니다. 참여자 수를 줄이는 것을 권장합니다.');
        }

        if (maxLatency > 200) {
            recommendations.push('지연시간이 높습니다. 네트워크 환경을 확인하거나 SFU 방식을 고려해보세요.');
        }

        if (totalNetworkUsage > 2000) {
            recommendations.push('네트워크 사용량이 높습니다. 비디오 품질을 낮추거나 참여자 수를 제한하세요.');
        }

        if (recommendations.length === 0) {
            recommendations.push('성능이 양호합니다. 현재 설정으로 서비스 가능합니다.');
        }

        return recommendations;
    }

    // CPU 사용률 추정 (연결 수 기반)
    estimateCPUUsage() {
        const connectionCount = this.connectionStates.size;

        // 경험적 공식: 기본 10% + 연결당 15%
        const estimatedCPU = Math.min(10 + (connectionCount * 15), 100);

        return Math.round(estimatedCPU);
    }

    // 실시간 알림 시스템
    checkPerformanceThresholds(data) {
        const warnings = [];

        // 메모리 사용량 체크
        if (data.memoryUsage > 400) {
            warnings.push('⚠️ 메모리 사용량이 400MB를 초과했습니다.');
        }

        // 지연시간 체크
        if (data.avgLatency > 250) {
            warnings.push('⚠️ 평균 지연시간이 250ms를 초과했습니다.');
        }

        // 네트워크 사용량 체크
        const totalNetwork = data.networkIn + data.networkOut;
        if (totalNetwork > 1500) {
            warnings.push('⚠️ 네트워크 사용량이 1.5MB/s를 초과했습니다.');
        }

        // 경고 표시
        warnings.forEach(warning => {
            log(warning);
            this.showPerformanceWarning(warning);
        });
    }

    // 성능 경고 표시
    showPerformanceWarning(message) {
        // 화면 상단에 경고 메시지 표시
        const warningEl = document.createElement('div');
        warningEl.className = 'performance-warning';
        warningEl.textContent = message;
        warningEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 1000;
            animation: fadeIn 0.3s ease-in;
        `;

        document.body.appendChild(warningEl);

        // 5초 후 자동 제거
        setTimeout(() => {
            if (warningEl.parentNode) {
                warningEl.remove();
            }
        }, 5000);
    }

    // 테스트 결과 다운로드
    downloadTestResults() {
        const report = this.generatePerformanceReport();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        const data = {
            testInfo: {
                timestamp: new Date().toISOString(),
                duration: report.testDuration,
                browser: navigator.userAgent,
                platform: navigator.platform
            },
            performanceSummary: report,
            rawData: this.performanceHistory
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webrtc-performance-test-${timestamp}.json`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        log('📁 테스트 결과 다운로드 완료');
    }

    // 실시간 그래프 업데이트 (Chart.js 사용 시)
    updatePerformanceChart(data) {
        // 차트 라이브러리가 있다면 실시간 그래프 업데이트
        if (window.performanceChart) {
            const labels = window.performanceChart.data.labels;
            const datasets = window.performanceChart.data.datasets;

            // 새 데이터 포인트 추가
            const currentTime = new Date().toLocaleTimeString();
            labels.push(currentTime);

            datasets[0].data.push(data.memoryUsage);      // 메모리
            datasets[1].data.push(data.avgLatency);       // 지연시간
            datasets[2].data.push(data.networkOut);       // 송신
            datasets[3].data.push(data.networkIn);        // 수신

            // 최대 20개 데이터 포인트만 유지
            if (labels.length > 20) {
                labels.shift();
                datasets.forEach(dataset => dataset.data.shift());
            }

            window.performanceChart.update('none'); // 애니메이션 없이 업데이트
        }
    }
}

// 전역 성능 모니터 인스턴스
window.performanceMonitor = new PerformanceMonitor();

// 방 입장 함수
async function joinRoom() {
    const userId = document.getElementById('userId').value.trim();
    const roomId = document.getElementById('roomId').value.trim();

    if (!userId || !roomId) {
        alert('사용자 ID와 방 ID를 입력해주세요.');
        return;
    }

    try {
        log(`🚀 방 입장 시작 - Room: ${roomId}, User: ${userId}`);

        // ICE 서버 설정 로드
        await window.webrtcClient.loadIceServers();

        // 로컬 미디어 설정
        await window.webrtcClient.setupLocalMedia();

        // WebSocket 연결
        await window.wsClient.connect(userId, roomId);

        // 방 입장 요청
        window.wsClient.joinRoom(userId, roomId);

        // 성능 모니터링 시작
        window.performanceMonitor.start();

        log('✅ 방 입장 완료');

    } catch (error) {
        log('❌ 방 입장 실패: ' + error.message);
        alert('방 입장에 실패했습니다: ' + error.message);
    }
}

// 방 퇴장 함수
function leaveRoom() {
    log('👋 방 나가기 시작');

    try {
        // 성능 모니터링 중지
        window.performanceMonitor.stop();

        // WebRTC 연결 정리
        window.webrtcClient.cleanup();

        // WebSocket 방 퇴장
        window.wsClient.leaveRoom();

        // WebSocket 연결 해제
        window.wsClient.disconnect();

        // UI 상태 초기화
        updateConnectionStatus(false);
        updateParticipants([]);

        log('✅ 방 나가기 완료');

    } catch (error) {
        log('❌ 방 나가기 실패: ' + error.message);
    }
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.wsClient && window.wsClient.isConnected()) {
        window.performanceMonitor.stop();
        window.webrtcClient.cleanup();
        window.wsClient.disconnect();
    }
});

// 테스트 결과 다운로드 함수 (버튼에서 호출 가능)
function downloadResults() {
    window.performanceMonitor.downloadTestResults();
}

// 성능 리포트 콘솔 출력
function showPerformanceReport() {
    const report = window.performanceMonitor.generatePerformanceReport();
    console.log('📊 성능 테스트 리포트:', report);
    log('📊 성능 리포트가 콘솔에 출력되었습니다. F12로 확인하세요.');
}