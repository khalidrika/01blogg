package com.blog.backend.controllers;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.blog.backend.entity.Report;
import com.blog.backend.services.ReportService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin")
public class AdminController {

    private final ReportService reportService;

    @GetMapping("/reports")
    public List<Report> getAllReports() {
        return reportService.getAllReports();
    }
}