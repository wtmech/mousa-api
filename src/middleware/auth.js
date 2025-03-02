const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Verify token
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token verification failed, authorization denied' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  next();
};

const isDistributor = (req, res, next) => {
  if (!req.user.isDistributor) {
    return res.status(403).json({ message: 'Access denied. Distributor privileges required.' });
  }
  next();
};

const isArtist = (req, res, next) => {
  if (!req.user.isArtist) {
    return res.status(403).json({ message: 'Access denied. Artist privileges required.' });
  }
  next();
};

module.exports = { auth, isAdmin, isDistributor, isArtist };