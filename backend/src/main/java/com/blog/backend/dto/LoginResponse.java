package com.blog.backend.dto;

public record LoginResponse(
        String token,
        Long id,
        String username,
        String email,
        String role) {
}