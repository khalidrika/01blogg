
package com.blog.backend.controllers;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.blog.backend.dto.PostResponse;
import com.blog.backend.dto.ProfileResponse;
import com.blog.backend.services.PostService;
import com.blog.backend.services.ProfileService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class ProfileController {

    private final ProfileService profileService;
    private final PostService postService;

    @GetMapping
    public List<ProfileResponse> getAllProfiles() {
        return profileService.getAllProfiles();
    }

    @GetMapping("/{userId}")
    public ProfileResponse getProfile(
            @PathVariable Long userId) {
        return profileService.getProfile(userId);
    }

    @GetMapping("/{userId}/posts")
    public List<PostResponse> getUserPosts(
            @PathVariable Long userId) {
        return postService.getPostsByUserId(userId);
    }
}
