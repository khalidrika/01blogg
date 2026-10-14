package com.blog.backend.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.blog.backend.entity.User;
import com.blog.backend.repository.CommentRepository;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.LikeRepository;
import com.blog.backend.repository.NotificationRepository;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.ReportRepository;
import com.blog.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final LikeRepository likeRepository;
    private final FollowRepository followRepository;
    private final NotificationRepository notificationRepository;
    private final ReportRepository reportRepository;

    @Transactional
    public void deleteUser(Long userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        commentRepository.deleteByAuthorId(userId);

        likeRepository.deleteByUserId(userId);

        followRepository.deleteByFollowerId(userId);
        followRepository.deleteByFollowingId(userId);

        notificationRepository.deleteByUserId(userId);

        reportRepository.deleteByReporterId(userId);
        reportRepository.deleteByReportedUserId(userId);

        postRepository.deleteByAuthorId(userId);

        userRepository.delete(user);
    }
}