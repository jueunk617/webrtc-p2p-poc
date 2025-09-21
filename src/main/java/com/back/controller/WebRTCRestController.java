package com.back.controller;

import com.back.config.IceServerConfig;
import com.back.dto.IceServer;
import com.back.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Map;

@RestController
@RequestMapping("/api/webrtc")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:3000"})
public class WebRTCRestController { // WebRTC 관련 REST API 컨트롤러

    private final RoomService roomService;

    // ICE 서버 설정 제공 (STUN/TURN 서버 정보)
    @GetMapping("/ice-servers")
    public ResponseEntity<IceServerConfig> getIceServers(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String roomId) {

        log.info("ICE 서버 설정 요청 - User: {}, Room: {}", userId, roomId);

        try {
            IceServerConfig config = IceServerConfig.builder()
                    .iceServers(Arrays.asList(
                            // Google STUN 서버들
                            IceServer.builder()
                                    .urls("stun:stun.l.google.com:19302")
                                    .build(),
                            IceServer.builder()
                                    .urls("stun:stun1.l.google.com:19302")
                                    .build(),
                            IceServer.builder()
                                    .urls("stun:stun2.l.google.com:19302")
                                    .build()

                            // 필요시 TURN 서버 추가 (현재는 STUN만 사용)
                            // IceServer.builder()
                            //         .urls("turn:your-turn-server:3478")
                            //         .username("username")
                            //         .credential("password")
                            //         .build()
                    ))
                    .build();

            log.info("ICE 서버 설정 제공 완료 - STUN 서버 {} 개", config.getIceServers().size());
            return ResponseEntity.ok(config);

        } catch (Exception e) {
            log.error("ICE 서버 설정 제공 실패 - Error: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    // 방 상태 조회
    @GetMapping("/rooms/{roomId}/state")
    public ResponseEntity<?> getRoomState(@PathVariable String roomId) {
        log.info("방 상태 조회 - Room: {}", roomId);

        try {
            var roomState = roomService.getRoomState(roomId);
            return ResponseEntity.ok(roomState);

        } catch (Exception e) {
            log.error("방 상태 조회 실패 - Room: {}, Error: {}", roomId, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    // 방 참여 가능 여부 확인
    @GetMapping("/rooms/{roomId}/can-join")
    public ResponseEntity<Map<String, Object>> canJoinRoom(@PathVariable String roomId) {
        log.info("방 참여 가능 여부 확인 - Room: {}", roomId);

        try {
            boolean canJoin = roomService.canJoinRoom(roomId);
            var participants = roomService.getRoomParticipants(roomId);

            Map<String, Object> response = Map.of(
                    "canJoin", canJoin,
                    "currentParticipants", participants.size(),
                    "maxParticipants", 6,  // TODO: 설정값에서 가져오기
                    "participants", participants
            );

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("방 참여 가능 여부 확인 실패 - Room: {}, Error: {}", roomId, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    // 서버 통계 조회
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getServerStats() {
        log.debug("서버 통계 조회");

        try {
            Map<String, Object> stats = roomService.getRoomStats();

            // 런타임 정보 추가
            Runtime runtime = Runtime.getRuntime();
            stats.put("memory", Map.of(
                    "total", runtime.totalMemory(),
                    "free", runtime.freeMemory(),
                    "used", runtime.totalMemory() - runtime.freeMemory(),
                    "max", runtime.maxMemory()
            ));

            stats.put("system", Map.of(
                    "processors", runtime.availableProcessors(),
                    "javaVersion", System.getProperty("java.version"),
                    "osName", System.getProperty("os.name")
            ));

            return ResponseEntity.ok(stats);

        } catch (Exception e) {
            log.error("서버 통계 조회 실패 - Error: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    // 헬스 체크 엔드포인트
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> health = Map.of(
                "status", "UP",
                "timestamp", System.currentTimeMillis(),
                "service", "WebRTC Signaling Server",
                "version", "1.0.0"
        );

        return ResponseEntity.ok(health);
    }

    // CORS 프리플라이트 요청 처리
    @RequestMapping(method = RequestMethod.OPTIONS, value = "/**")
    public ResponseEntity<Void> handleOptions() {
        return ResponseEntity.ok().build();
    }
}
