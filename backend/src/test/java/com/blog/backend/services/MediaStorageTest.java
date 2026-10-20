package com.blog.backend.services;

import com.blog.backend.controllers.MediaController;
import com.blog.backend.exception.BadRequestException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MediaStorageTest {
    @TempDir Path directory;
    private MediaStorage storage() { return new MediaStorage(directory.toString()); }
    private byte[] png() throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", output);
        return output.toByteArray();
    }
    private MockMultipartFile file(String name, String type, byte[] bytes) {
        return new MockMultipartFile("media", name, type, bytes);
    }

    @Test void storesOriginalBytesUnderRandomName() throws Exception {
        byte[] bytes = png();
        var storage = storage();
        var first = storage.store(file("photo.PNG", "image/png", bytes));
        var second = storage.store(file("photo.PNG", "image/png", bytes));
        assertNotEquals(first.url(), second.url());
        assertTrue(first.url().matches("/uploads/[a-f0-9-]{36}\\.png"));
        assertArrayEquals(bytes, Files.readAllBytes(storage.resolve(first.url())));
    }

    @Test void rejectsSpoofedCorruptEmptyAndMismatchedImages() throws Exception {
        var storage = storage();
        assertThrows(BadRequestException.class, () -> storage.store(file("a.png", "image/png", "<script>alert(1)</script>".getBytes())));
        assertThrows(BadRequestException.class, () -> storage.store(file("a.jpg", "image/jpeg", png())));
        assertThrows(BadRequestException.class, () -> storage.store(file("a.png", "image/png", new byte[0])));
        assertThrows(BadRequestException.class, () -> storage.store(file("a.png", "text/html", png())));
        byte[] truncated = java.util.Arrays.copyOf(png(), 35);
        assertThrows(BadRequestException.class, () -> storage.store(file("a.png", "image/png", truncated)));
    }

    @Test void rejectsOversizedUploadBeforeReadingIt() {
        var large = new MockMultipartFile("media", "a.png", "image/png", new byte[]{1}) {
            @Override public long getSize() { return (long) MediaStorage.MAX_BYTES + 1; }
        };
        assertThrows(BadRequestException.class, () -> storage().store(large));
    }

    @Test void rejectsPathsAndSymlinks() throws Exception {
        var storage = storage();
        assertThrows(BadRequestException.class, () -> storage.store(file("../a.png", "image/png", png())));
        assertThrows(BadRequestException.class, () -> storage.resolve("/uploads/../secret"));
        assertThrows(BadRequestException.class, () -> storage.resolve("/uploads/..\\secret"));
        Path target = Files.write(directory.resolve("target.png"), png());
        Files.createSymbolicLink(directory.resolve("link.png"), target);
        assertThrows(BadRequestException.class, () -> storage.readable("link.png"));
        Files.writeString(directory.resolve("script.html"), "<script></script>");
        assertNull(storage.readable("script.html"));
        assertNull(storage.readable("missing.png"));
    }

    @Test void rollbackDiscardsNewFileAndKeepsOldFile() throws Exception {
        var storage = storage();
        var old = storage.store(file("old.png", "image/png", png()));
        TransactionSynchronizationManager.initSynchronization();
        try {
            var replacement = storage.store(file("new.png", "image/png", png()));
            storage.deleteAfterCommit(old.url());
            TransactionSynchronizationManager.getSynchronizations().forEach(
                sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
            assertTrue(Files.exists(storage.resolve(old.url())));
            assertFalse(Files.exists(storage.resolve(replacement.url())));
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }

    @Test void commitKeepsNewFileAndDeletesOldFile() throws Exception {
        var storage = storage();
        var old = storage.store(file("old.png", "image/png", png()));
        TransactionSynchronizationManager.initSynchronization();
        try {
            var replacement = storage.store(file("new.png", "image/png", png()));
            storage.deleteAfterCommit(old.url());
            assertTrue(Files.exists(storage.resolve(old.url())));
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> {
                sync.afterCommit(); sync.afterCompletion(TransactionSynchronization.STATUS_COMMITTED);
            });
            assertFalse(Files.exists(storage.resolve(old.url())));
            assertTrue(Files.exists(storage.resolve(replacement.url())));
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }

    private byte[] box(String type, byte[] payload) {
        return ByteBuffer.allocate(payload.length + 8).putInt(payload.length + 8)
            .put(type.getBytes(StandardCharsets.US_ASCII)).put(payload).array();
    }
    private byte[] join(byte[]... chunks) throws Exception {
        var output = new ByteArrayOutputStream();
        for (byte[] chunk : chunks) output.write(chunk);
        return output.toByteArray();
    }

    @Test void checksMp4ContainerRatherThanTrustingMime() throws Exception {
        var storage = storage();
        byte[] ftyp = box("ftyp", "isom0000mp42".getBytes(StandardCharsets.US_ASCII));
        assertThrows(BadRequestException.class, () -> storage.store(file("a.mp4", "video/mp4", ftyp)));
        assertThrows(BadRequestException.class, () -> storage.store(file("a.mp4", "video/mp4", new byte[]{1,2,3})));
        byte[] handler = box("hdlr", join(new byte[8], "vide".getBytes(StandardCharsets.US_ASCII)));
        byte[] container = join(ftyp, box("moov", box("trak", box("mdia", handler))), box("mdat", new byte[]{1}));
        var saved = storage.store(file("a.mp4", "video/mp4", container));
        assertEquals("video", saved.type());
        assertArrayEquals(container, Files.readAllBytes(storage.resolve(saved.url())));
        container[0] = 127; // Box extends beyond the actual file.
        assertThrows(BadRequestException.class, () -> storage.store(file("a.mp4", "video/mp4", container)));
    }

    @Test void servesOriginalBytesWithSafeHeadersAndByteRanges() throws Exception {
        var storage = storage();
        byte[] bytes = png();
        var saved = storage.store(file("a.png", "image/png", bytes));
        var mvc = MockMvcBuilders.standaloneSetup(new MediaController(storage)).build();
        mvc.perform(get(saved.url())).andExpect(status().isOk())
            .andExpect(content().bytes(bytes)).andExpect(content().contentType("image/png"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string("Content-Security-Policy", "default-src 'none'; sandbox"));
        mvc.perform(get(saved.url()).header("Range", "bytes=0-7"))
            .andExpect(status().isPartialContent()).andExpect(content().bytes(java.util.Arrays.copyOf(bytes, 8)));
        mvc.perform(get("/uploads/missing.png")).andExpect(status().isNotFound());
    }
}
