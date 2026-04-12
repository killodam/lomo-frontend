var _userCache = {};
var _feedData = [];
var _empSearchData = [];
var _adminFeedData = [];
var _adminAllUsers = [];

var feedState = { page: 1, pageSize: 12, total: 0, totalPages: 0, search: '' };
var employerSearchState = { page: 1, pageSize: 12, total: 0, totalPages: 0, search: '', verified: '' };
var adminQueueState = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
var adminCandidateState = { page: 1, pageSize: 12, total: 0, totalPages: 0, search: '' };
var adminEmployerState = { page: 1, pageSize: 12, total: 0, totalPages: 0, search: '' };
var adminUsersState = { page: 1, pageSize: 20, total: 0, totalPages: 0, search: '' };

function recoverAuthFlowOnProtectedError(err, options) {
  var message = safeErrorText(err);
  if (!/Authentication required/i.test(message)) return false;

  clearToken();
  resetState();
  resetDisplay();

  if (options && options.listId) {
    var listEl = document.getElementById(options.listId);
    if (listEl) {
      listEl.innerHTML = '<div style="padding:20px;color:#991b1b;">Сессия завершилась. Войдите снова.</div>';
    }
  }

  if (options && options.pagerId) {
    renderPager(options.pagerId, { total: 0 }, function () {}, { label: options.label || 'элементов' });
  }

  showToast('Сессия завершилась. Войдите снова.');
  show('auth');
  return true;
}

function normalizePaginatedResponse(result) {
  if (Array.isArray(result)) {
    return {
      items: result,
      page: 1,
      pageSize: result.length || 0,
      total: result.length,
      totalPages: result.length ? 1 : 0,
    };
  }

  return {
    items: Array.isArray(result && result.items) ? result.items : [],
    page: Number(result && result.page) || 1,
    pageSize: Number(result && result.pageSize) || 0,
    total: Number(result && result.total) || 0,
    totalPages: Number(result && result.totalPages) || 0,
  };
}

function syncPagerState(targetState, response) {
  targetState.page = response.page || 1;
  targetState.pageSize = response.pageSize || targetState.pageSize;
  targetState.total = response.total || 0;
  targetState.totalPages = response.totalPages || (response.total ? 1 : 0);
}

function renderPager(targetId, pagerState, onNavigate, options) {
  var el = document.getElementById(targetId);
  if (!el) return;

  var total = Number(pagerState.total || 0);
  if (!total) {
    el.innerHTML = '';
    return;
  }

  var page = Number(pagerState.page || 1);
  var totalPages = Number(pagerState.totalPages || 1) || 1;
  var label = (options && options.label) || 'элементов';

  el.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.className = 'pagerBar';

  var meta = document.createElement('div');
  meta.className = 'pagerMeta';
  meta.textContent = totalPages > 1
    ? 'Страница ' + page + ' из ' + totalPages + ' · ' + total + ' ' + label
    : total + ' ' + label;

  var actions = document.createElement('div');
  actions.className = 'pagerActions';

  var prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'pagerBtn';
  prev.textContent = 'Назад';
  prev.disabled = page <= 1;
  prev.addEventListener('click', function () {
    if (page > 1) onNavigate(page - 1);
  });

  var next = document.createElement('button');
  next.type = 'button';
  next.className = 'pagerBtn';
  next.textContent = 'Далее';
  next.disabled = page >= totalPages;
  next.addEventListener('click', function () {
    if (page < totalPages) onNavigate(page + 1);
  });

  actions.appendChild(prev);
  actions.appendChild(next);
  wrap.appendChild(meta);
  wrap.appendChild(actions);
  el.appendChild(wrap);
}

function queueEmptyState(text) {
  return '<div style="text-align:center;padding:24px;color:#888;font-size:14px;">' + escapeHtml(text) + '</div>';
}

function loadAdminQueue(page) {
  if (!getToken()) return;
  if (page) adminQueueState.page = page;

  var el = document.getElementById('adminQueueList');
  if (el) el.innerHTML = queueEmptyState('Загрузка...');

  apiAdminQueue({
    page: adminQueueState.page,
    pageSize: adminQueueState.pageSize,
  }).then(function (result) {
    var data = normalizePaginatedResponse(result);
    syncPagerState(adminQueueState, data);

    var listEl = document.getElementById('adminQueueList');
    if (!listEl) return;

    if (!data.items.length) {
      listEl.innerHTML = queueEmptyState('Очередь пуста — все заявки обработаны');
      renderPager('adminQueuePager', { total: 0 }, function () {}, { label: 'документов' });
      return;
    }

    listEl.innerHTML = '';
    data.items.forEach(function (item) {
      var initials = (item.full_name || item.user_email || '?')
        .split(' ')
        .map(function (segment) { return segment[0] || ''; })
        .join('')
        .slice(0, 2)
        .toUpperCase();

      var card = document.createElement('div');
      card.className = 'adminCard';
      card.id = 'acard_' + item.id;
      card.innerHTML =
        '<div class="adminCardHead">' +
          '<div class="adminAvatar">' + escapeHtml(initials || '?') + '</div>' +
          '<div class="adminCardInfo">' +
            '<div class="adminCardName">' + escapeHtml(item.full_name || item.user_email || '—') + '</div>' +
            '<div class="adminCardDoc">' +
              escapeHtml(DOC_TYPE_LABELS[item.ach_type] || item.ach_type || 'Документ') +
              ' · ' +
              escapeHtml(item.ach_title || item.org || '') +
              (item.file_name ? ' · ' + escapeHtml(item.file_name) : '') +
            '</div>' +
          '</div>' +
          '<span class="statusBadge warn">На рассмотрении</span>' +
        '</div>' +
        '<div class="adminActions">' +
          '<input class="rejectInput" id="rInput_' + item.id + '" placeholder="Причина отказа"/>' +
        '</div>';

      var actions = card.querySelector('.adminActions');
      if (item.id) {
        var btnView = document.createElement('button');
        btnView.className = 'adminBtn';
        btnView.textContent = 'Просмотреть';
        btnView.style.cssText = 'background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;';
        btnView.addEventListener('click', function () {
          openSecureDocument(item.id, item.file_name).catch(function (err) {
            showToast('Ошибка: ' + err.message);
          });
        });
        actions.appendChild(btnView);
      }

      var btnApprove = document.createElement('button');
      btnApprove.className = 'adminBtn ok';
      btnApprove.textContent = 'Подтвердить';
      btnApprove.addEventListener('click', function () {
        apiAdminApprove(item.id).then(function () {
          showToast('Документ подтверждён');
          loadAdminQueue(adminQueueState.page);
        }).catch(function (err) {
          showToast('Ошибка: ' + err.message);
        });
      });

      var btnReject = document.createElement('button');
      btnReject.className = 'adminBtn danger';
      btnReject.textContent = 'Отклонить';
      btnReject.addEventListener('click', function () {
        var reason = document.getElementById('rInput_' + item.id);
        var value = reason ? reason.value.trim() : '';
        if (!value) {
          showToast('Укажите причину отказа');
          return;
        }
        apiAdminReject(item.id, value).then(function () {
          showToast('Документ отклонён');
          loadAdminQueue(adminQueueState.page);
        }).catch(function (err) {
          showToast('Ошибка: ' + err.message);
        });
      });

      actions.insertBefore(btnApprove, actions.firstChild);
      actions.appendChild(btnReject);
      listEl.appendChild(card);
    });

    renderPager('adminQueuePager', adminQueueState, loadAdminQueue, { label: 'документов' });
  }).catch(function (err) {
    var listEl = document.getElementById('adminQueueList');
    if (listEl) listEl.innerHTML = '<div style="color:#991b1b;padding:16px;">Ошибка загрузки: ' + escapeHtml(safeErrorText(err)) + '</div>';
    renderPager('adminQueuePager', { total: 0 }, function () {}, { label: 'документов' });
  });
}

function loadAdminUsers(page) {
  if (!getToken()) return;
  if (page) adminUsersState.page = page;
  adminUsersState.search = (document.getElementById('adminUserSearch')?.value || '').trim();

  var el = document.getElementById('adminUsersList');
  if (el) el.innerHTML = '<div style="color:#888;padding:8px;">Загрузка...</div>';

  apiAdminUsers({
    page: adminUsersState.page,
    pageSize: adminUsersState.pageSize,
    search: adminUsersState.search,
  }).then(function (result) {
    var data = normalizePaginatedResponse(result);
    syncPagerState(adminUsersState, data);
    _adminAllUsers = data.items || [];

    var listEl = document.getElementById('adminUsersList');
    if (!listEl) return;

    if (!_adminAllUsers.length) {
      listEl.innerHTML = '<div style="color:#888;padding:8px;">Нет пользователей</div>';
      renderPager('adminUsersPager', { total: 0 }, function () {}, { label: 'пользователей' });
      return;
    }

    listEl.innerHTML = '';
    var table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';
    table.innerHTML =
      '<thead><tr style="border-bottom:1px solid rgba(38,110,120,.15);">' +
        '<th style="text-align:left;padding:6px 8px;color:#666;">Email</th>' +
        '<th style="text-align:left;padding:6px 8px;color:#666;">Имя / Компания</th>' +
        '<th style="text-align:left;padding:6px 8px;color:#666;">Роль</th>' +
        '<th style="text-align:left;padding:6px 8px;color:#666;">Действия</th>' +
      '</tr></thead>';

    var tbody = document.createElement('tbody');
    _adminAllUsers.forEach(function (user) {
      var tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(0,0,0,.05)';
      tr.innerHTML =
        '<td style="padding:8px;">' + escapeHtml(user.email || '—') + '</td>' +
        '<td style="padding:8px;">' + escapeHtml(user.full_name || user.company || '—') + '</td>' +
        '<td style="padding:8px;"><span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(38,110,120,.10);color:#1a5c68;">' + escapeHtml(user.role || '—') + '</span></td>' +
        '<td style="padding:8px;" id="uactions_' + user.id + '"></td>';

      var actionsCell = tr.querySelector('#uactions_' + user.id);
      if (user.role !== 'admin') {
        var delBtn = document.createElement('button');
        delBtn.className = 'adminBtn danger';
        delBtn.style.fontSize = '11px';
        delBtn.style.padding = '4px 10px';
        delBtn.textContent = 'Удалить';
        delBtn.addEventListener('click', function () {
          if (!confirm('Удалить пользователя ' + user.email + '?')) return;
          apiFetch('/admin/users/' + user.id, { method: 'DELETE' }).then(function () {
            showToast('Пользователь удалён');
            loadAdminUsers(adminUsersState.page);
          }).catch(function (err) {
            showToast('Ошибка: ' + err.message);
          });
        });
        actionsCell.appendChild(delBtn);
      }

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    listEl.appendChild(table);
    renderPager('adminUsersPager', adminUsersState, loadAdminUsers, { label: 'пользователей' });
  }).catch(function (err) {
    var listEl = document.getElementById('adminUsersList');
    if (listEl) listEl.innerHTML = '<div style="color:#991b1b;padding:8px;">Ошибка: ' + escapeHtml(safeErrorText(err)) + '</div>';
    renderPager('adminUsersPager', { total: 0 }, function () {}, { label: 'пользователей' });
  });
}

function loadIncomingRequests() {
  var el = document.getElementById('epRequestsList');
  if (!el || state.roleReg !== 'EMPLOYEE' || !getToken()) return;
  el.innerHTML = '<div class="miniHint">Загрузка запросов...</div>';
  apiGetRequests().then(function (requests) {
    if (!requests.length) {
      el.innerHTML = '<div class="miniHint">Запросов пока нет</div>';
      return;
    }

    el.innerHTML = requests.map(function (req) {
      var who = escapeHtml(req.company || req.employer_name || 'Работодатель');
      var docLabel = escapeHtml(DOC_TYPE_LABELS[req.document_type] || req.document_type || 'Документ');
      var status = req.status === 'approved'
        ? '<span class="chip ok">одобрено</span>'
        : req.status === 'rejected'
          ? '<span class="chip bad">отклонено</span>'
          : '<span class="chip warn">ожидает решения</span>';
      var actions = req.status === 'pending'
        ? '<div class="actionsRow" style="margin-top:10px;">' +
            '<button type="button" class="pillBtn" data-approve-request="' + req.id + '">Разрешить доступ</button>' +
            '<button type="button" class="pillBtn" data-reject-request="' + req.id + '">Отклонить</button>' +
          '</div>'
        : '';

      return '<div class="achRow" style="align-items:flex-start;">' +
        '<div style="flex:1;">' +
          '<div class="achTitle">' + docLabel + '</div>' +
          '<div class="achMeta">' + who + ' запрашивает доступ к файлу</div>' +
          actions +
        '</div>' +
        status +
      '</div>';
    }).join('');
  }).catch(function (err) {
    el.innerHTML = '<div class="miniHint" style="color:#991b1b;">Ошибка: ' + escapeHtml(err.message) + '</div>';
  });
}

function handleRequestDecision(requestId, action) {
  var fn = action === 'approve' ? apiApproveRequest : apiRejectRequest;
  fn(requestId).then(function () {
    showToast(action === 'approve' ? 'Доступ разрешён' : 'Запрос отклонён');
    loadIncomingRequests();
    if (_activePublicProfileUserId) loadEmployerAccessPanel(_activePublicProfileUserId);
  }).catch(function (err) {
    showToast('Ошибка: ' + err.message);
  });
}

function requestDocumentAccess(candidateId, documentType) {
  apiSendRequest(candidateId, documentType).then(function () {
    showToast('Запрос отправлен');
    loadEmployerAccessPanel(candidateId);
  }).catch(function (err) {
    showToast('Ошибка: ' + err.message);
  });
}

function renderEmployerAccessPanel(candidateId, requests, files) {
  var box = document.getElementById('pubAccessPanel');
  if (!box) return;

  var requestMap = {};
  (requests || []).forEach(function (req) {
    requestMap[req.document_type] = req;
  });

  var fileMap = {};
  (files || []).forEach(function (file) {
    fileMap[file.type] = file;
  });

  var buttons = ['education', 'work', 'courses', 'passport', 'cv'].map(function (type) {
    var file = fileMap[type];
    if (file) {
      return '<button type="button" class="pillBtn" data-open-doc="' + file.id + '" data-file-name="' + escapeHtml(file.file_name || DOC_TYPE_LABELS[type]) + '">Открыть: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
    }

    var req = requestMap[type];
    if (req && req.status === 'pending') {
      return '<button type="button" class="pillBtn" disabled>Запрос отправлен: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
    }
    if (req && req.status === 'approved') {
      return '<button type="button" class="pillBtn" disabled>Доступ одобрен: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
    }

    return '<button type="button" class="pillBtn" data-request-doc="' + type + '" data-candidate-id="' + candidateId + '">Запросить: ' + escapeHtml(DOC_TYPE_LABELS[type]) + '</button>';
  }).join('');

  var filesHtml = (files && files.length)
    ? files.map(function (file) {
        return '<div class="achRow">' +
          '<div><div class="achTitle">' + escapeHtml(DOC_TYPE_LABELS[file.type] || file.type) + '</div><div class="achMeta">' + escapeHtml(file.file_name || '') + '</div></div>' +
          '<button type="button" class="miniLink" data-open-doc="' + file.id + '" data-file-name="' + escapeHtml(file.file_name || 'document') + '">Открыть</button>' +
        '</div>';
      }).join('')
    : '<div class="miniHint">Пока нет файлов с одобренным доступом</div>';

  box.innerHTML =
    '<div class="pubProfileSection">' +
      '<div class="pubProfileSTitle">Доступ к документам</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">' + buttons + '</div>' +
      filesHtml +
    '</div>';
}

function loadEmployerAccessPanel(candidateId) {
  if (state.roleReg !== 'EMPLOYER' || !getToken()) return;
  var box = document.getElementById('pubAccessPanel');
  if (!box) return;
  box.innerHTML = '<div class="miniHint">Загрузка доступа...</div>';

  Promise.all([
    apiGetRequests(),
    apiGetAccessibleFiles(candidateId).catch(function () { return []; }),
  ]).then(function (result) {
    var requests = (result[0] || []).filter(function (req) { return req.candidate_id === candidateId; });
    renderEmployerAccessPanel(candidateId, requests, result[1] || []);
  }).catch(function (err) {
    box.innerHTML = '<div class="miniHint" style="color:#991b1b;">Ошибка: ' + escapeHtml(err.message) + '</div>';
  });
}

function updateProfileProgress() {
  var p = state.employee;
  var score = 0;
  var total = 6;
  var hints = [];

  if (p.fullName) score += 1; else hints.push({ text: 'Добавьте имя' });
  if (p.eduPlace) score += 1; else hints.push({ text: 'Укажите место обучения' });
  if (p.vacancies) score += 1; else hints.push({ text: 'Укажите желаемые вакансии' });

  var anyProof = Object.values(p.proofs).some(function (proof) { return proof.fileName; });
  if (anyProof) score += 1; else hints.push({ text: 'Загрузите хотя бы один документ' });

  var anyVerified = Object.values(p.proofs).some(function (proof) { return proof.status === 'подтверждено'; });
  if (anyVerified) score += 1; else hints.push({ text: 'Получите первое подтверждение' });

  if (p.proofs.cv.fileName) score += 1; else hints.push({ text: 'Загрузите резюме (CV)' });

  var pct = Math.round((score / total) * 100);
  var fill = document.getElementById('epProgressFill');
  var label = document.getElementById('epProgressLabel');
  var hintsEl = document.getElementById('epProgressHints');
  var banner = document.getElementById('epOnboardBanner');
  var bannerText = document.getElementById('epOnboardText');

  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = 'Профиль ' + pct + '%' + (pct < 50 ? ' — заполните для видимости' : pct < 100 ? ' — почти готово!' : ' — профиль полный');
  if (hintsEl) {
    hintsEl.innerHTML = hints.slice(0, 3).map(function (hint) {
      return '<div class="progressHint">' + escapeHtml(hint.text) + '</div>';
    }).join('');
  }

  if (pct >= 100 && banner) banner.style.display = 'none';
  if (pct > 0 && pct < 100 && bannerText && hints[0]) {
    bannerText.textContent = 'Следующий шаг: ' + hints[0].text;
  }
}

function hydrateCvPrivacy() {
  var toggle = document.getElementById('cvPublicToggle');
  var label = document.getElementById('cvPrivacyLabel');
  if (toggle) toggle.checked = !!state.employee.cvPublic;
  if (label) label.textContent = state.employee.cvPublic ? 'CV видно публично' : 'CV скрыто (по умолчанию)';
}

function updateCvPrivacy() {
  var toggle = document.getElementById('cvPublicToggle');
  var label = document.getElementById('cvPrivacyLabel');
  state.employee.cvPublic = toggle ? toggle.checked : false;
  if (label) label.textContent = state.employee.cvPublic ? 'CV видно публично' : 'CV скрыто (по умолчанию)';
}

function initHashRouting() {
  var hash = location.hash;
  if (hash && hash.startsWith('#profile=')) {
    var id = decodeURIComponent(hash.slice(9));
    if (!id) return;
    apiGetPublicProfile(id).then(function (profile) {
      openUserProfile(profile);
    }).catch(function () {
      showToast('Профиль не найден');
      show(getToken() ? (_profileFromScreen || 'auth') : 'auth');
    });
  }
}

var CIS_UNIVERSITIES = [
  'МГУ им. М.В. Ломоносова', 'СПбГУ (Санкт-Петербургский государственный университет)',
  'МГТУ им. Н.Э. Баумана', 'НИУ ВШЭ (Высшая школа экономики)', 'МИФИ (Национальный ядерный университет)',
  'МФТИ (Московский физико-технический институт)', 'РАНХиГС',
  'МГИМО (Московский государственный институт международных отношений)',
  'Финансовый университет при Правительстве РФ', 'РЭУ им. Г.В. Плеханова',
  'РУДН (Российский университет дружбы народов)', 'УрФУ (Уральский федеральный университет)',
  'НГУ (Новосибирский государственный университет)', 'КФУ (Казанский федеральный университет)',
  'ТГУ (Томский государственный университет)', 'СФУ (Сибирский федеральный университет)',
  'ЮФУ (Южный федеральный университет)', 'ДВФУ (Дальневосточный федеральный университет)',
  'БФУ им. И. Канта (Балтийский федеральный университет)', 'РГГУ (Российский государственный гуманитарный университет)',
  'РГУНГ им. Губкина', 'МГТУ «СТАНКИН»', 'МАИ (Московский авиационный институт)',
  'МИИТ (РУТ — Российский университет транспорта)', 'МГСУ (НИУ Московский государственный строительный университет)',
  'ИТМО (Университет ИТМО, Санкт-Петербург)', 'Политех СПб (СПбПУ Петра Великого)',
  'ЛЭТИ (Санкт-Петербургский государственный электротехнический университет)',
  'СПбГАСУ (Санкт-Петербургский государственный архитектурно-строительный университет)',
  'НУ (Назарбаев Университет, Астана)', 'КазНУ им. аль-Фараби (Алматы)',
  'КНУ им. Тараса Шевченко (Киев)', 'КПИ им. Игоря Сикорского (Киев)',
  'БГУ (Белорусский государственный университет, Минск)',
  'НУУз (Национальный университет Узбекистана, Ташкент)',
  'БГУ (Бакинский государственный университет)',
  'ЕГУ (Ереванский государственный университет)',
  'ТГУ (Тбилисский государственный университет им. Джавахишвили)',
  'КНУ им. Жусупа Баласагына (Бишкек)',
  'ТНУ (Таджикский национальный университет, Душанбе)',
  'МГУ (Молдавский государственный университет, Кишинёв)',
  'Иннополис (Университет Иннополис, Татарстан)',
  'Сколтех (Сколковский институт науки и технологий)',
];

function filterUniList(query) {
  var dropdown = document.getElementById('uniDropdown');
  if (!dropdown) return;

  var q = String(query || '').trim().toLowerCase();
  if (q.length < 1) {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    return;
  }

  var matches = CIS_UNIVERSITIES.filter(function (university) {
    return university.toLowerCase().includes(q);
  }).slice(0, 12);

  dropdown.innerHTML = '';
  matches.forEach(function (name) {
    var option = document.createElement('div');
    option.className = 'uniOption';
    option.textContent = name;
    option.addEventListener('click', function () { selectUni(name); });
    dropdown.appendChild(option);
  });

  var custom = document.createElement('div');
  custom.className = 'uniOption add-custom';
  custom.textContent = 'Добавить: «' + query + '»';
  custom.addEventListener('click', function () { selectUni(query); });
  dropdown.appendChild(custom);
  dropdown.classList.add('open');
}

function selectUni(name) {
  var input = document.getElementById('mpCEduPlace');
  var dropdown = document.getElementById('uniDropdown');
  if (input) input.value = name;
  if (dropdown) {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
  }
}

document.addEventListener('click', function (event) {
  if (!event.target.closest('.uniWrap')) {
    var dropdown = document.getElementById('uniDropdown');
    if (dropdown) {
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
    }
  }
});

function buildFeedTags(user) {
  var tags = [];
  var statuses = {
    education: user.edu_status,
    work: user.work_status,
    courses: user.course_status,
    passport: user.pass_status,
    cv: user.cv_status,
  };
  var labels = {
    education: 'Образование',
    work: 'Опыт',
    courses: 'Курсы',
    passport: 'Паспорт',
    cv: 'CV',
  };

  Object.keys(statuses).forEach(function (key) {
    var status = statuses[key];
    if (status === 'verified') tags.push('<span class="feedTag verified">' + labels[key] + '</span>');
    else if (status === 'pending') tags.push('<span class="feedTag pending">' + labels[key] + '</span>');
  });

  if (!tags.length) tags.push('<span class="feedTag" style="background:#f5f5f5;color:#999;border-color:#e5e7eb;">Заполняется</span>');
  return tags.join('');
}

function buildSocialCard(user) {
  var isEmployer = user.role === 'employer';
  var name = escHtml(user.full_name || (isEmployer ? user.company : '') || user.email || '?');
  var rawName = name.replace(/&[^;]+;/g, '');
  var initials = rawName.split(' ').map(function (segment) { return segment[0] || ''; }).join('').slice(0, 2).toUpperCase() || '?';
  var avatarBg = isEmployer ? 'background:linear-gradient(135deg,#0f4c5c,#2a7a8a)' : 'background:linear-gradient(135deg,#2a7a8a,#38b2ac)';
  var avatarRadius = isEmployer ? '14px' : '50%';

  var verificationStatuses = [user.edu_status, user.work_status, user.course_status, user.pass_status, user.cv_status];
  var verifiedCount = verificationStatuses.filter(function (status) { return status === 'verified'; }).length;
  var pendingCount = verificationStatuses.filter(function (status) { return status === 'pending'; }).length;
  var verificationBadge = verifiedCount > 0
    ? '<span class="scVerBadge">✓ LOMO ' + verifiedCount + '</span>'
    : (pendingCount > 0 ? '<span class="scVerBadge pending">Проверяется</span>' : '');

  var roleTag = isEmployer
    ? '<span class="scRoleTag employer">Работодатель</span>'
    : '<span class="scRoleTag candidate">Кандидат</span>';

  var subParts = isEmployer
    ? [user.industry, user.location].filter(Boolean)
    : [user.edu_place, user.edu_year, user.location].filter(Boolean);
  var subLine = subParts.length ? '<div class="scSub">' + escHtml(subParts.join(' · ')) + '</div>' : '';

  var jobLine = '';
  if (!isEmployer && user.current_job && user.current_job !== 'Не работаю') {
    jobLine = '<div class="scJobLine">' + escHtml(user.current_job + (user.job_title ? ' · ' + user.job_title : '')) + '</div>';
  } else if (!isEmployer && user.current_job === 'Не работаю') {
    jobLine = '<div class="scJobLine" style="color:#bbb;font-size:12px">В поиске работы</div>';
  }

  var workExpLine = '';
  if (!isEmployer && user.work_exp && user.work_exp.length) {
    workExpLine = '<div class="scWorkExp">' + user.work_exp.slice(0, 2).map(function (item) {
      return '<div class="scExpItem"><span class="scExpCo">' + escHtml(item.company || '') + '</span>' +
        (item.role ? ' <span class="scExpRole">· ' + escHtml(item.role) + '</span>' : '') +
        (item.period ? ' <span class="scExpPeriod">' + escHtml(item.period) + '</span>' : '') +
      '</div>';
    }).join('') + '</div>';
  }

  var aboutSnippet = user.about
    ? '<div class="scAbout">' + escHtml(user.about.slice(0, 120)) + (user.about.length > 120 ? '…' : '') + '</div>'
    : '';

  var extraLines = '';
  if (isEmployer) {
    var safeWebsite = safeHttpUrl(user.website);
    if (safeWebsite) {
      extraLines += '<div class="scSub" style="margin-top:4px;"><a href="' + escHtml(safeWebsite) + '" target="_blank" rel="noopener noreferrer" style="color:#2a7a8a;text-decoration:none;">' + escHtml(user.website) + '</a></div>';
    }
    if (user.needed) {
      var needed = user.needed.split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 4);
      if (needed.length) {
        extraLines += '<div class="scChipRow" style="margin-top:8px;"><span style="font-size:11px;color:#999;margin-right:4px;">Ищем:</span>' +
          needed.map(function (item) { return '<span class="scProject hiring">' + escHtml(item) + '</span>'; }).join('') +
        '</div>';
      }
    }
  }

  var detailLines = '';
  if (!isEmployer) {
    var verifiedLabels = {
      edu_status: 'Образование',
      work_status: 'Опыт',
      course_status: 'Курсы',
      pass_status: 'Паспорт',
      cv_status: 'CV',
    };
    var verifiedItems = [];
    Object.keys(verifiedLabels).forEach(function (key) {
      if (user[key] === 'verified') verifiedItems.push(verifiedLabels[key]);
    });
    if (verifiedItems.length) {
      detailLines += '<div class="scChipRow" style="margin-top:6px;">' +
        verifiedItems.map(function (value) { return '<span class="scVerItem">✓ ' + value + '</span>'; }).join('') +
      '</div>';
    }
    if (user.vacancies) {
      var vacancies = user.vacancies.split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 3);
      if (vacancies.length) {
        detailLines += '<div class="scChipRow" style="margin-top:4px;"><span style="font-size:11px;color:#999;margin-right:4px;">Ищу:</span>' +
          vacancies.map(function (value) { return '<span class="scProject">' + escHtml(value) + '</span>'; }).join('') +
        '</div>';
      }
    }
  }

  var projectsLine = '';
  if (isEmployer && user.active_projects) {
    var projects = user.active_projects.split(';').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 3);
    if (projects.length) {
      projectsLine = '<div class="scChipRow" style="margin-top:4px;"><span style="font-size:11px;color:#999;margin-right:4px;">Проекты:</span>' +
        projects.map(function (value) { return '<span class="scProject">' + escHtml(value) + '</span>'; }).join('') +
      '</div>';
    }
  }

  var hasBody = aboutSnippet || jobLine || workExpLine || extraLines || detailLines || projectsLine;
  var avatarHtml;
  var avatarSrc = safeImageUrl(user.avatar_url);
  if (avatarSrc) {
    avatarHtml = '<div style="width:54px;height:54px;flex-shrink:0;border-radius:' + avatarRadius + ';overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.15);">' +
      '<img src="' + escHtml(avatarSrc) + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">' +
    '</div>';
  } else {
    avatarHtml = '<div style="width:54px;height:54px;font-size:19px;font-weight:700;flex-shrink:0;border-radius:' + avatarRadius + ';' + avatarBg + ';color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.15);">' + initials + '</div>';
  }

  var uid = String(user.id || user.email || '?');
  _userCache[uid] = user;
  return '<div class="socialCard" data-uid="' + uid + '" style="cursor:pointer;">' +
    '<div class="scHead">' +
      avatarHtml +
      '<div class="scInfo">' +
        '<div class="scNameRow"><span class="scName">' + name + '</span>' + verificationBadge + '</div>' +
        subLine +
        '<div class="scRoleRow">' + roleTag + '</div>' +
      '</div>' +
    '</div>' +
    (hasBody ? '<div class="scBody">' + (aboutSnippet || '') + jobLine + workExpLine + extraLines + detailLines + projectsLine + '</div>' : '') +
  '</div>';
}

function loadCandidateFeed(page) {
  if (page) feedState.page = page;
  feedState.search = (document.getElementById('feedSearchInput')?.value || '').trim();

  var el = document.getElementById('candidateFeedList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:32px;color:#888;">Загрузка...</div>';

  apiGetFeed({
    page: feedState.page,
    pageSize: feedState.pageSize,
    search: feedState.search,
  }).then(function (result) {
    var data = normalizePaginatedResponse(result);
    syncPagerState(feedState, data);
    _feedData = data.items || [];
    renderFeedList(_feedData);
    renderPager('candidateFeedPager', feedState, loadCandidateFeed, { label: 'профилей' });
  }).catch(function (err) {
    if (recoverAuthFlowOnProtectedError(err, {
      listId: 'candidateFeedList',
      pagerId: 'candidateFeedPager',
      label: 'профилей',
    })) return;
    el.innerHTML = '<div style="padding:20px;color:#991b1b;">Ошибка: ' + escHtml(safeErrorText(err)) + '</div>';
    renderPager('candidateFeedPager', { total: 0 }, function () {}, { label: 'профилей' });
  });
}

function filterFeed() {
  feedState.page = 1;
  loadCandidateFeed(1);
}

function renderFeedList(list) {
  var el = document.getElementById('candidateFeedList');
  if (!el) return;

  var filtered = list.filter(function (user) {
    return String(user.id) !== String(state.userId);
  });

  if (!filtered.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#aaa;font-size:14px;">По текущему запросу профили не найдены</div>';
    return;
  }

  el.innerHTML = filtered.map(function (user) {
    return buildSocialCard(user);
  }).join('');
}

function loadEmployerSearch(page) {
  if (page) employerSearchState.page = page;
  employerSearchState.search = (document.getElementById('empSearchName')?.value || '').trim();
  employerSearchState.verified = (document.getElementById('empSearchVerified')?.value || '').trim();

  var el = document.getElementById('employerCandidateList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:32px;color:#888;">Загрузка...</div>';

  apiGetCandidates({
    page: employerSearchState.page,
    pageSize: employerSearchState.pageSize,
    search: employerSearchState.search,
    verified: employerSearchState.verified === 'verified' ? 'true' : '',
  }).then(function (result) {
    var data = normalizePaginatedResponse(result);
    syncPagerState(employerSearchState, data);
    _empSearchData = data.items || [];
    renderEmployerSearch(_empSearchData);
    renderPager('employerCandidatePager', employerSearchState, loadEmployerSearch, { label: 'кандидатов' });
  }).catch(function (err) {
    if (recoverAuthFlowOnProtectedError(err, {
      listId: 'employerCandidateList',
      pagerId: 'employerCandidatePager',
      label: 'кандидатов',
    })) return;
    el.innerHTML = '<div style="padding:20px;color:#991b1b;">Ошибка: ' + escHtml(safeErrorText(err)) + '</div>';
    renderPager('employerCandidatePager', { total: 0 }, function () {}, { label: 'кандидатов' });
  });
}

function filterEmployerSearch() {
  employerSearchState.page = 1;
  loadEmployerSearch(1);
}

function renderEmployerSearch(list) {
  var el = document.getElementById('employerCandidateList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div style="padding:24px;text-align:center;color:#888;">Нет кандидатов по текущему фильтру</div>';
    return;
  }
  el.innerHTML = list.map(function (candidate) {
    return buildSocialCard(candidate);
  }).join('');
}

function loadAdminCandidates(page) {
  if (!getToken()) return;
  if (page) adminCandidateState.page = page;
  adminCandidateState.search = (document.getElementById('adminCandSearch')?.value || '').trim();

  var el = document.getElementById('adminCandidateList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:32px;color:#888;">Загрузка...</div>';

  apiGetCandidates({
    page: adminCandidateState.page,
    pageSize: adminCandidateState.pageSize,
    search: adminCandidateState.search,
  }).then(function (result) {
    var data = normalizePaginatedResponse(result);
    syncPagerState(adminCandidateState, data);
    _adminFeedData = data.items || [];
    renderAdminCandidates(_adminFeedData);
    renderPager('adminCandidatePager', adminCandidateState, loadAdminCandidates, { label: 'кандидатов' });
  }).catch(function (err) {
    if (recoverAuthFlowOnProtectedError(err, {
      listId: 'adminCandidateList',
      pagerId: 'adminCandidatePager',
      label: 'кандидатов',
    })) return;
    el.innerHTML = '<div style="padding:20px;color:#991b1b;">Ошибка: ' + escHtml(safeErrorText(err)) + '</div>';
    renderPager('adminCandidatePager', { total: 0 }, function () {}, { label: 'кандидатов' });
  });
}

function loadAdminEmployers(page) {
  if (!getToken()) return;
  if (page) adminEmployerState.page = page;
  adminEmployerState.search = (document.getElementById('adminEmpSearch')?.value || '').trim();

  var el = document.getElementById('adminEmployerList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:32px;color:#888;">Загрузка...</div>';

  apiAdminUsers({
    page: adminEmployerState.page,
    pageSize: adminEmployerState.pageSize,
    search: adminEmployerState.search,
    role: 'employer',
  }).then(function (result) {
    var data = normalizePaginatedResponse(result);
    syncPagerState(adminEmployerState, data);
    _adminAllUsers = data.items || [];
    renderAdminEmployers(_adminAllUsers);
    renderPager('adminEmployerPager', adminEmployerState, loadAdminEmployers, { label: 'компаний' });
  }).catch(function (err) {
    if (recoverAuthFlowOnProtectedError(err, {
      listId: 'adminEmployerList',
      pagerId: 'adminEmployerPager',
      label: 'компаний',
    })) return;
    el.innerHTML = '<div style="padding:20px;color:#991b1b;">Ошибка: ' + escHtml(safeErrorText(err)) + '</div>';
    renderPager('adminEmployerPager', { total: 0 }, function () {}, { label: 'компаний' });
  });
}

function switchAdminTab(tab) {
  ['docs', 'candidates', 'employers', 'users'].forEach(function (key) {
    var panel = document.getElementById('adminTabPanel' + key.charAt(0).toUpperCase() + key.slice(1));
    var button = document.getElementById('adminTab' + key.charAt(0).toUpperCase() + key.slice(1));
    if (panel) panel.style.display = key === tab ? '' : 'none';
    if (button) button.classList.toggle('active', key === tab);
  });

  if (tab === 'docs') loadAdminQueue();
  if (tab === 'candidates') loadAdminCandidates();
  if (tab === 'employers') loadAdminEmployers();
  if (tab === 'users') loadAdminUsers();
}

function loadAdminFeedTab(tab) {
  if (tab === 'candidates') loadAdminCandidates();
  if (tab === 'employers') loadAdminEmployers();
}

function filterAdminCandidates() {
  adminCandidateState.page = 1;
  loadAdminCandidates(1);
}

function filterAdminEmployers() {
  adminEmployerState.page = 1;
  loadAdminEmployers(1);
}

function renderAdminCandidates(list) {
  var el = document.getElementById('adminCandidateList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">Нет кандидатов</div>';
    return;
  }
  el.innerHTML = list.map(function (candidate) {
    candidate.role = candidate.role || 'candidate';
    return buildSocialCard(candidate);
  }).join('');
}

function renderAdminEmployers(list) {
  var el = document.getElementById('adminEmployerList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">Нет работодателей</div>';
    return;
  }
  el.innerHTML = list.map(function (user) {
    return buildSocialCard(user);
  }).join('');
}
