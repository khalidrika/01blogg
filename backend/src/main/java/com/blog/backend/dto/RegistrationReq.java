package com.blog.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegistrationReq(
    @NotBlank(message = "Username is required")
    String username,

    @Email(message = "Email should be valid")
    @NotBlank(message = "Email is required")
    String email,

    @Size(min = 6, message = "Password must be at least 6 characters long")
    @NotBlank(message = "Password is required")
    String password
) {
}