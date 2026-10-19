package com.blog.backend.services;

import com.blog.backend.controllers.LikeController;
import com.blog.backend.entity.Like;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.GlobalExceptionHandler;
import com.blog.backend.repository.LikeRepository;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class LikeServiceTest {
    private final LikeRepository likes = mock(LikeRepository.class);
    private final PostRepository posts = mock(PostRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final LikeService service = new LikeService(likes, posts, users);
    private Like stored;
    private MockMvc mvc;

    @BeforeEach void setup() {
        User user = new User(); user.setId(1L); user.setEmail("student@example.com");
        Post post = new Post(); post.setId(10L);
        when(users.findByEmail(user.getEmail())).thenReturn(user);
        when(users.findByEmailForUpdate(user.getEmail())).thenReturn(user);
        when(posts.findById(10L)).thenReturn(Optional.of(post));
        when(likes.findByUserIdAndPostId(1L, 10L)).thenAnswer(call -> Optional.ofNullable(stored));
        when(likes.existsByUserIdAndPostId(1L, 10L)).thenAnswer(call -> stored != null);
        when(likes.countByPostId(10L)).thenAnswer(call -> stored == null ? 3L : 4L);
        when(likes.save(any(Like.class))).thenAnswer(call -> { stored = call.getArgument(0); return stored; });
        doAnswer(call -> { stored = null; return null; }).when(likes).delete(any(Like.class));
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(user.getEmail(), null));
        mvc = MockMvcBuilders.standaloneSetup(new LikeController(service)).setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    @Test void returnsTheCurrentUsersStateAndTotalCount() throws Exception {
        mvc.perform(get("/api/posts/10/likes")).andExpect(status().isOk())
            .andExpect(jsonPath("$.liked").value(false)).andExpect(jsonPath("$.count").value(3));
        service.setLiked(10L, true);
        mvc.perform(get("/api/posts/10/likes")).andExpect(jsonPath("$.liked").value(true))
            .andExpect(jsonPath("$.count").value(4));
    }

    @Test void repeatedLikeRequestsCreateOneLikeAndLockTheCaller() throws Exception {
        mvc.perform(put("/api/posts/10/likes")).andExpect(status().isOk()).andExpect(jsonPath("$.liked").value(true));
        mvc.perform(put("/api/posts/10/likes")).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(4));
        verify(likes, times(1)).save(any(Like.class));
        verify(users, times(2)).findByEmailForUpdate("student@example.com");
    }

    @Test void repeatedUnlikeRequestsLeaveTheLikeRemoved() throws Exception {
        service.setLiked(10L, true);
        mvc.perform(delete("/api/posts/10/likes")).andExpect(status().isOk()).andExpect(jsonPath("$.liked").value(false));
        mvc.perform(delete("/api/posts/10/likes")).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(3));
        verify(likes, times(1)).delete(any(Like.class));
    }

    @Test void legacyToggleAndCountRemainCompatible() throws Exception {
        mvc.perform(post("/api/posts/10/likes")).andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/10/likes/count")).andExpect(content().string("4"));
        mvc.perform(post("/api/posts/10/likes")).andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/10/likes/count")).andExpect(content().string("3"));
    }

    @Test void missingPostIsRejectedForReadsAndWrites() throws Exception {
        mvc.perform(get("/api/posts/999/likes")).andExpect(status().isNotFound());
        mvc.perform(put("/api/posts/999/likes")).andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/999/likes")).andExpect(status().isNotFound());
        verifyNoInteractions(likes);
    }

    @Test void missingUserReturns404InsteadOfNullPointerError() throws Exception {
        when(users.findByEmail("student@example.com")).thenReturn(null);
        mvc.perform(get("/api/posts/10/likes")).andExpect(status().isNotFound());
        verifyNoInteractions(likes);
    }
}
