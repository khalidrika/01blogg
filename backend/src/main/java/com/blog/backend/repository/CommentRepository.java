package com.blog.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import com.blog.backend.entity.Comment;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByPostId(Long postId);
    List<Comment> findByPostIdOrderByCreatedAtAscIdAsc(Long postId);
    void deleteByAuthorId(Long userId);
    void deleteByPostId(Long postId);
}
