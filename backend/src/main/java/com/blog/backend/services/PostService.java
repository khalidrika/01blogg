package com.blog.backend.services;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.dto.PostRequest;
import com.blog.backend.dto.PostResponse;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final UserRepository userRepository;

    public List<PostResponse> getAllPosts() {
        return postRepository.findAll()
                .stream()
                .map(post -> new PostResponse(
                        post.getId(),
                        post.getTitle(),
                        post.getContent(),
                        post.getAuthor().getId(),
                        post.getAuthor().getUsername(),
                        post.getCreatedAt()))
                .toList();
    }

    public PostResponse createPost(PostRequest request) {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User user = userRepository.findByEmail(email);

        Post post = new Post();
        post.setTitle(request.title());
        post.setContent(request.content());
        post.setAuthor(user);
        post.setCreatedAt(LocalDateTime.now());

        Post savedPost = postRepository.save(post);
        return new PostResponse(
                savedPost.getId(),
                savedPost.getTitle(),
                savedPost.getContent(),
                savedPost.getAuthor().getId(),
                savedPost.getAuthor().getUsername(),
                savedPost.getCreatedAt());
    }
}