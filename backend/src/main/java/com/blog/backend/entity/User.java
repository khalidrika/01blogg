package com.blog.backend.entity;



import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Table(name = "users")
@Entity
public class User {
    @Id 
    private int id;

    private String username;
    private String email;
    private String password;
    private String role;
}
