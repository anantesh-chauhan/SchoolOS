import jwt from 'jsonwebtoken';

export const generateToken = (payload) => {
  return jwt.sign({ ...payload, tokenType: 'access' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || '30m',
  });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  });
};

export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tokenType && decoded.tokenType !== 'access') {
      throw new Error('Invalid access token');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    if (decoded.tokenType && decoded.tokenType !== 'refresh') {
      throw new Error('Invalid refresh token');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

export const decodeToken = (token) => {
  return jwt.decode(token);
};
