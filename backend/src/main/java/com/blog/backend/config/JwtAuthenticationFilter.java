package com.blog.backend.config;

import java.io.IOException;
import java.util.Collections;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.blog.backend.services.JwtService;

@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        System.out.println("11111111111111 - FILTER CALLED");//////////////////////

        String authHeader = request.getHeader("Authorization");

        System.out.println("22222222222222 - HEADER = " + authHeader);//////////////////////////

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {

            System.out.println("3333333333333333 - NO BEARER");//////////////

            filterChain.doFilter(request, response);
            return;
        }
        String token = authHeader.substring(7);

        // jwtService.extractEmail(token);
        String email;

        try {
            email = jwtService.extractEmail(token);
            System.out.println("444444444444 - EMAIL = " + email);///////
        } catch (Exception e) {
            System.out.println("5555555555555 - TOKEN ERROR = " + e.getMessage());//////////////

            filterChain.doFilter(request, response);
            return;
        }

        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                email,
                null,
                Collections.emptyList());

        System.out.println(
                "6666666666666666 - AUTHENTICATED = " + authentication.isAuthenticated());//////////////////////

        SecurityContext context = SecurityContextHolder.createEmptyContext();

        context.setAuthentication(authentication);

        SecurityContextHolder.setContext(context);
        context.setAuthentication(authentication);
        
        System.out.println(
                "7777777777777 - CONTEXT AUTH = "
                        + SecurityContextHolder.getContext().getAuthentication());////////////////
        SecurityContextHolder.setContext(context);
        filterChain.doFilter(request, response);
    }
}