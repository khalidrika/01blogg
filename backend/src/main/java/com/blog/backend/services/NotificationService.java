package com.blog.backend.services;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.blog.backend.entity.Follow;
import com.blog.backend.entity.Notification;
import com.blog.backend.entity.User;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.NotificationRepository;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.dto.NotificationResponse;
import lombok.RequiredArgsConstructor;
import com.blog.backend.exception.NotificationForbiddenException;
import com.blog.backend.exception.NotificationNotFoundException;
import com.blog.backend.exception.UserNotFoundException;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final FollowRepository followRepository;
    private final UserRepository userRepository;

    @Transactional
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

    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications() {
        User user = currentUser();

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

    @Transactional
    public void markAsRead(Long notificationId) {
        setRead(notificationId, true);
    }

    @Transactional
    public void markAsUnread(Long notificationId) {
        setRead(notificationId, false);
    }

    private void setRead(Long notificationId, boolean read) {
        User currentUser = currentUser();

        Notification notification = notificationRepository
                .findById(notificationId)
                .orElseThrow(() -> new NotificationNotFoundException("Notification not found"));

        if (!notification.getUser().getId().equals(currentUser.getId())) {
            throw new NotificationForbiddenException("You cannot modify this notification");
        }

        if (notification.isRead() != read) {
            notification.setRead(read);
            notificationRepository.save(notification);
        }
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email);
        if (user == null) throw new UserNotFoundException("User not found");
        return user;
    }
}
