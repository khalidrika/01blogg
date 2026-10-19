package com.blog.backend.services;

import com.blog.backend.controllers.NotificationController;
import com.blog.backend.entity.Follow;
import com.blog.backend.entity.Notification;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.exception.GlobalExceptionHandler;
import com.blog.backend.repository.CommentRepository;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.LikeRepository;
import com.blog.backend.repository.NotificationRepository;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class NotificationServiceTest {
    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final FollowRepository follows = mock(FollowRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final NotificationService service = new NotificationService(notifications, follows, users);
    private final User caller = user(1L, "student");
    private Notification notification;
    private MockMvc mvc;

    private static User user(Long id, String username) {
        User user = new User();
        user.setId(id); user.setUsername(username); user.setEmail(username + "@example.com");
        return user;
    }

    @BeforeEach void setup() {
        when(users.findByEmail(caller.getEmail())).thenReturn(caller);
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(caller.getEmail(), null));
        notification = new Notification();
        notification.setId(10L); notification.setUser(caller);
        notification.setMessage("Author published a new post");
        notification.setCreatedAt(LocalDateTime.of(2026, 10, 19, 10, 0));
        when(notifications.findById(10L)).thenReturn(Optional.of(notification));
        mvc = MockMvcBuilders.standaloneSetup(new NotificationController(service))
            .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    @Test void listsOnlyTheSignedInUsersNotifications() throws Exception {
        when(notifications.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(notification));
        mvc.perform(get("/api/notifications")).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(10))
            .andExpect(jsonPath("$[0].message").value("Author published a new post"))
            .andExpect(jsonPath("$[0].read").value(false))
            .andExpect(jsonPath("$[0].createdAt").exists())
            .andExpect(jsonPath("$[0].user").doesNotExist());
        verify(notifications).findByUserIdOrderByCreatedAtDesc(1L);
        verify(notifications, never()).findAll();
    }

    @Test void marksReadAndUnreadAndSupportsRetriesWithoutToggling() throws Exception {
        mvc.perform(put("/api/notifications/10/read")).andExpect(status().isNoContent());
        assertTrue(notification.isRead());
        mvc.perform(put("/api/notifications/10/read")).andExpect(status().isNoContent());
        assertTrue(notification.isRead());
        mvc.perform(put("/api/notifications/10/unread")).andExpect(status().isNoContent());
        assertFalse(notification.isRead());
        mvc.perform(put("/api/notifications/10/unread")).andExpect(status().isNoContent());
        assertFalse(notification.isRead());
        verify(notifications, times(2)).save(notification);
    }

    @ParameterizedTest @ValueSource(strings = { "read", "unread" })
    void cannotModifyAnotherUsersNotification(String action) throws Exception {
        notification.setUser(user(2L, "other"));
        notification.setRead(action.equals("unread"));
        boolean before = notification.isRead();
        mvc.perform(put("/api/notifications/10/" + action)).andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("You cannot modify this notification"));
        assertEquals(before, notification.isRead());
        verify(notifications, never()).save(any());
    }

    @ParameterizedTest @ValueSource(strings = { "read", "unread" })
    void missingNotificationReturns404(String action) throws Exception {
        mvc.perform(put("/api/notifications/999/" + action)).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Notification not found"));
        verify(notifications, never()).save(any());
    }

    @Test void missingCurrentUserReturns404InsteadOfNullPointerError() throws Exception {
        when(users.findByEmail(caller.getEmail())).thenReturn(null);
        mvc.perform(get("/api/notifications")).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("User not found"));
    }

    @Test void publishingAPostAutomaticallyNotifiesEveryFollower() {
        User follower1 = user(2L, "follower1");
        User follower2 = user(3L, "follower2");
        Follow first = new Follow(); first.setFollower(follower1); first.setFollowing(caller);
        Follow second = new Follow(); second.setFollower(follower2); second.setFollowing(caller);
        when(follows.findByFollowingId(1L)).thenReturn(List.of(first, second));
        PostRepository posts = mock(PostRepository.class);
        when(posts.save(any(Post.class))).thenAnswer(invocation -> {
            Post post = invocation.getArgument(0); post.setId(20L); return post;
        });
        PostService postService = new PostService(posts, users, service, follows,
            mock(CommentRepository.class), mock(LikeRepository.class));
        LocalDateTime before = LocalDateTime.now();
        postService.createPost("What I learned", "Learning Spring Boot", null);
        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(notifications, times(2)).save(saved.capture());
        assertEquals(List.of(follower1, follower2), saved.getAllValues().stream().map(Notification::getUser).toList());
        for (Notification item : saved.getAllValues()) {
            assertFalse(item.isRead());
            assertEquals("student published a new post", item.getMessage());
            assertFalse(item.getCreatedAt().isBefore(before));
            assertFalse(item.getCreatedAt().isAfter(LocalDateTime.now()));
        }
    }

    @Test void authorWithoutFollowersDoesNotGenerateNotifications() {
        when(follows.findByFollowingId(1L)).thenReturn(List.of());
        service.notifyFollowersAboutNewPost(caller);
        verify(notifications, never()).save(any());
    }

    @Test void rejectedPostDoesNotNotifyFollowers() {
        PostRepository posts = mock(PostRepository.class);
        PostService postService = new PostService(posts, users, service, follows,
            mock(CommentRepository.class), mock(LikeRepository.class));
        assertThrows(BadRequestException.class, () -> postService.createPost(" ", "Content", null));
        verifyNoInteractions(posts, notifications, follows);
    }
}
