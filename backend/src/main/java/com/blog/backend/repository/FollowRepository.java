package com.blog.backend.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.blog.backend.entity.Follow;

public interface FollowRepository extends JpaRepository<Follow, Long> {

    Optional<Follow> findByFollowerIdAndFollowingId(
            Long followerId,
            Long followingId);

    long countByFollowingId(Long userId);
    long countByFollowerId(Long userId);
}