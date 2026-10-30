const jwt = require('jsonwebtoken');
const { permissionsForRole, hasPermission, isLiveRole } = require('../services/rbac');

const JWT_SECRET = process.env.JWT_SECRET || 'it-scool-secret-change-me-on-host';

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!isLiveRole(payload.role)) {
      return res.status(403).json({ error: 'Эта роль отключена' });
    }
    req.user = payload;
    req.user.permissions = permissionsForRole(payload.role);
    next();
  } catch {
    return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'Недостаточно прав' });
  };
}

/** Any of the listed permissions (admin always passes) */
function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    if (hasPermission(req.user.role, ...perms)) return next();
    return res.status(403).json({ error: 'Недостаточно прав для этого раздела' });
  };
}

function userCan(user, ...perms) {
  if (!user) return false;
  return hasPermission(user.role, ...perms);
}

module.exports = {
  authRequired,
  requireRole,
  requirePermission,
  userCan,
  JWT_SECRET,
};
