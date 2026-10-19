package com.blog.backend.services;

import java.time.LocalDateTime;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.blog.backend.dto.ReportRequest;
import com.blog.backend.dto.ReportResponse;
import com.blog.backend.entity.Report;
import com.blog.backend.entity.User;
import com.blog.backend.exception.UserNotFoundException;
import com.blog.backend.repository.ReportRepository;
import com.blog.backend.repository.UserRepository;
import com.blog.backend.exception.BadRequestException;
import java.util.List;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;

    public void createReport(Long reportedUserId, ReportRequest request) {

        if (request == null || request.reason() == null || request.reason().isBlank()) {
            throw new BadRequestException("Reason is required");
        }
        if (request.reason().length() > 255) {
            throw new BadRequestException("Reason must be 255 characters or fewer");
        }

        String email = SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getName();

        User reporter = userRepository.findByEmail(email);
        if (reporter == null) throw new UserNotFoundException("User not found");

        User reportedUser = userRepository.findById(reportedUserId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        if (reporter.getId().equals(reportedUser.getId())) {
            throw new BadRequestException("You cannot report yourself");
        }

        Report report = new Report();

        report.setReporter(reporter);
        report.setReportedUser(reportedUser);
        report.setReason(request.reason().trim());
        report.setCreatedAt(LocalDateTime.now());

        reportRepository.save(report);
    }

    public List<ReportResponse> getAllReports() {

        return reportRepository.findAll()
                .stream()
                .map(report -> new ReportResponse(
                        report.getId(),
                        report.getReporter().getId(),
                        report.getReporter().getUsername(),
                        report.getReportedUser().getId(),
                        report.getReportedUser().getUsername(),
                        report.getReason(),
                        report.getCreatedAt()))
                .toList();
    }
}
