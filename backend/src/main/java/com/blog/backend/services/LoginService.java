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
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class LoginService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public ResponseEntity<?> login(LoginReq request) {
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            return ResponseEntity.status(401).body(new ErrorResponse("Invalid email or password"));
        }

        User user = userRepository.findByEmail(request.email());

        if (user == null) {
            return ResponseEntity.status(401).body(new ErrorResponse("Invalid email or password"));
        }

        boolean isPasswordMatch = passwordEncoder.matches(request.password(), user.getPassword());

        if (!isPasswordMatch) {
            return ResponseEntity.status(401).body(new ErrorResponse("Invalid email or password"));
        }

        if (user.isBanned()) {
            return ResponseEntity.status(403).body(new ErrorResponse("Your account has been banned"));
        }

        String token = jwtService.generateToken(user.getEmail(), user.getId());

        LoginResponse loginResponse = new LoginResponse(token, user.getId(), user.getUsername(), user.getEmail(),
                user.getRole().name());

        return ResponseEntity.ok().body(loginResponse);
    }

}
