package com.blog.backend.config;

import com.blog.backend.entity.Role;
import com.blog.backend.entity.User;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.services.JwtService;
import io.jsonwebtoken.MalformedJwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = SecurityConfigTest.TestConfig.class)
@WebAppConfiguration
class SecurityConfigTest {
    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import(SecurityConfig.class)
    static class TestConfig {
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean JwtService jwt() { return mock(JwtService.class); }
        @Bean ProbeController controller() { return new ProbeController(); }
    }
    @RestController
    static class ProbeController {
        @GetMapping({"/api/login", "/api/register", "/api/probe", "/api/admin/probe"})
        String probe() { return "ok"; }
    }
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    MockMvc mvc;

    @BeforeEach void setup() {
        reset(users, jwt);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }
    void session(Role role, boolean banned) {
        User user = new User(); user.setRole(role); user.setBanned(banned);
        when(jwt.extractEmail("valid-token")).thenReturn("user@example.com");
        when(users.findByEmail("user@example.com")).thenReturn(user);
    }
    @Test void anonymousApiRequestGets401() throws Exception {
        mvc.perform(get("/api/probe")).andExpect(status().isUnauthorized());
    }
    @Test void regularUserCannotAccessAdminApi() throws Exception {
        session(Role.USER, false);
        mvc.perform(get("/api/admin/probe").header("Authorization", "Bearer valid-token"))
            .andExpect(status().isForbidden());
    }
    @Test void adminCanAccessAdminApiWithoutCreatingSession() throws Exception {
        session(Role.ADMIN, false);
        var result = mvc.perform(get("/api/admin/probe").header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk()).andReturn();
        assertNull(result.getRequest().getSession(false));
    }
    @Test void bannedUserIsRejectedEvenWithExistingToken() throws Exception {
        session(Role.USER, true);
        mvc.perform(get("/api/probe").header("Authorization", "Bearer valid-token"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_BANNED"));
    }
    @Test void invalidTokenGets401() throws Exception {
        when(jwt.extractEmail("invalid")).thenThrow(new MalformedJwtException("Invalid token"));
        mvc.perform(get("/api/probe").header("Authorization", "Bearer invalid"))
            .andExpect(status().isUnauthorized());
    }
    @Test void deletedUserGets401() throws Exception {
        when(jwt.extractEmail("deleted")).thenReturn("deleted@example.com");
        mvc.perform(get("/api/probe").header("Authorization", "Bearer deleted"))
            .andExpect(status().isUnauthorized());
    }
    @Test void publicAuthEndpointsIgnoreStaleTokens() throws Exception {
        mvc.perform(get("/api/login").header("Authorization", "Bearer stale"))
            .andExpect(status().isOk());
        mvc.perform(get("/api/register").header("Authorization", "Bearer stale"))
            .andExpect(status().isOk());
        verifyNoInteractions(jwt);
    }
}
