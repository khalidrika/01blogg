package com.blog.backend.services;

import com.blog.backend.dto.RegistrationReq;
import com.blog.backend.entity.Role;
import com.blog.backend.entity.User;
import com.blog.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RegistrationServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final RegistrationService service = new RegistrationService(users, encoder);
    private final RegistrationReq request = new RegistrationReq("student", "student@example.com", "Learning123!");

    @Test void storesOnlyHashedPasswordAndAlwaysCreatesARegularUser() {
        when(users.save(any())).thenAnswer(call -> { User user = call.getArgument(0); user.setId(1L); return user; });
        assertEquals(200, service.register(request).getStatusCode().value());
        var saved = ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());
        assertNotEquals(request.password(), saved.getValue().getPassword());
        assertTrue(encoder.matches(request.password(), saved.getValue().getPassword()));
        assertEquals(Role.USER, saved.getValue().getRole());
    }

    @Test void concurrentUniqueConstraintFailureBecomesAUsefulClientError() {
        when(users.save(any())).thenThrow(new DataIntegrityViolationException("duplicate key"));
        assertEquals(400, service.register(request).getStatusCode().value());
    }

    @Test void rejectsMultibytePasswordsBeyondBcryptLimit() {
        assertEquals(400, service.register(new RegistrationReq("student", "student@example.com", "é".repeat(40))).getStatusCode().value());
        verifyNoInteractions(users);
    }
}
