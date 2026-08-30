const $ = (id) => document.getElementById(id);

function savedValue(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function saveValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // The product remains usable when storage is unavailable.
  }
}

const copy = {
  ar: {
    brand_category: 'ذكاء رقمي متقن',
    primary_navigation: 'التنقل الرئيسي',
    nav_workspace: 'المحادثة',
    nav_experience: 'تجربة Hana',
    theme_toggle: 'تبديل المظهر',
    music_play: 'تشغيل الموسيقى',
    music_pause: 'إيقاف الموسيقى',
    music_error: 'تعذر تشغيل الموسيقى',
    hero_title: 'ذكاء GARHY TECH في محادثة واحدة',
    hero_lead: 'Hana تمنح أفكارك وضوحا أكبر وتحولها إلى خطوات عملية بهدوء ودقة',
    start_chat: 'ابدأ مع Hana',
    secure_note: 'اتصال آمن يحمي خصوصية المحادثة',
    hero_identity: 'مساعدة GARHY TECH الذكية',
    media_kicker: 'عالم GARHY TECH',
    media_title: 'مشاهد صنعت هوية Hana',
    media_note: 'اسحب لاستكشاف التجربة',
    media_aria: 'مشاهد GARHY TECH البصرية',
    workspace_kicker: 'مساحة Hana',
    workspace_title: 'محادثة واضحة تبدأ منك',
    status_ready: 'Hana جاهزة',
    status_thinking: 'Hana تفكر',
    status_complete: 'Hana جاهزة',
    status_unavailable: 'الخدمة غير متاحة الآن',
    new_chat: 'محادثة جديدة',
    conversation_aria: 'محادثة Hana',
    assistant_label: 'مساعدة GARHY TECH الذكية',
    welcome: 'مرحبا أنا Hana المساعدة الذكية من GARHY TECH كيف يمكنني مساعدتك اليوم',
    suggestions_aria: 'اقتراحات للبدء',
    suggestion_one: 'ساعديني في تطوير فكرة مشروع',
    suggestion_two: 'اكتبي لي رسالة احترافية',
    suggestion_three: 'لخصي هذه الملاحظات',
    composer_label: 'رسالتك إلى Hana',
    composer_placeholder: 'اكتب ما تريد إنجازه اليوم',
    shortcut_hint: 'Enter للإرسال و Shift Enter لسطر جديد',
    count_joiner: 'من',
    send: 'إرسال',
    sending: 'جارٍ الإرسال',
    advanced_settings: 'إعدادات Hana',
    model_label: 'أسلوب Hana',
    model_fast: 'سريع',
    model_power: 'قوي',
    reasoning_label: 'مستوى التفكير',
    reasoning_fast: 'سريع',
    reasoning_balanced: 'متوازن',
    reasoning_deep: 'عميق',
    hana_identity_aria: 'هوية Hana',
    aside_identity: 'من GARHY TECH',
    aside_kicker: 'وضوح في كل خطوة',
    aside_title: 'أفكارك بصوت أكثر وضوحا',
    aside_body: 'Hana ترتب أفكارك وتحافظ على سياق المحادثة حتى تصل إلى الخطوة التالية بثقة',
    confidence_one: 'واجهة عربية متقنة',
    confidence_two: 'تحكم واضح في الإعدادات',
    confidence_three: 'محادثة مركزة وسلسة',
    experience_kicker: 'تجربة مصممة بعناية',
    experience_title: 'كل ما تحتاجه دون ضوضاء',
    experience_body: 'مساحة هادئة تساعدك على التفكير والكتابة واتخاذ الخطوة التالية',
    capability_one_title: 'ابدأ بوضوح',
    capability_one_body: 'اكتب فكرتك كما هي وتساعدك Hana على تطويرها خطوة بخطوة',
    capability_two_title: 'حافظ على السياق',
    capability_two_body: 'واصل المحادثة بسلاسة مع فهم أدق لاتجاهك ونبرة فكرتك',
    capability_three_title: 'جزء من GARHY TECH',
    footer_note: 'محادثة ذكية مصممة حول احتياجك',
    health_check: 'فحص حالة الخدمة',
    health_online: 'الخدمة متصلة',
    health_offline: 'الخدمة تحتاج محاولة لاحقة',
    health_checking: 'يتم فحص الخدمة',
    skip_to_workspace: 'الانتقال إلى المحادثة',
    user_label: 'أنت',
    error_response: 'تعذر إكمال الطلب الآن ويمكنك المحاولة بعد لحظات',
    error_empty: 'أضف رسالة للبدء',
    typing_label: 'Hana تكتب',
    request_cancelled: 'توقفت المحاولة ويمكنك الإرسال من جديد',
    description: 'Hana المساعدة الذكية من GARHY TECH لتفكير أوضح ومحادثات أكثر سلاسة'
  },
  en: {
    brand_category: 'Refined digital intelligence',
    primary_navigation: 'Primary navigation',
    nav_workspace: 'Conversation',
    nav_experience: 'Hana experience',
    theme_toggle: 'Toggle color theme',
    music_play: 'Play music',
    music_pause: 'Pause music',
    music_error: 'Music is unavailable',
    hero_title: 'GARHY TECH intelligence in one conversation',
    hero_lead: 'Hana brings clarity to your ideas and turns them into practical next steps',
    start_chat: 'Start with Hana',
    secure_note: 'A secure connection built for private conversations',
    hero_identity: 'Intelligent assistant by GARHY TECH',
    media_kicker: 'Inside GARHY TECH',
    media_title: 'The visual world behind Hana',
    media_note: 'Drag to explore the experience',
    media_aria: 'GARHY TECH visual stories',
    workspace_kicker: 'Hana workspace',
    workspace_title: 'A focused conversation shaped around you',
    status_ready: 'Hana is ready',
    status_thinking: 'Hana is thinking',
    status_complete: 'Hana is ready',
    status_unavailable: 'Service unavailable',
    new_chat: 'New chat',
    conversation_aria: 'Hana conversation',
    assistant_label: 'Intelligent assistant by GARHY TECH',
    welcome: 'Hello I am Hana the intelligent assistant from GARHY TECH How can I help today',
    suggestions_aria: 'Conversation starters',
    suggestion_one: 'Help me develop a project idea',
    suggestion_two: 'Write a professional message',
    suggestion_three: 'Summarize these notes',
    composer_label: 'Your message to Hana',
    composer_placeholder: 'Write what you want to accomplish today',
    shortcut_hint: 'Enter to send and Shift Enter for a new line',
    count_joiner: 'of',
    send: 'Send',
    sending: 'Sending',
    advanced_settings: 'Hana settings',
    model_label: 'Hana style',
    model_fast: 'Fast',
    model_power: 'Power',
    reasoning_label: 'Reasoning',
    reasoning_fast: 'Fast',
    reasoning_balanced: 'Balanced',
    reasoning_deep: 'Deep',
    hana_identity_aria: 'Hana identity',
    aside_identity: 'by GARHY TECH',
    aside_kicker: 'Clarity at every step',
    aside_title: 'Your ideas in a clearer voice',
    aside_body: 'Hana keeps your ideas organized and your conversation focused on the next meaningful step',
    confidence_one: 'Refined Arabic first interface',
    confidence_two: 'Clear control of settings',
    confidence_three: 'Focused natural conversations',
    experience_kicker: 'Designed with purpose',
    experience_title: 'Everything you need without the noise',
    experience_body: 'A calm space for thinking writing and moving your ideas forward',
    capability_one_title: 'Start with clarity',
    capability_one_body: 'Write your idea as it is and Hana helps you develop it one step at a time',
    capability_two_title: 'Keep the context',
    capability_two_body: 'Continue naturally with a clearer understanding of your direction and tone',
    capability_three_title: 'Part of GARHY TECH',
    footer_note: 'An intelligent conversation designed around your needs',
    health_check: 'Check service status',
    health_online: 'Service connected',
    health_offline: 'Try the service again later',
    health_checking: 'Checking service',
    skip_to_workspace: 'Skip to conversation',
    user_label: 'You',
    error_response: 'The request could not be completed right now Please try again in a moment',
    error_empty: 'Add a message to begin',
    typing_label: 'Hana is writing',
    request_cancelled: 'The request stopped and you can send it again',
    description: 'Hana the intelligent assistant from GARHY TECH for clearer thinking and smoother conversations'
  }
};

const state = {
  locale: savedValue('hana-locale') === 'en' ? 'en' : 'ar',
  history: [],
  sending: false,
  musicPlaying: false
};

const elements = {
  chatForm: $('chatForm'),
  prompt: $('prompt'),
  send: $('send'),
  sendText: $('send').querySelector('span'),
  conversation: $('conversation'),
  characterCount: $('characterCount'),
  chatState: $('chatState'),
  serviceLabel: $('serviceLabel'),
  healthLabel: $('healthLabel'),
  healthCheck: $('healthCheck'),
  newChat: $('newChat'),
  startChat: $('startChat'),
  languageToggle: $('languageToggle'),
  themeToggle: $('themeToggle'),
  musicToggle: $('musicToggle'),
  musicLabel: $('musicLabel'),
  audio: $('hanaAudio'),
  mediaRail: $('mediaRail'),
  mediaTrack: $('mediaTrack'),
  model: $('model'),
  reasoning: $('reasoning')
};

function text(key) {
  return copy[state.locale][key] || '';
}

function setMetaDescription(value) {
  const tags = [
    document.querySelector('meta[name="description"]'),
    document.querySelector('meta[property="og:description"]'),
    document.querySelector('meta[name="twitter:description"]')
  ];
  tags.forEach((node) => {
    if (node) node.setAttribute('content', value);
  });
}

function applyLocale(locale) {
  state.locale = locale;
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.body.dataset.locale = locale;
  saveValue('hana-locale', locale);

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = text(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.setAttribute('placeholder', text(node.dataset.i18nPlaceholder));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
    node.setAttribute('aria-label', text(node.dataset.i18nAria));
  });
  document.querySelectorAll('[data-prompt-key]').forEach((node) => {
    node.textContent = text(node.dataset.promptKey);
  });

  elements.languageToggle.textContent = locale === 'ar' ? 'EN' : 'ع';
  elements.languageToggle.setAttribute('aria-label', locale === 'ar' ? 'Switch language to English' : 'تبديل اللغة إلى العربية');
  setMetaDescription(text('description'));
  updateCharacterCount();
  updateMusicControl(state.musicPlaying);
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function updateThemeColor() {
  const tag = document.querySelector('meta[name="theme-color"]');
  if (tag) tag.setAttribute('content', currentTheme() === 'dark' ? '#10192b' : '#f7faff');
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  saveValue('hana-theme', theme);
  updateThemeColor();
}

function setServiceStatus(key) {
  elements.serviceLabel.textContent = text(key);
}

function updateCharacterCount() {
  elements.characterCount.textContent = String(elements.prompt.value.length) + ' ' + text('count_joiner') + ' 8000';
  elements.prompt.style.height = 'auto';
  elements.prompt.style.height = Math.min(elements.prompt.scrollHeight, 190) + 'px';
}

function updateMusicControl(isPlaying) {
  state.musicPlaying = isPlaying;
  const key = isPlaying ? 'music_pause' : 'music_play';
  elements.musicLabel.textContent = text(key);
  elements.musicToggle.setAttribute('aria-label', text(key));
  elements.musicToggle.setAttribute('aria-pressed', String(isPlaying));
  elements.musicToggle.classList.toggle('is-playing', isPlaying);
}

async function toggleMusic() {
  if (!elements.audio.paused) {
    elements.audio.pause();
    updateMusicControl(false);
    return;
  }

  elements.audio.volume = 0.48;
  try {
    await elements.audio.play();
    updateMusicControl(true);
  } catch (error) {
    updateMusicControl(false);
    elements.musicLabel.textContent = text('music_error');
    window.setTimeout(() => updateMusicControl(false), 1800);
  }
}

function triggerHaptic(button) {
  if (button.disabled || typeof navigator.vibrate !== 'function') return;
  const duration = button.classList.contains('button--primary') || button === elements.musicToggle ? 14 : 8;
  navigator.vibrate(duration);
}

function scrollConversationToEnd() {
  requestAnimationFrame(() => {
    elements.conversation.scrollTo({
      top: elements.conversation.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  });
}

function createPortrait() {
  const portrait = document.createElement('span');
  portrait.className = 'message__avatar hana-portrait';
  portrait.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.src = '/assets/brand/hana-ai.webp';
  image.width = 320;
  image.height = 320;
  image.alt = '';
  portrait.append(image);
  return portrait;
}

function appendMessage(role, content, options = {}) {
  const message = document.createElement('div');
  message.className = 'message message--' + role + (options.error ? ' message--error' : '');

  if (role === 'assistant') message.append(createPortrait());

  const bubble = document.createElement('article');
  bubble.className = 'message__bubble';
  if (options.pending) bubble.setAttribute('aria-label', text('typing_label'));

  if (options.pending) {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-label', text('typing_label'));
    for (let index = 0; index < 3; index += 1) indicator.append(document.createElement('span'));
    bubble.append(indicator);
  } else {
    const meta = document.createElement('div');
    meta.className = 'message__meta';
    const name = document.createElement('strong');
    name.textContent = role === 'assistant' ? 'Hana' : text('user_label');
    meta.append(name);
    if (role === 'assistant' && !options.error) {
      const label = document.createElement('span');
      label.textContent = text('assistant_label');
      meta.append(label);
    }
    const paragraph = document.createElement('p');
    paragraph.dir = 'auto';
    paragraph.textContent = content;
    bubble.append(meta, paragraph);
  }

  message.append(bubble);
  elements.conversation.append(message);
  scrollConversationToEnd();
  return message;
}

function clearConversation() {
  state.history = [];
  elements.conversation.replaceChildren();
  appendMessage('assistant', text('welcome'));
  elements.chatState.textContent = '';
  setServiceStatus('status_ready');
}

function requestMessages() {
  const selected = [];
  let total = 0;
  const maxChars = 15000;
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const message = state.history[index];
    if (total + message.content.length > maxChars) continue;
    selected.unshift(message);
    total += message.content.length;
    if (selected.length >= 20) break;
  }
  return selected;
}

function apiErrorMessage(error) {
  return error && error.name === 'AbortError' ? text('request_cancelled') : text('error_response');
}

async function sendMessage() {
  const prompt = elements.prompt.value.trim();
  if (!prompt || state.sending) {
    if (!prompt) elements.chatState.textContent = text('error_empty');
    return;
  }

  state.sending = true;
  elements.send.disabled = true;
  elements.sendText.textContent = text('sending');
  elements.chatState.textContent = text('status_thinking');
  setServiceStatus('status_thinking');

  appendMessage('user', prompt);
  state.history.push({ role: 'user', content: prompt });
  elements.prompt.value = '';
  updateCharacterCount();
  const pending = appendMessage('assistant', '', { pending: true });
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 65000);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        model: elements.model.value,
        reasoning: elements.reasoning.value,
        messages: requestMessages()
      }),
      signal: controller.signal
    });

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    pending.remove();
    if (!response.ok || !data || typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('Response unavailable');
    }

    const reply = data.reply.trim();
    state.history.push({ role: 'assistant', content: reply });
    appendMessage('assistant', reply);
    elements.chatState.textContent = '';
    setServiceStatus('status_complete');
  } catch (error) {
    pending.remove();
    appendMessage('assistant', apiErrorMessage(error), { error: true });
    elements.chatState.textContent = text('status_unavailable');
    setServiceStatus('status_unavailable');
  } finally {
    window.clearTimeout(timeout);
    state.sending = false;
    elements.send.disabled = false;
    elements.sendText.textContent = text('send');
    elements.prompt.focus();
  }
}

function setupMediaRail() {
  const rail = elements.mediaRail;
  const track = elements.mediaTrack;
  if (!rail || !track) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  Array.from(track.children).forEach((item) => {
    const duplicate = item.cloneNode(true);
    duplicate.setAttribute('aria-hidden', 'true');
    duplicate.querySelectorAll('img').forEach((image) => image.setAttribute('alt', ''));
    track.append(duplicate);
  });

  let railWidth = 0;
  let offset = 0;
  let startX = 0;
  let startOffset = 0;
  let dragging = false;
  let pauseUntil = 0;
  let lastFrame = performance.now();

  const wrap = (value) => {
    if (!railWidth) return 0;
    return ((value % railWidth) + railWidth) % railWidth;
  };
  const render = () => {
    track.style.transform = 'translate3d(' + (-offset) + 'px, 0, 0)';
  };
  const measure = () => {
    railWidth = track.scrollWidth / 2;
    offset = wrap(offset);
    render();
  };
  const pause = (duration = 1500) => {
    pauseUntil = Math.max(pauseUntil, performance.now() + duration);
  };
  const tick = (now) => {
    const elapsed = Math.min(now - lastFrame, 64);
    lastFrame = now;
    if (!reduceMotion.matches && !dragging && document.visibilityState === 'visible' && now >= pauseUntil && railWidth) {
      offset = wrap(offset + elapsed * 0.018);
      render();
    }
    requestAnimationFrame(tick);
  };

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measure);
    observer.observe(track);
  }
  window.addEventListener('load', measure, { once: true });
  window.addEventListener('resize', measure, { passive: true });
  requestAnimationFrame(() => {
    measure();
    requestAnimationFrame(tick);
  });

  rail.addEventListener('pointerdown', (event) => {
    dragging = true;
    startX = event.clientX;
    startOffset = offset;
    pause(1800);
    rail.setPointerCapture(event.pointerId);
  });
  rail.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    offset = wrap(startOffset - (event.clientX - startX));
    render();
  });
  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    pause(1300);
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
  };
  rail.addEventListener('pointerup', endDrag);
  rail.addEventListener('pointercancel', endDrag);
  rail.addEventListener('mouseenter', () => pause(900));
  rail.addEventListener('mouseleave', () => {
    if (!dragging) pause(250);
  });
  rail.addEventListener('focusin', () => pause(1200));
  rail.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    offset = wrap(offset + event.deltaX);
    render();
    pause(1600);
  }, { passive: false });
  rail.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    offset = wrap(offset + (event.key === 'ArrowLeft' ? -120 : 120));
    render();
    pause(1800);
  });
}

async function checkHealth() {
  elements.healthCheck.setAttribute('aria-busy', 'true');
  elements.healthLabel.textContent = text('health_checking');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/api/health', { credentials: 'same-origin', signal: controller.signal });
    const data = await response.json();
    if (!response.ok || !data || data.ok !== true) throw new Error('Health unavailable');
    elements.healthLabel.textContent = text('health_online');
    setServiceStatus('status_ready');
  } catch (error) {
    elements.healthLabel.textContent = text('health_offline');
    setServiceStatus('status_unavailable');
  } finally {
    window.clearTimeout(timeout);
    elements.healthCheck.removeAttribute('aria-busy');
  }
}

elements.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage();
});
elements.prompt.addEventListener('input', updateCharacterCount);
elements.prompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
});
elements.newChat.addEventListener('click', () => {
  clearConversation();
  elements.prompt.focus();
});
elements.startChat.addEventListener('click', () => {
  $('workspace').scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start'
  });
  window.setTimeout(() => elements.prompt.focus(), 420);
});
document.querySelectorAll('[data-prompt-key]').forEach((button) => {
  button.addEventListener('click', () => {
    elements.prompt.value = text(button.dataset.promptKey);
    updateCharacterCount();
    elements.prompt.focus();
  });
});
elements.languageToggle.addEventListener('click', () => {
  applyLocale(state.locale === 'ar' ? 'en' : 'ar');
  clearConversation();
});
elements.themeToggle.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
elements.musicToggle.addEventListener('click', toggleMusic);
elements.audio.addEventListener('play', () => updateMusicControl(true));
elements.audio.addEventListener('pause', () => updateMusicControl(false));
elements.healthCheck.addEventListener('click', checkHealth);
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (button) triggerHaptic(button);
});

applyLocale(state.locale);
updateThemeColor();
updateCharacterCount();
setupMediaRail();
