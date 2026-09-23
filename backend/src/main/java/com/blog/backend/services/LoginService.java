package com.blog.backend.services;

import com.blog.backend.dto.LoginReq;
import com.blog.backend.dto.LoginResponse;
import com.blog.backend.entity.User;
import com.blog.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.http.ResponseEntity;
import com.blog.backend.dto.ErrorResponse;

@Service
@RequiredArgsConstructor
public class LoginService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public ResponseEntity<?> login(LoginReq request) {

        User user = userRepository.findByEmail(request.email());

        if (user == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid email or password"));
        }

        boolean isPasswordMatch = passwordEncoder.matches(request.password(), user.getPassword());

        if (!isPasswordMatch) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid email or password"));
        }

        String token = jwtService.generateToken(user.getEmail());

        LoginResponse loginResponse = new LoginResponse(token, user.getId(), user.getUsername(), user.getEmail(),
                user.getRole().name());

        return ResponseEntity.ok().body(loginResponse);
    }

}