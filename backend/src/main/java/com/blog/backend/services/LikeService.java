package com.blog.backend.services;

import com.blog.backend.dto.LikeStatusResponse;
import com.blog.backend.entity.Like;
import com.blog.backend.entity.Post;
import com.blog.backend.entity.User;
import com.blog.backend.exception.PostNotFoundException;
import com.blog.backend.exception.UserNotFoundException;
import com.blog.backend.repository.LikeRepository;
import com.blog.backend.repository.PostRepository;
import com.blog.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LikeService {
    private final LikeRepository likeRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public LikeStatusResponse getStatus(Long postId) {
        User user = currentUser(false);
        requirePost(postId);
        return status(user, postId);
    }

    @Transactional
    public LikeStatusResponse setLiked(Long postId, boolean liked) {
        // Serialize writes by the same user, including requests from different tabs.
        User user = currentUser(true);
        Post post = requirePost(postId);
        updateLike(user, post, liked);
        return status(user, postId);
    }

    @Transactional
    public void toggleLike(Long postId) {
        User user = currentUser(true);
        Post post = requirePost(postId);
        updateLike(user, post, !likeRepository.existsByUserIdAndPostId(user.getId(), postId));
    }

    @Transactional(readOnly = true)
    public long getLikeCount(Long postId) {
        requirePost(postId);
        return likeRepository.countByPostId(postId);
    }

    private void updateLike(User user, Post post, boolean liked) {
        var existing = likeRepository.findByUserIdAndPostId(user.getId(), post.getId());
        if (liked && existing.isEmpty()) {
            Like like = new Like();
            like.setUser(user);
            like.setPost(post);
            likeRepository.save(like);
        } else if (!liked && existing.isPresent()) {
            likeRepository.delete(existing.get());
        }
    }

    private LikeStatusResponse status(User user, Long postId) {
        return new LikeStatusResponse(likeRepository.existsByUserIdAndPostId(user.getId(), postId),
            likeRepository.countByPostId(postId));
    }

    private Post requirePost(Long postId) {
        return postRepository.findById(postId).orElseThrow(() -> new PostNotFoundException("Post not found"));
    }

    private User currentUser(boolean lock) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = lock ? userRepository.findByEmailForUpdate(email) : userRepository.findByEmail(email);
        if (user == null) throw new UserNotFoundException("User not found");
        return user;
    }
}
