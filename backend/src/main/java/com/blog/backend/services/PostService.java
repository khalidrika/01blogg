package com.blog.backend.services;

import java.util.List;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final UserRepository userRepository;

    public List<Post> getAllPosts() {
        return postRepository.findAll(); // JpaRepository<Post, Long>
    }

    public Post createPost(Post post) {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User user = userRepository.findByEmail(email);

        post.setAuthor(user);

        return postRepository.save(post);
    }
}