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
import com.blog.backend.exception.PostForbiddenException;
import com.blog.backend.exception.PostNotFoundException;

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

        public PostResponse getPostById(Long id) {

                Post post = postRepository.findById(id) // return Optional<post> or Optional<null>
                                .orElseThrow(() -> new PostNotFoundException("Post not found")); // if Optional == null
                                                                                                 // return Exception

                return new PostResponse(
                                post.getId(),
                                post.getTitle(),
                                post.getContent(),
                                post.getAuthor().getId(),
                                post.getAuthor().getUsername(),
                                post.getCreatedAt());
        }

        // updat
        public PostResponse updatePost(Long id, PostRequest request) {

                Post post = postRepository.findById(id)
                                .orElseThrow(() -> new PostNotFoundException("Post not found"));

                String email = SecurityContextHolder
                                .getContext()
                                .getAuthentication()
                                .getName();

                if (!post.getAuthor().getEmail().equals(email)) {
                        throw new PostForbiddenException("You cannot update this post");
                }

                post.setTitle(request.title());
                post.setContent(request.content());

                Post savedPost = postRepository.save(post);

                return new PostResponse(
                                savedPost.getId(),
                                savedPost.getTitle(),
                                savedPost.getContent(),
                                savedPost.getAuthor().getId(),
                                savedPost.getAuthor().getUsername(),
                                savedPost.getCreatedAt());
        }

        // delete
        public void deletePost(Long id) {

                Post post = postRepository.findById(id)
                                .orElseThrow(() -> new PostNotFoundException("Post not found"));

                String email = SecurityContextHolder
                                .getContext()
                                .getAuthentication()
                                .getName();

                if (!post.getAuthor().getEmail().equals(email)) {
                        throw new PostForbiddenException("You cannot delete this post");
                }

                postRepository.delete(post);
        }
}