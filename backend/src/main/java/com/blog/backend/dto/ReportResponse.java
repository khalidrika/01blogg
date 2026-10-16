package com.blog.backend.dto;

import java.time.LocalDateTime;

public record ReportResponse(
        Long id,
        Long reporterId,
        String reporterUsername,
        Long reportedUserId,
        String reportedUsername,
        String reason,
        LocalDateTime createdAt
) {}