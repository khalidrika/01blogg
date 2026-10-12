package com.blog.backend.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.blog.backend.entity.Role;
import com.blog.backend.entity.User;
import com.blog.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class AdminInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {

        String adminEmail = "admin@01blog.com";

        if (userRepository.findByEmail(adminEmail) == null) {

            User admin = new User();

            admin.setUsername("admin");
            admin.setEmail(adminEmail);
            admin.setPassword(
                    passwordEncoder.encode("admin123")
            );
            admin.setRole(Role.ADMIN);

            userRepository.save(admin);
        }
    }
}