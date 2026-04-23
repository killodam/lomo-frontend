(function () {
  function bindInput(id, eventName, handler) {
    var el = document.getElementById(id);
    if (!el || el.dataset.adminBound === '1') return;
    el.dataset.adminBound = '1';
    el.addEventListener(eventName, handler);
  }

  function bindChipFilter(chipSelector, selectId, attributeName, handler) {
    var select = document.getElementById(selectId);

    if (select && select.dataset.adminBound !== '1') {
      select.dataset.adminBound = '1';
      select.addEventListener('change', function () {
        handler();
      });
    }

    document.querySelectorAll(chipSelector).forEach(function (chip) {
      if (chip.dataset.adminBound === '1') return;
      chip.dataset.adminBound = '1';
      chip.addEventListener('click', function () {
        document.querySelectorAll(chipSelector).forEach(function (currentChip) {
          currentChip.classList.remove('active');
        });
        chip.classList.add('active');
        if (select) select.value = chip.getAttribute(attributeName) || '';
        handler();
      });
    });
  }

  function bindClick(id, handler) {
    var el = document.getElementById(id);
    if (!el || el.dataset.adminBound === '1') return;
    el.dataset.adminBound = '1';
    el.addEventListener('click', handler);
  }

  function initAdminScreenBindings() {
    if (typeof bindAdminRoleChips === 'function') bindAdminRoleChips();
    if (typeof bindEmpExtraFilters === 'function') bindEmpExtraFilters();

    bindInput('feedSearchInput', 'input', function () {
      if (typeof debouncedFilterFeed === 'function') debouncedFilterFeed();
    });
    bindChipFilter('.feedFilterChip', 'feedViewFilter', 'data-feed-view', filterFeed);
    bindChipFilter('.feedVerifiedChip', 'feedVerifiedFilter', 'data-feed-verified', filterFeed);

    bindInput('empSearchName', 'input', function () {
      if (typeof debouncedFilterEmployerSearch === 'function') debouncedFilterEmployerSearch();
    });
    bindInput('empSearchVerified', 'change', function () {
      if (typeof filterEmployerSearch === 'function') filterEmployerSearch();
    });
    bindClick('empClearSearchBtn', function () {
      var input = document.getElementById('empSearchName');
      if (input) input.value = '';
      if (typeof filterEmployerSearch === 'function') filterEmployerSearch();
    });

    bindInput('adminCandSearch', 'input', function () {
      if (typeof debouncedFilterAdminCandidates === 'function') debouncedFilterAdminCandidates();
    });
    bindInput('adminEmpSearch', 'input', function () {
      if (typeof debouncedFilterAdminEmployers === 'function') debouncedFilterAdminEmployers();
    });
    bindInput('adminUserSearch', 'input', function () {
      if (typeof loadAdminUsers === 'function') loadAdminUsers(1);
    });

    document.querySelectorAll('[data-admin-tab]').forEach(function (button) {
      if (button.dataset.adminBound === '1') return;
      button.dataset.adminBound = '1';
      button.addEventListener('click', function () {
        if (typeof switchAdminTab === 'function') switchAdminTab(button.getAttribute('data-admin-tab'));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminScreenBindings);
  } else {
    initAdminScreenBindings();
  }
})();
