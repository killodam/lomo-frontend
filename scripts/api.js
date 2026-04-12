const DEFAULT_API_BASE = (() => {
  const host = window.location.hostname || '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  const isLocalFile = window.location.protocol === 'file:';
  return (isLocalHost || isLocalFile)
    ? 'https://lomo-backend-hergg.amvera.io/api'
    : '/api';
})();

const API_BASE = (window.LOMO_CONFIG?.API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
const BACKEND_BASE = API_BASE.startsWith('http')
  ? API_BASE.replace(/\/api$/, '')
  : window.location.origin;
const CSRF_COOKIE_NAME = window.LOMO_CONFIG?.CSRF_COOKIE_NAME || 'lomo_csrf';

const DOC_TYPE_LABELS = {
  education: 'Образование',
  work: 'Опыт работы',
  courses: 'Курсы / сертификаты',
  passport: 'Паспорт',
  cv: 'CV',
  company_doc: 'Документы компании',
};

const PROOF_KEY_TO_TYPE = {
  companyDoc: 'company_doc',
  education: 'education',
  work: 'work',
  courses: 'courses',
  passport: 'passport',
  cv: 'cv',
};

const TYPE_TO_PROOF_KEY = {
  company_doc: 'companyDoc',
  education: 'education',
  work: 'work',
  courses: 'courses',
  passport: 'passport',
  cv: 'cv',
};

function getCookie(name) {
  const pattern = new RegExp('(?:^|; )' + String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : '';
}

function getCsrfToken() {
  return getCookie(CSRF_COOKIE_NAME);
}

function getToken() {
  return getCsrfToken();
}

function setToken() {
  return undefined;
}

function clearToken() {
  document.cookie = `${encodeURIComponent(CSRF_COOKIE_NAME)}=; Max-Age=0; path=/; SameSite=Lax`;
}

function proofKeyToApiType(key) {
  return PROOF_KEY_TO_TYPE[key] || key;
}

function apiTypeToProofKey(type) {
  return TYPE_TO_PROOF_KEY[type] || type;
}

function publicProfileUrlForId(publicId) {
  return location.href.split('#')[0] + '#profile=' + encodeURIComponent(publicId || '');
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const search = query.toString();
  return search ? `?${search}` : '';
}

async function apiFetch(path, opts = {}) {
  const method = String(opts.method || 'GET').toUpperCase();
  const csrfToken = getCsrfToken();
  const headers = {
    ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...(opts.headers || {}),
  };

  const response = await fetch(API_BASE + path, {
    ...opts,
    method,
    credentials: 'include',
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'API error ' + response.status);
  return data;
}

async function apiFetchBlob(path, opts = {}) {
  const method = String(opts.method || 'GET').toUpperCase();
  const csrfToken = getCsrfToken();
  const response = await fetch(API_BASE + path, {
    ...opts,
    method,
    credentials: 'include',
    headers: {
      ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(opts.headers || {}),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'API error ' + response.status);
  }
  return response.blob();
}

async function apiRegister(email, password, role, name, login) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, role, name, login }),
  });
  setToken();
  return data;
}

async function apiLogin(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken();
  return data;
}

async function apiLogout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}

async function apiLogoutAll() {
  return apiFetch('/auth/logout-all', { method: 'POST' });
}

async function apiDeleteAccount(password) {
  return apiFetch('/auth/account', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}

async function apiMe() {
  return apiFetch('/auth/me');
}

async function apiSaveProfile(fields) {
  return apiFetch('/profile', { method: 'PUT', body: JSON.stringify(fields) });
}

async function apiUploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch('/upload', { method: 'POST', body: formData });
}

async function apiCreateAchievement(type, title, org) {
  return apiFetch('/achievements', {
    method: 'POST',
    body: JSON.stringify({ type, title, org }),
  });
}

async function apiAttachDocument(achievement_id, file_url, file_name) {
  return apiFetch('/documents', {
    method: 'POST',
    body: JSON.stringify({ achievement_id, file_url, file_name }),
  });
}

async function apiGetAchievements() {
  return apiFetch('/achievements');
}

async function apiAdminQueue(params = {}) {
  return apiFetch('/admin/queue' + buildQuery(params));
}

async function apiAdminUsers(params = {}) {
  return apiFetch('/admin/users' + buildQuery(params));
}

async function apiAdminApprove(docId) {
  return apiFetch('/admin/documents/' + docId + '/approve', { method: 'POST' });
}

async function apiAdminReject(docId, reason) {
  return apiFetch('/admin/documents/' + docId + '/reject', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

async function apiForgotPassword(email) {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

async function apiResetPassword(email, code, newPassword) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, newPassword }),
  });
}

async function apiGetRequests() {
  return apiFetch('/requests');
}

async function apiGetConnections() {
  return apiFetch('/connections');
}

async function apiGetConnectionStatus(userId) {
  return apiFetch('/connections/status/' + encodeURIComponent(userId));
}

async function apiSendConnectionRequest(target_user_id) {
  return apiFetch('/connections', {
    method: 'POST',
    body: JSON.stringify({ target_user_id }),
  });
}

async function apiAcceptConnection(connectionId) {
  return apiFetch('/connections/' + encodeURIComponent(connectionId) + '/accept', { method: 'POST' });
}

async function apiRejectConnection(connectionId) {
  return apiFetch('/connections/' + encodeURIComponent(connectionId) + '/reject', { method: 'POST' });
}

async function apiRemoveConnection(connectionId) {
  return apiFetch('/connections/' + encodeURIComponent(connectionId), { method: 'DELETE' });
}

async function apiSendRequest(candidate_id, document_type) {
  return apiFetch('/requests', {
    method: 'POST',
    body: JSON.stringify({ candidate_id, document_type }),
  });
}

async function apiApproveRequest(id) {
  return apiFetch('/requests/' + id + '/approve', { method: 'POST' });
}

async function apiRejectRequest(id) {
  return apiFetch('/requests/' + id + '/reject', { method: 'POST' });
}

async function apiGetAccessibleFiles(candidateId) {
  return apiFetch('/requests/candidate/' + candidateId + '/files');
}

async function apiGetPublicProfile(publicId) {
  return apiFetch('/public/profile/' + encodeURIComponent(publicId));
}

async function apiGetCandidates(params = {}) {
  return apiFetch('/profile/candidates' + buildQuery(params));
}

async function apiGetFeed(params = {}) {
  return apiFetch('/profile/feed' + buildQuery(params));
}

function applyProfileToState(user, profile, achievements) {
  state.userId = String(user.id || '');
  state.email = user.email || '';
  state.login = user.login || '';
  state.roleReg = user.role === 'employer' ? 'EMPLOYER' : user.role === 'admin' ? 'ADMIN' : 'EMPLOYEE';
  if (profile && profile.public_id) state.publicId = profile.public_id;
  if (!profile) return;

  if (user.role === 'employer') {
    Object.assign(state.employer, {
      fullName: profile.full_name || '',
      title: profile.title || 'HR Manager',
      company: profile.company || '',
      foundedYear: profile.founded_year || '',
      location: profile.location || '',
      industry: profile.industry || '',
      products: profile.products || '',
      activeProjects: profile.active_projects || '',
      neededSpecialists: profile.needed || '',
      about: profile.about || '',
      email: profile.email || user.email,
      corpEmail: profile.corp_email || '',
      phone: profile.phone || '',
      website: profile.website || '',
      telegram: profile.telegram || '',
      avatarDataUrl: profile.avatar_url || '',
    });
  } else {
    Object.assign(state.employee, {
      fullName: profile.full_name || '',
      city: profile.location || '',
      phone: profile.phone || '',
      about: profile.about || '',
      eduPlace: profile.edu_place || '',
      eduYear: profile.edu_year || '',
      vacancies: profile.vacancies || '',
      current_job: profile.current_job || '',
      job_title: profile.job_title || '',
      work_exp: Array.isArray(profile.work_exp) ? profile.work_exp : [],
      email: profile.email || user.email,
      telegram: profile.telegram || '',
      cvPublic: !!profile.cv_public,
      avatarDataUrl: profile.avatar_url || '',
    });
  }

  if (achievements && achievements.length) {
    const target = user.role === 'employer' ? state.employer : state.employee;
    achievements.forEach((achievement) => {
      const key = apiTypeToProofKey(achievement.type);
      if (target.proofs && target.proofs[key] !== undefined) {
        target.proofs[key].status = achievement.status === 'verified'
          ? 'подтверждено'
          : achievement.status === 'pending'
            ? 'на рассмотрении'
            : achievement.status === 'rejected'
              ? 'отклонено'
              : 'не загружено';
        target.proofs[key].fileName = achievement.file_name || '';
        target.proofs[key].docId = achievement.doc_id || '';
        target.proofs[key].achievementId = achievement.id || '';
        target.proofs[key].url = '';
        target.proofs[key].rejectReason = achievement.reject_reason || '';
      }
    });
  }

  mergeLocalState(state.userId);
}

async function tryAutoLogin() {
  if (!getToken()) return false;
  try {
    const { user, profile, achievements } = await apiMe();
    applyProfileToState(user, profile, achievements);
    saveToStorage();
    return user;
  } catch {
    clearToken();
    return false;
  }
}
