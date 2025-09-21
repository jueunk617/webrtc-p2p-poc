package com.back.controller;

import com.back.dto.*;
import com.back.service.RoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WebRTCController { // WebRTC 시그널링 컨트롤러

    private final SimpMessagingTemplate messagingTemplate;
    private final RoomService roomService;

    // 방 입장 처리
    @MessageMapping("/room/join")
    public void handleJoinRoom(@Payload JoinRoomRequest request,
                               SimpMessageHeaderAccessor headerAccessor) {

        String sessionId = headerAccessor.getSessionId();
        log.info("방 입장 요청 - Room: {}, User: {}, Session: {}",
                request.getRoomId(), request.getUserId(), sessionId);

        try {
            // 방 참여 가능 여부 확인
            if (!roomService.canJoinRoom(request.getRoomId())) {
                sendErrorToUser(request.getUserId(), "ROOM_FULL",
                        "방 인원이 가득 찼습니다.", sessionId);
                return;
            }

            // 사용자를 방에 추가
            List<String> participants = roomService.addUserToRoom(request.getRoomId(), request.getUserId());

            // 세션에 사용자 정보 저장
            headerAccessor.getSessionAttributes().put("userId", request.getUserId());
            headerAccessor.getSessionAttributes().put("roomId", request.getRoomId());

            // 방의 다른 사용자들에게 새 사용자 입장 알림
            Map<String, Object> joinData = new HashMap<>();
            joinData.put("participants", participants);
            joinData.put("newUserId", request.getUserId());
            joinData.put("userAgent", request.getUserAgent());

            SignalMessage joinMessage = SignalMessage.builder()
                    .type("user-joined")
                    .fromUserId(request.getUserId())
                    .data(joinData)
                    .build();

            messagingTemplate.convertAndSend("/topic/room/" + request.getRoomId(), joinMessage);

            // 입장한 사용자에게 현재 참여자 목록 전송
            SignalMessage welcomeMessage = SignalMessage.builder()
                    .type("room-state")
                    .data(Map.of(
                            "participants", participants,
                            "roomId", request.getRoomId(),
                            "yourUserId", request.getUserId()
                    ))
                    .build();

            messagingTemplate.convertAndSendToUser(request.getUserId(), "/queue/room", welcomeMessage);

            log.info("방 입장 처리 완료 - Room: {}, User: {}, Total: {}",
                    request.getRoomId(), request.getUserId(), participants.size());

        } catch (Exception e) {
            log.error("방 입장 실패 - Room: {}, User: {}, Error: {}",
                    request.getRoomId(), request.getUserId(), e.getMessage());

            sendErrorToUser(request.getUserId(), "JOIN_FAILED", e.getMessage(), sessionId);
        }
    }

    // 방 퇴장 처리
    @MessageMapping("/room/leave")
    public void handleLeaveRoom(@Payload LeaveRoomRequest request,
                                SimpMessageHeaderAccessor headerAccessor) {

        String sessionId = headerAccessor.getSessionId();
        log.info("방 퇴장 요청 - Room: {}, User: {}, Session: {}",
                request.getRoomId(), request.getUserId(), sessionId);

        try {
            // 사용자를 방에서 제거
            roomService.removeUserFromRoom(request.getRoomId(), request.getUserId());

            // 세션 정보 정리
            headerAccessor.getSessionAttributes().remove("userId");
            headerAccessor.getSessionAttributes().remove("roomId");

            // 방의 다른 사용자들에게 퇴장 알림
            SignalMessage leaveMessage = SignalMessage.builder()
                    .type("user-left")
                    .fromUserId(request.getUserId())
                    .data(Map.of("leftUserId", request.getUserId()))
                    .build();

            messagingTemplate.convertAndSend("/topic/room/" + request.getRoomId(), leaveMessage);

            log.info("방 퇴장 처리 완료 - Room: {}, User: {}",
                    request.getRoomId(), request.getUserId());

        } catch (Exception e) {
            log.error("방 퇴장 실패 - Room: {}, User: {}, Error: {}",
                    request.getRoomId(), request.getUserId(), e.getMessage());
        }
    }

    // WebRTC Offer 처리
    @MessageMapping("/webrtc/offer")
    public void handleOffer(@Payload OfferMessage offer) {
        log.info("Offer 중계 - From: {} To: {}", offer.getFromUserId(), offer.getToUserId());

        try {
            // 유효성 검증
            if (!isValidWebRTCMessage(offer.getFromUserId(), offer.getToUserId(), offer.getRoomId())) {
                return;
            }

            SignalMessage signalMessage = SignalMessage.builder()
                    .type("offer")
                    .fromUserId(offer.getFromUserId())
                    .toUserId(offer.getToUserId())
                    .data(Map.of(
                            "sdp", offer.getSdp(),
                            "roomId", offer.getRoomId()
                    ))
                    .build();

            messagingTemplate.convertAndSendToUser(offer.getToUserId(), "/queue/webrtc", signalMessage);

            log.debug("Offer 중계 완료 - From: {} To: {}", offer.getFromUserId(), offer.getToUserId());

        } catch (Exception e) {
            log.error("Offer 중계 실패 - From: {} To: {}, Error: {}",
                    offer.getFromUserId(), offer.getToUserId(), e.getMessage());
        }
    }

    // WebRTC Answer 처리
    @MessageMapping("/webrtc/answer")
    public void handleAnswer(@Payload AnswerMessage answer) {
        log.info("Answer 중계 - From: {} To: {}", answer.getFromUserId(), answer.getToUserId());

        try {
            // 유효성 검증
            if (!isValidWebRTCMessage(answer.getFromUserId(), answer.getToUserId(), answer.getRoomId())) {
                return;
            }

            SignalMessage signalMessage = SignalMessage.builder()
                    .type("answer")
                    .fromUserId(answer.getFromUserId())
                    .toUserId(answer.getToUserId())
                    .data(Map.of(
                            "sdp", answer.getSdp(),
                            "roomId", answer.getRoomId()
                    ))
                    .build();

            messagingTemplate.convertAndSendToUser(answer.getToUserId(), "/queue/webrtc", signalMessage);

            log.debug("Answer 중계 완료 - From: {} To: {}", answer.getFromUserId(), answer.getToUserId());

        } catch (Exception e) {
            log.error("Answer 중계 실패 - From: {} To: {}, Error: {}",
                    answer.getFromUserId(), answer.getToUserId(), e.getMessage());
        }
    }

    // ICE Candidate 처리
    @MessageMapping("/webrtc/ice-candidate")
    public void handleIceCandidate(@Payload IceCandidateMessage candidate) {
        log.debug("ICE Candidate 중계 - From: {} To: {}",
                candidate.getFromUserId(), candidate.getToUserId());

        try {
            // 유효성 검증
            if (!isValidWebRTCMessage(candidate.getFromUserId(), candidate.getToUserId(), candidate.getRoomId())) {
                return;
            }

            SignalMessage signalMessage = SignalMessage.builder()
                    .type("ice-candidate")
                    .fromUserId(candidate.getFromUserId())
                    .toUserId(candidate.getToUserId())
                    .data(Map.of(
                            "candidate", candidate.getCandidate(),
                            "sdpMid", candidate.getSdpMid(),
                            "sdpMLineIndex", candidate.getSdpMLineIndex(),
                            "roomId", candidate.getRoomId()
                    ))
                    .build();

            messagingTemplate.convertAndSendToUser(candidate.getToUserId(), "/queue/webrtc", signalMessage);

        } catch (Exception e) {
            log.error("ICE Candidate 중계 실패 - From: {} To: {}, Error: {}",
                    candidate.getFromUserId(), candidate.getToUserId(), e.getMessage());
        }
    }

    // WebRTC 메시지 유효성 검증
    private boolean isValidWebRTCMessage(String fromUserId, String toUserId, String roomId) {
        if (fromUserId == null || toUserId == null) {
            log.warn("유효하지 않은 사용자 ID - From: {}, To: {}", fromUserId, toUserId);
            return false;
        }

        if (fromUserId.equals(toUserId)) {
            log.warn("자기 자신에게 메시지 전송 시도 - User: {}", fromUserId);
            return false;
        }

        // 같은 방에 있는지 확인
        String fromUserRoom = roomService.getUserRoom(fromUserId);
        String toUserRoom = roomService.getUserRoom(toUserId);

        if (fromUserRoom == null || !fromUserRoom.equals(toUserRoom)) {
            log.warn("다른 방의 사용자 간 통신 시도 - From: {} (Room: {}), To: {} (Room: {})",
                    fromUserId, fromUserRoom, toUserId, toUserRoom);
            return false;
        }

        if (roomId != null && !roomId.equals(fromUserRoom)) {
            log.warn("방 ID 불일치 - Expected: {}, Actual: {}", fromUserRoom, roomId);
            return false;
        }

        return true;
    }

    // 에러 메시지 전송
    private void sendErrorToUser(String userId, String errorCode, String message, String sessionId) {
        ErrorMessage errorMessage = ErrorMessage.of("ROOM_ERROR", message, errorCode);

        SignalMessage signalMessage = SignalMessage.builder()
                .type("error")
                .toUserId(userId)
                .data(Map.of(
                        "error", errorMessage,
                        "sessionId", sessionId
                ))
                .build();

        messagingTemplate.convertAndSendToUser(userId, "/queue/error", signalMessage);

        log.info("에러 메시지 전송 - User: {}, Code: {}, Message: {}", userId, errorCode, message);
    }
}
