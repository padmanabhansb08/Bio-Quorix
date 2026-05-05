/* ============================================
   Quorix AI - Main Application Logic
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
    lastLessonText: '',
    studyContext: {
        subject: localStorage.getItem('selectedSubject') || 'All Topics',
        topic: localStorage.getItem('selectedTopic') || 'General',
        difficulty: localStorage.getItem('selectedDifficulty') || 'Intermediate'
    }
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    // Apply saved theme
    applyTheme(APP_STATE.theme);
    initStudySelection();

    await loadUserFromStorage();
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
        restoreSidebarState();
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

const API_BASE = window.location.origin; // Since we serve static files from the same server
let AUTH_TOKEN = localStorage.getItem('bionexus_token');

// ===== STUDY CONTEXT =====
function getSelectedStudyContext() {
    const context = {
        subject: localStorage.getItem('selectedSubject') || APP_STATE.studyContext?.subject || 'All Topics',
        topic: localStorage.getItem('selectedTopic') || APP_STATE.studyContext?.topic || 'General',
        difficulty: localStorage.getItem('selectedDifficulty') || APP_STATE.studyContext?.difficulty || 'Intermediate'
    };
    APP_STATE.studyContext = context;
    return context;
}

function initStudySelection() {
    const context = getSelectedStudyContext();
    localStorage.setItem('selectedSubject', context.subject);
    localStorage.setItem('selectedTopic', context.topic);
    localStorage.setItem('selectedDifficulty', context.difficulty);
}

function renderSubjectSelector() {
    const subjectSelect = document.getElementById('selectedSubjectInput');
    const topicInput = document.getElementById('selectedTopicInput');
    const difficultySelect = document.getElementById('selectedDifficultyInput');
    if (!subjectSelect || !topicInput || !difficultySelect) return;

    const context = getSelectedStudyContext();
    subjectSelect.innerHTML = SUPPORTED_SUBJECTS.map(subject =>
        `<option value="${subject}" ${subject === context.subject ? 'selected' : ''}>${subject}</option>`
    ).join('');
    topicInput.value = context.topic;
    difficultySelect.value = context.difficulty;
    updateStudyContextSummary();
}

function saveStudySelection() {
    const subject = document.getElementById('selectedSubjectInput')?.value || 'All Topics';
    const topic = document.getElementById('selectedTopicInput')?.value.trim() || 'General';
    const difficulty = document.getElementById('selectedDifficultyInput')?.value || 'Intermediate';

    APP_STATE.studyContext = { subject, topic, difficulty };
    localStorage.setItem('selectedSubject', subject);
    localStorage.setItem('selectedTopic', topic);
    localStorage.setItem('selectedDifficulty', difficulty);

    APP_STATE.currentModuleTopic = null;
    APP_STATE.lastLessonText = '';
    updateStudyContextSummary();
    updateDashboardData();
    showToast(`Study focus saved: ${subject} / ${topic} / ${difficulty}`, '✅');
}

function updateStudyContextSummary() {
    const context = getSelectedStudyContext();
    const summary = document.getElementById('studyContextSummary');
    if (summary) summary.textContent = `${context.subject} • ${context.topic} • ${context.difficulty}`;

    ['currentSubjectLabel', 'currentTopicLabel', 'currentDifficultyLabel'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id.includes('Subject')) el.textContent = context.subject;
        if (id.includes('Topic')) el.textContent = context.topic;
        if (id.includes('Difficulty')) el.textContent = context.difficulty;
    });
}

function slugifyTopic(text) {
    return (text || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general';
}

function getTopicsForCurrentSelection() {
    const user = APP_STATE.currentUser || {};
    const context = getSelectedStudyContext();
    if (context.subject === 'All Topics') {
        const biologyTopics = typeof BIOTECH_TOPICS !== 'undefined' ? (BIOTECH_TOPICS[user.level] || BIOTECH_TOPICS.school || []) : [];
        const allTopics = typeof MIXED_INTEREST_TOPICS !== 'undefined' ? [...MIXED_INTEREST_TOPICS, ...biologyTopics] : biologyTopics;
        
        let topicsToReturn = allTopics;
        const userInterests = user.interests || [];
        if (userInterests.length > 0) {
            topicsToReturn = allTopics.filter(t => userInterests.includes(t.id));
        }
        
        if (context.topic && context.topic !== 'General') {
            const matched = allTopics.find(t => t.name.toLowerCase() === context.topic.toLowerCase() || t.id === slugifyTopic(context.topic));
            if (matched) return [matched, ...topicsToReturn.filter(t => t.id !== matched.id)];
        }
        return topicsToReturn;
    }

    const topicName = context.topic || 'General';
    return [
        {
            id: `custom-${slugifyTopic(context.subject)}-${slugifyTopic(topicName)}`,
            name: topicName,
            icon: '📘',
            description: `${context.difficulty} ${context.subject} study module focused on ${topicName}.`,
            difficulty: context.difficulty.toLowerCase(),
            prereqs: [],
            order: 1
        },
        {
            id: `custom-${slugifyTopic(context.subject)}-foundations`,
            name: `${context.subject} Foundations`,
            icon: '🧭',
            description: `Core ideas and prerequisite concepts for ${context.subject}.`,
            difficulty: 'beginner',
            prereqs: [],
            order: 2
        }
    ];
}

function findCurrentTopic(topicId) {
    return getTopicsForCurrentSelection().find(t => t.id === topicId);
}

// ===== AUTH =====
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            AUTH_TOKEN = data.token;
            localStorage.setItem('bionexus_token', AUTH_TOKEN);
            APP_STATE.currentUser = data.user;

            showToast('Welcome back! 👋', '✅');

            if (!APP_STATE.currentUser.setupComplete) {
                navigateTo('setup');
            } else {
                await loadUserFullProfile();
                navigateTo('dashboard');
            }
        } else {
            showToast(data.error || 'Login failed', '❌');
        }
    } catch (err) {
        showToast('Server error. Is the backend running?', '❌');
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

async function handleSignup(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (!name || !email || !password) {
        showToast('Please fill out all fields.', '⚠️');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await response.json();
        if (response.ok) {
            showToast('Account created! Logging you in...', '✅');
            document.getElementById('loginEmail').value = email;
            document.getElementById('loginPassword').value = password;
            await handleLogin({ preventDefault: () => { } });
        } else {
            showToast(data.error || 'Signup failed', '❌');
        }
    } catch (err) {
        showToast('Server error during signup.', '❌');
    }
}

function handleLogout() {
    APP_STATE.currentUser = null;
    AUTH_TOKEN = null;
    localStorage.removeItem('bionexus_token');
    navigateTo('landing');
    showToast('Logged out successfully', '👋');
}

async function loadUserFromStorage() {
    if (AUTH_TOKEN) {
        await loadUserFullProfile();
    }
}

async function loadUserFullProfile() {
    if (!AUTH_TOKEN) return;
    try {
        const response = await fetch(`${API_BASE}/api/user/profile`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
        });
        if (response.ok) {
            const data = await response.json();
            APP_STATE.currentUser = {
                ...data,
                setupComplete: !!data.setup_complete,
                quizHistory: (data.quizHistory || []).map(q => ({
                    ...q,
                    topicId: q.topicId || q.topic_id,
                    topicName: q.topicName || q.topic_name || q.topic,
                    subject: q.subject || 'All Topics',
                    topic: q.topic || q.topic_name || 'General',
                    difficulty: q.difficulty || 'Intermediate',
                    date: q.created_at || q.date
                })),
                flashcardDecks: {}
            };
            if (data.flashcardDecks) {
                data.flashcardDecks.forEach(card => {
                    if (!APP_STATE.currentUser.flashcardDecks[card.topic_id]) {
                        APP_STATE.currentUser.flashcardDecks[card.topic_id] = [];
                    }
                    APP_STATE.currentUser.flashcardDecks[card.topic_id].push({
                        front: card.question || card.front,
                        back: card.answer || card.back,
                        subject: card.subject || 'All Topics',
                        topic: card.topic || card.topic_name || 'General',
                        difficulty: card.difficulty || 'Intermediate',
                        interval: card.interval,
                        repetition: card.repetition,
                        efactor: card.efactor,
                        nextReviewDate: card.next_review_date
                    });
                });
            }
            updateDashboardData();
        } else if (response.status === 401) {
            handleLogout();
        }
    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

async function saveCurrentUser() {
    if (!APP_STATE.currentUser || !AUTH_TOKEN) return;
    try {
        await fetch(`${API_BASE}/api/user/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                level: APP_STATE.currentUser.level,
                interests: APP_STATE.currentUser.interests,
                xp: APP_STATE.currentUser.xp,
                streak: APP_STATE.currentUser.streak,
                setupComplete: APP_STATE.currentUser.setupComplete,
                streakFreezes: APP_STATE.currentUser.streakFreezes
            })
        });
    } catch (err) {
        console.error('Failed to save user:', err);
    }
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

const MIXED_INTEREST_TOPICS = [
    { id: 'quantum-physics', name: 'Quantum Physics', icon: '⚛️' },
    { id: 'organic-chemistry', name: 'Organic Chemistry', icon: '🧪' },
    { id: 'calculus', name: 'Calculus', icon: '📐' },
    { id: 'artificial-intelligence', name: 'Artificial Intelligence', icon: '🤖' },
    { id: 'world-history', name: 'World History', icon: '🌍' },
    { id: 'macroeconomics', name: 'Macroeconomics', icon: '📈' },
    { id: 'creative-writing', name: 'Creative Writing', icon: '✍️' },
    { id: 'genetics', name: 'Genetics & Evolution', icon: '🧬' },
    { id: 'psychology', name: 'Cognitive Psychology', icon: '🧠' },
    { id: 'astrophysics', name: 'Astrophysics', icon: '🌌' },
    { id: 'cybersecurity', name: 'Cybersecurity', icon: '🔒' },
    { id: 'environmental-science', name: 'Environmental Science', icon: '🌱' }
];

function populateInterestTags() {
    const topics = MIXED_INTEREST_TOPICS;
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
    const biologyTopics = typeof BIOTECH_TOPICS !== 'undefined' ? (BIOTECH_TOPICS[level] || []) : [];
    const topics = typeof MIXED_INTEREST_TOPICS !== 'undefined' ? [...MIXED_INTEREST_TOPICS, ...biologyTopics] : biologyTopics;
    
    const userInterests = APP_STATE.currentUser.interests || [];
    
    // Get topics the user selected that have quiz questions
    let selectedTopics = topics.filter(t => userInterests.includes(t.id) && typeof QUIZ_BANK !== 'undefined' && QUIZ_BANK[t.id]);
    
    // Only fall back to random topics if the user didn't select ANY valid topics
    if (selectedTopics.length === 0) {
        const otherTopics = topics.filter(t => typeof QUIZ_BANK !== 'undefined' && QUIZ_BANK[t.id]);
        otherTopics.sort(() => Math.random() - 0.5);
        selectedTopics = otherTopics.slice(0, 5);
    } else {
        // If they selected some topics, just test them on those, even if it's less than 5
        selectedTopics = selectedTopics.slice(0, 5);
    }

    // Pick 2 questions from each selected topic
    let diagnosticQuestions = [];
    const availableTopics = selectedTopics;

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

async function finishDiagnosticQuiz() {
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
        if (!APP_STATE.currentUser.quizScores) APP_STATE.currentUser.quizScores = {};
        APP_STATE.currentUser.quizScores[topicId] = Math.round((score.correct / score.total) * 100);
    });

    APP_STATE.currentUser.weakAreas = weakAreas;
    APP_STATE.currentUser.setupComplete = true;

    // Save to backend
    try {
        await fetch(`${API_BASE}/api/quiz/record`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                topicId: 'diagnostic',
                topicName: 'Diagnostic Quiz',
                subject: getSelectedStudyContext().subject,
                topic: getSelectedStudyContext().topic,
                difficulty: getSelectedStudyContext().difficulty,
                score: scorePercent,
                totalQuestions: qs.questions.length,
                correctAnswers: totalCorrect
            })
        });
    } catch (err) {
        console.error('Failed to save diagnostic record:', err);
    }

    await logActivity('quiz', `Completed diagnostic quiz with ${scorePercent}%`);
    await saveCurrentUser();
    await addXP(50, 'Completed Diagnostic Quiz');

    // Show results
    const area = document.getElementById('diagnosticQuizArea');
    area.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:3rem; margin-bottom:12px;">🎉</div>
      <h2>Diagnostic Complete!</h2>
      <div style="font-size:3.5rem; font-weight:900; margin:16px 0;" class="text-gradient">${scorePercent}%</div>
      <p style="margin-bottom:24px;">We've assessed your learning level and created your personalized study path.</p>
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
    if (section === 'notes') updateNotesContext();
    if (section === 'leaderboard') renderLeaderboard();
    if (section === 'profile') loadProfileData();

    if (section === 'chat') {
        if (typeof initFaceRecognition === 'function') initFaceRecognition();
    } else {
        if (typeof stopFaceRecognition === 'function') stopFaceRecognition();
    }
}

// ===== SIDEBAR TRAY TOGGLE =====
function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (!sidebar || !mainContent) return;
    
    const isCollapsed = sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded', isCollapsed);
    
    // Save state
    localStorage.setItem('quorix_sidebar_collapsed', isCollapsed ? '1' : '0');
}

// Restore sidebar state on load
function restoreSidebarState() {
    const collapsed = localStorage.getItem('quorix_sidebar_collapsed') === '1';
    if (collapsed) {
        const sidebar = document.getElementById('appSidebar');
        const mainContent = document.querySelector('.main-content');
        if (sidebar) sidebar.classList.add('collapsed');
        if (mainContent) mainContent.classList.add('expanded');
    }
}

// Face AI Logic
const FACE_AI_STATE = {
    initialized: false,
    video: null,
    interval: null,
    label: null
};

async function initFaceRecognition() {
    if (FACE_AI_STATE.initialized || !window.faceapi) return;
    
    FACE_AI_STATE.video = document.getElementById('emotionVideo');
    FACE_AI_STATE.label = document.getElementById('emotionLabel');
    if (!FACE_AI_STATE.video) return;

    try {
        if(FACE_AI_STATE.label) FACE_AI_STATE.label.textContent = "Loading Models...";
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/'),
            faceapi.nets.faceExpressionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/')
        ]);

        if(FACE_AI_STATE.label) FACE_AI_STATE.label.textContent = "Starting Camera...";
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        FACE_AI_STATE.video.srcObject = stream;
        
        FACE_AI_STATE.video.addEventListener('play', () => {
            if(FACE_AI_STATE.label) FACE_AI_STATE.label.textContent = "Detecting...";
            
            let negativeEmotionStreak = 0;
            const EMOTION_COOLDOWN = 20000; // Only trigger once every 20s
            let lastInterventionTime = 0;

            FACE_AI_STATE.interval = setInterval(async () => {
                const detections = await faceapi.detectSingleFace(
                    FACE_AI_STATE.video, 
                    new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 })
                ).withFaceExpressions();
                if (detections) {
                    const expressions = detections.expressions;
                    const maxEmotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
                    const confidence = expressions[maxEmotion];
                    
                    // Only accept detections with >40% confidence for more accurate reads
                    if (confidence > 0.4) {
                        if(FACE_AI_STATE.label) FACE_AI_STATE.label.textContent = `${maxEmotion.charAt(0).toUpperCase() + maxEmotion.slice(1)} ${Math.round(confidence * 100)}%`;
                        APP_STATE.currentEmotion = maxEmotion;
                    }

                    if (['sad', 'angry', 'fearful', 'disgusted'].includes(maxEmotion)) {
                        negativeEmotionStreak++;
                    } else {
                        negativeEmotionStreak = 0;
                    }

                    // If user looks confused/sad for 3 seconds continuously, proactively intervene
                    if (negativeEmotionStreak >= 3 && (Date.now() - lastInterventionTime) > EMOTION_COOLDOWN) {
                        lastInterventionTime = Date.now();
                        negativeEmotionStreak = 0;
                        triggerProactiveIntervention(maxEmotion);
                    }
                } else {
                    if(FACE_AI_STATE.label) FACE_AI_STATE.label.textContent = "No face";
                    APP_STATE.currentEmotion = "neutral";
                    negativeEmotionStreak = 0;
                }
            }, 1000);
        });

        FACE_AI_STATE.initialized = true;
    } catch (err) {
        console.error("Face Recognition Error: ", err);
        if(FACE_AI_STATE.label) FACE_AI_STATE.label.textContent = "Camera Error";
    }
}

function stopFaceRecognition() {
    if (FACE_AI_STATE.interval) clearInterval(FACE_AI_STATE.interval);
    if (FACE_AI_STATE.video && FACE_AI_STATE.video.srcObject) {
        FACE_AI_STATE.video.srcObject.getTracks().forEach(track => track.stop());
        FACE_AI_STATE.video.srcObject = null;
    }
    FACE_AI_STATE.initialized = false;
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
    renderSubjectSelector();

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

    const statFreezes = document.getElementById('statFreezes');
    if (statFreezes) statFreezes.textContent = `Owned: ${user.streakFreezes || 0}`;

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
    renderSubjectProgress();
    
    // Initialize push notifications if supported
    initPushNotifications();
}

async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const permission = await Notification.requestPermission();
        
        if (permission !== 'granted') return;
        
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            const response = await fetch(`${API_BASE}/api/push/vapidPublicKey`);
            const vapidPublicKey = await response.text();
            
            if (!vapidPublicKey) return;
            
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }
        
        await fetch(`${API_BASE}/api/push/subscribe`, {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });
        
    } catch (error) {
        console.error('Service Worker or Push Subscription failed:', error);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
        
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function testPushNotification() {
    try {
        const response = await fetch(`${API_BASE}/api/push/test`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });
        if (response.ok) {
            showToast('Push notification triggered!', '✅');
        } else {
            showToast('Please allow notifications in your browser first.', '❌');
        }
    } catch (err) {
        console.error('Test push error:', err);
    }
}

async function buyStreakFreeze() {
    const user = APP_STATE.currentUser;
    if (!user) return;
    
    if (user.xp < 500) {
        showToast('Not enough XP. Keep learning to earn more!', '❌');
        return;
    }
    
    user.xp -= 500;
    user.streakFreezes = (user.streakFreezes || 0) + 1;
    
    await logActivity('system', `Bought a Streak Freeze for 500 XP. You now have ${user.streakFreezes} freezes.`);
    await saveCurrentUser();
    
    updateDashboardData();
    showToast('Streak Freeze purchased! ❄️', '✅');
}


function renderSubjectProgress() {
    const user = APP_STATE.currentUser;
    const grid = document.getElementById('subjectProgressGrid');
    if (!user || !grid) return;

    const context = getSelectedStudyContext();
    const quizHistory = user.quizHistory || [];
    const subjectQuizzes = quizHistory.filter(q => (q.subject || 'All Topics') === context.subject);
    const subjectDecks = Object.values(user.flashcardDecks || {}).filter(deck =>
        deck.some(card => (card.subject || 'All Topics') === context.subject)
    );
    const avg = subjectQuizzes.length
        ? Math.round(subjectQuizzes.reduce((sum, q) => sum + (q.score || 0), 0) / subjectQuizzes.length)
        : 0;

    grid.innerHTML = `
      <div class="glass-card">
        <h4>Selected Subject</h4>
        <p id="currentSubjectLabel" style="font-size:1.1rem;color:var(--text-primary);">${context.subject}</p>
      </div>
      <div class="glass-card">
        <h4>Current Topic</h4>
        <p id="currentTopicLabel" style="font-size:1.1rem;color:var(--text-primary);">${context.topic}</p>
      </div>
      <div class="glass-card">
        <h4>Difficulty</h4>
        <p id="currentDifficultyLabel" style="font-size:1.1rem;color:var(--text-primary);">${context.difficulty}</p>
      </div>
      <div class="glass-card">
        <h4>Subject Progress</h4>
        <p>${subjectQuizzes.length} quizzes • ${subjectDecks.length} flashcard decks • ${avg}% average</p>
      </div>
    `;
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
    const topics = getTopicsForCurrentSelection();

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
    const topic = findCurrentTopic(topicId);
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
    speechBtn.onclick = () => speakText(lesson, true);
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
        const prompt = PROMPT_TEMPLATES.generateLesson(topic, user.level, user, getSelectedStudyContext());
        const response = await callAI(prompt, getSelectedStudyContext());
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
      <li>How this applies in the selected subject</li>
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
    const topics = getTopicsForCurrentSelection();
    const grid = document.getElementById('quizTopicGrid');
    if (!grid) return;

    grid.innerHTML = topics.map(t => {
        const score = user.quizScores?.[t.id];
        const difficulty = getSelectedStudyContext().difficulty.toLowerCase();
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
    const topic = findCurrentTopic(topicId);
    if (!topic) return;
    const studyContext = {
        ...getSelectedStudyContext(),
        topic: topic.name
    };

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
    const difficulty = studyContext.difficulty;

    if (ollamaModel) {
        try {
            const prompt = PROMPT_TEMPLATES.generateQuiz(topic.name, user.level, difficulty, studyContext);
            const response = await callAI(prompt, studyContext);
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

    if (!questions.length) {
        questions = generateGenericQuiz(topic.name, studyContext);
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
        subject: studyContext.subject,
        difficulty: studyContext.difficulty,
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
            aiExplanation = await callAI(prompt, getSelectedStudyContext());
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

async function finishQuiz() {
    const qs = APP_STATE.quizState;
    const user = APP_STATE.currentUser;
    const scorePercent = Math.round((qs.score / qs.questions.length) * 100);

    document.getElementById('quizPlayArea').classList.add('hidden');
    document.getElementById('quizResultsArea').classList.remove('hidden');

    document.getElementById('quizFinalScore').textContent = scorePercent + '%';
    document.getElementById('quizCorrectCount').textContent = qs.score;
    document.getElementById('quizWrongCount').textContent = qs.questions.length - qs.score;
    document.getElementById('quizTotalQ').textContent = qs.questions.length;

    // Update user data locally
    if (!user.quizScores) user.quizScores = {};
    user.quizScores[qs.currentTopic] = scorePercent;

    // Save to backend
    try {
        await fetch(`${API_BASE}/api/quiz/record`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                topicId: qs.currentTopic,
                topicName: qs.topicName,
                subject: qs.subject || getSelectedStudyContext().subject,
                topic: qs.topicName || getSelectedStudyContext().topic,
                difficulty: qs.difficulty || getSelectedStudyContext().difficulty,
                score: scorePercent,
                totalQuestions: qs.questions.length,
                correctAnswers: qs.score
            })
        });
    } catch (err) {
        console.error('Failed to save quiz record:', err);
    }

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

    await logActivity('quiz', `Scored ${scorePercent}% on ${qs.topicName}`);
    user.lastActive = new Date().toISOString();
    await saveCurrentUser();
    await addXP(Math.round(scorePercent / 5), 'Quiz Master');
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

function generateGenericQuiz(topicName, studyContext) {
    return [
        {
            question: `What is the main focus of ${topicName} in ${studyContext.subject}?`,
            options: ['Core concepts and applications', 'Unrelated facts only', 'Random memorization', 'No practical use'],
            correct: 0,
            explanation: `${topicName} should be studied through its core concepts and subject-specific applications.`
        },
        {
            question: `Which study approach works best for ${studyContext.difficulty} ${studyContext.subject}?`,
            options: ['Connect definitions, examples, and practice', 'Skip examples', 'Avoid revision', 'Study without questions'],
            correct: 0,
            explanation: 'Strong learning connects ideas with examples and checks understanding through practice.'
        },
        {
            question: `Why should examples be used when learning ${topicName}?`,
            options: ['They make abstract ideas easier to apply', 'They replace all theory', 'They are always optional', 'They reduce accuracy'],
            correct: 0,
            explanation: 'Examples help students transfer concepts into real questions and situations.'
        },
        {
            question: `What should you do after reading notes on ${topicName}?`,
            options: ['Summarize and self-test', 'Close the topic forever', 'Ignore weak areas', 'Only reread passively'],
            correct: 0,
            explanation: 'Active recall and short summaries improve retention.'
        },
        {
            question: `Which item belongs in a good revision plan for ${topicName}?`,
            options: ['Key terms, examples, and quick questions', 'Only long paragraphs', 'No feedback', 'Unverified shortcuts'],
            correct: 0,
            explanation: 'A good revision plan is concise, accurate, and practice-oriented.'
        }
    ];
}

// ===== STUDY NOTES =====
function updateNotesContext() {
    const context = getSelectedStudyContext();
    const title = document.getElementById('notesContextTitle');
    const meta = document.getElementById('notesContextMeta');
    if (title) title.textContent = `${context.subject}: ${context.topic}`;
    if (meta) meta.textContent = `${context.difficulty} difficulty`;
}

async function generateStudyNotes() {
    const context = getSelectedStudyContext();
    updateNotesContext();
    const display = document.getElementById('studyNotesDisplay');
    if (!display) return;

    display.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;padding:48px;">
        <div class="spinner"></div>
        <span style="margin-left:16px;color:var(--text-muted);">Generating study notes for ${context.subject} / ${context.topic}...</span>
      </div>
    `;

    try {
        const prompt = PROMPT_TEMPLATES.generateStudyNotes(context);
        const response = await callAI(prompt, context);
        if (response && !response.includes('**AI Connection Error')) {
            display.innerHTML = formatMarkdown(response);
            APP_STATE.lastLessonText = response;
            await logActivity('lesson', `Generated study notes: ${context.subject} - ${context.topic}`);
            await addXP(8, 'Study Notes');
            return;
        }
    } catch (err) {
        console.error('Study notes error:', err);
    }

    display.innerHTML = `
      <h2>${context.subject}: ${context.topic}</h2>
      <h3>Key Concepts</h3>
      <p>Review the central definitions, methods, and examples for this topic.</p>
      <h3>Simple Explanation</h3>
      <p>Break the topic into smaller parts, connect each idea to an example, and test yourself with short questions.</p>
      <h3>Important Facts</h3>
      <ul><li>Difficulty: ${context.difficulty}</li><li>Focus on accuracy and subject-specific vocabulary.</li></ul>
      <h3>Quick Revision Points</h3>
      <ul><li>Define the topic.</li><li>List major concepts.</li><li>Practice one example.</li></ul>
    `;
}

// ===== AI CHAT =====
async function callAI(prompt, studyContext = getSelectedStudyContext()) {
    if (!AUTH_TOKEN) return '**AI Error:** Not logged in.';
    const context = studyContext && studyContext.subject ? studyContext : getSelectedStudyContext();
    try {
        const response = await fetch(`${API_BASE}/api/ai/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                prompt,
                subject: context.subject || 'All Topics',
                topic: context.topic || 'General',
                difficulty: context.difficulty || 'Intermediate'
            })
        });

        if (!response.ok) throw new Error('Backend AI proxy failed');
        const data = await response.json();
        return data.response;
    } catch (err) {
        console.error('AI Error:', err);
        return `**AI Connection Error:** I couldn't connect to the backend. 
        
Please ensure:
1. The backend server is running.
2. **Ollama** is running on your machine with **llama3** installed.

*Error Details: ${err.message}*`;
    }
}

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
            const studyContext = getSelectedStudyContext();
            const context = APP_STATE.currentModuleTopic?.name || studyContext.topic || '';
            // Only keep last 6 messages (3 turns) for context to avoid huge prompts
            const history = APP_STATE.chatHistory.slice(-6);
            const personality = APP_STATE.tutorPersonality || 'emoji';
            const prompt = PROMPT_TEMPLATES.chatResponse(message, user.level, context, history, personality, studyContext, APP_STATE.currentEmotion || 'neutral');
            response = await callAI(prompt, { ...studyContext, topic: context || studyContext.topic });

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
    
    // Speak the response if TTS is enabled
    if (typeof speakText === 'function') speakText(response);

    // Log activity via backend
    await logActivity('chat', `Asked AI: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    await saveCurrentUser();
    await addXP(2, 'Curiosity');
}

async function triggerProactiveIntervention(emotion) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const typingId = 'typing-' + Date.now();
    container.innerHTML += `
    <div class="chat-message ai" id="${typingId}">
      <div class="chat-avatar">🧬</div>
      <div class="chat-bubble" style="display:flex;align-items:center;gap:8px;">
        <div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>
        Adapting to your expression...
      </div>
    </div>
  `;
    container.scrollTop = container.scrollHeight;

    const studyContext = getSelectedStudyContext();
    const prompt = `The student currently looks ${emotion}. Act proactively. Briefly ask if they are stuck on ${studyContext.topic}, offer a simpler analogy, or just give an encouraging word. Keep it strictly to 2 sentences. Don't mention their face directly, just respond to their struggle.`;
    
    let response = await callAI(prompt, studyContext);
    if (!response || response.includes('**AI Connection Error')) {
        response = "You seem a bit stuck! Let's take a deep breath. Can I explain this in a simpler way for you?";
    }

    const typingEl = document.getElementById(typingId);
    if (typingEl) {
        typingEl.innerHTML = `
      <div class="chat-avatar">🧬</div>
      <div class="chat-bubble" style="border: 1px solid var(--primary-500); background: rgba(16,185,129,0.05);">${formatMarkdown(response)}</div>
    `;
    }
    container.scrollTop = container.scrollHeight;
    
    if (typeof speakText === 'function') speakText(response);
}

// ===== VOICE & SPEECH =====
const VOICE_STATE = {
    enabled: false,
    synth: window.speechSynthesis,
    utterance: null
};

function toggleVoiceAssistant() {
    VOICE_STATE.enabled = !VOICE_STATE.enabled;
    const icon = document.getElementById('voiceToggleIcon');
    if (VOICE_STATE.enabled) {
        icon.textContent = '🔊';
        showToast('Voice Assistant Enabled', '🔊');
    } else {
        icon.textContent = '🔇';
        if (VOICE_STATE.synth && VOICE_STATE.synth.speaking) VOICE_STATE.synth.cancel();
        showToast('Voice Assistant Disabled', '🔇');
    }
}

function speakText(text, force = false) {
    if (!('speechSynthesis' in window)) return;
    if (!force && (!VOICE_STATE.enabled || !VOICE_STATE.synth)) return;
    
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    
    // Aggressively strip everything except alphabets and numbers
    let cleanText = text
        .replace(/```[\s\S]*?```/g, ' ')  // Replace code blocks
        .replace(/<[^>]*>?/gm, ' ')       // Remove HTML tags
        .replace(/[^a-zA-Z0-9\s]/g, ' ')  // Keep ONLY alphabets, numbers, and whitespace
        .replace(/\s+/g, ' ')             // Collapse multiple spaces
        .trim();
    
    if (!cleanText) return;
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Female') || v.name.includes('Samantha')));
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
}

const SPEECH_RECOGNITION_STATE = {
    recognition: null,
    isListening: false,
    silenceTimer: null,
    hasReceivedSpeech: false
};

function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showToast('Speech recognition not supported in this browser.', '⚠️');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    SPEECH_RECOGNITION_STATE.recognition = new SpeechRecognition();
    SPEECH_RECOGNITION_STATE.recognition.continuous = false;
    SPEECH_RECOGNITION_STATE.recognition.interimResults = true;
    
    SPEECH_RECOGNITION_STATE.recognition.onstart = function() {
        SPEECH_RECOGNITION_STATE.isListening = true;
        SPEECH_RECOGNITION_STATE.hasReceivedSpeech = false;
        const micIcon = document.getElementById('micIcon');
        if(micIcon) micIcon.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;border-top-color:var(--error);"></span>';
        
        // Start 4-second silence timeout
        SPEECH_RECOGNITION_STATE.silenceTimer = setTimeout(() => {
            if (!SPEECH_RECOGNITION_STATE.hasReceivedSpeech && SPEECH_RECOGNITION_STATE.isListening) {
                showToast('No speech detected. Microphone turned off.', '🎤');
                if (SPEECH_RECOGNITION_STATE.recognition) SPEECH_RECOGNITION_STATE.recognition.stop();
            }
        }, 4000);
    };
    
    SPEECH_RECOGNITION_STATE.recognition.onresult = function(event) {
        SPEECH_RECOGNITION_STATE.hasReceivedSpeech = true;
        // Clear the silence timeout since speech was detected
        if (SPEECH_RECOGNITION_STATE.silenceTimer) {
            clearTimeout(SPEECH_RECOGNITION_STATE.silenceTimer);
            SPEECH_RECOGNITION_STATE.silenceTimer = null;
        }
        
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        const input = document.getElementById('chatInput');
        if (finalTranscript) {
            input.value = finalTranscript;
        } else if (interimTranscript) {
            input.value = interimTranscript;
        }
    };
    
    SPEECH_RECOGNITION_STATE.recognition.onerror = function(event) {
        console.error("Speech recognition error", event.error);
        stopSpeechRecognition();
    };
    
    SPEECH_RECOGNITION_STATE.recognition.onend = function() {
        stopSpeechRecognition();
    };
}

function toggleSpeechToText() {
    if (!SPEECH_RECOGNITION_STATE.recognition) {
        initSpeechRecognition();
    }
    
    if (SPEECH_RECOGNITION_STATE.isListening) {
        SPEECH_RECOGNITION_STATE.recognition.stop();
    } else {
        document.getElementById('chatInput').value = '';
        if (SPEECH_RECOGNITION_STATE.recognition) SPEECH_RECOGNITION_STATE.recognition.start();
    }
}

function stopSpeechRecognition() {
    SPEECH_RECOGNITION_STATE.isListening = false;
    SPEECH_RECOGNITION_STATE.hasReceivedSpeech = false;
    if (SPEECH_RECOGNITION_STATE.silenceTimer) {
        clearTimeout(SPEECH_RECOGNITION_STATE.silenceTimer);
        SPEECH_RECOGNITION_STATE.silenceTimer = null;
    }
    const micIcon = document.getElementById('micIcon');
    if(micIcon) micIcon.innerHTML = '🎤';
}

if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => { if(VOICE_STATE.synth) VOICE_STATE.synth.getVoices(); };
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
        return "Hello! 👋 I'm your Quorix AI Tutor. I'm here to help with your selected subject, topic, and difficulty. What would you like to learn today?";
    }
    return "That's a great question! 🤔 Try exploring the **Learn** section for more details, or take a **Quiz** to test your current understanding. I'm here to help you master these concepts!";
}

// ===== LEARNING PATH =====
function renderLearningPath() {
    const user = APP_STATE.currentUser;
    if (!user) return;
    
    const biologyTopics = typeof BIOTECH_TOPICS !== 'undefined' ? (BIOTECH_TOPICS[user.level] || []) : [];
    const allTopics = typeof MIXED_INTEREST_TOPICS !== 'undefined' ? [...MIXED_INTEREST_TOPICS, ...biologyTopics] : biologyTopics;
    
    const userInterests = user.interests || [];
    let topics = allTopics.filter(t => userInterests.includes(t.id));
    
    if (topics.length === 0) {
        topics = allTopics.slice(0, 5);
    }
    
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
    const biologyTopics = typeof BIOTECH_TOPICS !== 'undefined' ? (BIOTECH_TOPICS[user.level] || []) : [];
    const allTopics = typeof MIXED_INTEREST_TOPICS !== 'undefined' ? [...MIXED_INTEREST_TOPICS, ...biologyTopics] : biologyTopics;
    const topics = allTopics;
    
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
        const studyContext = { ...getSelectedStudyContext(), topic: topicText };
        const prompt = PROMPT_TEMPLATES.generateCurriculum(topicText, user.level, studyContext);
        const response = await callAI(prompt, studyContext);

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
        const biologyTopics = typeof BIOTECH_TOPICS !== 'undefined' ? (BIOTECH_TOPICS[user.level] || []) : [];
        const allTopics = typeof MIXED_INTEREST_TOPICS !== 'undefined' ? [...MIXED_INTEREST_TOPICS, ...biologyTopics] : biologyTopics;
        const topic = allTopics.find(t => t.id === topicId) || { name: topicId, icon: '📇' };
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
            const studyContext = {
                ...getSelectedStudyContext(),
                topic: APP_STATE.currentModuleTopic?.name || getSelectedStudyContext().topic
            };
            const prompt = PROMPT_TEMPLATES.generateFlashcardsDecks(APP_STATE.lastLessonText, studyContext);
            const response = await callAI(prompt, studyContext);
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
        subject: getSelectedStudyContext().subject,
        topic: APP_STATE.currentModuleTopic?.name || getSelectedStudyContext().topic,
        difficulty: getSelectedStudyContext().difficulty,
        interval: 0,
        repetition: 0,
        efactor: 2.5,
        nextReviewDate: Date.now()
    }));

    user.flashcardDecks[topicId] = srsCards;

    // Sync to backend
    try {
        await fetch(`${API_BASE}/api/flashcards/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                topicId: topicId,
                subject: getSelectedStudyContext().subject,
                topic: APP_STATE.currentModuleTopic?.name || getSelectedStudyContext().topic,
                difficulty: getSelectedStudyContext().difficulty,
                cards: srsCards
            })
        });
    } catch (err) {
        console.error('Failed to sync flashcards:', err);
    }

    await saveCurrentUser();
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
    const topicId = state.originalDeckId || APP_STATE.currentModuleTopic?.id;
    if (topicId && AUTH_TOKEN) {
        try {
            fetch(`${API_BASE}/api/flashcards/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AUTH_TOKEN}`
                },
                body: JSON.stringify({
                    topicId: topicId,
                    subject: getSelectedStudyContext().subject,
                    topic: APP_STATE.currentModuleTopic?.name || getSelectedStudyContext().topic,
                    difficulty: getSelectedStudyContext().difficulty,
                    cards: APP_STATE.currentUser.flashcardDecks[topicId]
                })
            });
        } catch (err) {
            console.error('Failed to sync card rating:', err);
        }
    }

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
// speakText function is defined above in the VOICE & SPEECH section

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

// ===== LEGACY DIRECT OLLAMA API =====
async function callAIDirect(prompt) {
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

async function logActivity(type, text) {
    if (!APP_STATE.currentUser || !AUTH_TOKEN) return;
    try {
        await fetch(`${API_BASE}/api/user/activity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({ type, text })
        });
        // Also update local state for immediate UI feedback
        if (!APP_STATE.currentUser.activity) APP_STATE.currentUser.activity = [];
        APP_STATE.currentUser.activity.push({ type, text, date: new Date().toISOString() });
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
}

async function addXP(amount, reason) {
    if (!APP_STATE.currentUser) return;
    APP_STATE.currentUser.xp = (APP_STATE.currentUser.xp || 0) + amount;

    await logActivity('system', `Earned ${amount} XP: ${reason}`);
    await saveCurrentUser();

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
    const btn = document.getElementById('themeToggle');
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const newTheme = APP_STATE.theme === 'dark' ? 'light' : 'dark';

    // Create overlay with the TARGET theme's colors
    const overlay = document.createElement('div');
    overlay.classList.add('theme-wave-overlay');
    overlay.style.setProperty('--wave-x', x + 'px');
    overlay.style.setProperty('--wave-y', y + 'px');

    // Apply the target theme colors to the overlay
    if (newTheme === 'light') {
        overlay.style.background = '#ffffff';
    } else {
        overlay.style.background = '#09090b';
    }

    document.body.appendChild(overlay);

    // Force reflow so the initial clip-path is applied
    void overlay.offsetWidth;

    // Expand the circle
    overlay.classList.add('expanding');

    // After the wave finishes, apply the real theme and remove overlay
    overlay.addEventListener('transitionend', () => {
        APP_STATE.theme = newTheme;
        localStorage.setItem('bionexus_theme', newTheme);
        applyTheme(newTheme);
        overlay.remove();
    }, { once: true });
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
}

function clearChatHistory() {
    if (confirm('Are you sure you want to clear your AI chat history? This will delete all your conversations with the Quorix AI Tutor for this session.')) {
        APP_STATE.chatHistory = [];
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="chat-message ai">
                    <div class="chat-avatar">🌿</div>
                    <div class="chat-bubble">History cleared! 👋 How can I help with your selected subject today?</div>
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
