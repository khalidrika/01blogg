package com.blog.backend.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.blog.backend.dto.PostRequest;
import com.blog.backend.dto.PostResponse;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.PostForbiddenException;
import com.blog.backend.exception.PostNotFoundException;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;


@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final FollowRepository followRepository;

    public List<PostResponse> getAllPosts() {

        return postRepository.findAll()
                .stream()
                .map(post -> new PostResponse(
                        post.getId(),
                        post.getTitle(),
                        post.getContent(),
                        post.getAuthor().getId(),
                        post.getAuthor().getUsername(),
                        post.getCreatedAt()
                ))
                .toList();
    }



    public PostResponse createPost(
            String title,
            String content,
            MultipartFile media) {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User user = userRepository.findByEmail(email);

        Post post = new Post();

        post.setTitle(title);
        post.setContent(content);
        post.setAuthor(user);
        post.setCreatedAt(LocalDateTime.now());

        if (media != null && !media.isEmpty()) {

            String contentType = media.getContentType();

            if (contentType != null && contentType.startsWith("image/")) {

                post.setMediaType("image");

            } else if (contentType != null && contentType.startsWith("video/")) {

                post.setMediaType("video");

            } else {

                throw new RuntimeException(
                        "Only images and videos are allowed"
                );
            }

            try {

                Path uploadDirectory = Paths.get("uploads");

                Files.createDirectories(uploadDirectory);

                String fileName =
                        UUID.randomUUID()
                                + "_"
                                + media.getOriginalFilename();

                Path filePath =
                        uploadDirectory.resolve(fileName);

                media.transferTo(filePath);

                post.setMediaUrl(
                        "/uploads/" + fileName
                );

            } catch (IOException e) {

                throw new RuntimeException(
                        "Could not save media file"
                );
            }
        }

        Post savedPost =
                postRepository.save(post);

        notificationService
                .notifyFollowersAboutNewPost(user);

        return new PostResponse(
                savedPost.getId(),
                savedPost.getTitle(),
                savedPost.getContent(),
                savedPost.getAuthor().getId(),
                savedPost.getAuthor().getUsername(),
                savedPost.getCreatedAt()
        );
    }



    public PostResponse getPostById(Long id) {

        Post post = postRepository.findById(id)
                .orElseThrow(
                        () -> new PostNotFoundException(
                                "Post not found"
                        )
                );

        return new PostResponse(
                post.getId(),
                post.getTitle(),
                post.getContent(),
                post.getAuthor().getId(),
                post.getAuthor().getUsername(),
                post.getCreatedAt()
        );
    }

    public PostResponse updatePost(
            Long id,
            PostRequest request) {

        Post post = postRepository.findById(id)
                .orElseThrow(
                        () -> new PostNotFoundException(
                                "Post not found"
                        )
                );

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        if (!post.getAuthor()
                .getEmail()
                .equals(email)) {

            throw new PostForbiddenException(
                    "You cannot update this post"
            );
        }

        post.setTitle(request.title());
        post.setContent(request.content());

        Post savedPost =
                postRepository.save(post);

        return new PostResponse(
                savedPost.getId(),
                savedPost.getTitle(),
                savedPost.getContent(),
                savedPost.getAuthor().getId(),
                savedPost.getAuthor().getUsername(),
                savedPost.getCreatedAt()
        );
    }




    public void deletePost(Long id) {

        Post post = postRepository.findById(id)
                .orElseThrow(
                        () -> new PostNotFoundException(
                                "Post not found"
                        )
                );

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        if (!post.getAuthor()
                .getEmail()
                .equals(email)) {

            throw new PostForbiddenException(
                    "You cannot delete this post"
            );
        }

        postRepository.delete(post);
    }



    public List<PostResponse> getPostsByUserId(
            Long userId) {

        return postRepository
                .findByAuthorId(userId)
                .stream()
                .map(post -> new PostResponse(
                        post.getId(),
                        post.getTitle(),
                        post.getContent(),
                        post.getAuthor().getId(),
                        post.getAuthor().getUsername(),
                        post.getCreatedAt()
                ))
                .toList();
    }


    
    public void adminDeletePost(Long postId) {

        Post post = postRepository.findById(postId)
                .orElseThrow(
                        () -> new PostNotFoundException(
                                "Post not found"
                        )
                );

        postRepository.delete(post);
    }

    public List<PostResponse> getFeed() {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User user =
                userRepository.findByEmail(email);

        List<Long> followingIds =
                followRepository
                        .findByFollowerId(user.getId())
                        .stream()
                        .map(follow ->
                                follow.getFollowing().getId()
                        )
                        .toList();

        return postRepository
                .findByAuthorIdInOrderByCreatedAtDesc(
                        followingIds
                )
                .stream()
                .map(post -> new PostResponse(
                        post.getId(),
                        post.getTitle(),
                        post.getContent(),
                        post.getAuthor().getId(),
                        post.getAuthor().getUsername(),
                        post.getCreatedAt()
                ))
                .toList();
    }
}