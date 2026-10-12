package com.blog.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.blog.backend.entity.Report;

public interface ReportRepository extends JpaRepository<Report, Long> {
}