package com.blog.backend.dto;

public record ProfileResponse(
        Long id,
        String username,
        String email,
        String role,
        long followersCount,
        long followingCount
) {}