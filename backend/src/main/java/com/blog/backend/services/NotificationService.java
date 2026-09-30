package com.blog.backend.services;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.blog.backend.entity.Follow;
import com.blog.backend.entity.Notification;
import com.blog.backend.entity.User;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.NotificationRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final FollowRepository followRepository;

    public void notifyFollowersAboutNewPost(User author) {

        List<Follow> followers =
                followRepository.findByFollowingId(author.getId());

        for (Follow follow : followers) {

            Notification notification = new Notification();

            notification.setUser(follow.getFollower());

            notification.setMessage(
                    author.getUsername() + " published a new post"
            );

            notification.setRead(false);

            notification.setCreatedAt(LocalDateTime.now());

            notificationRepository.save(notification);
        }
    }
}