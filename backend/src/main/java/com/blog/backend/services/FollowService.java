package com.blog.backend.services;

import java.util.List;
import java.util.Optional;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.blog.backend.dto.UserResponse;
import com.blog.backend.dto.FollowStatusResponse;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.entity.Follow;
import com.blog.backend.entity.User;
import com.blog.backend.exception.UserNotFoundException;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FollowService {

    private final FollowRepository followRepository;
    private final UserRepository userRepository;

    @Transactional
    public FollowStatusResponse toggleFollow(Long followingId) {
        User follower = currentUser(true);
        User target = targetUser(followingId);
        Optional<Follow> existing = followRepository.findByFollowerIdAndFollowingId(follower.getId(), followingId);
        return updateFollowing(follower, target, existing, existing.isEmpty());
    }

    @Transactional
    public FollowStatusResponse setFollowing(Long followingId, boolean following) {
        // Serialize mutations by this user, including requests from multiple tabs.
        User follower = currentUser(true);
        User target = targetUser(followingId);
        Optional<Follow> existing = followRepository.findByFollowerIdAndFollowingId(follower.getId(), followingId);
        return updateFollowing(follower, target, existing, following);
    }

    @Transactional(readOnly = true)
    public FollowStatusResponse getFollowStatus(Long followingId) {
        User follower = currentUser(false);
        targetUser(followingId);
        boolean following = followRepository.findByFollowerIdAndFollowingId(follower.getId(), followingId).isPresent();
        return new FollowStatusResponse(following, followRepository.countByFollowingId(followingId));
    }

    private FollowStatusResponse updateFollowing(User follower, User target, Optional<Follow> existing, boolean following) {
        if (follower.getId().equals(target.getId())) {
            throw new BadRequestException("You cannot follow yourself");
        }
        if (following && target.isBanned()) {
            throw new BadRequestException("You cannot follow a banned user");
        }
        if (following && existing.isEmpty()) {
            Follow follow = new Follow();
            follow.setFollower(follower);
            follow.setFollowing(target);
            followRepository.save(follow);
        } else if (!following && existing.isPresent()) {
            followRepository.delete(existing.get());
        }
        return new FollowStatusResponse(following, followRepository.countByFollowingId(target.getId()));
    }

    private User currentUser(boolean lock) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = lock ? userRepository.findByEmailForUpdate(email) : userRepository.findByEmail(email);
        if (user == null) throw new UserNotFoundException("User not found");
        return user;
    }

    private User targetUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new UserNotFoundException("User not found"));
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
                        follow.getFollower().getRole().name(),
                        follow.getFollower().isBanned()
                    ))
                .toList();
    }

    public List<UserResponse> getFollowing(Long userId) {

        return followRepository.findByFollowerId(userId)
                .stream()
                .map(follow -> new UserResponse(
                        follow.getFollowing().getId(),
                        follow.getFollowing().getUsername(),
                        follow.getFollowing().getEmail(),
                        follow.getFollowing().getRole().name(),
                        follow.getFollowing().isBanned()
                    ))
                .toList();
    }
}