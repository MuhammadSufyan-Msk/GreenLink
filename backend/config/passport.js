// ============================================
// Passport.js + JWT Authentication Config
// ============================================
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

// In-memory user store (replace with DB in production)
const users = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@greenlink.io',
    // Default password: admin123
    password: '$2a$10$abrE4SoIOQRUkiqo70Xu3.VU9Ku9cDTGWhUujDYVL9RGNhFuhleZW',
    role: 'admin',
    name: 'System Admin'
  },
  {
    id: '2',
    username: 'operator',
    email: 'operator@greenlink.io',
    // Default password: operator123
    password: '$2a$10$abrE4SoIOQRUkiqo70Xu3.VU9Ku9cDTGWhUujDYVL9RGNhFuhleZW',
    role: 'operator',
    name: 'Field Operator'
  }
];

function configurePassport(passport) {
  // --- Local Strategy (login) ---
  passport.use(new LocalStrategy(
    { usernameField: 'username' },
    async (username, password, done) => {
      try {
        const user = users.find(u => u.username === username || u.email === username);
        if (!user) return done(null, false, { message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: 'Invalid credentials' });

        return done(null, { id: user.id, username: user.username, role: user.role, name: user.name });
      } catch (err) {
        return done(err);
      }
    }
  ));

  // --- JWT Strategy (protected routes) ---
  const jwtOpts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'greenlink_default_secret'
  };

  passport.use(new JwtStrategy(jwtOpts, (payload, done) => {
    const user = users.find(u => u.id === payload.id);
    if (user) {
      return done(null, { id: user.id, username: user.username, role: user.role, name: user.name });
    }
    return done(null, false);
  }));
}

function findUserByUsername(username) {
  return users.find(u => u.username === username || u.email === username);
}

function findUserById(id) {
  return users.find(u => u.id === id);
}

module.exports = { configurePassport, findUserByUsername, findUserById, users };
