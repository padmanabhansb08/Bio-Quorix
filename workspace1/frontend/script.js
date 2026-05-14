const subjectGrid =
  document.getElementById("subjectGrid");

const emptyState =
  document.getElementById("emptyState");

const subjectModal =
  document.getElementById("subjectModal");

const openSubjectModal =
  document.getElementById("openSubjectModal");

const heroCreateBtn =
  document.getElementById("heroCreateBtn");

const emptyCreateBtn =
  document.getElementById("emptyCreateBtn");

const closeModalBtn =
  document.getElementById("closeModalBtn");

const subjectForm =
  document.getElementById("subjectForm");

const subjectName =
  document.getElementById("subjectName");

const subjectDescription =
  document.getElementById("subjectDescription");

const workspaceView =
  document.getElementById("workspaceView");

const workspaceTitle =
  document.getElementById("workspaceTitle");

const backToDashboard =
  document.getElementById("backToDashboard");

const subjectsSection =
  document.querySelector(".subjects-section");

const tabButtons =
  document.querySelectorAll(".tab-btn");

const tabContents =
  document.querySelectorAll(".tab-content");

const notesEditor =
  document.getElementById("notesEditor");

const taskInput =
  document.getElementById("taskInput");

const addTaskBtn =
  document.getElementById("addTaskBtn");

const taskList =
  document.getElementById("taskList");

const chatForm =
  document.getElementById("chatForm");

const chatInput =
  document.getElementById("chatInput");

const chatBody =
  document.getElementById("chatBody");

const themeToggle =
  document.getElementById("themeToggle");

const themeIcon =
  document.getElementById("themeIcon");

const focusModeBtn =
  document.getElementById("focusModeBtn");

const navItems =
  document.querySelectorAll(".nav-item");


// =========================
// APP STATE
// =========================

let currentSubject = "";

let subjects =
  JSON.parse(
    localStorage.getItem("subjects")
  ) || [];


// =========================
// THEME SYSTEM
// =========================

function setTheme(mode) {

  if (mode === "light") {

    document.body.classList.add(
      "light-mode"
    );

    if (themeIcon) {

      themeIcon.className =
        "fa-solid fa-sun";

    }

  } else {

    document.body.classList.remove(
      "light-mode"
    );

    if (themeIcon) {

      themeIcon.className =
        "fa-solid fa-moon";

    }

  }

  localStorage.setItem(
    "theme",
    mode
  );

}


const savedTheme =
  localStorage.getItem("theme")
  || "dark";

setTheme(savedTheme);


if (themeToggle) {

  themeToggle.addEventListener(
    "click",
    () => {

      const isLight =
        document.body.classList.contains(
          "light-mode"
        );

      setTheme(
        isLight ? "dark" : "light"
      );

    }
  );

}


// =========================
// MODAL SYSTEM
// =========================

function openModal() {

  subjectModal.classList.remove(
    "hidden"
  );

}


function closeModal() {

  subjectModal.classList.add(
    "hidden"
  );

}


// OPEN BUTTONS

if (openSubjectModal) {

  openSubjectModal.addEventListener(
    "click",
    openModal
  );

}

if (heroCreateBtn) {

  heroCreateBtn.addEventListener(
    "click",
    openModal
  );

}

if (emptyCreateBtn) {

  emptyCreateBtn.addEventListener(
    "click",
    openModal
  );

}


// CLOSE BUTTON

if (closeModalBtn) {

  closeModalBtn.addEventListener(
    "click",
    closeModal
  );

}


// CLICK OUTSIDE

if (subjectModal) {

  subjectModal.addEventListener(
    "click",
    (e) => {

      if (e.target === subjectModal) {

        closeModal();

      }

    }
  );

}


// =========================
// SUBJECT SYSTEM
// =========================

function renderSubjects() {

  subjectGrid.innerHTML = "";


  // EMPTY STATE

  if (subjects.length === 0) {

    emptyState.style.display =
      "block";

    return;

  }

  emptyState.style.display =
    "none";


  // RENDER CARDS

  subjects.forEach((subject, index) => {

    const card =
      document.createElement("div");


    card.className =
      "subject-card glass";


    // NOTES

    const notes =
      localStorage.getItem(
        "notes-" + subject.name
      ) || "";


    const wordCount =
      notes.trim().length === 0
        ? 0
        : notes.trim().split(/\\s+/).length;


    // TASKS

    const tasks =
      JSON.parse(
        localStorage.getItem(
          "tasks-" + subject.name
        )
      ) || [];


    const completed =
      tasks.filter(
        task => task.completed
      ).length;


    const progress =
      tasks.length === 0
        ? 0
        : Math.round(
            (
              completed /
              tasks.length
            ) * 100
          );


    // CARD HTML

    card.innerHTML = `

      <div class="subject-card-top">

        <div>

          <h3>${subject.name}</h3>

          <p>
            ${
              subject.description ||
              "No description"
            }
          </p>

        </div>

        <button
          class="delete-btn"
        >

          <i class="fa-solid fa-trash"></i>

        </button>

      </div>


      <div class="subject-stats">

        <div class="subject-stat">

          <span>Words</span>

          <strong>${wordCount}</strong>

        </div>


        <div class="subject-stat">

          <span>Tasks</span>

          <strong>${tasks.length}</strong>

        </div>


        <div class="subject-stat">

          <span>Progress</span>

          <strong>${progress}%</strong>

        </div>

      </div>


      <div class="subject-progress">

        <div
          class="subject-progress-fill"
          style="width:${progress}%"
        ></div>

      </div>

    `;


    // OPEN WORKSPACE

    card.addEventListener(
      "click",
      (e) => {

        if (
          e.target.closest(
            ".delete-btn"
          )
        ) return;


        openWorkspace(
          subject.name
        );

      }
    );


    // DELETE

    card.querySelector(
      ".delete-btn"
    ).addEventListener(
      "click",
      (e) => {

    e.stopPropagation();

    subjects.splice(index, 1);


        localStorage.setItem(
          "subjects",
          JSON.stringify(subjects)
        );


        renderSubjects();

      }
    );


    subjectGrid.appendChild(card);

  });

}

// CREATE SUBJECT

if (subjectForm) {

  subjectForm.addEventListener(
  "submit",
  (e) => {

    e.preventDefault();


    const name =
      subjectName.value.trim();

    const description =
      subjectDescription.value.trim();


    if (!name) {

      alert(
        "Enter subject name"
      );

      return;

    }


    // CREATE SUBJECT

    const newSubject = {

      name,

      description

    };


    subjects.push(newSubject);


    // SAVE

    localStorage.setItem(

      "subjects",

      JSON.stringify(subjects)

    );


    // RE-RENDER

    renderSubjects();


    // RESET FORM

    subjectForm.reset();


    // CLOSE MODAL

    closeModal();

  }
);

}


// =========================
// WORKSPACE
// =========================

function openWorkspace(subjectName) {

  currentSubject = subjectName;

  workspaceTitle.textContent =
    subjectName;


  subjectsSection.classList.add(
    "hidden"
  );

  workspaceView.classList.remove(
    "hidden"
  );


  // LOAD NOTES

  const savedNotes =
    localStorage.getItem(
      "notes-" + subjectName
    );

  notesEditor.innerHTML =
    savedNotes || "";


  // WORD COUNT

  updateWordCount();


  // TASKS

  loadTasks();
  loadFlashcards();

  // OVERVIEW

  updateOverview();

}

// BACK

if (backToDashboard) {

  backToDashboard.addEventListener(
    "click",
    () => {

      workspaceView.classList.add(
        "hidden"
      );

      subjectsSection.classList.remove(
        "hidden"
      );

    }
  );

}


// =========================
// TABS
// =========================

tabButtons.forEach((button) => {

  button.addEventListener(
    "click",
    () => {

      const target =
        button.dataset.tab;


      tabButtons.forEach((btn) => {

        btn.classList.remove(
          "active"
        );

      });


      tabContents.forEach((content) => {

        content.classList.remove(
          "active"
        );

      });


      button.classList.add(
        "active"
      );


      document
        .getElementById(
          target + "Tab"
        )
        .classList.add("active");

    }
  );

});


// =========================
// NOTES
// =========================

function updateWordCount() {

  const words =
    notesEditor.innerHTML
      .trim()
      .split(/\s+/)
      .filter(
        word => word !== ""
      )
      .length;


  const wordCount =
    document.getElementById(
      "wordCount"
    );

  if (wordCount) {

    wordCount.textContent =
      `${words} words`;

  }

}


if (notesEditor) {

  notesEditor.addEventListener(
    "input",
    () => {

      if (!currentSubject) return;


      localStorage.setItem(
        "notes-" + currentSubject,
        notesEditor.innerHTML
      );


      updateWordCount();

      updateOverview();

    }
  );

}


// =========================
// TASKS
// =========================

function saveTasks(tasks) {

  localStorage.setItem(
    "tasks-" + currentSubject,
    JSON.stringify(tasks)
  );

}


function loadTasks() {

  if (!currentSubject) return;


  const tasks =
    JSON.parse(
      localStorage.getItem(
        "tasks-" + currentSubject
      )
    ) || [];


  taskList.innerHTML = "";


  tasks.forEach((task, index) => {

    const div =
      document.createElement("div");


    div.className =
      "task-item " +
      (
        task.completed
          ? "task-completed"
          : ""
      );


    div.innerHTML = `

      <div class="task-left">

        <input
          type="checkbox"
          data-index="${index}"
          ${task.completed ? "checked" : ""}
        >

        <span>${task.text}</span>

      </div>

      <button
        class="delete-task"
        data-delete="${index}"
      >

        <i class="fa-solid fa-trash"></i>

      </button>

    `;


    taskList.appendChild(div);

  });


  updateOverview();

}


// ADD TASK

if (addTaskBtn) {

  addTaskBtn.addEventListener(
    "click",
    () => {

      const text =
        taskInput.value.trim();

      if (!text) return;


      const tasks =
        JSON.parse(
          localStorage.getItem(
            "tasks-" + currentSubject
          )
        ) || [];


      tasks.push({

        text,

        completed: false

      });


      saveTasks(tasks);

      loadTasks();

      taskInput.value = "";

    }
  );

}
// DELETE / TOGGLE
if (taskList) {

  taskList.addEventListener(
    "click",
    (e) => {

      let tasks =
        JSON.parse(
          localStorage.getItem(
            "tasks-" + currentSubject
          )
        ) || [];


      // TOGGLE

      if (
        e.target.matches(
          'input[type="checkbox"]'
        )
      ) {

        const index =
          e.target.dataset.index;

        tasks[index].completed =
          !tasks[index].completed;


        saveTasks(tasks);

        loadTasks();

      }


      // DELETE

      const deleteBtn =
        e.target.closest(
          ".delete-task"
        );

      if (deleteBtn) {

        const index =
          deleteBtn.dataset.delete;

        tasks.splice(index, 1);

        saveTasks(tasks);

        loadTasks();

      }

    }
  );

}


// =========================
// OVERVIEW
// =========================

function updateOverview() {

  const notes =
    notesEditor.innerHTML.trim();

  const noteWords =
    notes.length === 0
      ? 0
      : notes.split(/\s+/).length;


  document.getElementById(
    "notesCount"
  ).textContent = noteWords;


  const tasks =
    JSON.parse(
      localStorage.getItem(
        "tasks-" + currentSubject
      )
    ) || [];


  document.getElementById(
    "tasksCount"
  ).textContent = tasks.length;


  const completed =
    tasks.filter(
      task => task.completed
    ).length;


  document.getElementById(
    "completedTasks"
  ).textContent = completed;


  const progress =
    tasks.length === 0
      ? 0
      : Math.round(
          (
            completed /
            tasks.length
          ) * 100
        );


  document.getElementById(
    "progressPercent"
  ).textContent =
    progress + "%";

}


// =========================
// CHAT
// =========================

function addMessage(text, sender) {

  const div =
    document.createElement("div");

  div.className =
    `chat-message ${sender}`;


  div.innerHTML = `

    <div class="chat-bubble">
      ${text}
    </div>

  `;


  chatBody.appendChild(div);


  requestAnimationFrame(() => {

    chatBody.scrollTop =
      chatBody.scrollHeight;

  });

}


// WELCOME

addMessage(
  "Hello 👋 I'm Quorix AI. How can I help you today?",
  "ai"
);


// FAKE AI

function generateAIResponse(message) {

  const lower =
    message.toLowerCase();


  // NOTES

  const notes =
    notesEditor.innerHTML.trim();


  // TASKS

  const tasks =
    JSON.parse(
      localStorage.getItem(
        "tasks-" + currentSubject
      )
    ) || [];


  // FLASHCARDS

  const flashcards =
    JSON.parse(
      localStorage.getItem(
        "flashcards-" + currentSubject
      )
    ) || [];


  // GREETING

  if (
    lower.includes("hello") ||
    lower.includes("hi")
  ) {

    return `
      Hello 👋
      You're currently inside
      ${currentSubject}.
    `;

  }


  // TASK COUNT

  if (
    lower.includes("task")
  ) {

    return `
      You currently have
      ${tasks.length}
      tasks in
      ${currentSubject}.
    `;

  }


  // FLASHCARDS

  if (
    lower.includes("flashcard")
  ) {

    return `
      You currently have
      ${flashcards.length}
      flashcards saved.
    `;

  }


  // NOTES

  if (
    lower.includes("notes")
  ) {

    const words =
      notes.length === 0
        ? 0
        : notes.split(/\\s+/).length;


    return `
      Your notes currently contain
      ${words}
      words.
    `;

  }


  // SUMMARY

  if (
    lower.includes("summary")
  ) {

    if (!notes) {

      return `
        No notes found to summarize.
      `;

    }

    return `
      Your notes mainly discuss:
      ${notes.substring(0, 120)}...
    `;

  }


  // DEFAULT

  return `
    I'm analyzing your
    ${currentSubject}
    workspace.
  `;

}

// SEND CHAT

if (chatForm) {

  chatForm.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();

    const message =
      chatInput.value.trim();

    if (!message) return;


    // USER MESSAGE

    addMessage(
      message,
      "user"
    );

    chatInput.value = "";


    // THINKING MESSAGE

    addMessage(
      "Thinking...",
      "ai"
    );


    try {

      // NOTES

      const notes =
        notesEditor.innerHTML;


      // TASKS

      const tasks =
        JSON.parse(
          localStorage.getItem(
            "tasks-" + currentSubject
          )
        ) || [];


      // FLASHCARDS

      const flashcards =
        JSON.parse(
          localStorage.getItem(
            "flashcards-" + currentSubject
          )
        ) || [];


      // REQUEST

      const response =
        await fetch(

          "http://localhost:5000/chat",

          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json"

            },

            body: JSON.stringify({

              message,

              subject: currentSubject,

              notes,

              tasks,

              flashcards

            })

          }

        );


      const data =
        await response.json();


      // REMOVE THINKING

      const thinkingMessage =
        document.querySelector(
          ".chat-message.ai:last-child"
        );

      if (thinkingMessage) {

        thinkingMessage.remove();

      }


      // AI RESPONSE

      addMessage(
        data.response,
        "ai"
      );

    } catch (error) {

      console.error(error);

      addMessage(
        "Something went wrong.",
        "ai"
      );

    }

  }
);}
// =========================
// NAVIGATION
// =========================

navItems.forEach((item) => {

  item.addEventListener(
    "click",
    () => {

      navItems.forEach((nav) => {

        nav.classList.remove(
          "active"
        );

      });


      item.classList.add(
        "active"
      );

    }
  );

});
// =========================
// ANALYTICS
// =========================

function loadAnalytics() {

  // SUBJECTS

  document.getElementById(
    "analyticsSubjects"
  ).textContent =
    subjects.length;


  let totalTasks = 0;

  let totalFlashcards = 0;

  let totalWords = 0;


  subjects.forEach((subject) => {

    // TASKS

    const tasks =
      JSON.parse(
        localStorage.getItem(
          "tasks-" + subject.name
        )
      ) || [];

    totalTasks += tasks.length;


    // FLASHCARDS

    const flashcards =
      JSON.parse(
        localStorage.getItem(
          "flashcards-" + subject.name
        )
      ) || [];

    totalFlashcards +=
      flashcards.length;


    // NOTES

    const notes =
      localStorage.getItem(
        "notes-" + subject.name
      ) || "";


    totalWords +=
      notes.replace(/<[^>]*>/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .length;

  });


  document.getElementById(
    "analyticsTasks"
  ).textContent =
    totalTasks;


  document.getElementById(
    "analyticsFlashcards"
  ).textContent =
    totalFlashcards;


  document.getElementById(
    "analyticsWords"
  ).textContent =
    totalWords;

}

// =========================
// FOCUS MODE
// =========================

if (focusModeBtn) {

  focusModeBtn.addEventListener(
    "click",
    () => {

      document.body.classList.toggle(
        "focus-mode"
      );

    }
  );

}


// =========================
// INIT
// =========================

renderSubjects();
const flashQuestion =
  document.getElementById("flashQuestion");

const flashAnswer =
  document.getElementById("flashAnswer");

const addFlashcardBtn =
  document.getElementById("addFlashcardBtn");

const flashcardGrid =
  document.getElementById("flashcardGrid");
const generateFlashcardsBtn =
  document.getElementById(
    "generateFlashcardsBtn"
  );

// SAVE

function saveFlashcards(cards) {

  localStorage.setItem(
    "flashcards-" + currentSubject,
    JSON.stringify(cards)
  );

}


// LOAD

function loadFlashcards() {

  if (!currentSubject) return;


  const cards =
    JSON.parse(
      localStorage.getItem(
        "flashcards-" + currentSubject
      )
    ) || [];


  flashcardGrid.innerHTML = "";


  cards.forEach((card, index) => {

    const div =
      document.createElement("div");

    div.className = "flashcard";


    div.innerHTML = `

      <div class="flashcard-front">

        <h3>${card.question}</h3>

      </div>

      <div class="flashcard-back">

        <h3>${card.answer}</h3>

      </div>

    `;


    // FLIP

    div.addEventListener(
      "click",
      () => {

        div.classList.toggle(
          "flipped"
        );

      }
    );


    flashcardGrid.appendChild(div);

  });

}


// ADD

if (addFlashcardBtn) {

  addFlashcardBtn.addEventListener(
    "click",
    () => {

      const question =
        flashQuestion.value.trim();

      const answer =
        flashAnswer.value.trim();


      if (!question || !answer) return;


      const cards =
        JSON.parse(
          localStorage.getItem(
            "flashcards-" + currentSubject
          )
        ) || [];


      cards.push({
        question,
        answer
      });


      saveFlashcards(cards);

      loadFlashcards();


      flashQuestion.value = "";

      flashAnswer.value = "";

    }
  );

}
// =========================
// NOTES TOOLBAR
// =========================

const boldBtn =
  document.getElementById("boldBtn");

const italicBtn =
  document.getElementById("italicBtn");

const h1Btn =
  document.getElementById("h1Btn");

const listBtn =
  document.getElementById("listBtn");

const linkBtn =
  document.getElementById("linkBtn");

const notesMenuBtn =
  document.getElementById("notesMenuBtn");

const notesDropdown =
  document.getElementById("notesDropdown");

const clearNotesBtn =
  document.getElementById("clearNotesBtn");

const copyNotesBtn =
  document.getElementById("copyNotesBtn");

const downloadNotesBtn =
  document.getElementById("downloadNotesBtn");


// BOLD

boldBtn.addEventListener(
  "click",
  () => {

    document.execCommand(
      "bold"
    );

  }
);


// ITALIC

italicBtn.addEventListener(
  "click",
  () => {

    document.execCommand(
      "italic"
    );

  }
);


// H1

h1Btn.addEventListener(
  "click",
  () => {

    document.execCommand(
      "formatBlock",
      false,
      "h1"
    );

  }
);


// LIST

listBtn.addEventListener(
  "click",
  () => {

    document.execCommand(
      "insertUnorderedList"
    );

  }
);


// LINK

linkBtn.addEventListener(
  "click",
  () => {

    const url =
      prompt("Enter URL");

    if (!url) return;

    document.execCommand(
      "createLink",
      false,
      url
    );

  }
);


// MENU TOGGLE

notesMenuBtn.addEventListener(
  "click",
  () => {

    notesDropdown.classList.toggle(
      "hidden"
    );

  }
);


// CLEAR

clearNotesBtn.addEventListener(
  "click",
  () => {

    notesEditor.innerHTML = "";

  }
);


// COPY

copyNotesBtn.addEventListener(
  "click",
  async () => {

    await navigator.clipboard.writeText(
      notesEditor.innerText
    );

    alert("Copied!");

  }
);


// DOWNLOAD

downloadNotesBtn.addEventListener(
  "click",
  () => {

    const blob =
      new Blob(
        [notesEditor.innerText],
        {
          type: "text/plain"
        }
      );

    const a =
      document.createElement("a");

    a.href =
      URL.createObjectURL(blob);

    a.download =
      currentSubject + "-notes.txt";

    a.click();

  }
);
// =========================
// SIDEBAR NAVIGATION
// =========================

const dashboardNav =
  document.getElementById(
    "dashboardNav"
  );

const subjectsNav =
  document.getElementById(
    "subjectsNav"
  );

const flashcardsNav =
  document.getElementById(
    "flashcardsNav"
  );

const analyticsNav =
  document.getElementById(
    "analyticsNav"
  );

const settingsNav =
  document.getElementById(
    "settingsNav"
  );


const flashcardsPage =
  document.getElementById(
    "flashcardsPage"
  );

const analyticsPage =
  document.getElementById(
    "analyticsPage"
  );

const settingsPage =
  document.getElementById(
    "settingsPage"
  );


// HIDE ALL

function hideAllPages() {

  subjectsSection.classList.add(
    "hidden"
  );

  workspaceView.classList.add(
    "hidden"
  );

  flashcardsPage.classList.add(
    "hidden"
  );

  analyticsPage.classList.add(
    "hidden"
  );

  settingsPage.classList.add(
    "hidden"
  );

}


// DASHBOARD

dashboardNav.addEventListener(
  "click",
  () => {

    hideAllPages();

    subjectsSection.classList.remove(
      "hidden"
    );

  }
);


// SUBJECTS

subjectsNav.addEventListener(
  "click",
  () => {

    hideAllPages();

    subjectsSection.classList.remove(
      "hidden"
    );

  }
);


// FLASHCARDS

flashcardsNav.addEventListener(
  "click",
  () => {

    hideAllPages();

    flashcardsPage.classList.remove(
      "hidden"
    );

    renderAllFlashcards();

  }
);


// ANALYTICS

analyticsNav.addEventListener(
  "click",
  () => {

    hideAllPages();

    analyticsPage.classList.remove(
      "hidden"
    );

    loadAnalytics();

  }
);


// SETTINGS

settingsNav.addEventListener(
  "click",
  () => {

    hideAllPages();

    settingsPage.classList.remove(
      "hidden"
    );

  }
);
// =========================
// SETTINGS INTERACTIONS
// =========================

const appearanceCard =
  document.getElementById(
    "appearanceCard"
  );

const aiCard =
  document.getElementById(
    "aiCard"
  );

const storageCard =
  document.getElementById(
    "storageCard"
  );

const languageCard =
  document.getElementById(
    "languageCard"
  );


// APPEARANCE

appearanceCard.addEventListener(
  "click",
  () => {

    document.body.classList.toggle(
      "light-mode"
    );

  }
);


// AI MODEL

aiCard.addEventListener(
  "click",
  () => {

    alert(
      "Gemma AI connected via Ollama"
    );

  }
);


// STORAGE

storageCard.addEventListener(
  "click",
  () => {

    const used =
      JSON.stringify(
        localStorage
      ).length / 1024;

    alert(
      `Local storage used:
${used.toFixed(2)} KB`
    );

  }
);


// LANGUAGE

languageCard.addEventListener(
  "click",
  () => {

    alert(
      "Multilingual AI enabled"
    );

  }
);
// =========================
// AI FLASHCARDS
// =========================

generateFlashcardsBtn.addEventListener(
  "click",
  async () => {

    if (!currentSubject) return;


    const notes =
      notesEditor.innerText.trim();


    if (!notes) {

      alert(
        "Write notes first"
      );

      return;

    }


    try {

      generateFlashcardsBtn.innerText =
        "Generating...";


      // REQUEST

      const response =
        await fetch(

          "http://localhost:5000/chat",

          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json"

            },

            body: JSON.stringify({

              message: `

Generate 5 flashcards
from these notes.

Return ONLY valid JSON.

Format:
[
  {
    "question":"...",
    "answer":"..."
  }
]

NOTES:
${notes}

              `,

              subject:
                currentSubject,

              notes,

              tasks: [],

              flashcards: []

            })

          }

        );


      const data =
        await response.json();


      // CLEAN RESPONSE

      const cleaned =
        data.response
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();


      // PARSE JSON

      const generated =
        JSON.parse(cleaned);


      // CURRENT CARDS

      const existing =
        JSON.parse(
          localStorage.getItem(
            "flashcards-" +
            currentSubject
          )
        ) || [];


      // SAVE

      const updated = [

        ...existing,

        ...generated

      ];


      localStorage.setItem(

        "flashcards-" +
        currentSubject,

        JSON.stringify(updated)

      );


      loadFlashcards();


      alert(
        "AI Flashcards generated!"
      );

    } catch (error) {

      console.error(error);

      alert(
        "Generation failed"
      );

    }


    generateFlashcardsBtn.innerText =
      "Generate AI Flashcards";

  }
);