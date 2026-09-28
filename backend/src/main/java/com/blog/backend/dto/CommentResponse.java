package com.blog.backend.dto;

import java.time.LocalDateTime;

public record CommentResponse(
        Long id,
        String content,
        Long authorId,
        String authorUsername,
        Long postId,
        LocalDateTime createdAt) {
}