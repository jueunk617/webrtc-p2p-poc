package com.back.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OfferMessage {
    private String fromUserId;
    private String toUserId;
    private String sdp;
    private String roomId;  // 검증용
}
