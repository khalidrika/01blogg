package com.blog.backend.services;

import com.blog.backend.entity.Post;
import com.blog.backend.entity.Role;
import com.blog.backend.entity.User;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.exception.UserNotFoundException;
import com.blog.backend.repository.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final PostRepository posts = mock(PostRepository.class);
    private final CommentRepository comments = mock(CommentRepository.class);
    private final LikeRepository likes = mock(LikeRepository.class);
    private final FollowRepository follows = mock(FollowRepository.class);
    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final ReportRepository reports = mock(ReportRepository.class);
    private final PostService postService = new PostService(posts, users, mock(NotificationService.class), follows, comments, likes);
    private final AdminService service = new AdminService(users, posts, comments, likes, follows, notifications, reports, postService);
    private User user;
    private Post post;
    private Path media;

    @BeforeEach void setup() {
        user = new User(); user.setId(2L); user.setRole(Role.USER);
        post = new Post(); post.setId(10L); post.setAuthor(user);
        when(users.findById(2L)).thenReturn(Optional.of(user));
        when(posts.findByAuthorId(2L)).thenReturn(List.of(post));
        when(posts.findById(10L)).thenReturn(Optional.of(post));
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach void cleanup() throws Exception {
        TransactionSynchronizationManager.clearSynchronization();
        if (media != null) Files.deleteIfExists(media);
    }

    private void attachMedia() throws Exception {
        Files.createDirectories(Path.of("uploads"));
        media = Files.createTempFile(Path.of("uploads"), "admin-delete-test-", ".png");
        Files.write(media, new byte[]{1, 2, 3});
        post.setMediaUrl("/uploads/" + media.getFileName());
    }

    @Test void userDeletionRemovesPostInteractionsAndUserRelationsBeforeTheAccount() {
        service.deleteUser(2L);
        var order = inOrder(comments, likes, posts, follows, notifications, reports, users);
        order.verify(comments).deleteByPostId(10L);
        order.verify(likes).deleteByPostId(10L);
        order.verify(posts).delete(post);
        order.verify(comments).deleteByAuthorId(2L);
        order.verify(likes).deleteByUserId(2L);
        order.verify(follows).deleteByFollowerId(2L);
        order.verify(follows).deleteByFollowingId(2L);
        order.verify(notifications).deleteByUserId(2L);
        order.verify(reports).deleteByReporterId(2L);
        order.verify(reports).deleteByReportedUserId(2L);
        order.verify(users).delete(user);
        verify(posts, never()).deleteByAuthorId(any());
    }

    @Test void banAndUnbanAreIdempotent() {
        service.setUserBanned(2L, true); service.setUserBanned(2L, true);
        assertTrue(user.isBanned());
        verify(users, times(1)).save(user);
        service.setUserBanned(2L, false); service.setUserBanned(2L, false);
        assertFalse(user.isBanned());
        verify(users, times(2)).save(user);
    }

    @Test void adminAccountsCannotBeBannedUnbannedOrDeleted() {
        user.setRole(Role.ADMIN);
        assertThrows(BadRequestException.class, () -> service.setUserBanned(2L, true));
        assertThrows(BadRequestException.class, () -> service.setUserBanned(2L, false));
        assertThrows(BadRequestException.class, () -> service.deleteUser(2L));
        verify(users, never()).save(any()); verify(users, never()).delete(any());
        verifyNoInteractions(posts, comments, likes, follows, notifications, reports);
    }

    @Test void missingUsersReturnNotFoundWithoutMutations() {
        assertThrows(UserNotFoundException.class, () -> service.setUserBanned(999L, true));
        assertThrows(UserNotFoundException.class, () -> service.deleteUser(999L));
        verify(users, never()).save(any()); verify(users, never()).delete(any());
        verifyNoInteractions(posts, comments, likes, follows, notifications, reports);
    }

    @Test void successfulUserDeletionRemovesMediaOnlyAfterCommit() throws Exception {
        attachMedia(); service.deleteUser(2L);
        assertTrue(Files.exists(media));
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        assertFalse(Files.exists(media));
    }

    @Test void accountDeletionFailureKeepsMediaOnRollback() throws Exception {
        attachMedia();
        doThrow(new IllegalStateException("Database failure")).when(users).delete(user);
        assertThrows(IllegalStateException.class, () -> service.deleteUser(2L));
        TransactionSynchronizationManager.getSynchronizations().forEach(callback ->
            callback.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        assertArrayEquals(new byte[]{1, 2, 3}, Files.readAllBytes(media));
    }

    @Test void postDeletionFailureStopsAccountDeletion() {
        doThrow(new IllegalStateException("Database failure")).when(posts).delete(post);
        assertThrows(IllegalStateException.class, () -> service.deleteUser(2L));
        verify(users, never()).delete(any());
    }
}
