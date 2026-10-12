package com.blog.backend.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.blog.backend.dto.ReportRequest;
import com.blog.backend.services.ReportService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class ReportController {

    private final ReportService reportService;

    @PostMapping("/{userId}/report")
    public ResponseEntity<Void> reportUser(
            @PathVariable Long userId,
            @Valid @RequestBody ReportRequest request) {

        reportService.createReport(userId, request);

        return ResponseEntity.noContent().build();
    }
}