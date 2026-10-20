package com.blog.backend.config;

import com.blog.backend.controllers.AdminController;
import com.blog.backend.entity.Role;
import com.blog.backend.entity.User;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.exception.GlobalExceptionHandler;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.services.AdminService;
import com.blog.backend.services.JwtService;
import com.blog.backend.services.PostService;
import com.blog.backend.services.ReportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = AdminAccessTest.TestConfig.class)
@WebAppConfiguration
class AdminAccessTest {
    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import({SecurityConfig.class, AdminController.class, GlobalExceptionHandler.class})
    static class TestConfig {
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean JwtService jwt() { return mock(JwtService.class); }
        @Bean PostService posts() { return mock(PostService.class); }
        @Bean ReportService reports() { return mock(ReportService.class); }
        @Bean AdminService admin() { return mock(AdminService.class); }
    }
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    @Autowired AdminService admin;
    @Autowired PostService posts;
    @Autowired ReportService reports;
    private MockMvc mvc;

    @BeforeEach void setup() {
        reset(users, jwt, admin, posts, reports);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private void session(Role role) {
        User user = new User(); user.setId(1L); user.setRole(role); user.setEmail("moderator@example.com");
        when(jwt.extractEmail("token")).thenReturn(user.getEmail());
        when(jwt.extractUserId("token")).thenReturn(user.getId());
        when(users.findByEmail(user.getEmail())).thenReturn(user);
    }

    @ParameterizedTest
    @CsvSource({"GET,/api/admin/users", "GET,/api/admin/posts", "GET,/api/admin/reports",
        "PUT,/api/admin/users/2/ban", "PUT,/api/admin/users/2/unban", "DELETE,/api/admin/users/2", "DELETE,/api/admin/posts/10"})
    void everyAdminRouteRejectsAnonymousAndRegularUsers(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path)).andExpect(status().isUnauthorized());
        session(Role.USER);
        mvc.perform(request(HttpMethod.valueOf(method), path).header("Authorization", "Bearer token"))
            .andExpect(status().isForbidden());
        verifyNoInteractions(admin, posts, reports);
        verify(users, never()).findAll();
    }

    @ParameterizedTest
    @CsvSource({"GET,/api/admin/users", "GET,/api/admin/posts", "GET,/api/admin/reports",
        "PUT,/api/admin/users/2/ban", "PUT,/api/admin/users/2/unban", "DELETE,/api/admin/users/2", "DELETE,/api/admin/posts/10"})
    void adminRoutesInvokeTheExpectedService(String method, String path) throws Exception {
        session(Role.ADMIN);
        mvc.perform(request(HttpMethod.valueOf(method), path).header("Authorization", "Bearer token"))
            .andExpect(status().is(method.equals("GET") ? 200 : 204));
        switch (path) {
            case "/api/admin/users" -> verify(users).findAll();
            case "/api/admin/posts" -> verify(posts).getAllPosts();
            case "/api/admin/reports" -> verify(reports).getAllReports();
            case "/api/admin/users/2/ban" -> verify(admin).setUserBanned(2L, true);
            case "/api/admin/users/2/unban" -> verify(admin).setUserBanned(2L, false);
            case "/api/admin/users/2" -> verify(admin).deleteUser(2L);
            case "/api/admin/posts/10" -> verify(posts).adminDeletePost(10L);
            default -> throw new AssertionError("Unexpected path");
        }
    }

    @Test void moderationValidationReturnsAUsableError() throws Exception {
        session(Role.ADMIN);
        doThrow(new BadRequestException("Administrator accounts cannot be moderated")).when(admin).setUserBanned(1L, true);
        mvc.perform(put("/api/admin/users/1/ban").header("Authorization", "Bearer token"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Administrator accounts cannot be moderated"));
    }
}
