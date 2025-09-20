package com.back.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IceCandidateMessage {
    private String fromUserId;
    private String toUserId;
    private String candidate;
    private String sdpMid;
    private Integer sdpMLineIndex;
    private String roomId;  // 검증용
}
