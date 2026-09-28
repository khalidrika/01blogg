package com.blog.backend.exception;

public class PostForbiddenException extends RuntimeException {

    public PostForbiddenException(String message) {
        super(message);
    }
}