package com.blog.backend.controllers;

import org.springframework.web.bind.annotation.RestController;
import com.blog.backend.services.LoginService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import com.blog.backend.dto.LoginReq;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;


@RestController
@RequiredArgsConstructor
@RequestMapping("/api/login")
public class LoginController {
    private final LoginService loginService;

    @PostMapping
    public ResponseEntity<?> login(@Valid @RequestBody LoginReq request) {
        return loginService.login(request);
    }
}