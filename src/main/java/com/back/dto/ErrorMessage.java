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
public class ErrorMessage {
    private String type;
    private String message;
    private String code;
    private LocalDateTime timestamp;

    public static ErrorMessage of(String type, String message, String code) {
        return ErrorMessage.builder()
                .type(type)
                .message(message)
                .code(code)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
