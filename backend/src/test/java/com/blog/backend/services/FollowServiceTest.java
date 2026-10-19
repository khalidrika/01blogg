package com.blog.backend.services;

import com.blog.backend.controllers.FollowController;
import com.blog.backend.entity.Follow;
import com.blog.backend.entity.User;
import com.blog.backend.exception.GlobalExceptionHandler;
import com.blog.backend.repository.FollowRepository;
import com.blog.backend.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class FollowServiceTest {
    private final FollowRepository follows = mock(FollowRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final FollowService service = new FollowService(follows, users);
    private final User caller = new User();
    private final User target = new User();
    private Follow stored;
    private MockMvc mvc;

    @BeforeEach void setup() {
        caller.setId(1L); caller.setEmail("caller@example.com");
        target.setId(2L); target.setEmail("target@example.com");
        when(users.findByEmail("caller@example.com")).thenReturn(caller);
        when(users.findByEmailForUpdate("caller@example.com")).thenReturn(caller);
        when(users.findById(1L)).thenReturn(Optional.of(caller));
        when(users.findById(2L)).thenReturn(Optional.of(target));
        when(follows.findByFollowerIdAndFollowingId(1L, 2L)).thenAnswer(invocation -> Optional.ofNullable(stored));
        when(follows.save(any(Follow.class))).thenAnswer(invocation -> { stored = invocation.getArgument(0); return stored; });
        doAnswer(invocation -> { stored = null; return null; }).when(follows).delete(any(Follow.class));
        when(follows.countByFollowingId(2L)).thenAnswer(invocation -> stored == null ? 3L : 4L);
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("caller@example.com", null));
        mvc = MockMvcBuilders.standaloneSetup(new FollowController(service))
            .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    @Test void followReturnsStateAndUpdatedCount() throws Exception {
        mvc.perform(put("/api/users/2/follow")).andExpect(status().isOk())
            .andExpect(jsonPath("$.following").value(true)).andExpect(jsonPath("$.followersCount").value(4));
        verify(users).findByEmailForUpdate("caller@example.com");
    }

    @Test void repeatedFollowDoesNotCreateAnotherRelationship() throws Exception {
        mvc.perform(put("/api/users/2/follow")).andExpect(status().isOk());
        mvc.perform(put("/api/users/2/follow")).andExpect(status().isOk())
            .andExpect(jsonPath("$.following").value(true)).andExpect(jsonPath("$.followersCount").value(4));
        verify(follows, times(1)).save(any(Follow.class));
    }

    @Test void repeatedUnfollowLeavesUserUnfollowed() throws Exception {
        service.setFollowing(2L, true);
        mvc.perform(delete("/api/users/2/follow")).andExpect(status().isOk())
            .andExpect(jsonPath("$.following").value(false)).andExpect(jsonPath("$.followersCount").value(3));
        mvc.perform(delete("/api/users/2/follow")).andExpect(status().isOk())
            .andExpect(jsonPath("$.following").value(false)).andExpect(jsonPath("$.followersCount").value(3));
        verify(follows, times(1)).delete(any(Follow.class));
    }

    @Test void statusReflectsCurrentRelationshipWithoutChangingIt() throws Exception {
        mvc.perform(get("/api/users/2/follow")).andExpect(status().isOk())
            .andExpect(jsonPath("$.following").value(false));
        service.setFollowing(2L, true);
        mvc.perform(get("/api/users/2/follow")).andExpect(status().isOk())
            .andExpect(jsonPath("$.following").value(true));
        verify(follows, times(1)).save(any(Follow.class));
    }

    @Test void selfFollowIsAValidationError() throws Exception {
        mvc.perform(put("/api/users/1/follow")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("You cannot follow yourself"));
        verify(follows, never()).save(any());
    }

    @Test void missingTargetReturns404() throws Exception {
        mvc.perform(put("/api/users/999/follow")).andExpect(status().isNotFound());
        verify(follows, never()).save(any());
    }

    @Test void bannedTargetCannotBeFollowed() throws Exception {
        target.setBanned(true);
        mvc.perform(put("/api/users/2/follow")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("You cannot follow a banned user"));
        verify(follows, never()).save(any());
    }

    @Test void anExistingFollowOfABannedUserCanBeRemoved() throws Exception {
        service.setFollowing(2L, true);
        target.setBanned(true);
        mvc.perform(delete("/api/users/2/follow")).andExpect(status().isOk())
            .andExpect(jsonPath("$.following").value(false));
    }

    @Test void legacyToggleRemainsCompatible() throws Exception {
        mvc.perform(post("/api/users/2/follow")).andExpect(status().isNoContent());
        mvc.perform(get("/api/users/2/follow")).andExpect(jsonPath("$.following").value(true));
        mvc.perform(post("/api/users/2/follow")).andExpect(status().isNoContent());
        mvc.perform(get("/api/users/2/follow")).andExpect(jsonPath("$.following").value(false));
    }
}
