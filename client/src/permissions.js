/** Permission helpers for UI visibility (mirrors server RBAC). */

export function can(user, ...codes) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return codes.some((c) => perms.includes(c));
}

export function flag(user, name) {
  if (!user) return false;
  if (user.flags && typeof user.flags[name] === 'boolean') return user.flags[name];
  const map = {
    office: ['office.access'],
    admin: ['admin.users', 'admin.roles'],
    content: ['content.teach', 'content.builder'],
    diary: ['diary.access'],
    diaryManage: ['diary.manage'],
    parent: ['parent.portal'],
    student: ['student.learn'],
    search: ['search.access'],
    messages: ['messages.access'],
    portfolio: ['portfolio.access'],
    documents: ['documents.access'],
    marketing: ['marketing.landings'],
  };
  return can(user, ...(map[name] || []));
}

export function homePathFor(user) {
  if (!user) return '/login';
  if (flag(user, 'parent') && user.role === 'parent') return '/parent';
  if (flag(user, 'office')) return '/office';
  if (flag(user, 'admin')) return '/admin/guide';
  if (flag(user, 'content')) return '/teacher';
  if (flag(user, 'student')) return '/dashboard';
  return '/courses';
}
