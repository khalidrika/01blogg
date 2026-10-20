package com.blog.backend.services;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {
    private static final String SECRET = "test-only-signing-key-at-least-thirty-two-bytes";
    private JwtService service(String secret) {
        var service = new JwtService();
        ReflectionTestUtils.setField(service, "secret", secret);
        return service;
    }

    @Test void signedTokensBindBothEmailAndAccountId() {
        var jwt = service(SECRET);
        jwt.validateSecret();
        String token = jwt.generateToken("student@example.com", 42L);
        assertEquals("student@example.com", jwt.extractEmail(token));
        assertEquals(42L, jwt.extractUserId(token));
        assertThrows(JwtException.class, () -> service(SECRET + "-different").extractEmail(token));
    }

    @Test void rejectsExpiredTokensAndWeakSecrets() {
        var jwt = service(SECRET);
        String expired = Jwts.builder().subject("student@example.com").claim("uid", 42L)
            .expiration(new Date(System.currentTimeMillis() - 60_000))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertThrows(ExpiredJwtException.class, () -> jwt.extractEmail(expired));
        assertThrows(IllegalStateException.class, () -> service("short").validateSecret());
    }
}
