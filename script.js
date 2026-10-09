document.body.classList.add('js-enabled');

const themeButton = document.querySelector('.theme-toggle');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let themeChosen = false;
try { themeChosen = ['light', 'dark'].includes(localStorage.getItem('mat-theme')); } catch {}
const applyTheme = theme => {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  themeButton.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#171a1b' : '#eeece5';
};
applyTheme(document.documentElement.dataset.theme || (systemTheme.matches ? 'dark' : 'light'));
themeButton.hidden = false;
themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  themeChosen = true;
  try { localStorage.setItem('mat-theme', next); } catch {}
  applyTheme(next);
});
systemTheme.addEventListener('change', event => {
  if (!themeChosen) applyTheme(event.matches ? 'dark' : 'light');
});

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-nav');
const closeMenu = () => {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('open');
};
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenu();
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

const filters = document.querySelectorAll('.filter');
const projects = document.querySelectorAll('[data-category]');
filters.forEach(filter => {
  filter.addEventListener('click', () => {
    filters.forEach(item => {
      const selected = item === filter;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    let count = 0;
    projects.forEach(project => {
      project.hidden = filter.dataset.filter !== 'all' && project.dataset.category !== filter.dataset.filter;
      if (!project.hidden) count++;
    });
    document.querySelector('#project-count').textContent = `${count} projects`;
  });
});

// These summaries describe the scope documented in the existing profile.
// The sketches are conceptual, not measurements or screenshots of live systems.
const studies = {
  claims: {
    title: 'Insurance Claims Orchestration',
    intro: 'A multi-agent workflow for health insurance claim validation, with structured routing and human review.',
    problem: 'Claim validation brings together domain rules, supporting information, and decisions that may require a person. The system needs clear steps and a way to inspect how it reached an outcome.',
    decisions: [
      'Stateful orchestration with LangGraph and deterministic routing between steps.',
      'ICD-10 lookups and tool integration through MCP to support domain-specific validation.',
      'Human-in-the-loop review paths, with Langfuse for observability and FastAPI for the application interface.'
    ],
    scope: 'This project explores how to structure an auditable AI workflow. The diagram is a conceptual overview; implementation details and setup are available in the repository.',
    url: 'https://github.com/anhtuan23004/Agentic-AI-Insurance-Claims'
  },
  docs: {
    title: 'DocuminChat',
    intro: 'A conversational RAG pipeline for finding information across documents and structured data.',
    problem: 'Useful information is spread across PDFs, spreadsheets, CSV files, and JSON. A conversational interface needs to retrieve relevant context from those formats before generating a response.',
    decisions: [
      'Document ingestion across PDF, CSV, XLSX, and JSON inputs.',
      'Hierarchical chunking and retrieval using LangChain with Milvus or Qdrant as vector stores.',
      'A Streamlit interface to explore document-backed conversations.'
    ],
    scope: 'The engineering focus is the retrieval pipeline and its handling of different data formats. See the repository for supported configuration and implementation details.',
    url: 'https://github.com/anhtuan23004/DocuminChat'
  },
  local: {
    title: 'LocalLLM',
    intro: 'Local infrastructure for serving, adapting, and exploring language and vision-language models.',
    problem: 'Running models locally requires choices across model size, GPU resources, serving runtimes, and adaptation. Those choices affect how the model can be used by an application.',
    decisions: [
      'Model serving and inference exploration using vLLM and Ollama.',
      'Fine-tuning workflows with LoRA / QLoRA, Unsloth, and PyTorch.',
      'Deployment and inference optimization for on-premise GPU infrastructure.'
    ],
    scope: 'This repository brings together model lifecycle and infrastructure work. The visual summarizes the model, runtime, and interface layers; it does not represent a live deployment status.',
    url: 'https://github.com/anhtuan23004/LocalLLM'
  }
};

const dialog = document.querySelector('.study-dialog');
const dialogContent = document.querySelector('#study-content');
const closeDialog = () => dialog.close();
const addStudyBlock = (title, content) => {
  const section = document.createElement('section');
  section.className = 'study-block';
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.append(heading);
  if (Array.isArray(content)) {
    const list = document.createElement('ul');
    content.forEach(text => {
      const item = document.createElement('li');
      item.textContent = text;
      list.append(item);
    });
    section.append(list);
  } else {
    const paragraph = document.createElement('p');
    paragraph.textContent = content;
    section.append(paragraph);
  }
  dialogContent.append(section);
};
document.querySelectorAll('.study-trigger').forEach(button => {
  button.addEventListener('click', () => {
    const study = studies[button.dataset.study];
    document.querySelector('#study-title').textContent = study.title;
    document.querySelector('#study-intro').textContent = study.intro;
    document.querySelector('#study-source').href = study.url;
    dialogContent.replaceChildren();
    addStudyBlock('01 / The problem', study.problem);
    addStudyBlock('02 / Architecture & technologies', study.decisions);
    addStudyBlock('03 / Project scope', study.scope);
    closeMenu();
    dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add('modal-open');
  });
});
document.querySelector('.dialog-close').addEventListener('click', closeDialog);
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
});

document.querySelector('#year').textContent = new Date().getFullYear();
const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const updateClock = () => { document.querySelector('.local-time').textContent = clockFormatter.format(new Date()); };
updateClock();
setInterval(updateClock, 60000);

const progress = document.querySelector('.scroll-progress');
let progressPending = false;
const updateProgress = () => {
  const distance = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
  progress.style.transform = `scaleX(${ratio})`;
  progressPending = false;
};
const scheduleProgress = () => {
  if (!progressPending) {
    progressPending = true;
    requestAnimationFrame(updateProgress);
  }
};
window.addEventListener('scroll', scheduleProgress, { passive: true });
window.addEventListener('resize', scheduleProgress);
filters.forEach(filter => filter.addEventListener('click', scheduleProgress));
document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', scheduleProgress));
updateProgress();

if ('IntersectionObserver' in window) {
  const navLinks = navigation.querySelectorAll('a[href^="#"]');
  const activeSectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('main section[id]').forEach(section => activeSectionObserver.observe(section));

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px 45px 0px' });
    document.querySelectorAll('.section-heading, .about-grid, .project-card, .cloud-card, .education').forEach(element => {
      if (element.getBoundingClientRect().top < window.innerHeight) return;
      element.classList.add('reveal-pending');
      revealObserver.observe(element);
    });
  }
}

// Load the locally hosted renderer only when the hero approaches the viewport.
const sceneHost = document.querySelector('.system-art');
let disposeScene;
let sceneLoading = false;
const loadScene = async () => {
  if (sceneLoading) return;
  sceneLoading = true;
  try {
    const { mountScene } = await import('./scene.js');
    disposeScene = mountScene(sceneHost);
  } catch {
    // CSS artwork remains visible if the optional renderer cannot initialize.
    sceneHost.classList.remove('scene-ready');
    sceneHost.querySelector('.scene-interface').hidden = true;
    sceneHost.querySelector('.scene-toggle').hidden = true;
    sceneHost.querySelector('.scene-canvas').replaceChildren();
    sceneHost.dataset.sceneState = 'fallback';
  }
};
if ('IntersectionObserver' in window) {
  const sceneLoader = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    sceneLoader.disconnect();
    loadScene();
  }, { rootMargin: '200px' });
  sceneLoader.observe(sceneHost);
} else {
  loadScene();
}
window.addEventListener('pagehide', event => {
  if (!event.persisted) disposeScene?.();
});

const allowPointerMotion = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
document.querySelectorAll('.project-visual').forEach(visual => {
  visual.addEventListener('pointermove', event => {
    if (!allowPointerMotion()) return;
    const bounds = visual.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    visual.style.setProperty('--visual-rotate-x', `${(0.5 - y) * 7}deg`);
    visual.style.setProperty('--visual-rotate-y', `${(x - 0.5) * 7}deg`);
    visual.style.setProperty('--light-x', `${x * 100}%`);
    visual.style.setProperty('--light-y', `${y * 100}%`);
    visual.style.setProperty('--light-opacity', '1');
  });
  visual.addEventListener('pointerleave', () => {
    visual.style.setProperty('--visual-rotate-x', '0deg');
    visual.style.setProperty('--visual-rotate-y', '0deg');
    visual.style.setProperty('--light-opacity', '0');
  });
});
const contact = document.querySelector('.contact-section');
contact.addEventListener('pointermove', event => {
  if (!allowPointerMotion()) return;
  const bounds = contact.getBoundingClientRect();
  contact.style.setProperty('--glow-x', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 80}px`);
  contact.style.setProperty('--glow-y', `${((event.clientY - bounds.top) / bounds.height - 0.5) * 50}px`);
});
contact.addEventListener('pointerleave', () => {
  contact.style.setProperty('--glow-x', '0px');
  contact.style.setProperty('--glow-y', '0px');
});
