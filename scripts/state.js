function emptyProof() {
  return { fileName: '', status: 'не загружено', url: '', docId: '', achievementId: '', rejectReason: '' };
}

const state = {
  roleReg: null,
  prevFromDone: 'landing',
  email: '',
  login: '',
  userId: '',
  publicId: '',
  connections: {
    accepted: [],
    incoming: [],
    outgoing: [],
    counts: { accepted: 0, incoming: 0, outgoing: 0 },
  },
  chat: {
    conversations: [],
    activeConversationId: '',
    messagesByConversation: {},
  },
  employer: {
    fullName: '',
    title: 'HR Manager',
    company: '',
    foundedYear: '',
    location: '',
    industry: '',
    products: '',
    activeProjects: '',
    neededSpecialists: '',
    about: '',
    email: '',
    corpEmail: '',
    phone: '',
    website: '',
    telegram: '',
    avatarDataUrl: '',
    proofs: {
      companyDoc: emptyProof(),
    },
  },
  employee: {
    fullName: '',
    city: '',
    phone: '',
    about: '',
    email: '',
    telegram: '',
    eduPlace: '',
    eduYear: '',
    vacancies: '',
    current_job: '',
    job_title: '',
    work_exp: [],
    cvPublic: false,
    portfolio: [],
    avatarDataUrl: '',
    proofs: {
      education: emptyProof(),
      work: emptyProof(),
      courses: emptyProof(),
      passport: emptyProof(),
      cv: emptyProof(),
    },
  },
};

function getUserStorageKey(userId) {
  return 'lomo_u_' + String(userId || '');
}

function getAppStorage() {
  return window.sessionStorage;
}

function saveToStorage() {
  if (!state.userId) return;
  try {
    const employerSnapshot = {
      fullName: state.employer.fullName,
      title: state.employer.title,
      company: state.employer.company,
      foundedYear: state.employer.foundedYear,
      location: state.employer.location,
      industry: state.employer.industry,
      products: state.employer.products,
      activeProjects: state.employer.activeProjects,
      neededSpecialists: state.employer.neededSpecialists,
      about: state.employer.about,
      website: state.employer.website,
      proofs: {
        companyDoc: {
          fileName: state.employer.proofs.companyDoc?.fileName || '',
          status: state.employer.proofs.companyDoc?.status || 'не загружено',
          docId: state.employer.proofs.companyDoc?.docId || '',
          achievementId: state.employer.proofs.companyDoc?.achievementId || '',
          rejectReason: state.employer.proofs.companyDoc?.rejectReason || '',
        },
      },
    };

    const employeeSnapshot = {
      fullName: state.employee.fullName,
      city: state.employee.city,
      about: state.employee.about,
      eduPlace: state.employee.eduPlace,
      eduYear: state.employee.eduYear,
      vacancies: state.employee.vacancies,
      current_job: state.employee.current_job,
      job_title: state.employee.job_title,
      work_exp: state.employee.work_exp,
      cvPublic: state.employee.cvPublic,
      proofs: {
        education: {
          fileName: state.employee.proofs.education.fileName,
          status: state.employee.proofs.education.status,
          docId: state.employee.proofs.education.docId || '',
          achievementId: state.employee.proofs.education.achievementId || '',
          rejectReason: state.employee.proofs.education.rejectReason || '',
        },
        work: {
          fileName: state.employee.proofs.work.fileName,
          status: state.employee.proofs.work.status,
          docId: state.employee.proofs.work.docId || '',
          achievementId: state.employee.proofs.work.achievementId || '',
          rejectReason: state.employee.proofs.work.rejectReason || '',
        },
        courses: {
          fileName: state.employee.proofs.courses.fileName,
          status: state.employee.proofs.courses.status,
          docId: state.employee.proofs.courses.docId || '',
          achievementId: state.employee.proofs.courses.achievementId || '',
          rejectReason: state.employee.proofs.courses.rejectReason || '',
        },
        passport: {
          fileName: state.employee.proofs.passport.fileName,
          status: state.employee.proofs.passport.status,
          docId: state.employee.proofs.passport.docId || '',
          achievementId: state.employee.proofs.passport.achievementId || '',
          rejectReason: state.employee.proofs.passport.rejectReason || '',
        },
        cv: {
          fileName: state.employee.proofs.cv.fileName,
          status: state.employee.proofs.cv.status,
          docId: state.employee.proofs.cv.docId || '',
          achievementId: state.employee.proofs.cv.achievementId || '',
          rejectReason: state.employee.proofs.cv.rejectReason || '',
        },
      },
    };

    getAppStorage().setItem(
      getUserStorageKey(state.userId),
      JSON.stringify({
        employer: employerSnapshot,
        employee: employeeSnapshot,
        login: state.login,
        publicId: state.publicId,
      })
    );
  } catch (error) {}
}

function loadUserStorage(userId) {
  try {
    return JSON.parse(getAppStorage().getItem(getUserStorageKey(userId)) || '{}');
  } catch {
    return {};
  }
}

function clearUserStorage(userId) {
  if (!userId) return;
  try {
    getAppStorage().removeItem(getUserStorageKey(userId));
  } catch (error) {}
}

function mergeLocalState(userId) {
  const saved = loadUserStorage(userId);
  const employerFields = ['fullName', 'title', 'company', 'foundedYear', 'location', 'industry', 'products', 'activeProjects', 'neededSpecialists', 'about', 'website'];
  const employeeFields = ['fullName', 'city', 'about', 'eduPlace', 'eduYear', 'vacancies', 'current_job', 'job_title'];

  if (saved.employer) {
    employerFields.forEach(function (key) {
      if (saved.employer[key] && !state.employer[key]) state.employer[key] = saved.employer[key];
    });
  }

  if (saved.employee) {
    employeeFields.forEach(function (key) {
      if (saved.employee[key] && !state.employee[key]) state.employee[key] = saved.employee[key];
    });
    if (Array.isArray(saved.employee.work_exp) && !state.employee.work_exp.length) {
      state.employee.work_exp = saved.employee.work_exp;
    }
    if (typeof saved.employee.cvPublic === 'boolean') {
      state.employee.cvPublic = saved.employee.cvPublic;
    }
  }

  if (saved.login && !state.login) state.login = saved.login;
  if (saved.publicId && !state.publicId) state.publicId = saved.publicId;

  ['education', 'work', 'courses', 'passport', 'cv'].forEach(function (key) {
    const proof = saved.employee?.proofs?.[key];
    if (!proof) return;
    if (!state.employee.proofs[key].fileName && proof.fileName) state.employee.proofs[key].fileName = proof.fileName;
    if (state.employee.proofs[key].status === 'не загружено' && proof.status !== 'не загружено') state.employee.proofs[key].status = proof.status;
    if (!state.employee.proofs[key].docId && proof.docId) state.employee.proofs[key].docId = proof.docId;
    if (!state.employee.proofs[key].achievementId && proof.achievementId) state.employee.proofs[key].achievementId = proof.achievementId;
    if (!state.employee.proofs[key].rejectReason && proof.rejectReason) state.employee.proofs[key].rejectReason = proof.rejectReason;
  });

  const companyDoc = saved.employer?.proofs?.companyDoc;
  if (companyDoc) {
    if (!state.employer.proofs.companyDoc.fileName && companyDoc.fileName) state.employer.proofs.companyDoc.fileName = companyDoc.fileName;
    if (state.employer.proofs.companyDoc.status === 'не загружено' && companyDoc.status !== 'не загружено') state.employer.proofs.companyDoc.status = companyDoc.status;
    if (!state.employer.proofs.companyDoc.docId && companyDoc.docId) state.employer.proofs.companyDoc.docId = companyDoc.docId;
    if (!state.employer.proofs.companyDoc.achievementId && companyDoc.achievementId) state.employer.proofs.companyDoc.achievementId = companyDoc.achievementId;
    if (!state.employer.proofs.companyDoc.rejectReason && companyDoc.rejectReason) state.employer.proofs.companyDoc.rejectReason = companyDoc.rejectReason;
  }
}

function resetState() {
  state.userId = '';
  state.email = '';
  state.login = '';
  state.roleReg = null;
  state.publicId = '';
  state.connections = {
    accepted: [],
    incoming: [],
    outgoing: [],
    counts: { accepted: 0, incoming: 0, outgoing: 0 },
  };
  state.chat = {
    conversations: [],
    activeConversationId: '',
    messagesByConversation: {},
  };
  state.employer = {
    fullName: '',
    title: 'HR Manager',
    company: '',
    foundedYear: '',
    location: '',
    industry: '',
    products: '',
    activeProjects: '',
    neededSpecialists: '',
    about: '',
    email: '',
    corpEmail: '',
    phone: '',
    website: '',
    telegram: '',
    avatarDataUrl: '',
    proofs: { companyDoc: emptyProof() },
  };
  state.employee = {
    fullName: '',
    city: '',
    phone: '',
    about: '',
    email: '',
    telegram: '',
    eduPlace: '',
    eduYear: '',
    vacancies: '',
    current_job: '',
    job_title: '',
    work_exp: [],
    cvPublic: false,
    portfolio: [],
    avatarDataUrl: '',
    proofs: {
      education: emptyProof(),
      work: emptyProof(),
      courses: emptyProof(),
      passport: emptyProof(),
      cv: emptyProof(),
    },
  };
}

function resetDisplay() {
  document.querySelectorAll('input[type="file"]').forEach(function (element) {
    try { element.value = ''; } catch (error) {}
  });
  const hints = {
    companyDocHintE: 'Файл не выбран',
    eduHintC: 'Файл не выбран',
    workHintC: 'Файл не выбран',
    courseHintC: 'Файл не выбран',
    passHintC: 'Файл не выбран',
    cvHintC: 'Файл не выбран',
    portHintC: 'Файлы не выбраны',
  };
  Object.keys(hints).forEach(function (id) {
    const element = document.getElementById(id);
    if (element) element.textContent = hints[id];
  });
  ['companyDocStatusE', 'eduStatusC', 'workStatusC', 'courseStatusC', 'passStatusC', 'cvStatusC'].forEach(function (id) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = 'не загружено';
      element.className = 'statusTag';
    }
  });
}

document.addEventListener('click', function (event) {
  const button = event.target.closest('.js-load-files');
  if (button) loadUserFiles(button.dataset.uid);
});

const CIS_COMPANIES = ['Газпром','Лукойл','Роснефть','Сбербанк','ВТБ','Яндекс','VK (Mail.ru)','Ростелеком','РЖД','Росатом','Норильский никель','Северсталь','НЛМК','Магнит','X5 Retail Group','Аэрофлот','Альфа-Банк','Тинькофф','МТС','Билайн','МегаФон','Лаборатория Касперского','1С','EPAM Systems','Softline','HeadHunter (hh.ru)','Авито','Wildberries','Ozon','Lamoda','СберМаркет','Delivery Club','ЮМоней','Ростех','АЛРОСА','Полюс','ФосАгро','Евраз','Металлоинвест','КамАЗ','АвтоВАЗ','Интер РАО','РусГидро','Мосэнерго','Unilever RU','Nestle RU','P&G RU','Samsung RU','Huawei RU','Microsoft RU','Oracle RU','SAP RU','IBM RU','Accenture RU','Deloitte CIS','EY RU','KPMG RU','PwC RU','McKinsey RU','BCG RU','Positive Technologies','Group-IB','Acronis','Parallels','JetBrains','Luxoft','DataArt','Сбертех','ВТБ Тех','МТС Диджитал','РТ-Солар','Skillfactory','Нетология','GeekBrains','Skyeng','Учи.ру','Додо Пицца','ВкусВилл','Самокат','Я.Маркет','Газпромнефть','Банк Открытие','Россельхозбанк','Почта России','МТС Банк','Совкомбанк','Трансмашхолдинг','Не работаю'];

function filterJobList(query) {
  var dropdown = document.getElementById('jobDropdown');
  if (!dropdown) return;
  var search = query.trim().toLowerCase();
  if (search.length < 1) { dropdown.classList.remove('open'); dropdown.innerHTML = ''; return; }
  var matches = CIS_COMPANIES.filter(function (company) { return company.toLowerCase().indexOf(search) >= 0; }).slice(0, 8);
  if (!matches.length) { dropdown.classList.remove('open'); dropdown.innerHTML = ''; return; }
  dropdown.innerHTML = matches.map(function (company) {
    var item = document.createElement('li');
    item.textContent = company;
    item.addEventListener('click', function () { selectJob(company); });
    return item.outerHTML;
  }).join('');
  dropdown.classList.add('open');
  dropdown.querySelectorAll('li').forEach(function (item) {
    item.addEventListener('click', function () { selectJob(item.textContent); });
  });
}

function selectJob(name) {
  var input = document.getElementById('mpCCurrentJob');
  var dropdown = document.getElementById('jobDropdown');
  if (input) input.value = name;
  if (dropdown) { dropdown.classList.remove('open'); dropdown.innerHTML = ''; }
}

var _wec = 0;

function addWorkExp() {
  var list = document.getElementById('workExpList');
  if (!list) return;
  var id = ++_wec;
  var element = document.createElement('div');
  element.className = 'workExpEntry';
  element.dataset.expId = id;
  element.innerHTML = '<button type="button" class="removeExpBtn" title="Удалить">×</button>'
    + '<div class="sqInput"><input type="text" class="expCompany" placeholder="Компания" autocomplete="off"></div>'
    + '<div class="sqInput"><input type="text" class="expRole" placeholder="Должность" autocomplete="off"></div>'
    + '<div class="sqInput"><input type="text" class="expPeriod" placeholder="Период (2021–2023)" autocomplete="off"></div>'
    + '<div class="sqInput"><input type="text" class="expDesc" placeholder="Обязанности (необязательно)" autocomplete="off"></div>';
  element.querySelector('.removeExpBtn').addEventListener('click', function () { removeWorkExp(id); });
  list.appendChild(element);
}

function removeWorkExp(id) {
  var element = document.querySelector('[data-exp-id="' + id + '"]');
  if (element) element.remove();
}

function getWorkExpData() {
  return Array.from(document.querySelectorAll('.workExpEntry')).map(function (element) {
    return {
      company: (element.querySelector('.expCompany') || {}).value || '',
      role: (element.querySelector('.expRole') || {}).value || '',
      period: (element.querySelector('.expPeriod') || {}).value || '',
      desc: (element.querySelector('.expDesc') || {}).value || '',
    };
  }).filter(function (item) {
    return item.company || item.role;
  });
}

function loadWorkExpData(items) {
  var list = document.getElementById('workExpList');
  if (!list || !items || !items.length) return;
  list.innerHTML = '';
  _wec = 0;
  items.forEach(function (item) {
    addWorkExp();
    var last = list.lastElementChild;
    if (!last) return;
    if (last.querySelector('.expCompany')) last.querySelector('.expCompany').value = item.company || '';
    if (last.querySelector('.expRole')) last.querySelector('.expRole').value = item.role || '';
    if (last.querySelector('.expPeriod')) last.querySelector('.expPeriod').value = item.period || '';
    if (last.querySelector('.expDesc')) last.querySelector('.expDesc').value = item.desc || '';
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}
