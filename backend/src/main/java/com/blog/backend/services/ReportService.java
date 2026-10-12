package com.blog.backend.services;

import java.time.LocalDateTime;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.blog.backend.dto.ReportRequest;
import com.blog.backend.entity.Report;
import com.blog.backend.entity.User;
import com.blog.backend.repository.ReportRepository;
import com.blog.backend.repository.UserRepository;
import java.util.List;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;

    public void createReport(Long reportedUserId, ReportRequest request) {

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User reporter = userRepository.findByEmail(email);

        User reportedUser = userRepository.findById(reportedUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Report report = new Report();

        report.setReporter(reporter);
        report.setReportedUser(reportedUser);
        report.setReason(request.reason());
        report.setCreatedAt(LocalDateTime.now());

        reportRepository.save(report);
    }

    public List<Report> getAllReports() {
        return reportRepository.findAll();
    }
}