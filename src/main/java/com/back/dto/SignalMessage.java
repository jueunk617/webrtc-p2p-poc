package com.back.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalMessage {
    private String type;
    private String fromUserId;
    private String toUserId;
    private Map<String, Object> data;

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}
