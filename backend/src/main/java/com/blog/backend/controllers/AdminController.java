package com.blog.backend.controllers;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.blog.backend.dto.ReportResponse;

import com.blog.backend.dto.PostResponse;
import com.blog.backend.dto.UserResponse;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.services.AdminService;
import com.blog.backend.services.PostService;
import com.blog.backend.services.ReportService;
import com.blog.backend.entity.User;
import com.blog.backend.exception.UserNotFoundException;

import lombok.RequiredArgsConstructor;  

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin")
public class AdminController {

    private final ReportService reportService;
    private final UserRepository userRepository;
    private final PostService postService;
    private final AdminService adminService;

    @GetMapping("/reports")
    public List<ReportResponse> getAllReports() {
        return reportService.getAllReports();
    }

    @GetMapping("/users")
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(user -> new UserResponse(
                        user.getId(),
                        user.getUsername(),
                        user.getEmail(),
                        user.getRole().name()))
                .toList();
    }

    @GetMapping("/posts")
    public List<PostResponse> getAllPosts() {
        return postService.getAllPosts();
    }

    @DeleteMapping("/posts/{postId}")
    public ResponseEntity<Void> deletePost(@PathVariable Long postId) {

        postService.adminDeletePost(postId);

        return ResponseEntity.noContent().build();
    }

    @PutMapping("/users/{userId}/ban")
    public ResponseEntity<Void> banUser(@PathVariable Long userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        user.setBanned(true);

        userRepository.save(user);

        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId) {

        adminService.deleteUser(userId);

        return ResponseEntity.noContent().build();
    }
}