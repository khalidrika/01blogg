package com.blog.backend.services;
import org.springframework.http.ResponseEntity;
import com.blog.backend.entity.User;
import com.blog.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor  
public class RegistrationService {
    private final UserRepository userRepository;

    public ResponseEntity<User> register(User user) {
        return ResponseEntity.ok(user);
    }

}