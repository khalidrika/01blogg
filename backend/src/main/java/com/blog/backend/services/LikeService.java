package com.blog.backend.services;

import java.util.Optional;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.blog.backend.entity.Like;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.PostNotFoundException;
import com.blog.backend.repository.LikeRepository;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LikeService {

    private final LikeRepository likeRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;

    public void toggleLike(Long postId) {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User user = userRepository.findByEmail(email);

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new PostNotFoundException("Post not found"));

        Optional<Like> existingLike = likeRepository.findByUserIdAndPostId(
                user.getId(),
                post.getId());

        if (existingLike.isPresent()) {
            likeRepository.delete(existingLike.get());
            return;
        }

        Like like = new Like();
        like.setUser(user);
        like.setPost(post);

        likeRepository.save(like);
    }

    public long getLikeCount(Long postId) {

        postRepository.findById(postId)
                .orElseThrow(() -> new PostNotFoundException("Post not found"));

        return likeRepository.countByPostId(postId);
    }
}