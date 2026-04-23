(function (window) {
  function createElement(tagName, className, text) {
    var el = document.createElement(tagName);
    if (className) el.className = className;
    if (typeof text !== 'undefined' && text !== null) el.textContent = text;
    return el;
  }

  function appendElement(parent, tagName, className, text) {
    var el = createElement(tagName, className, text);
    parent.appendChild(el);
    return el;
  }

  function getDisplayName(user, isEmployer) {
    return String(user && (user.full_name || (isEmployer ? user.company : '') || user.email) || '?');
  }

  function getInitials(name) {
    var initials = String(name || '?').split(/\s+/).map(function (segment) {
      return segment ? segment.charAt(0) : '';
    }).join('').slice(0, 2).toUpperCase();
    return initials || '?';
  }

  function buildAvatarFallback(avatarRoleClass, initials) {
    return createElement('div', 'scAvatarFallback' + avatarRoleClass, initials);
  }

  function buildAvatar(user, isEmployer, displayName) {
    var avatarRoleClass = isEmployer ? ' employer' : ' candidate';
    var avatar = createElement('div', 'scAvatar' + avatarRoleClass);
    var avatarSrc = safeImageUrl(user.avatar_url);

    if (!avatarSrc) {
      avatar.appendChild(buildAvatarFallback(avatarRoleClass, getInitials(displayName)));
      return avatar;
    }

    var img = document.createElement('img');
    img.src = avatarSrc;
    img.className = 'scAvatarImage';
    img.alt = displayName;
    img.addEventListener('error', function () {
      avatar.innerHTML = '';
      avatar.appendChild(buildAvatarFallback(avatarRoleClass, getInitials(displayName)));
    });
    avatar.appendChild(img);
    return avatar;
  }

  function buildVerificationBadge(user) {
    var verificationStatuses = [user.edu_status, user.work_status, user.course_status, user.pass_status, user.cv_status];
    var verifiedCount = verificationStatuses.filter(function (status) { return status === 'verified'; }).length;
    var pendingCount = verificationStatuses.filter(function (status) { return status === 'pending'; }).length;

    if (verifiedCount > 0) return createElement('span', 'scVerBadge', '✓ LOMO ' + verifiedCount);
    if (pendingCount > 0) return createElement('span', 'scVerBadge pending', 'Проверяется');
    return null;
  }

  function buildRoleTag(isEmployer) {
    return createElement('span', 'scRoleTag' + (isEmployer ? ' employer' : ' candidate'), isEmployer ? 'Работодатель' : 'Кандидат');
  }

  function appendTextLine(parent, className, text) {
    if (!text) return null;
    return appendElement(parent, 'div', className, text);
  }

  function appendChipRow(parent, rowClass, labelText, items, itemClass) {
    if (!items || !items.length) return null;

    var row = appendElement(parent, 'div', 'scChipRow ' + rowClass);
    if (labelText) appendElement(row, 'span', 'scChipLabel', labelText);

    items.forEach(function (item) {
      row.appendChild(createElement('span', itemClass || 'scProject', item));
    });
    return row;
  }

  function appendVerifiedItems(parent, user) {
    var verifiedData = [];
    var row;

    if (user.edu_status === 'verified') verifiedData.push({ label: 'Образование', tool: [user.edu_place, user.edu_year].filter(Boolean).join(', ') || 'Диплом проверен' });
    if (user.work_status === 'verified') verifiedData.push({ label: 'Опыт', tool: user.work_exp && user.work_exp[0] ? [user.work_exp[0].company, user.work_exp[0].role].filter(Boolean).join(' · ') : 'Стаж подтвержден' });
    if (user.course_status === 'verified') verifiedData.push({ label: 'Курсы', tool: 'Сертификаты доп. образования проверены' });
    if (user.pass_status === 'verified') verifiedData.push({ label: 'Паспорт', tool: 'Личность пользователя подтверждена' });
    if (user.cv_status === 'verified') verifiedData.push({ label: 'CV', tool: 'Резюме соответствует документам' });

    if (!verifiedData.length) return null;

    row = appendElement(parent, 'div', 'scChipRow regular');
    verifiedData.forEach(function (item) {
      var badge = createElement('span', 'scVerItem has-tooltip', '✓ ' + item.label);
      badge.setAttribute('data-tooltip', item.tool);
      row.appendChild(badge);
    });
    return row;
  }

  function appendEmployerExtras(parent, user) {
    var safeWebsite = safeHttpUrl(user.website);
    var needed;

    if (safeWebsite) {
      var websiteWrap = appendElement(parent, 'div', 'scSub compact');
      var link = createElement('a', 'scSubLink', user.website);
      link.href = safeWebsite;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      websiteWrap.appendChild(link);
    }

    if (user.needed) {
      needed = user.needed.split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 4);
      appendChipRow(parent, 'spacious', 'Ищем:', needed, 'scProject hiring');
    }
  }

  function appendCandidateDetails(parent, user) {
    var vacancies;

    appendVerifiedItems(parent, user);

    if (user.vacancies) {
      vacancies = user.vacancies.split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 3);
      appendChipRow(parent, 'compact', 'Ищу:', vacancies, 'scProject');
    }
  }

  function appendProjects(parent, projectsRaw) {
    var projects;
    if (!projectsRaw) return null;

    projects = projectsRaw.split(';').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 3);
    return appendChipRow(parent, 'compact', 'Проекты:', projects, 'scProject');
  }

  function appendWorkExperience(parent, workExp) {
    if (!workExp || !workExp.length) return null;

    var wrap = appendElement(parent, 'div', 'scWorkExp');
    workExp.slice(0, 2).forEach(function (item) {
      var row = appendElement(wrap, 'div', 'scExpItem');
      appendElement(row, 'span', 'scExpCo', item.company || '');
      if (item.role) appendElement(row, 'span', 'scExpRole', '· ' + item.role);
      if (item.period) appendElement(row, 'span', 'scExpPeriod', item.period);
    });
    return wrap;
  }

  function hasBodyContent(body) {
    return !!(body && body.childNodes && body.childNodes.length);
  }

  function createSocialCardElement(user) {
    if (!user) return null;

    var isEmployer = user.role === 'employer';
    var displayName = getDisplayName(user, isEmployer);
    var uid = String(user.id || user.email || '?');
    var card = createElement('div', 'socialCard clickable');
    var head = createElement('div', 'scHead');
    var info = createElement('div', 'scInfo');
    var nameRow = createElement('div', 'scNameRow');
    var body = createElement('div', 'scBody');
    var roleRow = createElement('div', 'scRoleRow');
    var bookmarkBtn;
    var verificationBadge;
    var subParts;
    var jobLineText;
    var lookingBadge;
    var salaryBadge;
    var salaryOfferBadge;
    var aboutText;

    card.setAttribute('data-uid', uid);
    if (window._userCache) window._userCache[uid] = user;

    if (state.userId) {
      var isBookmarked = typeof _isBookmarked === 'function' ? _isBookmarked(uid) : false;
      bookmarkBtn = createElement('button', 'scBookmarkBtn' + (isBookmarked ? ' active' : ''), '★');
      bookmarkBtn.type = 'button';
      bookmarkBtn.setAttribute('data-bookmark-uid', uid);
      bookmarkBtn.setAttribute('aria-pressed', isBookmarked ? 'true' : 'false');
      bookmarkBtn.setAttribute('title', isBookmarked ? 'Убрать из избранного' : 'Добавить в избранное');
      bookmarkBtn.setAttribute('aria-label', isBookmarked ? 'Убрать из избранного' : 'Добавить в избранное');
      card.appendChild(bookmarkBtn);
    }

    head.appendChild(buildAvatar(user, isEmployer, displayName));
    appendElement(nameRow, 'span', 'scName', displayName);
    verificationBadge = buildVerificationBadge(user);
    if (verificationBadge) nameRow.appendChild(verificationBadge);
    info.appendChild(nameRow);

    subParts = isEmployer
      ? [user.industry, user.location].filter(Boolean)
      : [user.edu_place, user.edu_year, user.location].filter(Boolean);
    if (subParts.length) appendTextLine(info, 'scSub', subParts.join(' · '));

    roleRow.appendChild(buildRoleTag(isEmployer));
    info.appendChild(roleRow);
    head.appendChild(info);
    card.appendChild(head);

    if (!isEmployer && user.current_job && user.current_job !== 'Не работаю') {
      jobLineText = user.current_job + (user.job_title ? ' · ' + user.job_title : '');
      appendTextLine(body, 'scJobLine', jobLineText);
    } else if (!isEmployer && user.current_job === 'Не работаю') {
      appendTextLine(body, 'scJobLine muted', 'В поиске работы');
    }

    if (!isEmployer) appendWorkExperience(body, user.work_exp);
    if (isEmployer) appendEmployerExtras(body, user);
    else appendCandidateDetails(body, user);
    if (isEmployer) appendProjects(body, user.active_projects);

    if (!isEmployer && user.salary_expectations) {
      var badgeRow = body.querySelector('.scBadgeRow') || createElement('div', 'scBadgeRow');
      salaryBadge = createElement('span', 'scSalaryBadge', '💰 ' + user.salary_expectations);
      badgeRow.appendChild(salaryBadge);
      if (!badgeRow.parentNode) body.insertBefore(badgeRow, body.firstChild);
    }

    if (!isEmployer && user.looking_for_work) {
      var lookingRow = body.querySelector('.scBadgeRow') || createElement('div', 'scBadgeRow');
      lookingBadge = createElement('span', 'scLookingBadge', '🟢 Активно ищет');
      lookingRow.insertBefore(lookingBadge, lookingRow.firstChild);
      if (!lookingRow.parentNode) body.insertBefore(lookingRow, body.firstChild);
    }

    if (isEmployer && user.salary_offer) {
      var offerRow = body.querySelector('.scBadgeRow') || createElement('div', 'scBadgeRow');
      salaryOfferBadge = createElement('span', 'scSalaryOfferBadge', '💼 ' + user.salary_offer);
      offerRow.appendChild(salaryOfferBadge);
      if (!offerRow.parentNode) body.insertBefore(offerRow, body.firstChild);
    }

    aboutText = user.about ? user.about.slice(0, 120) + (user.about.length > 120 ? '…' : '') : '';
    if (aboutText) {
      var about = createElement('div', 'scAbout', aboutText);
      var firstBodyChild = body.firstChild;
      if (firstBodyChild && firstBodyChild.classList && firstBodyChild.classList.contains('scBadgeRow')) {
        body.insertBefore(about, firstBodyChild.nextSibling);
      } else {
        body.insertBefore(about, body.firstChild);
      }
    }

    if (hasBodyContent(body)) card.appendChild(body);
    return card;
  }

  function buildSocialCard(user) {
    var card = createSocialCardElement(user);
    return card ? card.outerHTML : '';
  }

  window.createSocialCardElement = createSocialCardElement;
  window.buildSocialCard = buildSocialCard;
})(window);
