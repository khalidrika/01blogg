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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import com.blog.backend.dto.PostResponse;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.PostForbiddenException;
import com.blog.backend.exception.PostNotFoundException;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.CommentRepository;
import com.blog.backend.repository.LikeRepository;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.exception.BadRequestException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class PostService {

        private final PostRepository postRepository;
        private final UserRepository userRepository;
        private final NotificationService notificationService;
        private final FollowRepository followRepository;
        private final CommentRepository commentRepository;
        private final LikeRepository likeRepository;

        public List<PostResponse> getAllPosts() {

                return postRepository.findAll()
                                .stream()
                                .map(post -> new PostResponse(
                                                post.getId(),
                                                post.getTitle(),
                                                post.getContent(),
                                                post.getAuthor().getId(),
                                                post.getAuthor().getUsername(),
                                                post.getMediaUrl(),
                                                post.getMediaType(),
                                                post.getCreatedAt()))
                                .toList();
        }

        public PostResponse createPost(
                        String title,
                        String content,
                        MultipartFile media) {

                if (title == null || title.isBlank()) {
                        throw new BadRequestException("Title is required");
                }

                if (content == null || content.isBlank()) {
                        throw new BadRequestException("Content is required");
                }

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

                if (media != null) {

                        if (media.isEmpty()) {
                                throw new BadRequestException("Media file cannot be empty");
                        }

                        String originalName = media.getOriginalFilename();
                        String contentType = media.getContentType();

                        if (originalName == null) {
                                throw new BadRequestException("Invalid media file");
                        }

                        String lowerName = originalName.toLowerCase();

                        boolean validImage = (lowerName.endsWith(".png")
                                        || lowerName.endsWith(".jpg")
                                        || lowerName.endsWith(".jpeg"))
                                        && contentType != null
                                        && contentType.startsWith("image/");

                        boolean validVideo = lowerName.endsWith(".mp4")
                                        && contentType != null
                                        && contentType.equals("video/mp4");

                        if (!validImage && !validVideo) {
                                throw new BadRequestException(
                                                "Only PNG, JPG, JPEG and MP4 files are allowed");
                        }

                        if (validImage) {
                                post.setMediaType("image");
                        } else {
                                post.setMediaType("video");
                        }
                        try {

                                Path uploadDirectory = Paths.get("uploads");

                                Files.createDirectories(uploadDirectory);

                                String fileName = UUID.randomUUID()
                                                + "_"
                                                + media.getOriginalFilename();

                                Path filePath = uploadDirectory.resolve(fileName);

                                media.transferTo(filePath);

                                post.setMediaUrl(
                                                "/uploads/" + fileName);

                        } catch (IOException e) {

                                throw new RuntimeException(
                                                "Could not save media file");
                        }
                }

                Post savedPost = postRepository.save(post);

                notificationService
                                .notifyFollowersAboutNewPost(user);

                return new PostResponse(
                                savedPost.getId(),
                                savedPost.getTitle(),
                                savedPost.getContent(),
                                savedPost.getAuthor().getId(),
                                savedPost.getAuthor().getUsername(),
                                post.getMediaUrl(),
                                post.getMediaType(),
                                savedPost.getCreatedAt());
        }

        public PostResponse getPostById(Long id) {

                Post post = postRepository.findById(id)
                                .orElseThrow(
                                                () -> new PostNotFoundException(
                                                                "Post not found"));

                return new PostResponse(
                                post.getId(),
                                post.getTitle(),
                                post.getContent(),
                                post.getAuthor().getId(),
                                post.getAuthor().getUsername(),
                                post.getMediaUrl(),
                                post.getMediaType(),
                                post.getCreatedAt());
        }

        public PostResponse updatePost(
                        Long id,
                        String title,
                        String content,
                        MultipartFile media) {

                Post post = postRepository.findById(id)
                                .orElseThrow(() -> new PostNotFoundException("Post not found"));

                String email = SecurityContextHolder
                                .getContext()
                                .getAuthentication()
                                .getName();

                if (!post.getAuthor().getEmail().equals(email)) {
                        throw new PostForbiddenException("You cannot update this post");
                }

                if (title == null || title.isBlank()) {
                        throw new BadRequestException("Title is required");
                }

                if (content == null || content.isBlank()) {
                        throw new BadRequestException("Content is required");
                }

                post.setTitle(title);
                post.setContent(content);

                if (media != null) {

                        if (media.isEmpty()) {
                                throw new BadRequestException("Media file cannot be empty");
                        }

                        String originalName = media.getOriginalFilename();
                        String contentType = media.getContentType();

                        if (originalName == null) {
                                throw new BadRequestException("Invalid media file");
                        }

                        String lowerName = originalName.toLowerCase();

                        boolean validImage = (lowerName.endsWith(".png")
                                        || lowerName.endsWith(".jpg")
                                        || lowerName.endsWith(".jpeg"))
                                        && contentType != null
                                        && contentType.startsWith("image/");

                        boolean validVideo = lowerName.endsWith(".mp4")
                                        && contentType != null
                                        && contentType.equals("video/mp4");

                        if (!validImage && !validVideo) {
                                throw new BadRequestException(
                                                "Only PNG, JPG, JPEG and MP4 files are allowed");
                        }

                        if (validImage) {
                                post.setMediaType("image");
                        } else {
                                post.setMediaType("video");
                        }

                        try {
                                Path uploadDirectory = Paths.get("uploads");

                                Files.createDirectories(uploadDirectory);

                                String fileName = UUID.randomUUID() + "_" + media.getOriginalFilename();

                                Path filePath = uploadDirectory.resolve(fileName);

                                media.transferTo(filePath);

                                if (post.getMediaUrl() != null) {

                                        Path oldFile = Paths.get(
                                                        post.getMediaUrl().replaceFirst("^/uploads/", "uploads/"));

                                        try {
                                                Files.deleteIfExists(oldFile);
                                        } catch (IOException e) {
                                                throw new RuntimeException("Could not delete old media file");
                                        }
                                }

                                post.setMediaUrl("/uploads/" + fileName);

                        } catch (IOException e) {
                                throw new RuntimeException("Could not save media file");
                        }
                }

                Post savedPost = postRepository.save(post);

                return new PostResponse(
                                savedPost.getId(),
                                savedPost.getTitle(),
                                savedPost.getContent(),
                                savedPost.getAuthor().getId(),
                                savedPost.getAuthor().getUsername(),
                                savedPost.getMediaUrl(),
                                savedPost.getMediaType(),
                                savedPost.getCreatedAt());
        }

        @Transactional
        public void deletePost(Long id) {
                Post post = postRepository.findById(id)
                                .orElseThrow(() -> new PostNotFoundException("Post not found"));
                String email = SecurityContextHolder.getContext().getAuthentication().getName();
                if (!post.getAuthor().getEmail().equals(email)) {
                        throw new PostForbiddenException("You cannot delete this post");
                }
                deletePostAndRelations(post);
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
                                                post.getMediaUrl(),
                                                post.getMediaType(),
                                                post.getCreatedAt()))
                                .toList();
        }

        @Transactional
        public void adminDeletePost(Long postId) {
                Post post = postRepository.findById(postId)
                                .orElseThrow(() -> new PostNotFoundException("Post not found"));
                deletePostAndRelations(post);
        }

        private void deletePostAndRelations(Post post) {
                Path mediaFile = null;
                if (post.getMediaUrl() != null) {
                        Path uploads = Paths.get("uploads").toAbsolutePath().normalize();
                        String mediaUrl = post.getMediaUrl();
                        if (!mediaUrl.startsWith("/uploads/")) {
                                throw new BadRequestException("Invalid media path");
                        }
                        mediaFile = uploads.resolve(mediaUrl.substring("/uploads/".length())).normalize();
                        // Uploads are stored directly inside this directory.
                        if (!uploads.equals(mediaFile.getParent())) {
                                throw new BadRequestException("Invalid media path");
                        }
                }

                commentRepository.deleteByPostId(post.getId());
                likeRepository.deleteByPostId(post.getId());
                postRepository.delete(post);

                if (mediaFile != null) {
                        Path fileToDelete = mediaFile;
                        // Never remove media for a database deletion that rolls back.
                        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                                @Override
                                public void afterCommit() {
                                        try {
                                                Files.deleteIfExists(fileToDelete);
                                        } catch (IOException e) {
                                                // The post is already deleted; keep cleanup failures out of the API response.
                                                log.warn("Could not clean up media for deleted post {}: {}", post.getId(), fileToDelete, e);
                                        }
                                }
                        });
                }
        }

        public List<PostResponse> getFeed() {

                String email = SecurityContextHolder
                                .getContext()
                                .getAuthentication()
                                .getName();

                User user = userRepository.findByEmail(email);

                List<Long> followingIds = followRepository
                                .findByFollowerId(user.getId())
                                .stream()
                                .map(follow -> follow.getFollowing().getId())
                                .toList();

                return postRepository
                                .findByAuthorIdInOrderByCreatedAtDesc(
                                                followingIds)
                                .stream()
                                .map(post -> new PostResponse(
                                                post.getId(),
                                                post.getTitle(),
                                                post.getContent(),
                                                post.getAuthor().getId(),
                                                post.getAuthor().getUsername(),
                                                post.getMediaUrl(),
                                                post.getMediaType(),
                                                post.getCreatedAt()))
                                .toList();
        }
}