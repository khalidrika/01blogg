package com.blog.backend.services;

import com.blog.backend.controllers.CommentController;
import com.blog.backend.dto.CommentRequest;
import com.blog.backend.entity.Comment;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.exception.GlobalExceptionHandler;
import com.blog.backend.repository.CommentRepository;
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
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CommentServiceTest {
    private final CommentRepository comments = mock(CommentRepository.class);
    private final PostRepository posts = mock(PostRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CommentService service = new CommentService(comments, posts, users);
    private Comment comment;
    private MockMvc mvc;

    @BeforeEach void setup() {
        User user = new User(); user.setId(1L); user.setEmail("student@example.com"); user.setUsername("student");
        Post post = new Post(); post.setId(10L);
        comment = new Comment(); comment.setId(5L); comment.setAuthor(user); comment.setPost(post);
        comment.setContent("Helpful post"); comment.setCreatedAt(LocalDateTime.of(2026, 10, 19, 10, 0));
        when(users.findByEmail(user.getEmail())).thenReturn(user);
        when(posts.findById(10L)).thenReturn(Optional.of(post));
        when(comments.findById(5L)).thenReturn(Optional.of(comment));
        when(comments.save(any(Comment.class))).thenAnswer(call -> {
            Comment saved = call.getArgument(0); saved.setId(6L); return saved;
        });
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(user.getEmail(), null));
        mvc = MockMvcBuilders.standaloneSetup(new CommentController(service)).setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    @Test void createReturnsTrimmedContentAuthorAndTimestamp() throws Exception {
        LocalDateTime before = LocalDateTime.now();
        mvc.perform(post("/api/posts/10/comments").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"  Thanks!  \"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(6))
            .andExpect(jsonPath("$.content").value("Thanks!")).andExpect(jsonPath("$.authorId").value(1))
            .andExpect(jsonPath("$.postId").value(10)).andExpect(jsonPath("$.createdAt").exists());
        var saved = ArgumentCaptor.forClass(Comment.class); verify(comments).save(saved.capture());
        assertFalse(saved.getValue().getCreatedAt().isBefore(before));
    }

    @ParameterizedTest @ValueSource(strings = {"{}", "{\"content\":null}", "{\"content\":\"\"}", "{\"content\":\"   \"}"})
    void rejectsBlankComments(String body) throws Exception {
        mvc.perform(post("/api/posts/10/comments").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
        verify(comments, never()).save(any());
    }

    @Test void enforcesLengthLimitBeforeTheDatabaseAndAcceptsTheBoundary() throws Exception {
        mvc.perform(post("/api/posts/10/comments").contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"" + "a".repeat(256) + "\"}")).andExpect(status().isBadRequest());
        verify(comments, never()).save(any());
        mvc.perform(post("/api/posts/10/comments").contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"" + "a".repeat(255) + "\"}")).andExpect(status().isOk());
    }

    @Test void validatesDirectServiceCallsToo() {
        assertThrows(BadRequestException.class, () -> service.createComment(10L, null));
        assertThrows(BadRequestException.class, () -> service.createComment(10L, new CommentRequest(" ")));
        assertThrows(BadRequestException.class, () -> service.createComment(10L, new CommentRequest("a".repeat(256))));
        verify(comments, never()).save(any());
    }

    @Test void returnsCommentDetailsFromTheOrderedRepositoryQuery() throws Exception {
        when(comments.findByPostIdOrderByCreatedAtAscIdAsc(10L)).thenReturn(List.of(comment));
        mvc.perform(get("/api/posts/10/comments")).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(5)).andExpect(jsonPath("$[0].authorUsername").value("student"));
    }

    @Test void onlyTheCommentAuthorMayDeleteIt() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("other@example.com", null));
        mvc.perform(delete("/api/posts/comments/5")).andExpect(status().isForbidden());
        verify(comments, never()).delete(any());
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("student@example.com", null));
        mvc.perform(delete("/api/posts/comments/5")).andExpect(status().isNoContent());
        verify(comments).delete(comment);
    }

    @Test void missingCommentOrPostReturns404() throws Exception {
        mvc.perform(delete("/api/posts/comments/999")).andExpect(status().isNotFound());
        mvc.perform(get("/api/posts/999/comments")).andExpect(status().isNotFound());
        mvc.perform(post("/api/posts/999/comments").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Hello\"}"))
            .andExpect(status().isNotFound());
        verify(comments, never()).save(any()); verify(comments, never()).delete(any());
    }
}
