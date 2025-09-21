package com.back.config;

import com.back.dto.SignalMessage;
import com.back.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final RoomService roomService;
    private final SimpMessagingTemplate messagingTemplate;

    // WebSocket 연결 이벤트
    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();

        // 연결 헤더에서 사용자 정보 추출
        String userId = headerAccessor.getFirstNativeHeader("userId");
        String roomId = headerAccessor.getFirstNativeHeader("roomId");

        // 세션에 사용자 정보 저장
        if (userId != null && roomId != null) {
            headerAccessor.getSessionAttributes().put("userId", userId);
            headerAccessor.getSessionAttributes().put("roomId", roomId);
            log.info("WebSocket 연결 성공 - Session: {}, User: {}, Room: {}",
                    sessionId, userId, roomId);
        } else {
            log.info("WebSocket 연결 성공 - Session: {}", sessionId);
        }
    }

    // WebSocket 연결 해제 이벤트
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());

        String sessionId = headerAccessor.getSessionId();
        String userId = (String) headerAccessor.getSessionAttributes().get("userId");
        String roomId = (String) headerAccessor.getSessionAttributes().get("roomId");

        log.info("WebSocket 연결 해제 - Session: {}, User: {}, Room: {}",
                sessionId, userId, roomId);

        // 사용자가 방에 있었다면 자동으로 퇴장 처리
        if (userId != null && roomId != null) {
            try {
                roomService.removeUserFromRoom(roomId, userId);

                // 방의 다른 사용자들에게 퇴장 알림
                SignalMessage disconnectMessage = SignalMessage.builder()
                        .type("user-disconnected")
                        .fromUserId(userId)
                        .data(Map.of(
                                "userId", userId,
                                "reason", "connection-lost"
                        ))
                        .build();

                messagingTemplate.convertAndSend("/topic/room/" + roomId, disconnectMessage);

                log.info("연결 해제로 인한 자동 방 퇴장 처리 완료 - User: {}, Room: {}", userId, roomId);

            } catch (Exception e) {
                log.error("연결 해제 처리 실패 - User: {}, Room: {}, Error: {}",
                        userId, roomId, e.getMessage());
            }
        }
    }

    // 토픽 구독 이벤트
    @EventListener
    public void handleSessionSubscribeEvent(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());

        String sessionId = headerAccessor.getSessionId();
        String destination = headerAccessor.getDestination();
        String userId = (String) headerAccessor.getSessionAttributes().get("userId");

        log.debug("토픽 구독 - Session: {}, User: {}, Destination: {}",
                sessionId, userId, destination);

        // 방 토픽 구독 시 추가 로직 (필요시)
        if (destination != null && destination.startsWith("/topic/room/")) {
            String roomId = destination.substring("/topic/room/".length());
            log.info("방 토픽 구독 - User: {}, Room: {}", userId, roomId);
        }
    }

    // 토픽 구독 해제 이벤트
    @EventListener
    public void handleSessionUnsubscribeEvent(SessionUnsubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());

        String sessionId = headerAccessor.getSessionId();
        String subscriptionId = headerAccessor.getSubscriptionId();
        String userId = (String) headerAccessor.getSessionAttributes().get("userId");

        log.debug("토픽 구독 해제 - Session: {}, User: {}, Subscription: {}",
                sessionId, userId, subscriptionId);
    }
}
