package com.blog.backend.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;

import com.blog.backend.entity.Role;
import com.blog.backend.entity.User;
import com.blog.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class AdminInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    @Value("${app.bootstrap-admin.email:}") private String adminEmail;
    @Value("${app.bootstrap-admin.username:admin}") private String adminUsername;
    @Value("${app.bootstrap-admin.password:}") private String adminPassword;

    @Override
    public void run(String... args) {

        if (adminEmail.isBlank() || adminPassword.isBlank()) return;
        if (adminPassword.length() < 12 || adminPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("Bootstrap admin password must have at least 12 characters and at most 72 UTF-8 bytes");
        }

        if (userRepository.findByEmail(adminEmail) == null) {

            User admin = new User();

            if (userRepository.findByUsername(adminUsername) != null) {
                throw new IllegalStateException("Bootstrap admin username is already in use");
            }
            admin.setUsername(adminUsername);
            admin.setEmail(adminEmail);
            admin.setPassword(
                    passwordEncoder.encode(adminPassword)
            );
            admin.setRole(Role.ADMIN);

            userRepository.save(admin);
        }
    }
}
