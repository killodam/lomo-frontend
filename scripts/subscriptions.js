// subscriptions.js — monetization / subscription management screen
// ES5: var, function declarations, no const/let/arrows at global scope

var _subCachedPlans = null;
var _subCachedMy = null;

// Plans that show "Связаться с нами" instead of a direct buy button
var SUB_CONTACT_PLANS = ['company_badge', 'api_access'];

function loadSubscriptionPlans() {
  return apiFetch('/subscriptions/plans');
}

function loadMySubscriptions() {
  return apiFetch('/subscriptions/my');
}

function activatePlan(planKey) {
  return apiFetch('/subscriptions/activate', {
    method: 'POST',
    body: JSON.stringify({ plan_key: planKey }),
  });
}

function cancelPlan(planKey) {
  return apiFetch('/subscriptions/cancel', {
    method: 'DELETE',
    body: JSON.stringify({ plan_key: planKey }),
  });
}

function subFormatPrice(price, interval) {
  var formatted = price.toLocaleString('ru-RU') + '₽';
  if (interval === 'monthly') return formatted + '/мес';
  if (interval === 'yearly') return formatted + '/год';
  return formatted;
}

function subRenderPlanCard(plan, activeSub) {
  var isActive = !!activeSub;
  var isOneTime = plan.interval === 'one_time';
  var isContact = SUB_CONTACT_PLANS.indexOf(plan.key) !== -1;
  var features = [];
  try {
    features = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]');
  } catch (e) { features = []; }

  var featuresHtml = '';
  if (features.length) {
    featuresHtml = '<ul class="subCardFeatures">';
    for (var i = 0; i < features.length; i++) {
      featuresHtml += '<li>' + escapeHtml(String(features[i])) + '</li>';
    }
    featuresHtml += '</ul>';
  }

  var btnHtml;
  if (isContact) {
    btnHtml = '<a href="mailto:hello@lomo.website" class="subCardBtn subCardBtnContact">Связаться с нами</a>';
  } else if (isActive && isOneTime) {
    btnHtml = '<button type="button" class="subCardBtn subCardBtnOwned" disabled>Куплено ✓</button>';
  } else if (isActive) {
    btnHtml = '<button type="button" class="subCardBtn subCardBtnActive" disabled>Активен ✓</button>' +
      '<button type="button" class="subCardBtnCancel" data-sub-cancel="' + escapeHtml(plan.key) + '">Отменить</button>';
  } else {
    btnHtml = '<button type="button" class="subCardBtn subCardBtnActivate" data-sub-activate="' + escapeHtml(plan.key) + '">Подключить</button>';
  }

  return '<div class="subCard' + (isActive ? ' subCardActive' : '') + '">' +
    (isActive ? '<div class="subCardBadge">Активен ✓</div>' : '') +
    '<div class="subCardName">' + escapeHtml(plan.name) + '</div>' +
    '<div class="subCardPrice">' + escapeHtml(subFormatPrice(plan.price, plan.interval)) + '</div>' +
    (plan.description ? '<div class="subCardDesc">' + escapeHtml(plan.description) + '</div>' : '') +
    featuresHtml +
    '<div class="subCardActions">' + btnHtml + '</div>' +
    '</div>';
}

function subRenderScreen(plans, mySubs) {
  var role = (typeof state !== 'undefined' && state.roleReg) || 'EMPLOYEE';
  var relevantPlans = role === 'EMPLOYER' ? (plans.employer || []) : (plans.candidate || []);

  var activeMap = {};
  for (var i = 0; i < mySubs.length; i++) {
    activeMap[mySubs[i].plan_key] = mySubs[i];
  }

  if (!relevantPlans.length) {
    return '<div class="subEmpty">Тарифы временно недоступны.</div>';
  }

  var html = '<div class="subDisclaimer">⚠️ Оплата временно недоступна — функция в разработке</div>';
  html += '<div class="subGrid">';
  for (var j = 0; j < relevantPlans.length; j++) {
    html += subRenderPlanCard(relevantPlans[j], activeMap[relevantPlans[j].key] || null);
  }
  html += '</div>';
  return html;
}

function renderSubscriptionsScreen() {
  var container = document.getElementById('subscriptionsContent');
  if (!container) return;
  container.innerHTML = '<div class="subLoading">Загрузка тарифов…</div>';

  var isLoggedIn = typeof state !== 'undefined' && !!state.userId;
  var plansPromise = loadSubscriptionPlans();
  var mySubsPromise = isLoggedIn ? loadMySubscriptions() : Promise.resolve([]);

  Promise.all([plansPromise, mySubsPromise])
    .then(function (results) {
      _subCachedPlans = results[0];
      _subCachedMy = results[1];
      container.innerHTML = subRenderScreen(_subCachedPlans, _subCachedMy);
    })
    .catch(function (err) {
      container.innerHTML = '<div class="subError">Не удалось загрузить тарифы.<br>' +
        escapeHtml(err.message || 'Попробуйте позже.') + '</div>';
    });
}

// Event delegation for activate / cancel buttons
document.addEventListener('click', function (e) {
  var activateBtn = e.target.closest('[data-sub-activate]');
  var cancelBtn   = e.target.closest('[data-sub-cancel]');

  if (activateBtn) {
    var planKey = activateBtn.getAttribute('data-sub-activate');
    activateBtn.disabled = true;
    activateBtn.textContent = 'Подключение…';
    activatePlan(planKey)
      .then(function () {
        showToast('Тариф подключён!', 'success');
        renderSubscriptionsScreen();
      })
      .catch(function (err) {
        showToast('Ошибка: ' + (err.message || 'Попробуйте позже'), 'error');
        activateBtn.disabled = false;
        activateBtn.textContent = 'Подключить';
      });
  }

  if (cancelBtn) {
    var cancelKey = cancelBtn.getAttribute('data-sub-cancel');
    cancelBtn.disabled = true;
    cancelBtn.textContent = 'Отмена…';
    cancelPlan(cancelKey)
      .then(function () {
        showToast('Подписка отменена', 'info');
        renderSubscriptionsScreen();
      })
      .catch(function (err) {
        showToast('Ошибка: ' + (err.message || 'Попробуйте позже'), 'error');
        cancelBtn.disabled = false;
        cancelBtn.textContent = 'Отменить';
      });
  }
});

// Reload screen data each time it becomes active
window.addEventListener('lomo:screen-change', function (e) {
  if (e.detail && e.detail.current === 'subscriptions') {
    renderSubscriptionsScreen();
  }
});
