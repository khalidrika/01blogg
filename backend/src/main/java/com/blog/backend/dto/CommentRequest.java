package com.blog.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CommentRequest(

        @NotBlank(message = "Comment content is required")
        @Size(max = 255, message = "Comment must be 255 characters or fewer") String content

) {
}
