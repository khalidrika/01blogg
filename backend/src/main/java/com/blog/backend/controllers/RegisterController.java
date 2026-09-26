package com.blog.backend.controllers;

import org.springframework.web.bind.annotation.RestController;
import com.blog.backend.services.RegistrationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import com.blog.backend.dto.RegistrationReq;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/register")

public class RegisterController {
     private final RegistrationService registrationService;

     @PostMapping
     public ResponseEntity<?> register(@Valid @RequestBody RegistrationReq request) {
          return registrationService.register(request);
     }
}