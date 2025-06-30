const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// In-memory storage (replace with database in production)
let users = {
  'john': {
    id: 'john',
    name: 'Ragulapadu Pavithra',
    email: 'pavithra@example.com',
    bio: 'Web Developer & Tech Enthusiast',
    avatar: '👨‍💻',
    password: '$2a$10$example', // hashed password
    followers: [],
    following: [],
    posts: [],
    createdAt: new Date('2024-01-01'),
    isActive: true
  },
  'jane': {
    id: 'jane',
    name: 'Derangula Swetha',
    email: 'swetha@example.com',
    bio: 'Designer & Creative Mind',
    avatar: '👩‍🎨',
    password: '$2a$10$example',
    followers: [],
    following: [],
    posts: [],
    createdAt: new Date('2024-01-02'),
    isActive: true
  },
  'mike': {
    id: 'mike',
    name: 'Pamuru Pujitha',
    email: 'pujitha@example.com',
    bio: 'Photographer & Traveler',
    avatar: '📸',
    password: '$2a$10$example',
    followers: [],
    following: [],
    posts: [],
    createdAt: new Date('2024-01-03'),
    isActive: true
  },
  'sarah': {
    id: 'sarah',
    name: 'Chamanchi PadmaSree',
    email: 'padmasree@example.com',
    bio: 'Marketing Expert & Coffee Lover',
    avatar: '☕',
    password: '$2a$10$example',
    followers: [],
    following: [],
    posts: [],
    createdAt: new Date('2024-01-04'),
    isActive: true
  }
};

let posts = [];
let comments = [];
let likes = [];
let notifications = [];

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Utility functions
const generateId = () => uuidv4();

const createNotification = (userId, type, message, relatedId = null) => {
  const notification = {
    id: generateId(),
    userId,
    type,
    message,
    relatedId,
    isRead: false,
    createdAt: new Date()
  };
  notifications.push(notification);
  return notification;
};

const getUserStats = (userId) => {
  const userPosts = posts.filter(post => post.authorId === userId);
  const userFollowers = users[userId]?.followers || [];
  const userFollowing = users[userId]?.following || [];
  
  return {
    postsCount: userPosts.length,
    followersCount: userFollowers.length,
    followingCount: userFollowing.length
  };
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, bio = '', avatar = '👤' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = Object.values(users).find(user => user.email === email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateId();

    const newUser = {
      id: userId,
      name,
      email,
      bio,
      avatar,
      password: hashedPassword,
      followers: [],
      following: [],
      posts: [],
      createdAt: new Date(),
      isActive: true
    };

    users[userId] = newUser;

    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        name,
        email,
        bio,
        avatar,
        ...getUserStats(userId)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = Object.values(users).find(user => user.email === email);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
        ...getUserStats(user.id)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User routes
app.get('/api/users', authenticateToken, (req, res) => {
  const { search, limit = 20, offset = 0 } = req.query;
  let userList = Object.values(users).filter(user => user.isActive);

  if (search) {
    userList = userList.filter(user => 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.bio.toLowerCase().includes(search.toLowerCase())
    );
  }

  const paginatedUsers = userList
    .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    .map(user => ({
      id: user.id,
      name: user.name,
      bio: user.bio,
      avatar: user.avatar,
      ...getUserStats(user.id),
      isFollowing: users[req.user.userId]?.following.includes(user.id) || false
    }));

  res.json({
    users: paginatedUsers,
    total: userList.length,
    hasMore: parseInt(offset) + parseInt(limit) < userList.length
  });
});

app.get('/api/users/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;
  const user = users[userId];

  if (!user || !user.isActive) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user.id,
    name: user.name,
    bio: user.bio,
    avatar: user.avatar,
    createdAt: user.createdAt,
    ...getUserStats(userId),
    isFollowing: users[req.user.userId]?.following.includes(userId) || false
  });
});

app.put('/api/users/profile', authenticateToken, (req, res) => {
  const { name, bio, avatar } = req.body;
  const userId = req.user.userId;

  if (!users[userId]) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (name) users[userId].name = name;
  if (bio !== undefined) users[userId].bio = bio;
  if (avatar) users[userId].avatar = avatar;

  res.json({
    message: 'Profile updated successfully',
    user: {
      id: userId,
      name: users[userId].name,
      email: users[userId].email,
      bio: users[userId].bio,
      avatar: users[userId].avatar,
      ...getUserStats(userId)
    }
  });
});

// Follow/Unfollow routes
app.post('/api/users/:userId/follow', authenticateToken, (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.userId;

  if (userId === currentUserId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  if (!users[userId] || !users[userId].isActive) {
    return res.status(404).json({ error: 'User not found' });
  }

  const currentUser = users[currentUserId];
  const targetUser = users[userId];

  if (currentUser.following.includes(userId)) {
    return res.status(400).json({ error: 'Already following this user' });
  }

  currentUser.following.push(userId);
  targetUser.followers.push(currentUserId);

  // Create notification
  createNotification(
    userId,
    'follow',
    `${currentUser.name} started following you`,
    currentUserId
  );

  res.json({ message: 'Successfully followed user' });
});

app.delete('/api/users/:userId/follow', authenticateToken, (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.userId;

  if (!users[userId]) {
    return res.status(404).json({ error: 'User not found' });
  }

  const currentUser = users[currentUserId];
  const targetUser = users[userId];

  currentUser.following = currentUser.following.filter(id => id !== userId);
  targetUser.followers = targetUser.followers.filter(id => id !== currentUserId);

  res.json({ message: 'Successfully unfollowed user' });
});

// Post routes
app.get('/api/posts', authenticateToken, (req, res) => {
  const { limit = 20, offset = 0, userId } = req.query;
  let filteredPosts = posts;

  if (userId) {
    filteredPosts = posts.filter(post => post.authorId === userId);
  } else {
    // Feed: show posts from followed users and own posts
    const currentUser = users[req.user.userId];
    const followingIds = [...currentUser.following, req.user.userId];
    filteredPosts = posts.filter(post => followingIds.includes(post.authorId));
  }

  const postsWithDetails = filteredPosts
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    .map(post => {
      const author = users[post.authorId];
      const postLikes = likes.filter(like => like.postId === post.id);
      const postComments = comments.filter(comment => comment.postId === post.id);
      
      return {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        author: {
          id: author.id,
          name: author.name,
          avatar: author.avatar
        },
        likesCount: postLikes.length,
        commentsCount: postComments.length,
        isLiked: postLikes.some(like => like.userId === req.user.userId),
        comments: postComments.slice(0, 3).map(comment => ({
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          author: {
            id: users[comment.authorId].id,
            name: users[comment.authorId].name,
            avatar: users[comment.authorId].avatar
          }
        }))
      };
    });

  res.json({
    posts: postsWithDetails,
    total: filteredPosts.length,
    hasMore: parseInt(offset) + parseInt(limit) < filteredPosts.length
  });
});

app.post('/api/posts', authenticateToken, (req, res) => {
  const { content } = req.body;
  const userId = req.user.userId;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Post content is required' });
  }

  if (content.length > 1000) {
    return res.status(400).json({ error: 'Post content too long (max 1000 characters)' });
  }

  const post = {
    id: generateId(),
    authorId: userId,
    content: content.trim(),
    createdAt: new Date()
  };

  posts.push(post);

  const author = users[userId];
  res.status(201).json({
    message: 'Post created successfully',
    post: {
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      author: {
        id: author.id,
        name: author.name,
        avatar: author.avatar
      },
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
      comments: []
    }
  });
});

app.delete('/api/posts/:postId', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;

  const postIndex = posts.findIndex(post => post.id === postId);
  if (postIndex === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (posts[postIndex].authorId !== userId) {
    return res.status(403).json({ error: 'You can only delete your own posts' });
  }

  posts.splice(postIndex, 1);
  
  // Clean up associated likes and comments
  likes = likes.filter(like => like.postId !== postId);
  comments = comments.filter(comment => comment.postId !== postId);

  res.json({ message: 'Post deleted successfully' });
});

// Like routes
app.post('/api/posts/:postId/like', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;

  const post = posts.find(post => post.id === postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const existingLike = likes.find(like => like.postId === postId && like.userId === userId);
  if (existingLike) {
    return res.status(400).json({ error: 'Post already liked' });
  }

  const like = {
    id: generateId(),
    postId,
    userId,
    createdAt: new Date()
  };

  likes.push(like);

  // Create notification if liking someone else's post
  if (post.authorId !== userId) {
    createNotification(
      post.authorId,
      'like',
      `${users[userId].name} liked your post`,
      postId
    );
  }

  res.json({ message: 'Post liked successfully' });
});

app.delete('/api/posts/:postId/like', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;

  const likeIndex = likes.findIndex(like => like.postId === postId && like.userId === userId);
  if (likeIndex === -1) {
    return res.status(404).json({ error: 'Like not found' });
  }

  likes.splice(likeIndex, 1);
  res.json({ message: 'Post unliked successfully' });
});

// Comment routes
app.get('/api/posts/:postId/comments', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  const post = posts.find(post => post.id === postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const postComments = comments
    .filter(comment => comment.postId === postId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    .map(comment => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: {
        id: users[comment.authorId].id,
        name: users[comment.authorId].name,
        avatar: users[comment.authorId].avatar
      }
    }));

  res.json({
    comments: postComments,
    total: comments.filter(comment => comment.postId === postId).length
  });
});

app.post('/api/posts/:postId/comments', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Comment content is required' });
  }

  const post = posts.find(post => post.id === postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const comment = {
    id: generateId(),
    postId,
    authorId: userId,
    content: content.trim(),
    createdAt: new Date()
  };

  comments.push(comment);

  // Create notification if commenting on someone else's post
  if (post.authorId !== userId) {
    createNotification(
      post.authorId,
      'comment',
      `${users[userId].name} commented on your post`,
      postId
    );
  }

  const author = users[userId];
  res.status(201).json({
    message: 'Comment added successfully',
    comment: {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: {
        id: author.id,
        name: author.name,
        avatar: author.avatar
      }
    }
  });
});

// Notification routes
app.get('/api/notifications', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { limit = 20, offset = 0 } = req.query;

  const userNotifications = notifications
    .filter(notification => notification.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({
    notifications: userNotifications,
    unreadCount: notifications.filter(n => n.userId === userId && !n.isRead).length
  });
});

app.put('/api/notifications/:notificationId/read', authenticateToken, (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user.userId;

  const notification = notifications.find(n => n.id === notificationId && n.userId === userId);
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  notification.isRead = true;
  res.json({ message: 'Notification marked as read' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize sample data
const initializeSampleData = async () => {
  // Hash passwords for sample users
  for (const userId in users) {
    users[userId].password = await bcrypt.hash('password123', 10);
  }

  // Set up initial follows
  users.john.following = ['jane', 'mike'];
  users.jane.followers = ['john'];
  users.mike.followers = ['john'];
  users.jane.following = ['sarah'];
  users.sarah.followers = ['jane'];

  // Create sample posts
  const samplePosts = [
    {
      id: generateId(),
      authorId: 'jane',
      content: 'Just finished an amazing design project! 🎨 The client loved the modern approach with vibrant gradients.',
      createdAt: new Date(Date.now() - 3600000)
    },
    {
      id: generateId(),
      authorId: 'mike',
      content: 'Captured this stunning sunset during my hike today. Nature never fails to amaze me! 🌅',
      createdAt: new Date(Date.now() - 7200000)
    },
    {
      id: generateId(),
      authorId: 'john',
      content: 'Working on a new React project with some cool animations. The intersection observer API is incredibly powerful! 💻',
      createdAt: new Date(Date.now() - 10800000)
    }
  ];

  posts.push(...samplePosts);

  // Add sample likes and comments
  likes.push(
    { id: generateId(), postId: samplePosts[0].id, userId: 'john', createdAt: new Date() },
    { id: generateId(), postId: samplePosts[0].id, userId: 'mike', createdAt: new Date() },
    { id: generateId(), postId: samplePosts[1].id, userId: 'jane', createdAt: new Date() }
  );

  comments.push(
    {
      id: generateId(),
      postId: samplePosts[0].id,
      authorId: 'john',
      content: 'Looks fantastic! Great work Jane!',
      createdAt: new Date()
    },
    {
      id: generateId(),
      postId: samplePosts[1].id,
      authorId: 'jane',
      content: 'Breathtaking photo! Where was this taken?',
      createdAt: new Date()
    }
  );
};

// Start server
app.listen(PORT, async () => {
  await initializeSampleData();
  console.log(`SocialConnect Express server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
