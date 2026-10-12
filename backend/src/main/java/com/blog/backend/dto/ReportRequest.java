package com.blog.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record ReportRequest(
        @NotBlank(message = "Reason is required")
        String reason
) {}