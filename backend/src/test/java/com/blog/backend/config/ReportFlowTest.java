package com.blog.backend.config;

import com.blog.backend.controllers.AdminController;
import com.blog.backend.controllers.ReportController;
import com.blog.backend.dto.ReportRequest;
import com.blog.backend.entity.Report;
import com.blog.backend.entity.Role;
import com.blog.backend.entity.User;
import com.blog.backend.exception.BadRequestException;
import com.blog.backend.exception.GlobalExceptionHandler;
import com.blog.backend.repository.ReportRepository;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.services.AdminService;
import com.blog.backend.services.JwtService;
import com.blog.backend.services.PostService;
import com.blog.backend.services.ReportService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = ReportFlowTest.TestConfig.class)
@WebAppConfiguration
class ReportFlowTest {
    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import({SecurityConfig.class, ReportController.class, AdminController.class, ReportService.class, GlobalExceptionHandler.class})
    static class TestConfig {
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean ReportRepository reports() { return mock(ReportRepository.class); }
        @Bean JwtService jwt() { return mock(JwtService.class); }
        @Bean PostService posts() { return mock(PostService.class); }
        @Bean AdminService admin() { return mock(AdminService.class); }
    }
    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired ReportRepository reports;
    @Autowired JwtService jwt;
    @Autowired ReportService service;
    private MockMvc mvc;
    private User reporter;
    private User target;

    private static User user(long id, String username, Role role) {
        User user = new User(); user.setId(id); user.setUsername(username);
        user.setEmail(username + "@example.com"); user.setRole(role);
        return user;
    }

    @BeforeEach void setup() {
        reset(users, reports, jwt);
        reporter = user(1L, "reporter", Role.USER);
        target = user(2L, "target", Role.USER);
        User admin = user(3L, "admin", Role.ADMIN);
        for (User user : List.of(reporter, target, admin)) {
            when(jwt.extractEmail(user.getUsername())).thenReturn(user.getEmail());
            when(jwt.extractUserId(user.getUsername())).thenReturn(user.getId());
            when(users.findByEmail(user.getEmail())).thenReturn(user);
            when(users.findById(user.getId())).thenReturn(Optional.of(user));
        }
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test void authenticatedUserCreatesReportWithReasonIdentityAndTimestamp() throws Exception {
        LocalDateTime before = LocalDateTime.now();
        mvc.perform(post("/api/users/2/report").header("Authorization", "Bearer reporter")
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"  Offensive content  \"}"))
            .andExpect(status().isNoContent());
        ArgumentCaptor<Report> saved = ArgumentCaptor.forClass(Report.class);
        verify(reports).save(saved.capture());
        assertSame(reporter, saved.getValue().getReporter());
        assertSame(target, saved.getValue().getReportedUser());
        assertEquals("Offensive content", saved.getValue().getReason());
        assertFalse(saved.getValue().getCreatedAt().isBefore(before));
        assertFalse(saved.getValue().getCreatedAt().isAfter(LocalDateTime.now()));
    }

    @ParameterizedTest @ValueSource(strings = {"{}", "{\"reason\":null}", "{\"reason\":\"\"}", "{\"reason\":\"   \"}"})
    void invalidReasonIsRejectedBeforeSaving(String body) throws Exception {
        mvc.perform(post("/api/users/2/report").header("Authorization", "Bearer reporter")
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.reason").value("Reason is required"));
        verifyNoInteractions(reports);
    }

    @Test void longReasonGetsValidationErrorInsteadOfDatabaseFailure() throws Exception {
        mvc.perform(post("/api/users/2/report").header("Authorization", "Bearer reporter")
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"" + "a".repeat(256) + "\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.reason").value("Reason must be 255 characters or fewer"));
        verifyNoInteractions(reports);
    }

    @Test void reasonAtMaximumLengthIsAccepted() throws Exception {
        mvc.perform(post("/api/users/2/report").header("Authorization", "Bearer reporter")
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"" + "a".repeat(255) + "\"}"))
            .andExpect(status().isNoContent());
        verify(reports).save(any(Report.class));
    }

    @Test void serviceAlsoRejectsInvalidReasonsWhenCalledWithoutControllerValidation() {
        assertThrows(BadRequestException.class, () -> service.createReport(2L, null));
        assertThrows(BadRequestException.class, () -> service.createReport(2L, new ReportRequest(" ")));
        assertThrows(BadRequestException.class, () -> service.createReport(2L, new ReportRequest("a".repeat(256))));
        verifyNoInteractions(reports);
    }

    @Test void selfReportingIsRejected() throws Exception {
        mvc.perform(post("/api/users/1/report").header("Authorization", "Bearer reporter")
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Spam\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("You cannot report yourself"));
        verifyNoInteractions(reports);
    }

    @Test void missingTargetReturns404() throws Exception {
        mvc.perform(post("/api/users/999/report").header("Authorization", "Bearer reporter")
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Spam\"}"))
            .andExpect(status().isNotFound());
        verifyNoInteractions(reports);
    }

    @Test void anonymousUserCannotSubmitOrReadReports() throws Exception {
        mvc.perform(post("/api/users/2/report").contentType(MediaType.APPLICATION_JSON)
            .content("{\"reason\":\"Spam\"}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/reports")).andExpect(status().isUnauthorized());
        verifyNoInteractions(reports);
    }

    @Test void regularUserCannotReadReportsIncludingTheirOwn() throws Exception {
        mvc.perform(get("/api/admin/reports").header("Authorization", "Bearer reporter"))
            .andExpect(status().isForbidden());
        verifyNoInteractions(reports);
    }

    @Test void bannedUserCannotSubmitAReport() throws Exception {
        reporter.setBanned(true);
        mvc.perform(post("/api/users/2/report").header("Authorization", "Bearer reporter")
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Spam\"}"))
            .andExpect(status().isForbidden());
        verifyNoInteractions(reports);
    }

    @Test void adminCanReadReportDetails() throws Exception {
        Report report = new Report(); report.setId(10L); report.setReporter(reporter);
        report.setReportedUser(target); report.setReason("Spam"); report.setCreatedAt(LocalDateTime.now());
        when(reports.findAll()).thenReturn(List.of(report));
        mvc.perform(get("/api/admin/reports").header("Authorization", "Bearer admin"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].reason").value("Spam"))
            .andExpect(jsonPath("$[0].createdAt").exists());
    }
}
