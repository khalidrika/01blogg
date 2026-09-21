package com.blog.backend.dto;

import lombok.Builder;

@Builder
public record UserResponse(
    Long id,
    String username,
    String email,
    String role
) {
}
