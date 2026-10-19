package com.blog.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReportRequest(
        @NotBlank(message = "Reason is required")
        @Size(max = 255, message = "Reason must be 255 characters or fewer")
        String reason
) {}
