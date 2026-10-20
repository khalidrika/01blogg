package com.blog.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegistrationReq(
    @NotBlank(message = "Username is required")
    @Size(max = 50, message = "Username must be 50 characters or fewer")
    String username,

    @Email(message = "Email should be valid")
    @NotBlank(message = "Email is required")
    @Size(max = 254, message = "Email must be 254 characters or fewer")
    String email,

    @Size(min = 6, max = 72, message = "Password must contain between 6 and 72 characters")
    @NotBlank(message = "Password is required")
    String password
) {
}
