/* ============================================
   BioQuorix — Main Application Logic
   Navigation, Auth, Quiz, Chat, Analytics
   ============================================ */

// ===== STATE MANAGEMENT =====
const APP_STATE = {
    currentPage: 'landing',
    currentSection: 'overview',
    currentUser: null,
    theme: localStorage.getItem('bionexus_theme') || 'dark',
    ollamaModel: 'llama3',
    quizState: {
        currentTopic: null,
        questions: [],
        currentIndex: 0,
        answers: [],
        score: 0
    },
    flashcardState: {
        decks: {},
        currentDeck: null,
        currentIndex: 0,
        isFlipped: false
    },
    currentModuleTopic: null,
    chatHistory: [],
    tutorPersonality: 'emoji', // 'emoji', 'professor', 'comrade'
    lastLessonText: ''
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme
    applyTheme(APP_STATE.theme);

    loadUserFromStorage();
    updateNavbar();
    if (APP_STATE.currentUser && APP_STATE.currentUser.setupComplete) {
        navigateTo('dashboard');
    }

    // Initialize high-end scroll reveals
    initScrollAnimations();

    // Global Ripple Effect Listener
    document.addEventListener('click', function (e) {
        const target = e.target.closest('.ripple-btn');
        if (!target) return;

        const circle = document.createElement('span');
        const diameter = Math.max(target.clientWidth, target.clientHeight);
        const radius = diameter / 2;

        const rect = target.getBoundingClientRect();

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${e.clientX - rect.left - radius}px`;
        circle.style.top = `${e.clientY - rect.top - radius}px`;
        circle.classList.add('ripple-effect');

        // Remove old ripples to prevent DOM buildup
        const ripples = target.getElementsByClassName('ripple-effect');
        for (let i = 0; i < ripples.length; i++) {
            ripples[i].remove();
        }

        target.appendChild(circle);
    });

    // Flashcard Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (APP_STATE.currentSection !== 'flashcards') return;
        if (APP_STATE.currentPage !== 'dashboard') return;

        const playArea = document.getElementById('flashcardsPlayArea');
        if (playArea.classList.contains('hidden')) return;

        if (e.code === 'Space') {
            e.preventDefault();
            flipFlashcard();
        } else if (e.key === '1') {
            rateFlashcard(1);
        } else if (e.key === '2') {
            rateFlashcard(2);
        } else if (e.key === '3') {
            rateFlashcard(3);
        }
    });
});

// ===== NAVIGATION =====
function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    // Show target page
    const target = document.getElementById(`page-${page}`);
    if (target) {
        target.classList.remove('hidden');
        APP_STATE.currentPage = page;
    }
    updateNavbar();
    window.scrollTo(0, 0);

    if (page === 'dashboard') {
        showDashboardSection('overview');
        updateDashboardData();
    }
}

function updateNavbar() {
    const navLinks = document.getElementById('navLinks');
    if (APP_STATE.currentUser) {
        document.getElementById('navLinks').innerHTML = `
        <li><a href="#" onclick="navigateTo('dashboard'); showDashboardSection('learn');" style="font-weight: 500; font-size: 0.95rem; color: var(--text-secondary); transition: color 0.2s; margin-right: 16px;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-secondary)'">Courses</a></li>
        <li><a href="#" onclick="navigateTo('landing'); setTimeout(() => document.getElementById('testimonials').scrollIntoView({behavior:'smooth'}), 100);" style="font-weight: 500; font-size: 0.95rem; color: var(--text-secondary); transition: color 0.2s; margin-right: 16px;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-secondary)'">About Us</a></li>
        <li><a href="#" onclick="navigateTo('dashboard')" style="font-weight: 500; font-size: 0.95rem; color: var(--text-secondary); transition: color 0.2s;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-secondary)'">Dashboard</a></li>
        <li><a href="#" onclick="toggleNotifications(event)" style="font-size:1.1rem; cursor:pointer; position:relative; margin: 0 16px 0 8px; color: var(--text-secondary); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'; this.style.color='var(--primary-400)'" onmouseout="this.style.transform='scale(1)'; this.style.color='var(--text-secondary)'" title="Notifications">
            🔔<span id="navNotificationDot" style="position:absolute; top:-2px; right:-2px; background:var(--error); width:8px; height:8px; border-radius:50%; box-shadow: 0 0 6px var(--error);"></span>
        </a>
        <!-- Viewport attached dynamic dropdown container -->
        <div id="notificationsDropdown" class="hidden glass-card" style="position:absolute; top:60px; right:120px; width:340px; max-width:90vw; max-height:400px; overflow-y:auto; z-index:100; padding:0; background:var(--bg-card); border:1px solid var(--border-color); box-shadow:var(--shadow-lg);">
            <div style="padding:16px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0;">Notifications</h4>
                <button class="btn btn-ghost btn-sm" onclick="markNotificationsRead()" style="font-size:0.8rem; padding:4px 8px;">Mark all read</button>
            </div>
            <div id="notificationsList"></div>
        </div>
        </li>
        <li style="position:relative;">
            <button onclick="toggleProfileMenu(event)" style="background: var(--primary-500); color: white; border: none; padding: 6px 18px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-glow);" onmouseover="this.style.background='var(--primary-600)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='var(--primary-500)'; this.style.transform='translateY(0)'">👤 ${APP_STATE.currentUser.name.split(' ')[0].toLowerCase()} ✨ ${APP_STATE.currentUser.xp || 0} XP</button>
            
            <!-- Profile Dropdown -->
            <div id="profileDropdown" class="hidden glass-card" style="position:absolute; top:48px; right:0; width:220px; z-index:100; padding:8px 0; background:var(--bg-card); border:1px solid var(--border-color); box-shadow:var(--shadow-lg); border-radius:12px; display:flex; flex-direction:column;">
                <a href="#" onclick="navigateTo('dashboard'); showDashboardSection('credits'); renderCreditHistory(); closeProfileMenu();" style="display:flex; align-items:center; gap:12px; padding:12px 20px; color:var(--text-primary); text-decoration:none; transition:background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'"><span style="font-size:1.1rem;">✨</span> Credit History</a>
                <a href="#" onclick="navigateTo('dashboard'); showDashboardSection('profile'); closeProfileMenu();" style="display:flex; align-items:center; gap:12px; padding:12px 20px; color:var(--text-primary); text-decoration:none; transition:background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'"><span style="font-size:1.1rem;">👤</span> Profile Settings</a>
                <div style="height:1px; background:var(--border-color); margin:4px 0;"></div>
                <a href="#" onclick="handleLogout()" style="display:flex; align-items:center; gap:12px; padding:12px 20px; color:var(--error); text-decoration:none; transition:background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'"><span style="font-size:1.1rem;">🚪</span> Logout</a>
            </div>
        </li>
      `;
    } else {
        navLinks.innerHTML = `
      <li><a href="#" onclick="document.getElementById('features-section').scrollIntoView({behavior:'smooth'})" style="font-weight: 500; font-size: 0.95rem; color: var(--text-secondary); transition: color 0.2s;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-secondary)'">Courses</a></li>
      <li><a href="#" onclick="document.getElementById('testimonials').scrollIntoView({behavior:'smooth'})" style="font-weight: 500; font-size: 0.95rem; color: var(--text-secondary); transition: color 0.2s;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-secondary)'">About Us</a></li>
      <li><a href="#" onclick="navigateTo('login')" style="font-weight: 500; font-size: 0.95rem; color: var(--text-secondary); transition: color 0.2s; margin-left: 12px; margin-right: 8px;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-secondary)'">Log in</a></li>
      <li><a href="#" class="btn btn-primary btn-sm" onclick="navigateTo('signup')">Get Started</a></li>
    `;
    }
}

// ===== AUTH =====
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Check stored users
    const users = JSON.parse(localStorage.getItem('bionexus_users') || '{}');
    if (users[email] && users[email].password === password) {
        APP_STATE.currentUser = users[email];
        localStorage.setItem('bionexus_current', email);
        showToast('Welcome back! 👋', '✅');

        if (!APP_STATE.currentUser.setupComplete) {
            navigateTo('setup');
        } else {
            navigateTo('dashboard');
        }
    } else {
        showToast('Invalid credentials or user not found.', '❌');
    }
}

// ===== NOTIFICATIONS & PROFILE MENU =====
window.addEventListener('click', function (e) {
    const notifDropdown = document.getElementById('notificationsDropdown');
    const profDropdown = document.getElementById('profileDropdown');

    // Close notifications if click outside
    if (notifDropdown && !notifDropdown.classList.contains('hidden')) {
        if (!notifDropdown.contains(e.target) && !e.target.closest('a[title="Notifications"]')) {
            notifDropdown.classList.add('hidden');
        }
    }

    // Close profile menu if click outside
    if (profDropdown && !profDropdown.classList.contains('hidden')) {
        if (!profDropdown.contains(e.target) && !e.target.closest('button[onclick="toggleProfileMenu(event)"]')) {
            profDropdown.classList.add('hidden');
        }
    }
});

function toggleProfileMenu(e) {
    e.preventDefault();
    const dropdown = document.getElementById('profileDropdown');
    if (!dropdown) return;

    if (dropdown.classList.contains('hidden')) {
        // Hide notifications if open
        const notifDropdown = document.getElementById('notificationsDropdown');
        if (notifDropdown) notifDropdown.classList.add('hidden');

        dropdown.classList.remove('hidden');
    } else {
        dropdown.classList.add('hidden');
    }
}

function closeProfileMenu() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function toggleNotifications(e) {
    e.preventDefault();
    const dropdown = document.getElementById('notificationsDropdown');
    if (!dropdown) return;

    if (dropdown.classList.contains('hidden')) {
        // Hide profile menu if open
        const profDropdown = document.getElementById('profileDropdown');
        if (profDropdown) profDropdown.classList.add('hidden');

        populateNotifications();
        dropdown.classList.remove('hidden');
    } else {
        dropdown.classList.add('hidden');
    }
}

function populateNotifications() {
    const list = document.getElementById('notificationsList');
    const user = APP_STATE.currentUser;
    if (!list || !user) return;

    if (!user.activity || user.activity.length === 0) {
        list.innerHTML = `
            <div style="padding:24px; text-align:center; color:var(--text-muted); font-size:0.9rem;">
                No recent activity.
            </div>
        `;
        return;
    }

    const recent = user.activity.slice(-10).reverse();
    list.innerHTML = recent.map(a => `
      <div style="display:flex; align-items:flex-start; gap:12px; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
        <span style="font-size:1.1rem; margin-top:2px;">${a.type === 'quiz' ? '📝' : a.type === 'lesson' ? '📖' : a.type === 'system' ? '🌟' : '💬'}</span>
        <div style="flex:1;">
          <div style="font-size:0.9rem; font-weight:500; color:var(--text-primary); margin-bottom:2px; line-height:1.3;">${a.text}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${timeAgo(a.date)}</div>
        </div>
      </div>
    `).join('');
}

function markNotificationsRead() {
    const dot = document.getElementById('navNotificationDot');
    if (dot) dot.style.display = 'none';
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    const users = JSON.parse(localStorage.getItem('bionexus_users') || '{}');
    if (users[email]) {
        showToast('Account already exists. Please login.', '⚠️');
        return;
    }

    const newUser = {
        name,
        email,
        password,
        level: null,
        interests: [],
        completedTopics: [],
        quizScores: {},
        quizHistory: [],
        weakAreas: [],
        streak: 0,
        xp: 0,
        lastActive: new Date().toISOString(),
        setupComplete: false,
        createdAt: new Date().toISOString(),
        activity: []
    };

    users[email] = newUser;
    localStorage.setItem('bionexus_users', JSON.stringify(users));
    APP_STATE.currentUser = newUser;
    localStorage.setItem('bionexus_current', email);

    showToast('Account created! Let\'s set up your profile. 🎉', '✅');
    navigateTo('setup');
}

function handleLogout() {
    APP_STATE.currentUser = null;
    localStorage.removeItem('bionexus_current');
    navigateTo('landing');
    showToast('Logged out successfully', '👋');
}

function loadUserFromStorage() {
    const currentEmail = localStorage.getItem('bionexus_current');
    if (currentEmail) {
        const users = JSON.parse(localStorage.getItem('bionexus_users') || '{}');
        if (users[currentEmail]) {
            APP_STATE.currentUser = users[currentEmail];
            if (APP_STATE.currentUser.xp === undefined) APP_STATE.currentUser.xp = 0;
            if (!APP_STATE.currentUser.flashcardDecks) APP_STATE.currentUser.flashcardDecks = {};
        }
    }
}

function saveCurrentUser() {
    if (!APP_STATE.currentUser) return;
    const users = JSON.parse(localStorage.getItem('bionexus_users') || '{}');
    users[APP_STATE.currentUser.email] = APP_STATE.currentUser;
    localStorage.setItem('bionexus_users', JSON.stringify(users));
}

// ===== PROFILE SETUP =====
let selectedLevel = null;
let selectedInterests = [];

function selectLevel(level, el) {
    selectedLevel = level;
    document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('btnToStep2').disabled = false;
}

function nextSetupStep(step) {
    // Update step indicators
    document.querySelectorAll('.setup-step').forEach(s => {
        const sNum = parseInt(s.dataset.step);
        if (sNum < step) { s.classList.remove('active'); s.classList.add('done'); }
        else if (sNum === step) { s.classList.add('active'); s.classList.remove('done'); }
        else { s.classList.remove('active', 'done'); }
    });

    // Show/hide bodies
    document.querySelectorAll('.setup-body').forEach(b => b.classList.add('hidden'));
    document.getElementById(`setup-step-${step}`).classList.remove('hidden');

    if (step === 2) {
        APP_STATE.currentUser.level = selectedLevel;
        saveCurrentUser();
        populateInterestTags();
    }

    if (step === 3) {
        APP_STATE.currentUser.interests = selectedInterests;
        saveCurrentUser();
        startDiagnosticQuiz();
    }
}

function populateInterestTags() {
    const topics = BIOTECH_TOPICS[selectedLevel] || [];
    const container = document.getElementById('interestTags');
    container.innerHTML = topics.map(t => `
    <span class="topic-tag" onclick="toggleInterest('${t.id}', this)">${t.icon} ${t.name}</span>
  `).join('');
}

function toggleInterest(topicId, el) {
    el.classList.toggle('selected');
    if (selectedInterests.includes(topicId)) {
        selectedInterests = selectedInterests.filter(i => i !== topicId);
    } else {
        selectedInterests.push(topicId);
    }
}

// ===== DIAGNOSTIC QUIZ =====
function startDiagnosticQuiz() {
    const level = APP_STATE.currentUser.level;
    const topics = BIOTECH_TOPICS[level] || [];

    // Pick 2 questions from each of 5 topics for a 10-question diagnostic
    let diagnosticQuestions = [];
    const availableTopics = topics.filter(t => QUIZ_BANK[t.id]).slice(0, 5);

    availableTopics.forEach(topic => {
        const qs = QUIZ_BANK[topic.id];
        if (qs) {
            const shuffled = [...qs].sort(() => Math.random() - 0.5);
            diagnosticQuestions.push(
                { ...shuffled[0], topicId: topic.id, topicName: topic.name },
                { ...shuffled[1], topicId: topic.id, topicName: topic.name }
            );
        }
    });

    APP_STATE.quizState = {
        currentTopic: 'diagnostic',
        questions: diagnosticQuestions,
        currentIndex: 0,
        answers: [],
        score: 0
    };

    renderDiagnosticQuestion();
}

function renderDiagnosticQuestion() {
    const qs = APP_STATE.quizState;
    const area = document.getElementById('diagnosticQuizArea');

    if (qs.currentIndex >= qs.questions.length) {
        finishDiagnosticQuiz();
        return;
    }

    const q = qs.questions[qs.currentIndex];
    const progress = ((qs.currentIndex) / qs.questions.length) * 100;

    area.innerHTML = `
    <h3 style="text-align:center; margin-bottom:8px;">📋 Diagnostic Quiz</h3>
    <p style="text-align:center; margin-bottom:16px; font-size:0.85rem; color:var(--text-muted);">Question ${qs.currentIndex + 1} of ${qs.questions.length}</p>
    <div class="quiz-progress-bar" style="margin-bottom:24px;">
      <div class="progress-fill" style="width:${progress}%"></div>
    </div>
    <div class="quiz-question">
      <div class="question-number">${q.topicName}</div>
      <h3>${q.question}</h3>
      <div class="quiz-options">
        ${q.options.map((opt, i) => `
          <div class="quiz-option" onclick="selectDiagnosticAnswer(${i}, this)">
            <span class="option-label">${String.fromCharCode(65 + i)}</span>
            <span>${opt}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-primary" id="diagNextBtn" onclick="nextDiagnosticQuestion()" disabled>Next →</button>
    </div>
  `;
}

function selectDiagnosticAnswer(index, el) {
    const qs = APP_STATE.quizState;
    const q = qs.questions[qs.currentIndex];

    // Remove previous selection
    el.parentElement.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected', 'correct', 'incorrect'));

    // Show result
    if (index === q.correct) {
        el.classList.add('correct');
        qs.answers[qs.currentIndex] = { selected: index, correct: true, topicId: q.topicId };
    } else {
        el.classList.add('incorrect');
        el.parentElement.querySelectorAll('.quiz-option')[q.correct].classList.add('correct');
        qs.answers[qs.currentIndex] = { selected: index, correct: false, topicId: q.topicId };
    }

    // Disable further clicks
    el.parentElement.querySelectorAll('.quiz-option').forEach(o => o.style.pointerEvents = 'none');
    document.getElementById('diagNextBtn').disabled = false;
}

function nextDiagnosticQuestion() {
    APP_STATE.quizState.currentIndex++;
    renderDiagnosticQuestion();
}

function finishDiagnosticQuiz() {
    const qs = APP_STATE.quizState;
    const totalCorrect = qs.answers.filter(a => a.correct).length;
    const scorePercent = Math.round((totalCorrect / qs.questions.length) * 100);

    // Calculate per-topic scores
    const topicScores = {};
    qs.answers.forEach(a => {
        if (!topicScores[a.topicId]) topicScores[a.topicId] = { correct: 0, total: 0 };
        topicScores[a.topicId].total++;
        if (a.correct) topicScores[a.topicId].correct++;
    });

    // Identify weak areas
    const weakAreas = [];
    Object.entries(topicScores).forEach(([topicId, score]) => {
        if (score.correct / score.total < 0.5) {
            const topic = BIOTECH_TOPICS[APP_STATE.currentUser.level].find(t => t.id === topicId);
            if (topic) weakAreas.push(topic.name);
        }
        APP_STATE.currentUser.quizScores[topicId] = Math.round((score.correct / score.total) * 100);
    });

    APP_STATE.currentUser.weakAreas = weakAreas;
    APP_STATE.currentUser.setupComplete = true;
    APP_STATE.currentUser.quizHistory.push({
        type: 'diagnostic',
        score: scorePercent,
        date: new Date().toISOString(),
        totalQuestions: qs.questions.length,
        correctAnswers: totalCorrect
    });
    APP_STATE.currentUser.activity.push({
        type: 'quiz',
        text: `Completed diagnostic quiz with ${scorePercent}%`,
        date: new Date().toISOString()
    });
    saveCurrentUser();
    addXP(50, 'Completed Diagnostic Quiz');

    // Show results
    const area = document.getElementById('diagnosticQuizArea');
    area.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:3rem; margin-bottom:12px;">🎉</div>
      <h2>Diagnostic Complete!</h2>
      <div style="font-size:3.5rem; font-weight:900; margin:16px 0;" class="text-gradient">${scorePercent}%</div>
      <p style="margin-bottom:24px;">We've assessed your biotechnology knowledge and created your personalized learning path.</p>
      ${weakAreas.length ? `
        <div style="background:rgba(245,158,11,0.06); border-left:3px solid var(--warning); padding:12px 16px; border-radius:0 8px 8px 0; text-align:left; margin-bottom:24px;">
          <strong style="color:var(--warning);">🔧 Areas to Focus On:</strong><br>
          <span style="color:var(--text-secondary);">${weakAreas.join(', ')}</span>
        </div>
      ` : `
        <div style="background:rgba(34,197,94,0.06); border-left:3px solid var(--success); padding:12px 16px; border-radius:0 8px 8px 0; text-align:left; margin-bottom:24px;">
          <strong style="color:var(--success);">💪 Great job!</strong><br>
          <span style="color:var(--text-secondary);">You have a strong foundation! Let's take you to advanced topics.</span>
        </div>
      `}
      <button class="btn btn-primary btn-lg" onclick="navigateTo('dashboard')">Go to Dashboard →</button>
    </div>
  `;
}

// ===== DASHBOARD =====
function showDashboardSection(section) {
    document.querySelectorAll('.dashboard-section').forEach(s => {
        s.classList.add('hidden');
        s.style.animation = 'none'; // reset animation
    });

    const target = document.getElementById(`section-${section}`);
    if (target) {
        target.classList.remove('hidden');
        // Trigger reflow to restart animation
        void target.offsetWidth;
        target.style.animation = 'fadeUpStagger 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards';
    }

    // Update sidebar active link
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const navLink = document.getElementById(`nav-${section}`);
    if (navLink) navLink.classList.add('active');

    APP_STATE.currentSection = section;

    // Initialize section-specific content
    if (section === 'overview') updateDashboardData();
    if (section === 'learn') populateModuleTopics();
    if (section === 'quiz') populateQuizTopics();
    if (section === 'path') renderLearningPath();
    if (section === 'analytics') renderAnalytics();
    if (section === 'flashcards') renderFlashcardDecks();
    if (section === 'leaderboard') renderLeaderboard();
    if (section === 'profile') loadProfileData();
}

// Cache DOM elements for dashboard data to improve rendering efficiency
const DOM_CACHE = {
    dashUserName: null, sidebarName: null, sidebarLevel: null,
    sidebarAvatar: null, sidebarXp: null, statQuizzes: null,
    statAvgScore: null, statStreak: null, recentActivity: null
};

function initDomCache() {
    DOM_CACHE.dashUserName = document.getElementById('dashUserName');
    DOM_CACHE.sidebarName = document.getElementById('sidebarName');
    DOM_CACHE.sidebarLevel = document.getElementById('sidebarLevel');
    DOM_CACHE.sidebarAvatar = document.getElementById('sidebarAvatar');
    DOM_CACHE.sidebarXp = document.getElementById('sidebarXp');
    DOM_CACHE.statQuizzes = document.getElementById('statQuizzes');
    DOM_CACHE.statAvgScore = document.getElementById('statAvgScore');
    DOM_CACHE.statStreak = document.getElementById('statStreak');
    DOM_CACHE.recentActivity = document.getElementById('recentActivity');
    DOM_CACHE.dailyQuestContainer = document.getElementById('dailyQuestContainer');
}

function updateDashboardData() {
    const user = APP_STATE.currentUser;
    if (!user) return;

    checkDailyQuest(); // Initialize or reset todays quest

    if (!DOM_CACHE.dashUserName) initDomCache();

    if (DOM_CACHE.dashUserName) DOM_CACHE.dashUserName.textContent = user.name.split(' ')[0];
    if (DOM_CACHE.sidebarName) DOM_CACHE.sidebarName.textContent = user.name;
    if (DOM_CACHE.sidebarLevel) DOM_CACHE.sidebarLevel.textContent = user.level === 'university' ? 'University Level' : 'School Level';
    if (DOM_CACHE.sidebarAvatar) DOM_CACHE.sidebarAvatar.textContent = user.name.charAt(0).toUpperCase();

    // Explicit cache refresh if it wasn't captured initially (e.g. appended dynamically)
    if (!DOM_CACHE.sidebarXp) DOM_CACHE.sidebarXp = document.getElementById('sidebarXp');
    if (DOM_CACHE.sidebarXp) DOM_CACHE.sidebarXp.textContent = `✨ ${user.xp || 0} XP`;

    if (!DOM_CACHE.statModules) DOM_CACHE.statModules = document.getElementById('statModules');
    const completed = user.completedTopics?.length || 0;
    if (DOM_CACHE.statModules) DOM_CACHE.statModules.textContent = completed;

    if (DOM_CACHE.statQuizzes) DOM_CACHE.statQuizzes.textContent = user.quizHistory?.length || 0;

    const scores = user.quizHistory?.map(q => q.score) || [];
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    if (DOM_CACHE.statAvgScore) DOM_CACHE.statAvgScore.textContent = avgScore + '%';
    if (DOM_CACHE.statStreak) DOM_CACHE.statStreak.textContent = user.streak || calculateStreak(user);

    // Recent activity
    if (DOM_CACHE.recentActivity && user.activity && user.activity.length > 0) {
        const recent = user.activity.slice(-5).reverse();
        DOM_CACHE.recentActivity.innerHTML = recent.map(a => `
      <div style="display:flex; align-items:flex-start; gap:16px; padding:16px 24px; border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:1.1rem; margin-top:2px;">${a.type === 'quiz' ? '📝' : a.type === 'lesson' ? '📖' : '💬'}</span>
        <div style="flex:1;">
          <div style="font-size:0.95rem; font-weight:500; color:var(--text-primary); margin-bottom:4px;">${a.text}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${timeAgo(a.date)}</div>
        </div>
      </div>
    `).join('');
    }

    renderDailyQuests();
}

// ===== DAILY QUESTS LOGIC =====
function checkDailyQuest() {
    const user = APP_STATE.currentUser;
    const today = new Date().toDateString();
    if (!user.quests || user.quests.date !== today) {
        // Generate new quest for today
        user.quests = {
            date: today,
            title: 'Complete 2 Lessons',
            type: 'lesson', // or 'quiz'
            target: 2,
            current: 0,
            reward: 50,
            isClaimed: false
        };
        saveCurrentUser();
    }
}

function updateQuestProgress(type, amount = 1) {
    const user = APP_STATE.currentUser;
    if (!user || (!user.quests)) return;

    // Check if it's today's quest
    if (user.quests.date !== new Date().toDateString()) {
        checkDailyQuest();
    }

    if (user.quests.type === type && !user.quests.isClaimed && user.quests.current < user.quests.target) {
        user.quests.current += amount;
        if (user.quests.current > user.quests.target) user.quests.current = user.quests.target;
        saveCurrentUser();
        // If we happen to be in overview, update rendering visually
        if (APP_STATE.currentSection === 'overview') {
            renderDailyQuests();
        }
    }
}

function claimQuestReward() {
    const user = APP_STATE.currentUser;
    if (!user || !user.quests) return;

    if (user.quests.current >= user.quests.target && !user.quests.isClaimed) {
        user.quests.isClaimed = true;
        saveCurrentUser();

        addXP(user.quests.reward, 'Quest Completed');
        renderDailyQuests();
    }
}

function renderDailyQuests() {
    const user = APP_STATE.currentUser;
    const container = document.getElementById('dailyQuestContainer');
    if (!container || !user.quests) return;

    const q = user.quests;
    const progressPercent = Math.min((q.current / q.target) * 100, 100);
    const isCompleted = q.current >= q.target;

    let btnHtml = '';
    if (q.isClaimed) {
        btnHtml = `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.6; background:var(--bg-input);">Claimed ✓</button>`;
    } else if (isCompleted) {
        btnHtml = `<button class="btn btn-primary btn-sm ripple-btn" onclick="claimQuestReward()" style="animation: pulse 2s infinite;">Claim ${q.reward} XP ✨</button>`;
    } else {
        btnHtml = `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.6;">Claim ${q.reward} XP</button>`;
    }

    container.innerHTML = `
        <h3 style="margin-bottom:16px; margin-top:24px;">🎯 Daily Quests</h3>
        <div class="glass-card flex items-center justify-between hover-elevate transition-all" style="margin-bottom:24px; flex-wrap:wrap; gap:16px; border-left: ${isCompleted && !q.isClaimed ? '3px solid var(--primary-500)' : '1px solid var(--border-color)'};">
          <div style="display:flex; gap:16px; align-items:center;">
            <div style="width:48px; height:48px; border-radius:12px; background:rgba(99,102,241,0.15); display:flex; align-items:center; justify-content:center; font-size:1.5rem; filter: grayscale(${q.isClaimed ? '100%' : '0'});">🌟</div>
            <div>
              <h4 style="margin-bottom:4px; opacity: ${q.isClaimed ? '0.6' : '1'};">${q.title}</h4>
              <div class="progress-track" style="width:200px; height:6px; background:var(--bg-input); border-radius:4px; overflow:hidden;">
                <div class="progress-fill" style="width:${progressPercent}%; height:100%; background:${isCompleted ? 'var(--success)' : 'var(--gradient-primary)'}; transition: width 0.5s ease-out, background 0.3s;"></div>
              </div>
              <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">${q.current} / ${q.target} completed</p>
            </div>
          </div>
          ${btnHtml}
        </div>
    `;
}

function calculateStreak(user) {
    if (!user.activity || user.activity.length === 0) return 0;
    const today = new Date().toDateString();
    const lastActive = new Date(user.lastActive).toDateString();
    if (today === lastActive) return Math.max(user.streak || 1, 1);
    return 0;
}

// ===== LEARNING MODULE =====
function populateModuleTopics() {
    const user = APP_STATE.currentUser;
    if (!user) return;
    const topics = BIOTECH_TOPICS[user.level] || [];

    // Helper to generate a single valid card
    const generateCard = (t) => {
        const isComplete = user.completedTopics?.includes(t.id);
        const score = user.quizScores?.[t.id];
        return `
      <div class="glass-card zoom-hover" style="cursor:pointer; display: flex; flex-direction: column;" onclick="openModule('${t.id}')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:2rem; transition: transform 0.3s;" class="icon-bounce">${t.icon}</span>
          ${isComplete ? '<span class="badge green">Completed</span>' :
                score !== undefined ? '<span class="badge amber">In Progress</span>' :
                    '<span class="badge blue">New</span>'}
        </div>
        <h4 style="margin-bottom:4px; flex-grow: 1;">${t.name}</h4>
        <p style="font-size:0.85rem; color: var(--text-muted);">${t.description}</p>
        ${score !== undefined ? `
          <div style="margin-top:12px;">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
              <span>Score</span><span style="font-weight:bold; color:var(--primary-500);">${score}%</span>
            </div>
            <div class="progress-bar"><div class="fill green" style="width:${score}%"></div></div>
          </div>
        ` : ''}
      </div>
    `;
    };

    // Render Recent Modules
    const recentGrid = document.getElementById('recentModuleGrid');
    const recentArea = document.getElementById('recentModulesArea');
    if (recentGrid && recentArea) {
        let recentDocs = user.recentlyAccessed || [];
        // Ensure they actually exist in the current level's topics
        let recentTopicObjs = recentDocs.map(id => topics.find(t => t.id === id)).filter(Boolean);

        if (recentTopicObjs.length > 0) {
            recentArea.classList.remove('hidden');
            recentGrid.innerHTML = recentTopicObjs.map(generateCard).join('');
        } else {
            recentArea.classList.add('hidden');
            recentGrid.innerHTML = '';
        }
    }

    // Render All Topics
    const grid = document.getElementById('moduleTopicGrid');
    if (grid) {
        grid.innerHTML = topics.map(generateCard).join('');
    }
}

async function openModule(topicId) {
    const user = APP_STATE.currentUser;
    const topics = BIOTECH_TOPICS[user.level] || [];
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    APP_STATE.currentModuleTopic = topic;

    document.getElementById('moduleTopicGrid').parentElement.classList.add('hidden');
    document.getElementById('moduleContentArea').classList.remove('hidden');

    const contentEl = document.getElementById('moduleContentDisplay');
    contentEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:48px;">
      <div class="spinner"></div>
      <span style="margin-left:16px;color:var(--text-muted);">AI is generating your personalized lesson on ${topic.name}...</span>
    </div>
  `;

    // Try Gemini API first, fallback to pre-built content
    const lesson = await generateLesson(topic);
    APP_STATE.lastLessonText = lesson; // Store for flashcards and export

    contentEl.innerHTML = lesson;

    // Inject Speech Button at the top
    const speechBtn = document.createElement('button');
    speechBtn.className = 'btn btn-ghost btn-sm';
    speechBtn.style.marginBottom = '16px';
    speechBtn.innerHTML = '🔊 Read Aloud';
    speechBtn.onclick = () => speakText(lesson.replace(/<[^>]*>?/gm, ''));
    contentEl.insertBefore(speechBtn, contentEl.firstChild);

    // Log activity
    user.activity.push({
        type: 'lesson',
        text: `Studied: ${topic.name}`,
        date: new Date().toISOString()
    });

    // Track recently accessed
    if (!user.recentlyAccessed) user.recentlyAccessed = [];
    user.recentlyAccessed = user.recentlyAccessed.filter(id => id !== topicId); // Remove if exists
    user.recentlyAccessed.unshift(topicId); // Add to front
    if (user.recentlyAccessed.length > 4) user.recentlyAccessed.pop(); // Keep max 4

    user.lastActive = new Date().toISOString();
    saveCurrentUser();
    addXP(10, 'Completed Lesson');
    updateQuestProgress('lesson', 1);
}

function backToModuleList() {
    document.getElementById('moduleContentArea').classList.add('hidden');
    const grid = document.getElementById('moduleTopicGrid');
    grid.parentElement.classList.remove('hidden');
    populateModuleTopics();
}

async function generateLesson(topic) {
    const user = APP_STATE.currentUser;

    try {
        const prompt = PROMPT_TEMPLATES.generateLesson(topic, user.level, user);
        const response = await callAI(prompt);
        if (response && !response.includes('**AI Connection Error')) {
            return formatMarkdown(response);
        }
    } catch (e) {
        console.error('AI lesson error:', e);
    }


    // Fallback: built-in lesson content
    return generateFallbackLesson(topic, user.level);
}

function generateFallbackLesson(topic, level) {
    const lessons = {
        'cell-biology': `
      <h1>🔬 Cell Biology & Structure</h1>
      <h2>🎯 Introduction</h2>
      <p>Every living organism is made of <strong>cells</strong> — the fundamental units of life. Think of cells like LEGO bricks: just as complex structures are built from simple blocks, all life is built from cells.</p>
      <h2>🔑 Key Concepts</h2>
      <p><strong>Two Main Types:</strong></p>
      <ul style="color:var(--text-secondary); margin-left:20px; margin-bottom:16px;">
        <li><strong>Prokaryotic cells</strong> (bacteria) — Simple, no membrane-bound nucleus. DNA floats freely.</li>
        <li><strong>Eukaryotic cells</strong> (plants, animals, fungi) — Complex, DNA enclosed in a nucleus.</li>
      </ul>
      <div class="info-box">
        <strong>🧠 Analogy:</strong> A prokaryotic cell is like a studio apartment (everything in one room), while a eukaryotic cell is like a house with separate rooms (organelles) for different functions.
      </div>
      <h2>🏗️ Key Organelles</h2>
      <ul style="color:var(--text-secondary); margin-left:20px; margin-bottom:16px;">
        <li><strong>Nucleus</strong> — The "brain" — stores DNA and controls cell activities</li>
        <li><strong>Mitochondria</strong> — The "powerhouse" — produces ATP energy</li>
        <li><strong>Ribosomes</strong> — The "factories" — make proteins</li>
        <li><strong>Endoplasmic Reticulum</strong> — The "highway" — transports materials</li>
        <li><strong>Golgi Apparatus</strong> — The "post office" — packages and ships proteins</li>
        <li><strong>Cell Membrane</strong> — The "security gate" — controls what enters/exits</li>
      </ul>
      <h2>🌍 Real-World Applications</h2>
      <p>Understanding cells is the foundation of medicine, drug design, cancer research, and biotechnology. For example, understanding how cancer cells divide uncontrollably helps develop targeted therapies.</p>
      <h2>📌 Key Takeaways</h2>
      <ul style="color:var(--text-secondary); margin-left:20px; margin-bottom:16px;">
        <li>Cells are the basic unit of all life</li>
        <li>Prokaryotic = simple, no nucleus; Eukaryotic = complex, has nucleus</li>
        <li>Each organelle has a specific function</li>
        <li>Plant cells have cell walls and chloroplasts; animal cells don't</li>
      </ul>
      <div class="info-box">
        <strong>💡 Did You Know?</strong> Your body contains approximately 37.2 trillion cells, and they replace themselves at a rate of about 3.8 million cells per second!
      </div>
    `,
        'dna-structure': `
      <h1>🧬 DNA Structure & Replication</h1>
      <h2>🎯 Introduction</h2>
      <p>DNA (Deoxyribonucleic Acid) is the <strong>molecule of life</strong> — it carries the instructions for building and running every living organism. Think of it as the <strong>ultimate recipe book</strong> written in a 4-letter alphabet.</p>
      <h2>🔑 Key Concepts</h2>
      <p><strong>The Double Helix:</strong></p>
      <p>Discovered by Watson & Crick in 1953, DNA has a twisted ladder shape. The "rails" are sugar-phosphate backbones, and the "rungs" are base pairs:</p>
      <ul style="color:var(--text-secondary); margin-left:20px; margin-bottom:16px;">
        <li><strong>A</strong>denine pairs with <strong>T</strong>hymine (2 hydrogen bonds)</li>
        <li><strong>G</strong>uanine pairs with <strong>C</strong>ytosine (3 hydrogen bonds)</li>
      </ul>
      <div class="info-box">
        <strong>🧠 Analogy:</strong> DNA is like a zipper. The two strands are the zipper tracks, and the base pairs are the interlocking teeth. To "read" the DNA, you unzip it!
      </div>
      <h2>🔄 DNA Replication</h2>
      <p>Before a cell divides, it must copy its DNA. This is <strong>semi-conservative replication</strong>:</p>
      <ol style="color:var(--text-secondary); margin-left:20px; margin-bottom:16px;">
        <li><strong>Helicase</strong> unwinds and separates the double helix</li>
        <li><strong>Primase</strong> adds a short RNA primer</li>
        <li><strong>DNA Polymerase</strong> adds new nucleotides (5' → 3' direction)</li>
        <li><strong>Ligase</strong> joins the fragments (Okazaki fragments on lagging strand)</li>
      </ol>
      <h2>📌 Key Takeaways</h2>
      <ul style="color:var(--text-secondary); margin-left:20px; margin-bottom:16px;">
        <li>DNA is a double helix with complementary base pairing (A-T, G-C)</li>
        <li>Replication is semi-conservative — each new DNA has one old + one new strand</li>
        <li>Key enzymes: Helicase, Primase, DNA Polymerase, Ligase</li>
      </ul>
      <div class="info-box">
        <strong>💡 Did You Know?</strong> If you uncoiled all the DNA in one human cell and stretched it out, it would be about 2 meters long. All the DNA in your body would stretch to the sun and back 600 times!
      </div>
    `
    };

    // Generic fallback for topics without specific content
    const fallback = `
    <h1>${topic.icon} ${topic.name}</h1>
    <h2>🎯 Introduction</h2>
    <p>${topic.description}</p>
    <div class="info-box">
      <strong>💡 AI Insight:</strong> This module covers <strong>${topic.name}</strong> at the ${level === 'university' ? 'university' : 'school'} level. Our AI tutor is ready to help you explore deeper concepts and solve complex problems in this field.
    </div>
    <h2>🔑 What You'll Learn</h2>
    <ul style="color:var(--text-secondary); margin-left:20px; margin-bottom:16px;">
      <li>Core concepts and definitions</li>
      <li>How this applies in biotechnology</li>
      <li>Real-world examples and applications</li>
      <li>Key experiments and discoveries</li>
    </ul>
    <h2>📖 Getting Started</h2>
    <p>Use the right panel to take a quiz after reading, or chat with the AI tutor for deeper explanations. Take the quiz on this topic to test your understanding and help the system personalize your learning journey!</p>
  `;

    return lessons[topic.id] || fallback;
}

function startTopicQuiz() {
    if (APP_STATE.currentModuleTopic) {
        showDashboardSection('quiz');
        startQuiz(APP_STATE.currentModuleTopic.id);
    }
}

// ===== QUIZ MODULE =====
function populateQuizTopics() {
    const user = APP_STATE.currentUser;
    if (!user) return;
    const topics = BIOTECH_TOPICS[user.level] || [];
    const grid = document.getElementById('quizTopicGrid');
    if (!grid) return;

    grid.innerHTML = topics.filter(t => QUIZ_BANK[t.id]).map(t => {
        const score = user.quizScores?.[t.id];
        const difficulty = calculateDifficulty(score);
        return `
      <div class="glass-card" style="cursor:pointer;" onclick="startQuiz('${t.id}')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:1.8rem;">${t.icon}</span>
          <span class="badge ${difficulty === 'advanced' ? 'purple' : difficulty === 'intermediate' ? 'amber' : 'green'}">${difficulty}</span>
        </div>
        <h4 style="margin-bottom:4px;">${t.name}</h4>
        <p style="font-size:0.85rem;">5 questions • AI-adapted difficulty</p>
        ${score !== undefined ? `<p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">Last score: ${score}%</p>` : ''}
      </div>
    `;
    }).join('');
}

function calculateDifficulty(score) {
    if (score === undefined || score === null) return 'beginner';
    if (score >= 85) return 'advanced';
    if (score >= 60) return 'intermediate';
    return 'beginner';
}

async function startQuiz(topicId) {
    const user = APP_STATE.currentUser;
    const topics = BIOTECH_TOPICS[user.level] || [];
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    document.getElementById('quizSelectionArea').classList.add('hidden');
    document.getElementById('quizResultsArea').classList.add('hidden');
    document.getElementById('quizPlayArea').classList.remove('hidden');

    const card = document.getElementById('quizQuestionCard');
    card.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px; text-align:center;">
        <div class="spinner" style="margin-bottom:16px;"></div>
        <h4 style="color:var(--text-primary);">Generating your Quiz...</h4>
        <p style="color:var(--text-muted); font-size:0.9rem;">Building questions from ${topic.name}</p>
      </div>
    `;

    document.getElementById('quizNextBtn').disabled = true;
    document.getElementById('quizProgressFill').style.width = '0%';
    document.getElementById('quizCounter').textContent = 'Preparing...';

    // Try to generate quiz via Ollama, fallback to bank
    let questions = [];
    const ollamaModel = APP_STATE.ollamaModel;
    const difficulty = calculateDifficulty(user.quizScores?.[topicId]);

    if (ollamaModel) {
        try {
            const prompt = PROMPT_TEMPLATES.generateQuiz(topic.name, user.level, difficulty);
            const response = await callAI(prompt, ollamaModel);
            if (response) {
                // Better JSON extraction to handle Ollama conversational wrappers
                const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
                const jsonString = jsonMatch ? jsonMatch[0] : response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

                const parsed = JSON.parse(jsonString);

                // Validate schema implicitly to avoid runtime render crashes
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].options) {
                    questions = parsed;
                } else {
                    throw new Error("Parsed JSON does not match expected Quiz schema");
                }
            }
        } catch (e) {
            console.error('Quiz generation error:', e);
        }
    }

    if (!questions.length && QUIZ_BANK[topicId]) {
        questions = [...QUIZ_BANK[topicId]].sort(() => Math.random() - 0.5).slice(0, 5);
    }

    // Safety check if no questions generated and no fallback exists
    if (!questions || questions.length === 0) {
        showToast('Failed to generate a Quiz for this topic. Please try another.', '⚠️');
        document.getElementById('quizSelectionArea').classList.remove('hidden');
        document.getElementById('quizResultsArea').classList.add('hidden');
        document.getElementById('quizPlayArea').classList.add('hidden');
        return;
    }

    APP_STATE.quizState = {
        currentTopic: topicId,
        topicName: topic.name,
        questions,
        currentIndex: 0,
        answers: [],
        score: 0
    };

    renderQuizQuestion();
}

function renderQuizQuestion() {
    const qs = APP_STATE.quizState;
    if (qs.currentIndex >= qs.questions.length) {
        finishQuiz();
        return;
    }

    const q = qs.questions[qs.currentIndex];
    const progress = ((qs.currentIndex) / qs.questions.length) * 100;

    document.getElementById('quizProgressFill').style.width = progress + '%';
    document.getElementById('quizCounter').textContent = `Question ${qs.currentIndex + 1} of ${qs.questions.length}`;

    const card = document.getElementById('quizQuestionCard');
    card.innerHTML = `
    <div class="quiz-question">
      <div class="question-number">Question ${qs.currentIndex + 1} — ${qs.topicName}</div>
      <h3>${q.question}</h3>
      <div class="quiz-options">
        ${q.options.map((opt, i) => `
          <div class="quiz-option" onclick="selectQuizAnswer(${i}, this)">
            <span class="option-label">${String.fromCharCode(65 + i)}</span>
            <span>${opt}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div id="quizExplanation" class="hidden" style="margin-top:16px;padding:12px 16px;background:rgba(16,185,129,0.06);border-radius:8px;border-left:3px solid var(--primary-500);">
      <strong>Explanation:</strong> <span id="quizExplanationText"></span>
    </div>
  `;

    const nextBtn = document.getElementById('quizNextBtn');
    nextBtn.disabled = true;
    nextBtn.textContent = qs.currentIndex === qs.questions.length - 1 ? 'See Results' : 'Next Question →';
}

async function selectQuizAnswer(index, el) {
    const qs = APP_STATE.quizState;
    const q = qs.questions[qs.currentIndex];

    el.parentElement.querySelectorAll('.quiz-option').forEach(o => {
        o.classList.remove('selected', 'correct', 'incorrect');
        o.style.pointerEvents = 'none';
    });

    const isCorrect = index === q.correct;
    if (isCorrect) {
        el.classList.add('correct');
        qs.score++;
    } else {
        el.classList.add('incorrect');
        el.parentElement.querySelectorAll('.quiz-option')[q.correct].classList.add('correct');
    }

    qs.answers.push({ selected: index, correct: isCorrect });

    // Show explanation
    const quizExplanationEl = document.getElementById('quizExplanation');
    const quizExplanationTextEl = document.getElementById('quizExplanationText');
    quizExplanationEl.classList.remove('hidden');
    quizExplanationTextEl.innerHTML = '<span style="display:flex;align-items:center;gap:8px;"><div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Analyzing your answer...</span>';

    let aiExplanation = '';
    const ollamaModel = APP_STATE.ollamaModel;
    if (ollamaModel) {
        try {
            const userAnsStr = q.options[index];
            const corrAnsStr = q.options[q.correct];
            const userName = APP_STATE.currentUser?.name || 'the student';
            const prompt = `Be very polite, encouraging, and friendly. Address "${userName}" by name. They selected the wrong answer "${userAnsStr}" instead of "${corrAnsStr}" for the question: "${q.question}". Gently explain why in strictly 2-3 short, concise lines. Keep it kind and simple format as a text block without markdown bolding.`;
            aiExplanation = await callAI(prompt, ollamaModel);
        } catch (e) {
            console.error('AI explanation error:', e);
            aiExplanation = q.explanation || 'No specific explanation available.';
        }
    } else {
        aiExplanation = q.explanation || 'No specific explanation available. Add your local model name for AI explanations!';
    }

    // Typewriter effect for the explanation
    quizExplanationTextEl.innerHTML = '';
    const rawText = aiExplanation.replace(/<[^>]*>?/gm, ''); // Strip HTML for the typing phase

    let i = 0;
    const speed = 15; // ms per char

    function typeWriter() {
        if (i < rawText.length) {
            quizExplanationTextEl.innerHTML += rawText.charAt(i);
            i++;
            setTimeout(typeWriter, speed);
        } else {
            // Once typing is done, inject the fully formatted markdown
            quizExplanationTextEl.innerHTML = formatMarkdown(aiExplanation);
        }
    }

    typeWriter();

    document.getElementById('quizNextBtn').disabled = false;
}

function nextQuizQuestion() {
    APP_STATE.quizState.currentIndex++;
    renderQuizQuestion();
}

function finishQuiz() {
    const qs = APP_STATE.quizState;
    const user = APP_STATE.currentUser;
    const scorePercent = Math.round((qs.score / qs.questions.length) * 100);

    document.getElementById('quizPlayArea').classList.add('hidden');
    document.getElementById('quizResultsArea').classList.remove('hidden');

    document.getElementById('quizFinalScore').textContent = scorePercent + '%';
    document.getElementById('quizCorrectCount').textContent = qs.score;
    document.getElementById('quizWrongCount').textContent = qs.questions.length - qs.score;
    document.getElementById('quizTotalQ').textContent = qs.questions.length;

    // Update user data
    user.quizScores[qs.currentTopic] = scorePercent;
    user.quizHistory.push({
        topic: qs.topicName,
        topicId: qs.currentTopic,
        score: scorePercent,
        date: new Date().toISOString(),
        totalQuestions: qs.questions.length,
        correctAnswers: qs.score
    });

    if (!user.completedTopics) user.completedTopics = [];
    if (scorePercent >= 70 && !user.completedTopics.includes(qs.currentTopic)) {
        user.completedTopics.push(qs.currentTopic);
    }

    // Recalculate weak areas
    const weakAreas = [];
    Object.entries(user.quizScores).forEach(([topicId, score]) => {
        if (score < 60) {
            const topic = BIOTECH_TOPICS[user.level]?.find(t => t.id === topicId);
            if (topic) weakAreas.push(topic.name);
        }
    });
    user.weakAreas = weakAreas;

    user.activity.push({
        type: 'quiz',
        text: `Scored ${scorePercent}% on ${qs.topicName}`,
        date: new Date().toISOString()
    });
    user.lastActive = new Date().toISOString();
    saveCurrentUser();
    addXP(Math.round(scorePercent / 5), 'Quiz Master');
    updateQuestProgress('quiz', 1);

    // Feedback
    const feedback = document.getElementById('quizFeedback');
    if (scorePercent >= 90) {
        feedback.innerHTML = '🌟 <strong>Outstanding!</strong> You\'ve mastered this topic. Keep up the amazing work!';
    } else if (scorePercent >= 70) {
        feedback.innerHTML = '✅ <strong>Good job!</strong> You have a solid understanding. Review the questions you missed to strengthen your knowledge.';
    } else if (scorePercent >= 50) {
        feedback.innerHTML = '📖 <strong>Keep going!</strong> You\'re on the right track. Revisit the lesson material and try again.';
    } else {
        feedback.innerHTML = '💪 <strong>Don\'t give up!</strong> Study the lesson carefully, use the AI tutor for doubts, and retake the quiz.';
    }
}

function retakeQuiz() {
    startQuiz(APP_STATE.quizState.currentTopic);
}

function backToQuizSelection() {
    document.getElementById('quizPlayArea').classList.add('hidden');
    document.getElementById('quizResultsArea').classList.add('hidden');
    document.getElementById('quizSelectionArea').classList.remove('hidden');
    populateQuizTopics();
}

// ===== AI CHAT =====
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    const container = document.getElementById('chatMessages');

    // Add user message
    container.innerHTML += `
    <div class="chat-message user">
      <div class="chat-avatar">👤</div>
      <div class="chat-bubble">${escapeHtml(message)}</div>
    </div>
  `;

    // Add typing indicator
    const typingId = 'typing-' + Date.now();
    container.innerHTML += `
    <div class="chat-message ai" id="${typingId}">
      <div class="chat-avatar">🧬</div>
      <div class="chat-bubble" style="display:flex;align-items:center;gap:8px;">
        <div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>
        Thinking...
      </div>
    </div>
  `;
    container.scrollTop = container.scrollHeight;

    // Get response
    let response = '';
    const user = APP_STATE.currentUser;
    const ollamaModel = APP_STATE.ollamaModel;

    if (ollamaModel) {
        try {
            const context = APP_STATE.currentModuleTopic?.name || '';
            // Only keep last 6 messages (3 turns) for context to avoid huge prompts
            const history = APP_STATE.chatHistory.slice(-6);
            const personality = APP_STATE.tutorPersonality || 'emoji';
            const prompt = PROMPT_TEMPLATES.chatResponse(message, user.level, context, history, personality);
            response = await callAI(prompt);

            if (response && !response.includes('**AI Connection Error')) {
                // Save to history
                APP_STATE.chatHistory.push({ role: 'user', content: message });
                APP_STATE.chatHistory.push({ role: 'tutor', content: response });
            }
        } catch (e) {
            console.error('Chat error:', e);
        }
    }

    if (!response) {
        response = generateFallbackChatResponse(message);
    }

    // Replace typing with response
    const typingEl = document.getElementById(typingId);
    if (typingEl) {
        typingEl.innerHTML = `
      <div class="chat-avatar">🧬</div>
      <div class="chat-bubble">${formatMarkdown(response)}</div>
    `;
    }
    container.scrollTop = container.scrollHeight;

    // Log activity
    user.activity.push({
        type: 'chat',
        text: `Asked AI: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
        date: new Date().toISOString()
    });
    saveCurrentUser();
    addXP(2, 'Curiosity');
}

function changeTutorPersonality(personality) {
    APP_STATE.tutorPersonality = personality;
    showToast(`AI Tutor is now in ${personality.charAt(0).toUpperCase() + personality.slice(1)} mode!`, '🎭');

    // Clear history to avoid mixing vibes too much
    APP_STATE.chatHistory = [];

    // Smooth scroll to chat if not fully visible
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function generateFallbackChatResponse(question) {
    const q = question.toLowerCase();
    if (q.includes('dna') || q.includes('gene')) {
        return "Great question about genetics! 🧬 DNA (Deoxyribonucleic Acid) is the molecule that carries genetic instructions. It has a double-helix structure with base pairs (Adenine-Thymine, Guanine-Cytosine). Learning about DNA is fundamental to modern biotechnology!";
    } else if (q.includes('pcr') || q.includes('polymerase')) {
        return "PCR (Polymerase Chain Reaction) is a powerful technique! 🔥 It amplifies specific DNA segments through cycles of denaturation, annealing, and extension. After 30 cycles, you get about a billion copies for analysis.";
    } else if (q.includes('crispr') || q.includes('gene edit')) {
        return "CRISPR-Cas9 is revolutionary! ✂️ It's a gene-editing tool that uses a guide RNA to direct the Cas9 enzyme to a specific DNA location for precise editing. It's used in medicine, agriculture, and research worldwide.";
    } else if (q.includes('enzyme') || q.includes('protein')) {
        return "Enzymes are biological catalysts! ⚙️ They speed up biochemical reactions by lowering activation energy. Each enzyme has an active site that fits specific substrates, crucial for industrial biotech processes.";
    } else if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
        return "Hello! 👋 I'm your BioQuorix AI Tutor. I'm here to help you with biotechnology questions. Ask me about DNA, genetics, CRISPR, enzymes, or any biotech topic. What would you like to learn today?";
    }
    return "That's a great question! 🤔 Biotechnology involves many fascinating topics. Try exploring the **Learn** section for more details, or take a **Quiz** to test your current understanding. I'm here to help you master these concepts!";
}

// ===== LEARNING PATH =====
function renderLearningPath() {
    const user = APP_STATE.currentUser;
    if (!user) return;
    const topics = BIOTECH_TOPICS[user.level] || [];
    const timeline = document.getElementById('learningPathTimeline');

    timeline.innerHTML = topics.map((t, index) => {
        const isComplete = user.completedTopics?.includes(t.id);
        const score = user.quizScores?.[t.id];
        const isCurrent = !isComplete && (index === 0 || user.completedTopics?.includes(topics[index - 1]?.id));
        const isLocked = !isComplete && !isCurrent;
        const status = isComplete ? 'completed' : isCurrent ? 'current' : 'locked';

        return `
      <div class="path-item ${status}">
        <div class="glass-card path-card" style="${isLocked ? 'opacity:0.5;' : ''}">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <h4>${t.icon} ${t.name}</h4>
            ${isComplete ? '<span class="badge green">✓ Complete</span>' :
                isCurrent ? '<span class="badge amber">→ Current</span>' :
                    '<span class="badge" style="opacity:0.5;">🔒 Locked</span>'}
          </div>
          <div class="path-meta">
            <span>Difficulty: ${t.difficulty}</span>
            ${score !== undefined ? `<span>Score: ${score}%</span>` : ''}
          </div>
          <p style="font-size:0.85rem;">${t.description}</p>
          ${isCurrent ? `<button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="openModule('${t.id}'); showDashboardSection('learn');">Start Learning →</button>` : ''}
          ${isComplete && score < 70 ? `<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="startQuiz('${t.id}'); showDashboardSection('quiz');">Retake Quiz ↻</button>` : ''}
        </div>
      </div>
    `;
    }).join('');
}

// ===== ANALYTICS =====
function renderAnalytics() {
    const user = APP_STATE.currentUser;
    if (!user) return;

    // Destroy existing charts to prevent canvas reuse issues
    Chart.helpers?.each(Chart.instances, (instance) => instance.destroy());

    const quizHistory = user.quizHistory || [];
    const quizScores = user.quizScores || {};

    // 1. Quiz Scores Over Time
    const ctx1 = document.getElementById('chartScores');
    if (ctx1) {
        new Chart(ctx1, {
            type: 'line',
            data: {
                labels: quizHistory.slice(-10).map((_, i) => `Quiz ${i + 1}`),
                datasets: [{
                    label: 'Score %',
                    data: quizHistory.slice(-10).map(q => q.score),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    y: { min: 0, max: 100, ticks: { color: '#64748b' }, grid: { color: 'rgba(55,65,81,0.3)' } },
                    x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(55,65,81,0.3)' } }
                }
            }
        });
    }

    // 2. Topic Proficiency (Radar)
    const topics = BIOTECH_TOPICS[user.level] || [];
    const topicLabels = topics.filter(t => quizScores[t.id] !== undefined).map(t => t.name.substring(0, 15));
    const topicScoreValues = topics.filter(t => quizScores[t.id] !== undefined).map(t => quizScores[t.id]);

    const ctx2 = document.getElementById('chartTopics');
    if (ctx2 && topicLabels.length >= 3) {
        new Chart(ctx2, {
            type: 'radar',
            data: {
                labels: topicLabels,
                datasets: [{
                    label: 'Proficiency %',
                    data: topicScoreValues,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.15)',
                    pointBackgroundColor: '#8b5cf6'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    r: {
                        min: 0, max: 100,
                        ticks: { color: '#64748b', backdropColor: 'transparent' },
                        grid: { color: 'rgba(55,65,81,0.3)' },
                        pointLabels: { color: '#94a3b8', font: { size: 10 } }
                    }
                }
            }
        });
    } else if (ctx2) {
        ctx2.parentElement.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Take quizzes on at least 3 topics to see the proficiency radar chart.</p></div>';
    }

    // 3. Time distribution (bar)
    const ctx3 = document.getElementById('chartTime');
    if (ctx3) {
        const timeLabels = topics.slice(0, 6).map(t => t.name.substring(0, 12));
        const timeData = topics.slice(0, 6).map(t => {
            const attempts = quizHistory.filter(q => q.topicId === t.id).length;
            return attempts * 5 + (user.completedTopics?.includes(t.id) ? 10 : 0);
        });

        new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: 'Est. Minutes',
                    data: timeData,
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.6)',
                        'rgba(139, 92, 246, 0.6)',
                        'rgba(20, 184, 166, 0.6)',
                        'rgba(245, 158, 11, 0.6)',
                        'rgba(59, 130, 246, 0.6)',
                        'rgba(239, 68, 68, 0.6)'
                    ],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                    y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(55,65,81,0.3)' } },
                    x: { ticks: { color: '#64748b', maxRotation: 45 }, grid: { display: false } }
                }
            }
        });
    }

    // 4. Difficulty distribution (doughnut)
    const ctx4 = document.getElementById('chartDifficulty');
    if (ctx4) {
        const beginner = quizHistory.filter(q => q.score >= 80).length;
        const intermediate = quizHistory.filter(q => q.score >= 50 && q.score < 80).length;
        const advanced = quizHistory.filter(q => q.score < 50).length;

        new Chart(ctx4, {
            type: 'doughnut',
            data: {
                labels: ['Easy (80%+)', 'Medium (50-79%)', 'Hard (<50%)'],
                datasets: [{
                    data: [beginner || 1, intermediate || 1, advanced || 1],
                    backgroundColor: ['rgba(34,197,94,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)'],
                    borderColor: 'transparent',
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#94a3b8' }, position: 'bottom' } }
            }
        });
    }

    // Strengths & Weaknesses
    const strengths = document.getElementById('strengthsList');
    const weaknesses = document.getElementById('weaknessesList');

    const strongTopics = Object.entries(quizScores).filter(([_, s]) => s >= 70).sort((a, b) => b[1] - a[1]);
    const weakTopics = Object.entries(quizScores).filter(([_, s]) => s < 70).sort((a, b) => a[1] - b[1]);

    if (strengths) {
        strengths.innerHTML = strongTopics.length ? strongTopics.map(([id, score]) => {
            const t = topics.find(tp => tp.id === id);
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);">
        <span>${t?.icon || '📚'} ${t?.name || id}</span>
        <span class="badge green">${score}%</span>
      </div>`;
        }).join('') : '<p style="color:var(--text-muted);">Complete quizzes to see strengths!</p>';
    }

    if (weaknesses) {
        weaknesses.innerHTML = weakTopics.length ? weakTopics.map(([id, score]) => {
            const t = topics.find(tp => tp.id === id);
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);">
        <span>${t?.icon || '📚'} ${t?.name || id}</span>
        <span class="badge amber">${score}%</span>
      </div>`;
        }).join('') : '<p style="color:var(--text-muted);">No weak areas found — great job!</p>';
    }
}

// ===== DYNAMIC CURRICULUM =====
async function generateDynamicCurriculum() {
    const input = document.getElementById('dynamicTopicInput');
    const button = input.nextElementSibling; // Get the Generate button
    const topicText = input.value.trim();
    if (!topicText) return;

    // UI Loading state
    input.value = '';
    input.placeholder = 'Generating custom curriculum...';
    input.disabled = true;
    if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:8px;"></span> Generating...';
    }

    try {
        const user = APP_STATE.currentUser;
        const prompt = PROMPT_TEMPLATES.generateCurriculum(topicText, user.level);
        const response = await callAI(prompt);

        if (response && !response.includes('**AI Connection Error')) {
            let jsonString = '';

            // Extremely robust JSON extraction
            try {
                // Try to find an array block
                const jsonMatch = response.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    jsonString = jsonMatch[0];
                } else {
                    // Fallback cleanup
                    jsonString = response.replace(/```json/g, '').replace(/```/g, '').trim();
                }

                const newModules = JSON.parse(jsonString);

                if (!Array.isArray(newModules) || newModules.length === 0) {
                    throw new Error("AI did not return an array of modules");
                }

                if (!BIOTECH_TOPICS[user.level]) BIOTECH_TOPICS[user.level] = [];

                newModules.forEach((mod, idx) => {
                    mod.id = 'dynamic-' + Date.now() + '-' + idx;
                    BIOTECH_TOPICS[user.level].unshift(mod);
                });

                showToast(`Course on "${topicText}" generated!`, '✨');
                showDashboardSection('learn');
                populateModuleTopics();
            } catch (parseError) {
                console.error("Failed to parse curriculum JSON:", parseError, "\nRaw AI Response:", response);
                showToast(`AI generated an invalid format. Please try again.`, '⚠️');
            }
        } else {
            showToast('Failed to connect to local AI.', '❌');
        }
    } catch (e) {
        console.error("Curriculum generation error:", e);
        showToast('Error generating curriculum. Is Ollama running?', '❌');
    } finally {
        // Restore UI state
        input.disabled = false;
        input.placeholder = 'What do you want to learn today?';
        if (button) {
            button.disabled = false;
            button.innerHTML = 'Generate Course';
        }
    }
}

// ===== FLASHCARDS =====
function renderFlashcardDecks() {
    const grid = document.getElementById('flashcardDeckGrid');
    const user = APP_STATE.currentUser;
    if (!user || !user.flashcardDecks) user.flashcardDecks = {};

    const decks = Object.keys(user.flashcardDecks);

    if (decks.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p>No flashcards yet. Generate them after completing a lesson!</p></div>';
        return;
    }

    grid.innerHTML = decks.map(topicId => {
        const topic = BIOTECH_TOPICS[user.level]?.find(t => t.id === topicId) || { name: topicId, icon: '📇' };
        const deck = user.flashcardDecks[topicId];
        return `
      <div class="glass-card" style="cursor:pointer; display:flex; flex-direction:column; align-items:center; text-align:center;" onclick="openFlashcardDeck('${topicId}')">
        <div style="font-size:2.5rem; margin-bottom:12px;">${topic.icon}</div>
        <h4>${topic.name}</h4>
        <p style="color:var(--text-muted); font-size:0.85rem;">${deck.length} cards</p>
      </div>
    `;
    }).join('');
}

async function generateFlashcards() {
    const user = APP_STATE.currentUser;
    const topicId = APP_STATE.currentModuleTopic?.id;

    if (!topicId || !APP_STATE.lastLessonText) {
        showToast('Please read a lesson first.', '⚠️');
        return;
    }

    const btn = document.querySelector('button[onclick="generateFlashcards()"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:8px;"></div>Generating...';
    }

    let cards = null;

    if (APP_STATE.ollamaModel) {
        showToast('Generating smart flashcards...', '⚙️');
        try {
            const prompt = PROMPT_TEMPLATES.generateFlashcardsDecks(APP_STATE.lastLessonText);
            const response = await callAI(prompt);
            if (response && !response.includes('**AI Connection Error')) {
                // Better JSON extraction to handle Ollama conversational wrappers
                const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
                const jsonString = jsonMatch ? jsonMatch[0] : response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

                const parsed = JSON.parse(jsonString);
                if (Array.isArray(parsed)) {
                    cards = parsed;
                } else {
                    throw new Error("Parsed JSON is not an array");
                }
            } else {
                showToast('API issue, using standard deck.', '⚠️');
            }
        } catch (e) {
            console.error('Flashcard error', e);
            showToast('AI failed, using standard deck.', '⚠️');
        }
    } else {
        showToast('No API key attached, using standard deck.', '⚠️');
    }

    // Fallback if AI generation failed or wasn't attempted
    if (!cards) {
        cards = [
            { front: "What is the primary function of DNA?", back: "To store and transmit genetic information using a 4-letter code." },
            { front: "What does mRNA stand for?", back: "Messenger Ribonucleic Acid" },
            { front: "What is the process of copying DNA into RNA called?", back: "Transcription, occurring in the nucleus." },
            { front: "Where does translation (protein synthesis) occur?", back: "At the ribosome in the cytoplasm." },
            { front: "What are the building blocks of proteins?", back: "Amino acids linked by peptide bonds." },
            { front: "Which organelle is the 'powerhouse' of the cell?", back: "Mitochondria, via ATP production." },
            { front: "What is the semi-permeable boundary of a cell?", back: "The Cell Membrane (Plasma Membrane)." },
            { front: "What is the central dogma of molecular biology?", back: "DNA -> RNA -> Protein." },
            { front: "What base replaces Thymine (T) in RNA?", back: "Uracil (U)." },
            { front: "Which enzyme unwinds the DNA double helix?", back: "Helicase." },
            { front: "How many hydrogen bonds form between A and T?", back: "Two." },
            { front: "What is an exon in eukaryotic genes?", back: "A coding region that remains in the mature mRNA." }
        ];
    }

    // Add SRS tracking data
    const srsCards = cards.map(c => ({
        ...c,
        interval: 0,
        repetition: 0,
        efactor: 2.5,
        nextReviewDate: Date.now()
    }));

    user.flashcardDecks[topicId] = srsCards;
    saveCurrentUser();
    showToast('Flashcards generated!', '✅');

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Generate Flashcards 📇';
    }

    showDashboardSection('flashcards');
}

function openFlashcardDeck(topicId) {
    const user = APP_STATE.currentUser;
    const deck = user.flashcardDecks[topicId];
    if (!deck || deck.length === 0) return;

    // Filter cards strictly to what is due for review
    const now = Date.now();
    const dueCards = deck.filter(c => !c.nextReviewDate || c.nextReviewDate <= now);

    APP_STATE.flashcardState.currentDeck = dueCards;
    APP_STATE.flashcardState.currentIndex = 0;
    APP_STATE.flashcardState.isFlipped = false;
    APP_STATE.flashcardState.originalDeckId = topicId;
    APP_STATE.flashcardState.totalCards = dueCards.length;

    document.getElementById('flashcardsSelectionArea').classList.add('hidden');
    document.getElementById('flashcardsPlayArea').classList.remove('hidden');

    updateFlashcardUI();
}

function updateFlashcardUI() {
    const state = APP_STATE.flashcardState;
    const cardEl = document.getElementById('activeFlashcard');
    const controls = document.getElementById('flashcardControls');
    const counter = document.getElementById('flashcardCounter');
    const progressFill = document.getElementById('deckProgressFill');
    const progressText = document.getElementById('deckProgressText');

    if (!state.currentDeck || state.currentIndex >= state.currentDeck.length) {
        // All caught up
        if (cardEl) cardEl.classList.remove('flipped');

        // Hide the "Click to flip" instruction
        const hint = document.getElementById('flashcardHint');
        if (hint) hint.classList.add('hidden');

        document.getElementById('flashcardFrontText').innerHTML = `
            <div style="font-size:3.5rem; margin-bottom:16px;">🎊</div>
            <h3 style="margin-bottom:12px; font-size:1.8rem; color:var(--success);">All Caught Up!</h3>
            <p style="font-size:1rem; color:var(--text-secondary); margin-bottom:24px; max-width:280px; margin-left:auto; margin-right:auto;">
                Excellent work! You've mastered these concepts for now.
            </p>
            <button class="btn btn-primary" onclick="resetFlashcardDeck(event)" 
                style="padding:12px 24px; border-radius:14px; font-weight:800; font-size:1.1rem; box-shadow:0 0 20px rgba(16,185,129,0.3); border:none; cursor:pointer;">
                ✨ Reset Deck (10 Credits)
            </button>
        `;
        document.getElementById('flashcardBackText').innerHTML = 'Keep pushing your limits! 🧬';
        controls.classList.add('hidden');
        counter.innerText = '0 cards remaining';

        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.innerText = `${state.totalCards}/${state.totalCards}`;

        if (state.totalCards > 0 && !state.celebrated) {
            triggerConfetti();
            state.celebrated = true;
        }
        return;
    }

    state.celebrated = false;
    controls.classList.remove('hidden');

    // Show the "Click to flip" instruction again
    const hint = document.getElementById('flashcardHint');
    if (hint) hint.classList.remove('hidden');

    const card = state.currentDeck[state.currentIndex];

    document.getElementById('flashcardFrontText').innerHTML = escapeHtml(card.front);
    document.getElementById('flashcardBackText').innerHTML = escapeHtml(card.back);

    const remaining = state.currentDeck.length - state.currentIndex;
    counter.innerText = `${remaining} due today`;

    const currentTotal = state.totalCards || 1;
    const progress = (state.currentIndex / currentTotal) * 100;
    if (progressFill) progressFill.style.width = progress + '%';
    if (progressText) progressText.innerText = `${state.currentIndex}/${currentTotal}`;

    if (state.isFlipped) {
        cardEl.classList.add('flipped');
    } else {
        cardEl.classList.remove('flipped');
    }
}

function flipFlashcard() {
    if (!APP_STATE.flashcardState.currentDeck || APP_STATE.flashcardState.currentIndex >= APP_STATE.flashcardState.currentDeck.length) return;
    APP_STATE.flashcardState.isFlipped = !APP_STATE.flashcardState.isFlipped;
    updateFlashcardUI();
}

function resetFlashcardDeck(event) {
    if (event) event.stopPropagation();

    const user = APP_STATE.currentUser;
    // Fallback to originalDeckId if currentModuleTopic is lost
    const topicId = APP_STATE.flashcardState.originalDeckId || APP_STATE.currentModuleTopic?.id;
    const topicName = APP_STATE.currentModuleTopic?.name || "this topic";

    if (!user || !topicId) {
        showToast('System error: Topic not found.', '❌');
        return;
    }

    const cost = 10;
    if (user.xp < cost) {
        showToast(`Need ${cost} credits. You have ${user.xp}.`, '⚠️');
        return;
    }

    if (spendCredits(cost, `Study Boost: Reset ${topicName} deck`)) {
        // Reset state for this topic
        APP_STATE.flashcardState.currentIndex = 0;
        APP_STATE.flashcardState.isFlipped = false;

        // Reset SRS intervals for this session to allow immediate re-study
        const deck = user.flashcardDecks[topicId];
        if (deck) {
            const now = Date.now();
            deck.forEach(card => {
                card.nextReviewDate = now - 1000;
            });
            // Re-populate active deck
            APP_STATE.flashcardState.currentDeck = [...deck];
            APP_STATE.flashcardState.totalCards = deck.length;
            APP_STATE.flashcardState.celebrated = false;
        }

        saveCurrentUser();
        showToast('Deck reset! Happy studying. 📇✨', '✅');
        updateFlashcardUI();
    }
}

function rateFlashcard(quality) {
    const state = APP_STATE.flashcardState;
    if (!state.currentDeck || state.currentIndex >= state.currentDeck.length) return;

    const card = state.currentDeck[state.currentIndex];
    const cardEl = document.getElementById('activeFlashcard');

    // Visual feedback
    if (quality === 1) {
        cardEl.classList.add('shake');
        setTimeout(() => cardEl.classList.remove('shake'), 500);
    } else if (quality === 3) {
        cardEl.classList.add('success-pulse');
        setTimeout(() => cardEl.classList.remove('success-pulse'), 400);
    }

    // SM-2 mapping
    let smQuality = 0;
    if (quality === 1) smQuality = 3; // Hard
    else if (quality === 2) smQuality = 4; // Good
    else if (quality === 3) smQuality = 5; // Easy

    if (smQuality < 3) {
        card.repetition = 0;
        card.interval = 1;
    } else {
        if (card.repetition === 0) {
            card.interval = 1;
        } else if (card.repetition === 1) {
            card.interval = 6;
        } else {
            card.interval = Math.round(card.interval * card.efactor);
        }
        card.repetition++;
    }

    card.efactor = card.efactor + (0.1 - (5 - smQuality) * (0.08 + (5 - smQuality) * 0.02));
    if (card.efactor < 1.3) card.efactor = 1.3;

    // Convert days to ms for interval
    card.nextReviewDate = Date.now() + card.interval * 24 * 60 * 60 * 1000;

    // Save
    saveCurrentUser();
    addXP(1, 'Flashcard Reviewed');

    // Proceed to next card with slight delay for animation
    setTimeout(() => {
        state.currentIndex++;
        state.isFlipped = false;
        updateFlashcardUI();
    }, 250);
}

function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#10b981', '#f43f5e']
        });
    }
}

function backToFlashcardDecks() {
    document.getElementById('flashcardsPlayArea').classList.add('hidden');
    document.getElementById('flashcardsSelectionArea').classList.remove('hidden');
    renderFlashcardDecks();
}

// ===== VOICE INTERACTION =====
let currentUtterance = null;
function speakText(text) {
    if (!('speechSynthesis' in window)) {
        showToast('Text-to-speech not supported in this browser.', '⚠️');
        return;
    }

    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel(); // Stop if already playing
    }

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = 1.0;
    currentUtterance.pitch = 1.0;

    // Try to find a good English voice
    const voices = window.speechSynthesis.getVoices();
    const goodVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Google') || v.name.includes('Samantha'));
    if (goodVoice) currentUtterance.voice = goodVoice;

    window.speechSynthesis.speak(currentUtterance);
}

// ===== EXPORT =====
function exportNotes() {
    if (!APP_STATE.lastLessonText || !APP_STATE.currentModuleTopic) {
        showToast('Read a lesson first to download it.', '⚠️');
        return;
    }
    const topic = APP_STATE.currentModuleTopic.name;
    const textData = APP_STATE.lastLessonText;

    // Create blob and trigger download
    const blob = new Blob([textData], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topic.replace(/\\s+/g, '_')}_Notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Notes downloaded! 📥');
}

// ===== PROFILE =====
function loadProfileData() {
    const user = APP_STATE.currentUser;
    if (!user) return;
    document.getElementById('profileName').value = user.name || '';
}

function saveProfile() {
    const user = APP_STATE.currentUser;
    const newName = document.getElementById('profileName').value.trim();
    if (!newName) {
        showToast('Please enter a valid name.', '⚠️');
        return;
    }
    user.name = newName;
    saveCurrentUser();
    updateDashboardData();
    showToast('Account renamed successfully! ✏️', '✅');
}

function deleteLocalAccount() {
    const user = APP_STATE.currentUser;
    if (!user) return;

    if (confirm(`⚠️ DANGER: Are you sure you want to delete the account "${user.name}"? This will permanently remove all progress and data from this device.`)) {
        const email = user.email;
        const users = JSON.parse(localStorage.getItem('bionexus_users') || '{}');
        delete users[email];
        localStorage.setItem('bionexus_users', JSON.stringify(users));

        showToast('Account deleted successfully.', '🗑️');
        handleLogout();
    }
}

function switchUser(email) {
    const users = JSON.parse(localStorage.getItem('bionexus_users') || '{}');
    if (users[email]) {
        APP_STATE.currentUser = users[email];
        localStorage.setItem('bionexus_current', email);

        // Reset state for new user
        APP_STATE.chatHistory = [];
        APP_STATE.lastLessonText = '';

        showToast(`Switched to ${users[email].name.split(' ')[0]}! 👋`, '👥');

        if (!users[email].setupComplete) {
            navigateTo('setup');
        } else {
            navigateTo('dashboard');
            updateDashboardData();
        }
    }
}

// ===== OLLAMA API =====
async function callAI(prompt) {
    const model = 'llama3'; // Hardcoded as per user preference
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: false
            })
        });

        if (!response.ok) throw new Error('Ollama connection failed');
        const data = await response.json();
        return data.response;
    } catch (err) {
        console.error('AI Error:', err);
        return `**AI Connection Error:** I couldn't connect to Ollama. 
        
Please ensure:
1. **Ollama** is running on your machine.
2. The **llama3** model is installed (run \`ollama run llama3\` in your terminal).
3. The server is accessible at \`http://localhost:11434\`.

*Error Details: ${err.message}*`;
    }
}

// ===== UTILITIES =====
function formatMarkdown(text) {
    if (typeof marked !== 'undefined') {
        try {
            return marked.parse(text);
        } catch (e) {
            // Fallback: basic replacements
        }
    }
    // Basic markdown formatting
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, icon = '✅') {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = message;
    document.getElementById('toastIcon').textContent = icon;
    toast.style.display = 'block';
    toast.style.animation = 'slideUp 0.3s ease';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return date.toLocaleDateString();
}

function addXP(amount, reason) {
    if (!APP_STATE.currentUser) return;
    APP_STATE.currentUser.xp = (APP_STATE.currentUser.xp || 0) + amount;

    APP_STATE.currentUser.activity.push({
        type: 'system',
        text: `Earned ${amount} XP: ${reason}`,
        date: new Date().toISOString()
    });

    saveCurrentUser();

    // Update UI if visible
    if (document.getElementById('sidebarXp')) {
        document.getElementById('sidebarXp').textContent = `✨ ${APP_STATE.currentUser.xp} XP`;
    }

    const navDot = document.getElementById('navNotificationDot');
    if (navDot) navDot.style.display = 'block';

    if (amount > 20) {
        if (typeof confetti === 'function') {
            const duration = 2.5 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

            function randomInRange(min, max) { return Math.random() * (max - min) + min; }

            const interval = setInterval(function () {
                const timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) return clearInterval(interval);
                const particleCount = 50 * (timeLeft / duration);

                // Shoot from both sides
                confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
            }, 250);
        }
        showToast(`Incredible! +${amount} XP: ${reason} 🎉`, '🌟');
    } else {
        showToast(`+${amount} XP: ${reason}`, '✨');
    }
}

function spendCredits(amount, reason) {
    const user = APP_STATE.currentUser;
    if (!user) return false;

    if (user.xp < amount) {
        showToast(`Insufficient credits. You need ${amount} XP.`, '⚠️');
        return false;
    }

    user.xp -= amount;
    user.activity.push({
        type: 'system',
        text: `Spent ${amount} Credits: ${reason}`,
        date: new Date().toISOString()
    });

    saveCurrentUser();

    // Update UI
    if (document.getElementById('sidebarXp')) {
        document.getElementById('sidebarXp').textContent = `✨ ${user.xp} XP`;
    }
    const navXpBtn = document.querySelector('button[onclick="toggleProfileMenu(event)"]');
    if (navXpBtn) {
        navXpBtn.innerHTML = `👤 ${user.name.split(' ')[0].toLowerCase()} ✨ ${user.xp} XP`;
    }

    const navDot = document.getElementById('navNotificationDot');
    if (navDot) navDot.style.display = 'block';

    showToast(`Spent ${amount} Credits: ${reason}`, '⚖️');
    return true;
}

// ===== CREDIT HISTORY =====
function renderCreditHistory() {
    const list = document.getElementById('creditHistoryList');
    const user = APP_STATE.currentUser;
    if (!list || !user) return;

    if (!user.activity || user.activity.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="padding:48px;">
                <div class="empty-icon">🌟</div>
                <h4>No XP earned yet</h4>
                <p>Start learning to build your credit history!</p>
            </div>
        `;
        return;
    }

    const allActivities = [...user.activity].reverse();

    list.innerHTML = allActivities.map(a => {
        let isXp = a.type === 'system';
        let icon = '💬';
        if (a.type === 'lesson') icon = '📖';
        if (a.type === 'quiz') icon = '📝';
        if (a.type === 'system') icon = '🌟';

        // Determine or extract XP
        let xpAmountHtml = '';
        if (isXp) {
            const match = a.text ? a.text.match(/Earned (\d+) XP/) : null;
            if (match) {
                xpAmountHtml = `<div style="font-weight:700; color:var(--primary-400); font-size:1.1rem; background:rgba(99,102,241,0.1); padding:4px 12px; border-radius:12px;">+${match[1]} XP</div>`;
                a.text = a.text.replace(/Earned \d+ XP: /, '').trim(); // Clean up title
            } else {
                xpAmountHtml = `<div style="font-weight:700; color:var(--primary-400); font-size:1.1rem; background:rgba(99,102,241,0.1); padding:4px 12px; border-radius:12px;">+10 XP</div>`;
            }
        } else {
            // Assign retroactive XP UI for older activities
            let xpVal = 10;
            if (a.type === 'lesson') xpVal = 20;
            if (a.type === 'quiz') xpVal = 50;
            xpAmountHtml = `<div style="font-weight:700; color:var(--primary-400); font-size:1.1rem; background:rgba(99,102,241,0.1); padding:4px 12px; border-radius:12px;">+${xpVal} XP</div>`;
        }

        return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="width:40px; height:40px; border-radius:12px; background:rgba(99,102,241,0.15); display:flex; align-items:center; justify-content:center; font-size:1.2rem;">${icon}</div>
          <div>
            <div style="font-size:1rem; font-weight:500; color:var(--text-primary); margin-bottom:4px;">${escapeHtml(a.text || (!isXp ? `Completed ${a.type}` : 'System points'))}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(a.date).toLocaleString()}</div>
          </div>
        </div>
        ${xpAmountHtml}
      </div>
    `}).join('');
}

// ===== LEADERBOARD =====
function renderLeaderboard() {
    const container = document.getElementById('leaderboardContainer');
    if (!container) return;

    const usersDict = JSON.parse(localStorage.getItem('bionexus_users') || '{}');
    const currentUser = APP_STATE.currentUser;

    // Map all local users to leaderboard format
    const leaderboardUsers = Object.values(usersDict).map(user => ({
        name: user.name || 'Anonymous',
        xp: user.xp || 0,
        avatar: (user.name || 'A').charAt(0).toUpperCase(),
        level: user.level === 'university' ? 'University Level' : 'School Level',
        email: user.email,
        isCurrentUser: currentUser && user.email === currentUser.email
    }));

    // Sort by XP
    leaderboardUsers.sort((a, b) => b.xp - a.xp);

    let html = '';
    leaderboardUsers.forEach((user, index) => {
        let rankIcon = `#${index + 1}`;
        if (index === 0) rankIcon = '🥇';
        if (index === 1) rankIcon = '🥈';
        if (index === 2) rankIcon = '🥉';

        const isMe = user.isCurrentUser;

        html += `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:16px; background:${isMe ? 'rgba(16,185,129,0.1)' : 'var(--bg-card)'}; border:1px solid ${isMe ? 'var(--primary-500)' : 'var(--border-color)'}; border-radius:var(--radius-md);">
            <div style="display:flex; align-items:center; gap:16px;">
                <div style="font-size:1.5rem; font-weight:800; width:40px; text-align:center; color:${isMe ? 'var(--primary-400)' : 'var(--text-muted)'};">${rankIcon}</div>
                <div style="width:40px; height:40px; border-radius:50%; background:${isMe ? 'var(--gradient-primary)' : 'var(--bg-input)'}; display:flex; align-items:center; justify-content:center; font-weight:bold; color:${isMe ? '#fff' : 'var(--text-secondary)'};">${user.avatar}</div>
                <div>
                    <div style="font-weight:600; color:${isMe ? 'var(--text-primary)' : 'var(--text-secondary)'};">${user.name} ${isMe ? '(You)' : ''}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${user.level}</div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:16px;">
                <div style="font-weight:800; font-size:1.1rem; color:var(--primary-400);">✨ ${user.xp} XP</div>
                ${!isMe ? `<button class="btn btn-ghost btn-sm" onclick="switchUser('${user.email}')" style="padding:4px 12px; font-size:0.75rem; border:1px solid var(--border-color);">Switch</button>` : ''}
            </div>
        </div>
        `;
    });

    if (leaderboardUsers.length === 0) {
        html = `
        <div style="padding:40px; text-align:center; color:var(--text-muted);">
            <div style="font-size:3rem; margin-bottom:16px;">🏆</div>
            <h4>No students yet</h4>
            <p>Register and earn XP to appear on the leaderboard!</p>
        </div>
        `;
    }

    container.innerHTML = html;
}

// ===== ANIMATIONS & INTERACTIONS =====
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                // Optional: Stop observing after it animates once
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.scroll-reveal');
    revealElements.forEach(el => observer.observe(el));
}

// ===== THEME MANAGEMENT =====
function toggleTheme() {
    APP_STATE.theme = APP_STATE.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('bionexus_theme', APP_STATE.theme);
    applyTheme(APP_STATE.theme);
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
}

function clearChatHistory() {
    if (confirm('Are you sure you want to clear your AI chat history? This will delete all your conversations with the BioQuorix Tutor for this session.')) {
        APP_STATE.chatHistory = [];
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="chat-message ai">
                    <div class="chat-avatar">🌿</div>
                    <div class="chat-bubble">History cleared! 👋 How can I help you with biotechnology today?</div>
                </div>
            `;
        }
        showToast('Chat history cleared! 🧹', '✨');
    }
}

function exportUserData() {
    const user = APP_STATE.currentUser;
    if (!user) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(user, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `bionexus_${user.name.split(' ')[0].toLowerCase()}_data.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    showToast('Data exported successfully! 📤', '📦');
}

function showAddUserModal() {
    document.getElementById('addUserModal').classList.remove('hidden');
}

function hideAddUserModal() {
    document.getElementById('addUserModal').classList.add('hidden');
    // Clear inputs
    document.getElementById('quickName').value = '';
    document.getElementById('quickEmail').value = '';
    document.getElementById('quickPassword').value = '';
}

function handleQuickSignup(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('quickName').value.trim();
    const email = document.getElementById('quickEmail').value.trim();
    const password = document.getElementById('quickPassword').value;

    if (!name || !email || !password) {
        showToast('Please fill out all fields.', '⚠️');
        return;
    }

    if (!email.includes('@') || !email.includes('.')) {
        showToast('Please enter a valid email address.', '⚠️');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters.', '⚠️');
        return;
    }

    const users = JSON.parse(localStorage.getItem('bionexus_users') || '{}');
    if (users[email]) {
        showToast('Account already exists for this email.', '⚠️');
        return;
    }

    const newUser = {
        name,
        email,
        password,
        level: null,
        interests: [],
        completedTopics: [],
        quizScores: {},
        quizHistory: [],
        weakAreas: [],
        streak: 0,
        xp: 0,
        lastActive: new Date().toISOString(),
        setupComplete: false,
        createdAt: new Date().toISOString(),
        activity: []
    };

    users[email] = newUser;
    localStorage.setItem('bionexus_users', JSON.stringify(users));

    // Switch to new user immediately
    hideAddUserModal();
    switchUser(email);

    showToast('New student added! Welcome to the lab. 🎉', '✅');
}
