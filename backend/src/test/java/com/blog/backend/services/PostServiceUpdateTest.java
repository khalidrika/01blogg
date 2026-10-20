package com.blog.backend.services;

import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.exception.PostForbiddenException;
import com.blog.backend.exception.PostNotFoundException;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.CommentRepository;
import com.blog.backend.repository.LikeRepository;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Optional;
import java.io.ByteArrayOutputStream;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PostServiceUpdateTest {
    private final PostRepository posts = mock(PostRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final PostService service = new PostService(posts, mock(UserRepository.class), notifications, mock(FollowRepository.class), mock(CommentRepository.class), mock(LikeRepository.class), new MediaStorage("uploads"));
    private Post post;

    @BeforeEach void setup() {
        TransactionSynchronizationManager.initSynchronization();
        User author = new User();
        author.setId(1L); author.setUsername("student"); author.setEmail("owner@example.com");
        post = new Post();
        post.setId(10L); post.setAuthor(author); post.setTitle("Original"); post.setContent("Original content");
        post.setCreatedAt(LocalDateTime.of(2026, 10, 19, 10, 0));
        post.setMediaUrl("/uploads/original.png"); post.setMediaType("image");
        when(posts.findById(10L)).thenReturn(Optional.of(post));
        when(posts.save(any(Post.class))).thenAnswer(invocation -> invocation.getArgument(0));
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("owner@example.com", null));
    }

    @AfterEach void cleanup() {
        TransactionSynchronizationManager.clearSynchronization();
        SecurityContextHolder.clearContext();
    }

    @Test void textOnlyEditPreservesMediaAuthorAndDate() {
        var result = service.updatePost(10L, "Updated title", "Updated content", null);
        assertEquals("Updated title", result.title());
        assertEquals("Updated content", result.content());
        assertEquals("/uploads/original.png", result.mediaUrl());
        assertEquals("image", result.mediaType());
        assertEquals(1L, result.authorid());
        assertEquals(LocalDateTime.of(2026, 10, 19, 10, 0), result.createdAt());
        verify(posts).save(post);
        verifyNoInteractions(notifications);
    }

    @Test void otherUserCannotEditEvenByCallingServiceDirectly() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("other@example.com", null));
        assertThrows(PostForbiddenException.class, () -> service.updatePost(10L, "Changed", "Changed", null));
        assertEquals("Original", post.getTitle());
        verify(posts, never()).save(any());
    }

    @Test void emptyTitleOrContentIsRejected() {
        assertThrows(BadRequestException.class, () -> service.updatePost(10L, " ", "Content", null));
        assertThrows(BadRequestException.class, () -> service.updatePost(10L, "Title", " ", null));
        verify(posts, never()).save(any());
    }

    @Test void missingPostIsRejected() {
        assertThrows(PostNotFoundException.class, () -> service.updatePost(999L, "Title", "Content", null));
        verify(posts, never()).save(any());
    }

    @Test void invalidOrEmptyMediaIsRejected() {
        var html = new MockMultipartFile("media", "script.html", "text/html", new byte[]{1});
        var empty = new MockMultipartFile("media", "empty.png", "image/png", new byte[0]);
        assertThrows(BadRequestException.class, () -> service.updatePost(10L, "Title", "Content", html));
        assertThrows(BadRequestException.class, () -> service.updatePost(10L, "Title", "Content", empty));
        verify(posts, never()).save(any());
    }

    @Test void replacingMediaStoresNewBytesAndRemovesPreviousFile() throws Exception {
        Path directory = Path.of("uploads");
        Files.createDirectories(directory);
        Path oldFile = Files.createTempFile(directory, "post-edit-test-", ".png");
        Files.write(oldFile, new byte[]{1, 2});
        post.setMediaUrl("/uploads/" + oldFile.getFileName());
        var image = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", image);
        byte[] bytes = image.toByteArray();
        Path newFile = null;
        try {
            var result = service.updatePost(10L, "Title", "Content",
                new MockMultipartFile("media", "replacement.png", "image/png", bytes));
            newFile = directory.resolve(result.mediaUrl().substring("/uploads/".length()));
            assertArrayEquals(bytes, Files.readAllBytes(newFile));
            assertTrue(Files.exists(oldFile), "Old media remains until the database commits");
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCommit());
            assertFalse(Files.exists(oldFile));
            assertEquals("image", result.mediaType());
        } finally {
            Files.deleteIfExists(oldFile);
            if (newFile != null) Files.deleteIfExists(newFile);
        }
    }
}
