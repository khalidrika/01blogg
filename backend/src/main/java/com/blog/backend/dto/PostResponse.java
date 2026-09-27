package com.blog.backend.dto;

import java.time.LocalDateTime;

public record PostResponse(
        Long id,
        String title,
        String content,
        Long authorid,
        String authorusername,
        LocalDateTime createdAt) {
}