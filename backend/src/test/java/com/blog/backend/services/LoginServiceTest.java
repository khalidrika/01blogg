package com.blog.backend.services;

import com.blog.backend.dto.LoginReq;
import com.blog.backend.entity.User;
import com.blog.backend.entity.Role;
import com.blog.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LoginServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final JwtService jwt = mock(JwtService.class);
    private final LoginService service = new LoginService(users, passwords, jwt);

    @Test void unknownUserGetsUnauthorized() {
        assertEquals(401, service.login(new LoginReq("missing@example.com", "password")).getStatusCode().value());
        verifyNoInteractions(jwt);
    }

    @Test void bannedUserCannotObtainToken() {
        User user = new User(); user.setPassword("hash"); user.setBanned(true);
        when(users.findByEmail("user@example.com")).thenReturn(user);
        when(passwords.matches("password", "hash")).thenReturn(true);
        assertEquals(403, service.login(new LoginReq("user@example.com", "password")).getStatusCode().value());
        verifyNoInteractions(jwt);
    }

    @Test void wrongPasswordCannotObtainToken() {
        User user = new User(); user.setPassword("hash");
        when(users.findByEmail("user@example.com")).thenReturn(user);
        assertEquals(401, service.login(new LoginReq("user@example.com", "wrong")).getStatusCode().value());
        verifyNoInteractions(jwt);
    }

    @Test void validCredentialsObtainToken() {
        User user = new User(); user.setPassword("hash"); user.setEmail("user@example.com"); user.setRole(Role.USER);
        when(users.findByEmail("user@example.com")).thenReturn(user);
        when(passwords.matches("password", "hash")).thenReturn(true);
        when(jwt.generateToken("user@example.com")).thenReturn("signed-token");
        assertEquals(200, service.login(new LoginReq("user@example.com", "password")).getStatusCode().value());
        verify(jwt).generateToken("user@example.com");
    }
}
