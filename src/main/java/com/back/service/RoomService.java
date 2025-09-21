package com.back.service;

import com.back.dto.RoomStateMessage;
import com.back.dto.UserStateMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class RoomService {

    @Value("${app.webrtc.max-participants:6}")
    private int maxParticipants;

    // 방별 사용자 목록 (roomId -> Set<userId>)
    private final Map<String, Set<String>> roomParticipants = new ConcurrentHashMap<>();

    // 사용자별 방 정보 (userId -> roomId)
    private final Map<String, String> userRoomMapping = new ConcurrentHashMap<>();

    // 방별 생성 시간
    private final Map<String, LocalDateTime> roomCreationTime = new ConcurrentHashMap<>();

    // 사용자를 방에 추가
    public synchronized List<String> addUserToRoom(String roomId, String userId) {
        log.info("사용자 방 입장 시도 - Room: {}, User: {}", roomId, userId);

        // 이미 다른 방에 있는 경우 기존 방에서 제거
        String existingRoom = userRoomMapping.get(userId);
        if (existingRoom != null && !existingRoom.equals(roomId)) {
            removeUserFromRoom(existingRoom, userId);
            log.info("사용자가 기존 방에서 이동 - From: {}, To: {}", existingRoom, roomId);
        }

        // 방 참여자 수 체크
        Set<String> participants = roomParticipants.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet());

        if (participants.size() >= maxParticipants && !participants.contains(userId)) {
            log.warn("방 인원 초과 - Room: {}, Current: {}, Max: {}", roomId, participants.size(), maxParticipants);
            throw new IllegalStateException("방 인원이 초과되었습니다. (최대 " + maxParticipants + "명)");
        }

        // 방이 새로 생성되는 경우
        if (participants.isEmpty()) {
            roomCreationTime.put(roomId, LocalDateTime.now());
            log.info("새 방 생성 - Room: {}", roomId);
        }

        // 사용자 추가
        participants.add(userId);
        userRoomMapping.put(userId, roomId);

        List<String> participantList = new ArrayList<>(participants);

        log.info("사용자 방 입장 완료 - Room: {}, User: {}, Total: {}/{}",
                roomId, userId, participants.size(), maxParticipants);

        return participantList;
    }

    // 사용자를 방에서 제거
    public synchronized void removeUserFromRoom(String roomId, String userId) {
        log.info("사용자 방 퇴장 시도 - Room: {}, User: {}", roomId, userId);

        Set<String> participants = roomParticipants.get(roomId);
        if (participants != null) {
            participants.remove(userId);
            userRoomMapping.remove(userId);

            // 방이 비어있으면 정리
            if (participants.isEmpty()) {
                roomParticipants.remove(roomId);
                roomCreationTime.remove(roomId);
                log.info("빈 방 정리 - Room: {}", roomId);
            }

            log.info("사용자 방 퇴장 완료 - Room: {}, User: {}, Remaining: {}",
                    roomId, userId, participants.size());
        }
    }

    // 방 참여자 목록 조회
    public List<String> getRoomParticipants(String roomId) {
        Set<String> participants = roomParticipants.get(roomId);
        return participants != null ? new ArrayList<>(participants) : new ArrayList<>();
    }

    // 사용자가 속한 방 조회
    public String getUserRoom(String userId) {
        return userRoomMapping.get(userId);
    }

    // 방 상태 정보 조회
    public RoomStateMessage getRoomState(String roomId) {
        Set<String> participants = roomParticipants.get(roomId);

        return RoomStateMessage.builder()
                .roomId(roomId)
                .participantCount(participants != null ? participants.size() : 0)
                .participants(participants != null ? new ArrayList<>(participants) : new ArrayList<>())
                .timestamp(LocalDateTime.now())
                .build();
    }

    // 사용자 상태 메시지 생성
    public UserStateMessage createUserStateMessage(String userId, String status, String roomId) {
        return UserStateMessage.builder()
                .userId(userId)
                .status(status)
                .roomId(roomId)
                .timestamp(LocalDateTime.now())
                .build();
    }

    // 방 존재 여부 확인
    public boolean isRoomExists(String roomId) {
        return roomParticipants.containsKey(roomId);
    }

    // 방 참여 가능 여부 확인
    public boolean canJoinRoom(String roomId) {
        Set<String> participants = roomParticipants.get(roomId);
        return participants == null || participants.size() < maxParticipants;
    }

    // 모든 방 정보 조회
    public Map<String, Set<String>> getAllRooms() {
        return new HashMap<>(roomParticipants);
    }

    // 통계 정보 조회
    public Map<String, Object> getRoomStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRooms", roomParticipants.size());
        stats.put("totalUsers", userRoomMapping.size());
        stats.put("maxParticipants", maxParticipants);

        // 방별 참여자 수 분포
        Map<Integer, Integer> participantDistribution = new HashMap<>();
        roomParticipants.values().forEach(participants -> {
            int size = participants.size();
            participantDistribution.merge(size, 1, Integer::sum);
        });
        stats.put("participantDistribution", participantDistribution);

        return stats;
    }
}