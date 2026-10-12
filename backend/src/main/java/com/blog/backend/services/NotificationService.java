package com.blog.backend.services;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.blog.backend.entity.Follow;
import com.blog.backend.entity.Notification;
import com.blog.backend.entity.User;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.NotificationRepository;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.dto.NotificationResponse;
import lombok.RequiredArgsConstructor;
import com.blog.backend.exception.NotificationForbiddenException;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final FollowRepository followRepository;
    private final UserRepository userRepository; //

    public void notifyFollowersAboutNewPost(User author) {

        List<Follow> followers = followRepository.findByFollowingId(author.getId());

        for (Follow follow : followers) {

            Notification notification = new Notification();

            notification.setUser(follow.getFollower());

            notification.setMessage(
                    author.getUsername() + " published a new post");

            notification.setRead(false);

            notification.setCreatedAt(LocalDateTime.now());

            notificationRepository.save(notification);
        }
    }

    public List<NotificationResponse> getMyNotifications() {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User user = userRepository.findByEmail(email);

        return notificationRepository
                .findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(notification -> new NotificationResponse(
                        notification.getId(),
                        notification.getMessage(),
                        notification.isRead(),
                        notification.getCreatedAt()))
                .toList();
    }

    public void markAsRead(Long notificationId) {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User currentUser = userRepository.findByEmail(email);

        Notification notification = notificationRepository
                .findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        if (!notification.getUser().getId().equals(currentUser.getId())) {
            throw new NotificationForbiddenException("You cannot modify this notification");
        }

        notification.setRead(true);

        notificationRepository.save(notification);
    }
}