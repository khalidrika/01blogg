package com.blog.backend.services;

import org.springframework.http.ResponseEntity;
import com.blog.backend.entity.User;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.dto.RegistrationReq;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor
public class RegistrationService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public ResponseEntity<User> register(RegistrationReq request) {
        User existingUser = userRepository.findByEmail(request.email());
        if (existingUser != null) {
            return ResponseEntity.badRequest().build();
        }
        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole("USER");

        User savedUser = userRepository.save(user);
        return ResponseEntity.ok(savedUser);
    }

}