package com.blog.backend.services;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.exception.UserNotFoundException;

import com.blog.backend.dto.CommentRequest;
import com.blog.backend.dto.CommentResponse;
import com.blog.backend.entity.Comment;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.CommentNotFoundException;
import com.blog.backend.exception.PostForbiddenException;
import com.blog.backend.exception.PostNotFoundException;
import com.blog.backend.repository.CommentRepository;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CommentService {

        private final CommentRepository commentRepository;
        private final PostRepository postRepository;
        private final UserRepository userRepository;

        @Transactional
        public CommentResponse createComment(Long postId, CommentRequest request) {
                if (request == null || request.content() == null || request.content().isBlank()) {
                        throw new BadRequestException("Comment content is required");
                }
                if (request.content().length() > 255) {
                        throw new BadRequestException("Comment must be 255 characters or fewer");
                }

                String email = SecurityContextHolder
                                .getContext()
                                .getAuthentication()
                                .getName();

                User user = userRepository.findByEmail(email);
                if (user == null) throw new UserNotFoundException("User not found");

                Post post = postRepository.findById(postId)
                                .orElseThrow(() -> new PostNotFoundException("Post not found"));

                Comment comment = new Comment();

                comment.setContent(request.content().trim());
                comment.setAuthor(user);
                comment.setPost(post);
                comment.setCreatedAt(LocalDateTime.now());

                Comment savedComment = commentRepository.save(comment);

                return new CommentResponse(
                                savedComment.getId(),
                                savedComment.getContent(),
                                savedComment.getAuthor().getId(),
                                savedComment.getAuthor().getUsername(),
                                savedComment.getPost().getId(),
                                savedComment.getCreatedAt());
        }

        @Transactional(readOnly = true)
        public List<CommentResponse> getCommentsByPostId(Long postId) {

                Post post = postRepository.findById(postId)
                                .orElseThrow(() -> new PostNotFoundException("Post not found"));

                return commentRepository.findByPostIdOrderByCreatedAtAscIdAsc(post.getId())
                                .stream()
                                .map(comment -> new CommentResponse(
                                                comment.getId(),
                                                comment.getContent(),
                                                comment.getAuthor().getId(),
                                                comment.getAuthor().getUsername(),
                                                comment.getPost().getId(),
                                                comment.getCreatedAt()))
                                .toList();
        }

        @Transactional
        public void deleteComment(Long id) {

                Comment comment = commentRepository.findById(id)
                                .orElseThrow(() -> new CommentNotFoundException("Comment not found"));

                String email = SecurityContextHolder
                                .getContext()
                                .getAuthentication()
                                .getName();

                if (!comment.getAuthor().getEmail().equals(email)) {
                        throw new PostForbiddenException("You cannot delete this comment");
                }

                commentRepository.delete(comment);
        }
}
