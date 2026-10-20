package com.blog.backend.services;

import com.blog.backend.dto.PostResponse;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.exception.PostForbiddenException;
import com.blog.backend.exception.PostNotFoundException;
import com.blog.backend.exception.UserNotFoundException;
import com.blog.backend.repository.CommentRepository;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.LikeRepository;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class PostService {
    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final FollowRepository followRepository;
    private final CommentRepository commentRepository;
    private final LikeRepository likeRepository;
    private final MediaStorage mediaStorage;

    @Transactional(readOnly = true)
    public List<PostResponse> getAllPosts() {
        return postRepository.findAll().stream().map(this::response).toList();
    }

    @Transactional
    public PostResponse createPost(String title, String content, MultipartFile media) {
        validateText(title, content);
        User user = currentUser();
        MediaStorage.StoredMedia stored = media == null ? null : mediaStorage.store(media);
        try {
            Post post = new Post();
            post.setTitle(title.trim()); post.setContent(content.trim());
            post.setAuthor(user); post.setCreatedAt(LocalDateTime.now());
            if (stored != null) { post.setMediaUrl(stored.url()); post.setMediaType(stored.type()); }
            Post saved = postRepository.save(post);
            notificationService.notifyFollowersAboutNewPost(user);
            return response(saved);
        } catch (RuntimeException exception) {
            if (stored != null) mediaStorage.discard(stored.url());
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public PostResponse getPostById(Long id) { return response(requirePost(id)); }

    @Transactional
    public PostResponse updatePost(Long id, String title, String content, MultipartFile media) {
        Post post = requirePost(id);
        requireOwner(post);
        validateText(title, content);
        String oldUrl = post.getMediaUrl();
        if (media != null && oldUrl != null) mediaStorage.resolve(oldUrl);
        MediaStorage.StoredMedia stored = media == null ? null : mediaStorage.store(media);
        try {
            post.setTitle(title.trim()); post.setContent(content.trim());
            if (stored != null) { post.setMediaUrl(stored.url()); post.setMediaType(stored.type()); }
            Post saved = postRepository.save(post);
            if (stored != null) mediaStorage.deleteAfterCommit(oldUrl);
            return response(saved);
        } catch (RuntimeException exception) {
            if (stored != null) mediaStorage.discard(stored.url());
            throw exception;
        }
    }

    @Transactional
    public void deletePost(Long id) {
        Post post = requirePost(id);
        requireOwner(post);
        deletePostAndRelations(post);
    }

    @Transactional
    public void adminDeletePost(Long id) { deletePostAndRelations(requirePost(id)); }

    private void deletePostAndRelations(Post post) {
        if (post.getMediaUrl() != null) mediaStorage.resolve(post.getMediaUrl());
        commentRepository.deleteByPostId(post.getId());
        likeRepository.deleteByPostId(post.getId());
        postRepository.delete(post);
        mediaStorage.deleteAfterCommit(post.getMediaUrl());
    }

    @Transactional(readOnly = true)
    public List<PostResponse> getPostsByUserId(Long id) {
        return postRepository.findByAuthorId(id).stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public List<PostResponse> getFeed() {
        User user = currentUser();
        List<Long> authorIds = followRepository.findByFollowerId(user.getId()).stream()
            .map(follow -> follow.getFollowing().getId()).toList();
        return postRepository.findByAuthorIdInOrderByCreatedAtDesc(authorIds).stream().map(this::response).toList();
    }

    private Post requirePost(Long id) {
        return postRepository.findById(id).orElseThrow(() -> new PostNotFoundException("Post not found"));
    }
    private User currentUser() {
        User user = userRepository.findByEmail(SecurityContextHolder.getContext().getAuthentication().getName());
        if (user == null) throw new UserNotFoundException("User not found");
        return user;
    }
    private void requireOwner(Post post) {
        if (!post.getAuthor().getEmail().equals(SecurityContextHolder.getContext().getAuthentication().getName())) {
            throw new PostForbiddenException("You can only modify your own posts");
        }
    }
    private void validateText(String title, String content) {
        if (title == null || title.isBlank()) throw new BadRequestException("Title is required");
        if (content == null || content.isBlank()) throw new BadRequestException("Content is required");
        if (title.trim().length() > 255) throw new BadRequestException("Title must be 255 characters or fewer");
        if (content.trim().length() > 10_000) throw new BadRequestException("Content must be 10000 characters or fewer");
    }
    private PostResponse response(Post post) {
        return new PostResponse(post.getId(), post.getTitle(), post.getContent(), post.getAuthor().getId(),
            post.getAuthor().getUsername(), post.getMediaUrl(), post.getMediaType(), post.getCreatedAt());
    }
}
