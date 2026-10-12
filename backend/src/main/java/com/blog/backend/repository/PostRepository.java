package com.blog.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.blog.backend.entity.Post;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findByAuthorId(Long userId);
}