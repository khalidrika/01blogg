package com.blog.backend.controllers;

import com.blog.backend.services.MediaStorage;
import java.nio.file.Path;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class MediaController {
    private final MediaStorage storage;

    @GetMapping("/uploads/{filename:.+}")
    public ResponseEntity<Resource> media(@PathVariable String filename) {
        Path file = storage.readable(filename);
        if (file == null) return ResponseEntity.notFound().build();
        String lower = filename.toLowerCase(Locale.ROOT);
        MediaType type = MediaType.parseMediaType(lower.endsWith(".mp4") ? "video/mp4"
            : lower.endsWith(".png") ? "image/png" : "image/jpeg");
        return ResponseEntity.ok().contentType(type)
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", "default-src 'none'; sandbox")
            .header(HttpHeaders.CACHE_CONTROL, "no-cache")
            .body(new FileSystemResource(file));
    }
}
