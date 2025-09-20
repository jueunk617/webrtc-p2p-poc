package com.back;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackApplication {

    public static void main(String[] args) {
        SpringApplication.run(BackApplication.class, args);

        System.out.println("\n" +
                "🚀 WebRTC 시그널링 서버 시작\n" +
                "WebSocket URL: ws://localhost:8080/ws\n" +
                "테스트 페이지: http://localhost:8000\n" +
                "로그 레벨: DEBUG\n" +
                "=======================================\n");
    }

}
