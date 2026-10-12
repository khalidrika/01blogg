package com.blog.backend.exception;

public class NotificationForbiddenException extends RuntimeException {

    public NotificationForbiddenException(String message) {
        super(message);
    }
}