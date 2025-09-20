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
public class RoomStateMessage {
    private String roomId;
    private int participantCount;
    private java.util.List<String> participants;
    private LocalDateTime timestamp;
}
