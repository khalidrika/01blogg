package com.blog.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record PostRequest(

        @NotBlank(message = "Title is required") String title,

        @NotBlank(message = "Content is required") String content

) {
}