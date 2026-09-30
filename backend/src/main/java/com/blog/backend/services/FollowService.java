package com.blog.backend.services;

import java.util.List;
import java.util.Optional;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.blog.backend.dto.UserResponse;
import com.blog.backend.entity.Follow;
import com.blog.backend.entity.User;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FollowService {

    private final FollowRepository followRepository;
    private final UserRepository userRepository;

    public void toggleFollow(Long followingId) {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User follower = userRepository.findByEmail(email);

        User following = userRepository.findById(followingId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Optional<Follow> existingFollow = followRepository.findByFollowerIdAndFollowingId(
                follower.getId(),
                following.getId());

        if (existingFollow.isPresent()) {
            followRepository.delete(existingFollow.get());
            return;
        }

        Follow follow = new Follow();
        follow.setFollower(follower);
        follow.setFollowing(following);

        if (follower.getId().equals(following.getId())) {
            throw new RuntimeException("You cannot follow yourself");
        }

        followRepository.save(follow);
    }

    public long getFollowersCount(Long userId) {
        return followRepository.countByFollowingId(userId);
    }

    public long getFollowingCount(Long userId) {
        return followRepository.countByFollowerId(userId);
    }

    public List<UserResponse> getFollowers(Long userId) {

        return followRepository.findByFollowingId(userId)
                .stream()
                .map(follow -> new UserResponse(
                        follow.getFollower().getId(),
                        follow.getFollower().getUsername(),
                        follow.getFollower().getEmail(),
                        follow.getFollower().getRole().name()))
                .toList();
    }

    public List<UserResponse> getFollowing(Long userId) {

        return followRepository.findByFollowerId(userId)
                .stream()
                .map(follow -> new UserResponse(
                        follow.getFollowing().getId(),
                        follow.getFollowing().getUsername(),
                        follow.getFollowing().getEmail(),
                        follow.getFollowing().getRole().name()))
                .toList();
    }
}