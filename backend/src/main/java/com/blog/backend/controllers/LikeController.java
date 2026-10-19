package com.blog.backend.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import com.blog.backend.dto.LikeStatusResponse;

import com.blog.backend.services.LikeService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/posts")
public class LikeController {

    private final LikeService likeService;

    @GetMapping("/{postId}/likes")
    public LikeStatusResponse getStatus(@PathVariable Long postId) {
        return likeService.getStatus(postId);
    }

    @PutMapping("/{postId}/likes")
    public LikeStatusResponse like(@PathVariable Long postId) {
        return likeService.setLiked(postId, true);
    }

    @DeleteMapping("/{postId}/likes")
    public LikeStatusResponse unlike(@PathVariable Long postId) {
        return likeService.setLiked(postId, false);
    }

    @PostMapping("/{postId}/likes")
    public ResponseEntity<Void> addLike(@PathVariable Long postId) {

        likeService.toggleLike(postId);

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{postId}/likes/count")
    public long getLikeCount(@PathVariable Long postId) {
        return likeService.getLikeCount(postId);
    }
}
