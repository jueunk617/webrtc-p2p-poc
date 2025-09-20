package com.back.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserStateMessage {
    private String userId;
    private String status;  // joined, left, connected, disconnected
    private String roomId;
    private LocalDateTime timestamp;
}
