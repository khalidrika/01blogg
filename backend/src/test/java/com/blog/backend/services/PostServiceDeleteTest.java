package com.blog.backend.services;

import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.exception.PostForbiddenException;
import com.blog.backend.exception.PostNotFoundException;
import com.blog.backend.repository.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PostServiceDeleteTest {
    private final PostRepository posts = mock(PostRepository.class);
    private final CommentRepository comments = mock(CommentRepository.class);
    private final LikeRepository likes = mock(LikeRepository.class);
    private final PostService service = new PostService(posts, mock(UserRepository.class),
        mock(NotificationService.class), mock(FollowRepository.class), comments, likes, new MediaStorage("uploads"));
    private Post post;
    private Path media;

    @BeforeEach void setup() {
        User author = new User(); author.setEmail("owner@example.com");
        post = new Post(); post.setId(10L); post.setAuthor(author);
        when(posts.findById(10L)).thenReturn(Optional.of(post));
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("owner@example.com", null));
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach void cleanup() throws Exception {
        TransactionSynchronizationManager.clearSynchronization();
        SecurityContextHolder.clearContext();
        if (media != null) Files.deleteIfExists(media);
    }

    private void attachMedia() throws Exception {
        Path directory = Path.of("uploads");
        Files.createDirectories(directory);
        media = Files.createTempFile(directory, "post-delete-test-", ".png");
        Files.write(media, new byte[]{1, 2, 3});
        post.setMediaUrl("/uploads/" + media.getFileName());
    }

    @Test void ownerDeletesRelationshipsBeforePost() {
        service.deletePost(10L);
        var order = inOrder(comments, likes, posts);
        order.verify(comments).deleteByPostId(10L);
        order.verify(likes).deleteByPostId(10L);
        order.verify(posts).delete(post);
    }

    @Test void anotherUserCannotDeletePostOrInteractions() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("other@example.com", null));
        assertThrows(PostForbiddenException.class, () -> service.deletePost(10L));
        verifyNoInteractions(comments, likes);
        verify(posts, never()).delete(any());
    }

    @Test void missingPostDoesNotDeleteAnything() {
        assertThrows(PostNotFoundException.class, () -> service.deletePost(999L));
        verifyNoInteractions(comments, likes);
        verify(posts, never()).delete(any());
    }

    @Test void adminDeletionAlsoRemovesRelationships() {
        service.adminDeletePost(10L);
        verify(comments).deleteByPostId(10L);
        verify(likes).deleteByPostId(10L);
        verify(posts).delete(post);
    }

    @Test void mediaIsRemovedOnlyAfterCommit() throws Exception {
        attachMedia();
        service.deletePost(10L);
        assertTrue(Files.exists(media));
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        assertFalse(Files.exists(media));
    }

    @Test void rollbackKeepsTheOriginalMedia() throws Exception {
        attachMedia();
        service.deletePost(10L);
        TransactionSynchronizationManager.getSynchronizations().forEach(
            callback -> callback.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        assertTrue(Files.exists(media));
        assertArrayEquals(new byte[]{1, 2, 3}, Files.readAllBytes(media));
    }

    @Test void databaseFailureDoesNotScheduleMediaRemoval() throws Exception {
        attachMedia();
        doThrow(new IllegalStateException("Database failure")).when(posts).delete(post);
        assertThrows(IllegalStateException.class, () -> service.deletePost(10L));
        assertTrue(Files.exists(media));
        assertTrue(TransactionSynchronizationManager.getSynchronizations().isEmpty());
    }

    @Test void mediaPathOutsideUploadsIsRejectedBeforeDeletingAnything() {
        post.setMediaUrl("/uploads/../../outside.png");
        assertThrows(BadRequestException.class, () -> service.deletePost(10L));
        verifyNoInteractions(comments, likes);
        verify(posts, never()).delete(any());
    }
}
