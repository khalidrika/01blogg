package com.blog.backend.dto;

import com.blog.backend.entity.User;
import lombok.Builder;

@Builder
public record UserResponse(
    Long id,
    String username,
    String email,
    String role
) {
    public static UserResponse fromUser(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }
}
