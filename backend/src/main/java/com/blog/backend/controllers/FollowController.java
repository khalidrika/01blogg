package com.blog.backend.controllers;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.blog.backend.dto.UserResponse;
import com.blog.backend.services.FollowService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class FollowController {

    private final FollowService followService;

    @PostMapping("/{userId}/follow")
    public ResponseEntity<Void> toggleFollow(@PathVariable Long userId) {

        followService.toggleFollow(userId);

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{userId}/followers/count")
    public long getFollowersCount(@PathVariable Long userId) {
        return followService.getFollowersCount(userId);
    }

    @GetMapping("/{userId}/following/count")
    public long getFollowingCount(@PathVariable Long userId) {
        return followService.getFollowingCount(userId);
    }

    @GetMapping("/{userId}/followers")
    public List<UserResponse> getFollowers(@PathVariable Long userId) {
        return followService.getFollowers(userId);
    }

    @GetMapping("/{userId}/following")
    public List<UserResponse> getFollowing(@PathVariable Long userId) {
        return followService.getFollowing(userId);
    }
}
