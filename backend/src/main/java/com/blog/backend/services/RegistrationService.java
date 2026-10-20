package com.blog.backend.services;

import org.springframework.http.ResponseEntity;
import com.blog.backend.entity.User;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.dto.RegistrationReq;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.blog.backend.dto.UserResponse;
import com.blog.backend.entity.Role;
import com.blog.backend.dto.ErrorResponse;
import java.nio.charset.StandardCharsets;
import org.springframework.dao.DataIntegrityViolationException;

@Service
@RequiredArgsConstructor
public class RegistrationService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public ResponseEntity<?> register(RegistrationReq request) {
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Password must be 72 UTF-8 bytes or fewer"));
        }
        User existingUser = userRepository.findByEmail(request.email());
        User existingUserByusername = userRepository.findByUsername(request.username());
        if (existingUser != null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Email is already in use"));
        } else if (existingUserByusername != null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Username is already in use"));

        }

        User user = new User();

        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(Role.USER);

        User savedUser;
        try {
            savedUser = userRepository.save(user);
        } catch (DataIntegrityViolationException exception) {
            // Concurrent registrations may both pass the initial lookup.
            return ResponseEntity.badRequest().body(new ErrorResponse("Username or email is already in use"));
        }
        UserResponse response = new UserResponse(savedUser.getId(), savedUser.getUsername(), savedUser.getEmail(),
                savedUser.getRole().name(), savedUser.isBanned());
        return ResponseEntity.ok(response);
    }

}
