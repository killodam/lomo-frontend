// Posts feed + likes UI. Rendered into a container on the author's own profile
// (with composer) and on public profiles (read-only list; composer only if the
// viewer is the author). Variant A — posts live on the profile page only, never
// in the main candidate feed (see CLAUDE.md).
//
// All user-supplied text (post content, author name) is inserted via
// textContent — never innerHTML — so it is XSS-safe by construction. Static
// icon/markup uses innerHTML deliberately.
(function (window) {
  var MAX_CONTENT = 3000;

  function escHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // `state` is a top-level lexical global (const in state.js), not window.state,
  // so reference it directly rather than through window.
  function currentUserId() {
    return (typeof state !== 'undefined' && state && state.userId) ? String(state.userId) : '';
  }

  function isAdminViewer() {
    return !!(typeof state !== 'undefined' && state && state.roleReg === 'ADMIN');
  }

  function heartSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'
      + '</svg>';
  }

  function initials(name) {
    var parts = String(name || '?').split(/\s+/).map(function (segment) {
      return segment ? segment.charAt(0) : '';
    }).join('').slice(0, 2).toUpperCase();
    return parts || '?';
  }

  function formatDate(value) {
    var date = new Date(value);
    if (!isFinite(date.getTime())) return '';
    var now = new Date();
    var diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'только что';
    if (diffSec < 3600) return Math.floor(diffSec / 60) + ' мин назад';
    if (diffSec < 86400) return Math.floor(diffSec / 3600) + ' ч назад';
    if (diffSec < 604800) return Math.floor(diffSec / 86400) + ' дн назад';
    return ('0' + date.getDate()).slice(-2) + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + '.' + date.getFullYear();
  }

  // ── Post card ──────────────────────────────────────────────────────────────
  function buildPostCard(post, ctx) {
    var card = el('div', 'postCard');
    card.setAttribute('data-post-id', String(post.id));

    var displayName = post.full_name || post.company || ctx.authorName || 'Пользователь LOMO';
    var isEmployerAuthor = (post.author_role || ctx.authorRole) === 'employer';

    // Header: avatar + name + role tag + date
    var head = el('div', 'postCardHead');
    var avatar = el('div', 'postAvatar' + (isEmployerAuthor ? ' employer' : ' candidate'));
    var avatarSrc = (typeof safeImageUrl === 'function') ? safeImageUrl(post.avatar_url || ctx.avatarUrl) : (post.avatar_url || ctx.avatarUrl || '');
    if (avatarSrc) {
      var img = document.createElement('img');
      img.src = avatarSrc;
      img.className = 'postAvatarImg';
      img.alt = displayName;
      img.addEventListener('error', function () {
        avatar.innerHTML = '';
        avatar.appendChild(el('div', 'postAvatarFallback', initials(displayName)));
      });
      avatar.appendChild(img);
    } else {
      avatar.appendChild(el('div', 'postAvatarFallback', initials(displayName)));
    }
    head.appendChild(avatar);

    var headText = el('div', 'postHeadText');
    headText.appendChild(el('div', 'postAuthorName', displayName));
    var metaRow = el('div', 'postHeadMeta');
    metaRow.appendChild(el('span', 'postRoleTag' + (isEmployerAuthor ? ' employer' : ' candidate'), isEmployerAuthor ? 'Работодатель' : 'Кандидат'));
    var dateText = formatDate(post.created_at);
    if (dateText) metaRow.appendChild(el('span', 'postDate', dateText));
    headText.appendChild(metaRow);
    head.appendChild(headText);

    // Delete button — author or admin
    var canDelete = (currentUserId() && String(post.author_id) === currentUserId()) || isAdminViewer();
    if (canDelete) {
      var delBtn = el('button', 'postDeleteBtn', '×');
      delBtn.type = 'button';
      delBtn.setAttribute('title', 'Удалить публикацию');
      delBtn.setAttribute('aria-label', 'Удалить публикацию');
      delBtn.addEventListener('click', function () { handleDelete(post, card); });
      head.appendChild(delBtn);
    }
    card.appendChild(head);

    // Content text (preserves line breaks via CSS white-space: pre-wrap)
    if (post.content) card.appendChild(el('div', 'postContent', post.content));

    // Optional image
    if (post.image_url) {
      var picWrap = el('div', 'postImageWrap');
      var pic = document.createElement('img');
      pic.className = 'postImage';
      pic.loading = 'lazy';
      pic.alt = 'Изображение публикации';
      pic.src = (typeof resolveBackendUrl === 'function') ? resolveBackendUrl(post.image_url) : post.image_url;
      picWrap.appendChild(pic);
      card.appendChild(picWrap);
    }

    // Footer: like button + count
    var footer = el('div', 'postCardFooter');
    var likeBtn = el('button', 'postLikeBtn' + (post.liked_by_me ? ' liked' : ''));
    likeBtn.type = 'button';
    likeBtn.setAttribute('aria-pressed', post.liked_by_me ? 'true' : 'false');
    var iconSpan = el('span', 'postLikeIcon');
    iconSpan.innerHTML = heartSvg();
    likeBtn.appendChild(iconSpan);
    likeBtn.appendChild(el('span', 'postLikeCount', String(post.likes_count || 0)));

    if (currentUserId()) {
      likeBtn.addEventListener('click', function () { handleLike(post, likeBtn); });
    } else {
      likeBtn.classList.add('readonly');
      likeBtn.setAttribute('title', 'Войдите, чтобы оценить');
    }
    footer.appendChild(likeBtn);
    card.appendChild(footer);

    return card;
  }

  // ── Optimistic like toggle ───────────────────────────────────────────────
  function handleLike(post, likeBtn) {
    if (likeBtn.getAttribute('data-busy') === '1') return;
    var countEl = likeBtn.querySelector('.postLikeCount');
    var wasLiked = post.liked_by_me;
    var nextLiked = !wasLiked;

    // Optimistic UI first.
    post.liked_by_me = nextLiked;
    post.likes_count = Math.max(0, Number(post.likes_count || 0) + (nextLiked ? 1 : -1));
    likeBtn.classList.toggle('liked', nextLiked);
    likeBtn.setAttribute('aria-pressed', nextLiked ? 'true' : 'false');
    if (countEl) countEl.textContent = String(post.likes_count);
    likeBtn.setAttribute('data-busy', '1');

    var request = nextLiked ? apiLikePost(post.id) : apiUnlikePost(post.id);
    request.then(function (res) {
      // Reconcile with the server's authoritative count.
      if (res && typeof res.likes_count !== 'undefined') {
        post.likes_count = Number(res.likes_count);
        if (countEl) countEl.textContent = String(post.likes_count);
      }
    }).catch(function () {
      // Revert on failure.
      post.liked_by_me = wasLiked;
      post.likes_count = Math.max(0, Number(post.likes_count || 0) + (nextLiked ? -1 : 1));
      likeBtn.classList.toggle('liked', wasLiked);
      likeBtn.setAttribute('aria-pressed', wasLiked ? 'true' : 'false');
      if (countEl) countEl.textContent = String(post.likes_count);
    }).then(function () {
      likeBtn.removeAttribute('data-busy');
    });
  }

  function handleDelete(post, card) {
    if (!window.confirm('Удалить эту публикацию? Действие необратимо.')) return;
    apiDeletePost(post.id).then(function () {
      if (card && card.parentNode) card.parentNode.removeChild(card);
    }).catch(function (error) {
      window.alert(typeof safeErrorText === 'function' ? safeErrorText(error) : 'Не удалось удалить публикацию');
    });
  }

  // ── Composer ─────────────────────────────────────────────────────────────
  function buildComposer(ctx, listEl) {
    var box = el('div', 'postComposer');
    var pendingFile = null;
    var previewUrl = null;

    var textarea = document.createElement('textarea');
    textarea.className = 'postComposerInput';
    textarea.setAttribute('maxlength', String(MAX_CONTENT));
    textarea.setAttribute('rows', '3');
    textarea.setAttribute('placeholder', ctx.authorRole === 'employer'
      ? 'Поделитесь новостью компании, проектом или вакансией…'
      : 'Поделитесь достижением, проектом или мыслями о работе…');
    box.appendChild(textarea);

    var previewWrap = el('div', 'postComposerPreview');
    previewWrap.style.display = 'none';
    var previewImg = document.createElement('img');
    previewImg.className = 'postComposerPreviewImg';
    previewImg.alt = 'Предпросмотр';
    var removeImgBtn = el('button', 'postComposerRemoveImg', '× убрать фото');
    removeImgBtn.type = 'button';
    previewWrap.appendChild(previewImg);
    previewWrap.appendChild(removeImgBtn);
    box.appendChild(previewWrap);

    var bar = el('div', 'postComposerBar');

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp';
    fileInput.className = 'postComposerFile';
    fileInput.style.display = 'none';

    var photoBtn = el('button', 'sqBtn sm postComposerPhotoBtn', '📷 Фото');
    photoBtn.type = 'button';
    photoBtn.addEventListener('click', function () { fileInput.click(); });

    var counter = el('span', 'postComposerCounter', '0 / ' + MAX_CONTENT);

    var submitBtn = el('button', 'accentBtn postComposerSubmit', 'Опубликовать');
    submitBtn.type = 'button';
    submitBtn.disabled = true;

    bar.appendChild(photoBtn);
    bar.appendChild(counter);
    bar.appendChild(submitBtn);
    box.appendChild(bar);
    box.appendChild(fileInput);

    function clearPreview() {
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
      pendingFile = null;
      fileInput.value = '';
      previewImg.removeAttribute('src');
      previewWrap.style.display = 'none';
      refreshSubmitState();
    }

    function refreshSubmitState() {
      var hasText = textarea.value.trim().length > 0;
      submitBtn.disabled = !(hasText || pendingFile);
      counter.textContent = textarea.value.length + ' / ' + MAX_CONTENT;
    }

    textarea.addEventListener('input', refreshSubmitState);

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var okType = /^image\/(jpeg|png|webp)$/i.test(file.type);
      if (!okType) { window.alert('Можно прикрепить только JPG, PNG или WEBP.'); fileInput.value = ''; return; }
      if (file.size > 5 * 1024 * 1024) { window.alert('Изображение не должно превышать 5 МБ.'); fileInput.value = ''; return; }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      pendingFile = file;
      previewUrl = URL.createObjectURL(file);
      previewImg.src = previewUrl;
      previewWrap.style.display = '';
      refreshSubmitState();
    });

    removeImgBtn.addEventListener('click', clearPreview);

    submitBtn.addEventListener('click', function () {
      var content = textarea.value.trim();
      if (!content && !pendingFile) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Публикуем…';
      apiCreatePost(content, pendingFile).then(function (post) {
        // Prepend the new card; carry author identity from the composer context.
        post.author_id = post.author_id || currentUserId();
        post.author_role = post.author_role || ctx.authorRole;
        post.full_name = post.full_name || ctx.authorName;
        post.avatar_url = post.avatar_url || ctx.avatarUrl;
        var emptyState = listEl.querySelector('.postsEmpty');
        if (emptyState) listEl.removeChild(emptyState);
        listEl.insertBefore(buildPostCard(post, ctx), listEl.firstChild);
        textarea.value = '';
        clearPreview();
        refreshSubmitState();
      }).catch(function (error) {
        window.alert(typeof safeErrorText === 'function' ? safeErrorText(error) : 'Не удалось опубликовать');
      }).then(function () {
        submitBtn.textContent = 'Опубликовать';
        refreshSubmitState();
      });
    });

    return box;
  }

  // ── Public entry point ───────────────────────────────────────────────────
  // container: DOM node; opts: { authorId, canCompose, authorRole, authorName, avatarUrl }
  function render(container, opts) {
    if (!container) return;
    opts = opts || {};
    var ctx = {
      authorRole: opts.authorRole || '',
      authorName: opts.authorName || '',
      avatarUrl: opts.avatarUrl || '',
    };

    container.innerHTML = '';

    var listEl = el('div', 'postsList');

    if (opts.canCompose) {
      container.appendChild(buildComposer(ctx, listEl));
    }

    var loading = el('div', 'postsLoading miniHint', 'Загрузка публикаций…');
    container.appendChild(loading);
    container.appendChild(listEl);

    apiListPosts(opts.authorId).then(function (posts) {
      if (loading.parentNode) loading.parentNode.removeChild(loading);
      posts = posts || [];
      if (!posts.length) {
        listEl.appendChild(el('div', 'postsEmpty miniHint',
          opts.canCompose ? 'У вас пока нет публикаций. Поделитесь первой!' : 'Публикаций пока нет.'));
        return;
      }
      posts.forEach(function (post) {
        listEl.appendChild(buildPostCard(post, ctx));
      });
    }).catch(function () {
      if (loading.parentNode) loading.parentNode.removeChild(loading);
      listEl.appendChild(el('div', 'postsEmpty miniHint', 'Не удалось загрузить публикации.'));
    });
  }

  window.lomoPosts = { render: render };
})(window);
