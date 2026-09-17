package com.blog.backend.services;
import org.springframework.http.ResponseEntity;
import com.blog.backend.entity.User;
import com.blog.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service 
public class RegistrationService {

    public ResponseEntity<User> register(User user) {
        
        return ResponseEntity.ok(user);
    }

}