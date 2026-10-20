package com.blog.backend.services;

import com.blog.backend.exception.BadRequestException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
@Slf4j
public class MediaStorage {
    public static final int MAX_BYTES = 50 * 1024 * 1024;
    private static final long MAX_PIXELS = 20_000_000;
    private final Path directory;

    public MediaStorage(@Value("${file.upload-dir:uploads}") String directory) {
        this.directory = Path.of(directory).toAbsolutePath().normalize();
    }

    public record StoredMedia(String url, String type) {}

    public StoredMedia store(MultipartFile file) {
        if (file.isEmpty()) throw new BadRequestException("Media file cannot be empty");
        if (file.getSize() > MAX_BYTES) throw new BadRequestException("Media must be 50 MB or smaller");
        String name = file.getOriginalFilename();
        if (name == null || name.contains("/") || name.contains("\\") || name.chars().anyMatch(Character::isISOControl)) {
            throw new BadRequestException("Invalid media filename");
        }
        String lower = name.toLowerCase(Locale.ROOT);
        String mime = file.getContentType();
        String extension = lower.endsWith(".png") && "image/png".equals(mime) ? "png"
            : (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) && "image/jpeg".equals(mime) ? "jpg"
            : lower.endsWith(".mp4") && "video/mp4".equals(mime) ? "mp4" : null;
        if (extension == null) throw new BadRequestException("Only PNG, JPG, JPEG and MP4 files are allowed");

        Path destination = null;
        try {
            byte[] bytes;
            try (var input = file.getInputStream()) { bytes = input.readNBytes(MAX_BYTES + 1); }
            if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new BadRequestException("Invalid media size");
            if (extension.equals("mp4")) validateMp4(bytes);
            else validateImage(bytes, extension);
            Files.createDirectories(directory);
            destination = directory.resolve(UUID.randomUUID() + "." + extension);
            Files.write(destination, bytes, StandardOpenOption.CREATE_NEW);
            Path saved = destination;
            // A newly written file must not survive a rolled-back post or notification write.
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void afterCompletion(int status) {
                        if (status != STATUS_COMMITTED) deleteQuietly(saved);
                    }
                });
            }
            return new StoredMedia("/uploads/" + destination.getFileName(), extension.equals("mp4") ? "video" : "image");
        } catch (IOException exception) {
            if (destination != null) deleteQuietly(destination);
            throw new IllegalStateException("Could not store media", exception);
        }
    }

    private void validateImage(byte[] bytes, String extension) throws IOException {
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw new BadRequestException("The selected file is not a valid image");
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream, true, true);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!(extension.equals("jpg") ? format.equals("jpeg") : format.equals("png"))) {
                    throw new BadRequestException("File contents do not match its image type");
                }
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || (long) width * height > MAX_PIXELS) {
                    throw new BadRequestException("Images must contain no more than 20 million pixels");
                }
                BufferedImage image = reader.read(0);
                if (image == null) throw new BadRequestException("The selected image is corrupt");
                image.flush();
            } catch (IOException exception) {
                throw new BadRequestException("The selected image is corrupt");
            } finally { reader.dispose(); }
        }
    }

    // Validate ISO BMFF box boundaries, MP4 branding, a video track and media payload.
    // This checks the container; it does not decode codecs or transcode video.
    private void validateMp4(byte[] bytes) {
        boolean branded = false, video = false, data = false;
        for (int offset = 0; offset < bytes.length;) {
            Box box = box(bytes, offset, bytes.length);
            if (box.type().equals("ftyp")) {
                if (box.end() - box.payload() < 8 || (box.end() - box.payload()) % 4 != 0) invalidVideo();
                Set<String> brands = Set.of("isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ");
                for (int p = box.payload(); p + 4 <= box.end(); p += 4) {
                    if (p != box.payload() + 4 && brands.contains(text(bytes, p))) branded = true;
                }
            }
            if (box.type().equals("moov")) video |= containsVideoTrack(bytes, box.payload(), box.end());
            if (box.type().equals("mdat") && box.end() > box.payload()) data = true;
            offset = box.end();
        }
        if (!branded || !video || !data) invalidVideo();
    }

    private boolean containsVideoTrack(byte[] bytes, int start, int end) {
        for (int p = start; p < end;) {
            Box track = box(bytes, p, end);
            if (track.type().equals("trak")) {
                for (int t = track.payload(); t < track.end();) {
                    Box media = box(bytes, t, track.end());
                    if (media.type().equals("mdia")) {
                        for (int m = media.payload(); m < media.end();) {
                            Box handler = box(bytes, m, media.end());
                            if (handler.type().equals("hdlr") && handler.end() - handler.payload() >= 12
                                && text(bytes, handler.payload() + 8).equals("vide")) return true;
                            m = handler.end();
                        }
                    }
                    t = media.end();
                }
            }
            p = track.end();
        }
        return false;
    }

    private record Box(String type, int payload, int end) {}
    private Box box(byte[] bytes, int start, int limit) {
        if (limit - start < 8) invalidVideo();
        long size = Integer.toUnsignedLong(ByteBuffer.wrap(bytes, start, 4).getInt());
        int header = 8;
        if (size == 1) {
            if (limit - start < 16) invalidVideo();
            size = ByteBuffer.wrap(bytes, start + 8, 8).getLong(); header = 16;
        } else if (size == 0) size = limit - start;
        if (size < header || size > limit - start) invalidVideo();
        return new Box(text(bytes, start + 4), start + header, start + (int) size);
    }
    private String text(byte[] bytes, int start) { return new String(bytes, start, 4, StandardCharsets.ISO_8859_1); }
    private void invalidVideo() { throw new BadRequestException("The selected file is not a valid MP4 video"); }

    public Path resolve(String url) {
        if (url == null || !url.startsWith("/uploads/")) throw new BadRequestException("Invalid media path");
        String filename = url.substring("/uploads/".length());
        if (filename.isBlank() || filename.contains("/") || filename.contains("\\") || filename.chars().anyMatch(Character::isISOControl)) {
            throw new BadRequestException("Invalid media path");
        }
        Path file = directory.resolve(filename).normalize();
        if (!directory.equals(file.getParent()) || Files.isSymbolicLink(file)) throw new BadRequestException("Invalid media path");
        return file;
    }

    public Path readable(String filename) {
        Path file = resolve("/uploads/" + filename);
        if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) return null;
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".mp4") ? file : null;
    }

    public void deleteAfterCommit(String url) {
        if (url == null) return;
        Path file = resolve(url);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { deleteQuietly(file); }
            });
        } else {
            throw new IllegalStateException("Media deletion requires a transaction");
        }
    }

    public void discard(String url) { if (url != null) deleteQuietly(resolve(url)); }
    private void deleteQuietly(Path file) {
        try { Files.deleteIfExists(file); }
        catch (IOException exception) { log.warn("Media cleanup failed for {}", file.getFileName(), exception); }
    }
}
