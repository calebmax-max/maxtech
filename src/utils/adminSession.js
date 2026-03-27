const ADMIN_SESSION_KEY = 'elitehotels-admin-session';
const WORKSPACE_KEY = 'elitehotels-workspace-slug';

export const getAdminSession = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const savedSession = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    return savedSession ? JSON.parse(savedSession) : null;
  } catch (error) {
    return null;
  }
};

export const setAdminSession = (admin) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const session = {
    email: admin.email,
    name: admin.name || 'Caleb Tonny',
    isAdmin: Boolean(admin.isAdmin),
    orgId: admin.orgId || null,
    organization: admin.organization || null,
    signedInAt: admin.signedInAt || new Date().toISOString(),
  };

  window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  if (admin.organization?.slug) {
    window.localStorage.setItem(WORKSPACE_KEY, admin.organization.slug);
  }
  return session;
};

export const clearAdminSession = () => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
};

export const setActiveWorkspace = (slug) => {
  if (typeof window !== 'undefined' && slug) {
    window.localStorage.setItem(WORKSPACE_KEY, slug);
  }
};

export const isAdminAuthenticated = () => {
  const session = getAdminSession();
  return Boolean(session?.isAdmin);
};
