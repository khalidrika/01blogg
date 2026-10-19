
package com.blog.backend.services;

import java.util.List;

import org.springframework.stereotype.Service;

import com.blog.backend.dto.ProfileResponse;
import com.blog.backend.entity.User;
import com.blog.backend.exception.UserNotFoundException;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final FollowRepository followRepository;

    public ProfileResponse getProfile(Long userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new UserNotFoundException("User not found"));

        long followersCount =
                followRepository.countByFollowingId(userId);

        long followingCount =
                followRepository.countByFollowerId(userId);

        return new ProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name(),
                followersCount,
                followingCount
        );
    }

    public List<ProfileResponse> getAllProfiles() {

        return userRepository.findAll()
                .stream()
                .filter(user -> !user.isBanned())
                .filter(user ->
                        !"ADMIN".equals(user.getRole().name()))
                .map(user -> getProfile(user.getId()))
                .toList();
    }
}
