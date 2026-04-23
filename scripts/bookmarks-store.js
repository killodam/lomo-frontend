(function (window) {
  function clonePlainObject(source) {
    var target = {};
    Object.keys(source || {}).forEach(function (key) {
      target[key] = source[key];
    });
    return target;
  }

  function createEmptyBookmarksState(items) {
    return {
      lists: {
        'default': {
          id: 'default',
          name: 'Избранные',
          items: items || {},
        },
      },
    };
  }

  function getBookmarksStorageKey() {
    return 'lomo_favs_' + String(state.userId || 'anon');
  }

  function getBookmarkFilterValueForListId(listId) {
    return String(listId || '') === 'default' ? 'favorites' : String(listId || '');
  }

  function normalizeBookmarkFilterValue(rawValue) {
    return getBookmarkFilterValueForListId(rawValue);
  }

  function isBookmarkFavoritesFilter(rawValue) {
    return normalizeBookmarkFilterValue(rawValue) === 'favorites';
  }

  function isBookmarkFolderFilter(rawValue) {
    var value = normalizeBookmarkFilterValue(rawValue);
    return value === 'favorites' || value.indexOf('list_') === 0;
  }

  function getBookmarkListIdFromFilter(rawValue) {
    var value = normalizeBookmarkFilterValue(rawValue);
    return value === 'favorites' ? 'default' : value;
  }

  function writeBookmarks(bookmarks) {
    try {
      var payload = { lists: (bookmarks && bookmarks.lists) ? bookmarks.lists : {} };
      var defaultItems = payload.lists.default && payload.lists.default.items ? payload.lists.default.items : {};

      Object.keys(defaultItems).forEach(function (uid) {
        payload[uid] = defaultItems[uid];
      });

      window.localStorage.setItem(getBookmarksStorageKey(), JSON.stringify(payload));
      return true;
    } catch (error) {
      if (typeof showToast === 'function') showToast('Не удалось сохранить избранное', 'error');
      return false;
    }
  }

  function readBookmarks() {
    try {
      var raw = window.localStorage.getItem(getBookmarksStorageKey());
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') parsed = {};

      if (!parsed.lists && Object.keys(parsed).length > 0) {
        parsed = createEmptyBookmarksState(clonePlainObject(parsed));
        writeBookmarks(parsed);
      } else if (!parsed.lists) {
        parsed = createEmptyBookmarksState();
        writeBookmarks(parsed);
      }

      return parsed;
    } catch (error) {
      return createEmptyBookmarksState();
    }
  }

  function getBookmarkedUsersList(listId) {
    var bookmarks = readBookmarks();
    var lists = bookmarks.lists || {};

    if (listId && lists[listId]) {
      return Object.keys(lists[listId].items || {}).map(function (uid) {
        return lists[listId].items[uid];
      }).filter(Boolean);
    }

    var allUsers = {};
    Object.keys(lists).forEach(function (currentListId) {
      Object.keys(lists[currentListId].items || {}).forEach(function (uid) {
        allUsers[uid] = lists[currentListId].items[uid];
      });
    });

    return Object.keys(allUsers).map(function (uid) {
      return allUsers[uid];
    }).filter(Boolean);
  }

  function buildBookmarkSearchText(user) {
    var parts = [
      user && user.full_name,
      user && user.email,
      user && user.location,
      user && user.edu_place,
      user && user.edu_year,
      user && user.vacancies,
      user && user.about,
      user && user.current_job,
      user && user.job_title,
      user && user.company,
      user && user.industry,
    ];

    if (Array.isArray(user && user.work_exp)) {
      user.work_exp.forEach(function (item) {
        if (!item) return;
        parts.push(item.company, item.role, item.period, item.desc);
      });
    }

    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function filterBookmarkedUsers(list, query) {
    var normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return list.slice();

    return list.filter(function (user) {
      return buildBookmarkSearchText(user).indexOf(normalizedQuery) !== -1;
    });
  }

  function paginateLocalItems(items, pagerState) {
    var total = items.length;
    var totalPages = total ? Math.ceil(total / pagerState.pageSize) : 0;
    var safePage = pagerState.page || 1;
    var start;

    if (totalPages && safePage > totalPages) safePage = totalPages;
    if (!totalPages) safePage = 1;

    pagerState.page = safePage;
    start = (safePage - 1) * pagerState.pageSize;
    syncPagerState(pagerState, {
      total: total,
      page: safePage,
      pageSize: pagerState.pageSize,
      totalPages: totalPages,
    });
    return items.slice(start, start + pagerState.pageSize);
  }

  function getVisibleBookmarkedUsers(query, listId) {
    return filterBookmarkedUsers(getBookmarkedUsersList(listId), query).filter(function (user) {
      return String(user && user.id || user && user.email || '') !== String(state.userId || '');
    });
  }

  function ensureBookmarksDefaultList(bookmarks) {
    if (!bookmarks.lists) bookmarks.lists = {};
    if (!bookmarks.lists.default) {
      bookmarks.lists.default = { id: 'default', name: 'Избранные', items: {} };
    }
    if (!bookmarks.lists.default.items) bookmarks.lists.default.items = {};
    return bookmarks.lists.default;
  }

  window.createEmptyBookmarksState = createEmptyBookmarksState;
  window.getBookmarksStorageKey = getBookmarksStorageKey;
  window.getBookmarkFilterValueForListId = getBookmarkFilterValueForListId;
  window.normalizeBookmarkFilterValue = normalizeBookmarkFilterValue;
  window.isBookmarkFavoritesFilter = isBookmarkFavoritesFilter;
  window.isBookmarkFolderFilter = isBookmarkFolderFilter;
  window.getBookmarkListIdFromFilter = getBookmarkListIdFromFilter;
  window.readBookmarks = readBookmarks;
  window.writeBookmarks = writeBookmarks;
  window.getBookmarkedUsersList = getBookmarkedUsersList;
  window.buildBookmarkSearchText = buildBookmarkSearchText;
  window.filterBookmarkedUsers = filterBookmarkedUsers;
  window.paginateLocalItems = paginateLocalItems;
  window.getVisibleBookmarkedUsers = getVisibleBookmarkedUsers;
  window.ensureBookmarksDefaultList = ensureBookmarksDefaultList;
})(window);
