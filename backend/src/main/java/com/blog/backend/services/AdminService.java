package com.blog.backend.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.blog.backend.entity.User;
import com.blog.backend.entity.Role;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.exception.UserNotFoundException;
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
    private final PostService postService;

    @Transactional
    public void setUserBanned(Long userId, boolean banned) {
        User user = manageableUser(userId);
        if (user.isBanned() != banned) {
            user.setBanned(banned);
            userRepository.save(user);
        }
    }

    @Transactional
    public void deleteUser(Long userId) {

        User user = manageableUser(userId);

        // Include other users' interactions on these posts and defer media cleanup until commit.
        for (var post : postRepository.findByAuthorId(userId)) {
            postService.adminDeletePost(post.getId());
        }

        commentRepository.deleteByAuthorId(userId);

        likeRepository.deleteByUserId(userId);

        followRepository.deleteByFollowerId(userId);
        followRepository.deleteByFollowingId(userId);

        notificationRepository.deleteByUserId(userId);

        reportRepository.deleteByReporterId(userId);
        reportRepository.deleteByReportedUserId(userId);

        userRepository.delete(user);
    }

    private User manageableUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        if (user.getRole() == Role.ADMIN) {
            throw new BadRequestException("Administrator accounts cannot be moderated");
        }
        return user;
    }
}
