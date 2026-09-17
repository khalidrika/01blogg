package com.blog.backend.controllers;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import com.blog.backend.services.RegistrationService;
import com.blog.backend.entity.User;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/register")
@RequiredArgsConstructor
public class RegisterController {

    private final RegistrationService registrationService;

    @GetMapping("/test")
    public String register() {
        return "Register endpoint is working!";
    }

    @PostMapping
    public ResponseEntity<User> register(@RequestBody User user) {
        return registrationService.register(user);
    }
}