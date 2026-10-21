/**
 * app.js - Main Application Controller for TaskFlow
 * Handles state management, UI rendering, filters, Kanban drag-and-drop,
 * modals, keyboard shortcuts, and theme management.
 */

class TaskFlowApp {
    constructor() {
        this.tasks = [];
        this.categories = [];
        this.stats = {};
        this.currentView = 'list';
        this.activeFilter = {
            due: 'all',
            status: '',
            category: 'all',
            priority: 'all',
            search: ''
        };
        this.sortBy = 'due_date';
        this.sortOrder = 'asc';
        this.editingTaskId = null;
        this.modalSubtasks = [];

        this.init();
    }

    async init() {
        this.initTheme();
        this.initPomodoro();
        this.bindDOM();
        this.bindEvents();
        this.bindKeyboardShortcuts();

        // Initial fetch
        await this.loadCategories();
        await this.loadTasks();
        await this.loadStats();
    }

    // ===================== THEME SETUP =====================
    initTheme() {
        const savedTheme = localStorage.getItem('taskflow_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const nextTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('taskflow_theme', nextTheme);
        this.showToast(`Switched to ${nextTheme} theme`);
    }

    initPomodoro() {
        this.pomodoro = new window.PomodoroTimer();
    }

    // ===================== DOM BINDING =====================
    bindDOM() {
        // App Layout
        this.sidebar = document.getElementById('sidebar');
        this.toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
        this.themeToggleBtn = document.getElementById('themeToggleBtn');
        this.globalSearchInput = document.getElementById('globalSearchInput');

        // Views
        this.viewButtons = document.querySelectorAll('.view-btn');
        this.viewPanels = {
            list: document.getElementById('listView'),
            kanban: document.getElementById('kanbanView'),
            analytics: document.getElementById('analyticsView')
        };

        // Task List View DOM
        this.viewTitle = document.getElementById('viewTitle');
        this.viewSubtitle = document.getElementById('viewSubtitle');
        this.taskListContainer = document.getElementById('taskListContainer');
        this.emptyState = document.getElementById('emptyState');
        this.quickAddForm = document.getElementById('quickAddForm');
        this.quickTaskTitle = document.getElementById('quickTaskTitle');
        this.quickTaskCategory = document.getElementById('quickTaskCategory');
        this.quickTaskPriority = document.getElementById('quickTaskPriority');
        this.quickTaskDueDate = document.getElementById('quickTaskDueDate');
        this.sortBySelect = document.getElementById('sortBySelect');
        this.btnToggleOrder = document.getElementById('btnToggleOrder');
        this.orderAscIcon = document.getElementById('orderAscIcon');
        this.orderDescIcon = document.getElementById('orderDescIcon');
        this.statusFilterPills = document.querySelectorAll('#statusFilterPills .filter-pill');

        // Kanban Columns
        this.kanbanCols = {
            todo: document.getElementById('kanbanColTodo'),
            in_progress: document.getElementById('kanbanColInProgress'),
            completed: document.getElementById('kanbanColCompleted')
        };

        // Sidebar Elements
        this.sidebarNavItems = document.querySelectorAll('.sidebar-nav .nav-item');
        this.categoryList = document.getElementById('categoryList');

        // Sidebar Badges
        this.badges = {
            all: document.getElementById('countAll'),
            today: document.getElementById('countToday'),
            upcoming: document.getElementById('countUpcoming'),
            overdue: document.getElementById('countOverdue'),
            important: document.getElementById('countImportant'),
            completed: document.getElementById('countCompleted')
        };

        // Sidebar Widget
        this.widgetProgressBar = document.getElementById('widgetProgressBar');
        this.widgetCompletionRate = document.getElementById('widgetCompletionRate');
        this.widgetDoneToday = document.getElementById('widgetDoneToday');
        this.widgetTotalPomos = document.getElementById('widgetTotalPomos');

        // Modals
        this.taskModal = document.getElementById('taskModal');
        this.taskForm = document.getElementById('taskForm');
        this.taskModalTitle = document.getElementById('taskModalTitle');
        this.taskFormId = document.getElementById('taskFormId');
        this.taskTitleInput = document.getElementById('taskTitleInput');
        this.taskDescInput = document.getElementById('taskDescInput');
        this.taskCategorySelect = document.getElementById('taskCategorySelect');
        this.taskPrioritySelect = document.getElementById('taskPrioritySelect');
        this.taskDueDateInput = document.getElementById('taskDueDateInput');
        this.taskStatusSelect = document.getElementById('taskStatusSelect');
        this.taskRecurringSelect = document.getElementById('taskRecurringSelect');
        this.taskEstimatedPomos = document.getElementById('taskEstimatedPomos');
        this.subtasksListContainer = document.getElementById('subtasksListContainer');
        this.newSubtaskInput = document.getElementById('newSubtaskInput');
        this.btnAddSubtaskBtn = document.getElementById('btnAddSubtaskBtn');

        this.categoryModal = document.getElementById('categoryModal');
        this.categoryForm = document.getElementById('categoryForm');
        this.backupModal = document.getElementById('backupModal');
        this.helpModal = document.getElementById('helpModal');

        this.toastContainer = document.getElementById('toastContainer');
    }

    // ===================== EVENT LISTENERS =====================
    bindEvents() {
        // Toggle Sidebar
        this.toggleSidebarBtn.addEventListener('click', () => {
            this.sidebar.classList.toggle('collapsed');
        });

        // Theme Toggle
        this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());

        // Global Search with debounce
        let searchTimeout;
        this.globalSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.activeFilter.search = e.target.value.trim();
                this.loadTasks();
            }, 250);
        });

        // View Switching
        this.viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetView = e.currentTarget.dataset.view;
                this.switchView(targetView);
            });
        });

        // Sidebar Navigation filter clicks
        this.sidebarNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.sidebarNavItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Clear category filter when clicking main navigation item
                document.querySelectorAll('.category-item').forEach(c => c.classList.remove('active'));
                this.activeFilter.category = 'all';

                if (item.dataset.filterDue) {
                    this.activeFilter.due = item.dataset.filterDue;
                    this.activeFilter.status = '';
                } else if (item.dataset.filterStatus) {
                    this.activeFilter.due = 'all';
                    this.activeFilter.status = item.dataset.filterStatus;
                }

                this.viewTitle.textContent = item.dataset.title || 'Tasks';
                this.loadTasks();
            });
        });

        // Status Filter Pills (All / Active / Completed)
        this.statusFilterPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                this.statusFilterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.activeFilter.status = pill.dataset.status;
                this.loadTasks();
            });
        });

        // Sorting
        this.sortBySelect.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.loadTasks();
        });

        this.btnToggleOrder.addEventListener('click', () => {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
            if (this.sortOrder === 'asc') {
                this.orderAscIcon.classList.remove('hidden');
                this.orderDescIcon.classList.add('hidden');
            } else {
                this.orderAscIcon.classList.add('hidden');
                this.orderDescIcon.classList.remove('hidden');
            }
            this.loadTasks();
        });

        // Quick Add Form
        this.quickAddForm.addEventListener('submit', (e) => this.handleQuickAdd(e));

        // New Task Button
        document.getElementById('btnNewTask').addEventListener('click', () => this.openTaskModal());
        document.getElementById('btnEmptyStateNewTask').addEventListener('click', () => this.openTaskModal());

        // Quick column adds in Kanban
        document.querySelectorAll('.btn-add-in-col').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const colStatus = e.currentTarget.dataset.colStatus;
                this.openTaskModal(null, { status: colStatus });
            });
        });

        // Task Form Submit
        this.taskForm.addEventListener('submit', (e) => this.handleTaskFormSubmit(e));

        // Subtask Add inside Modal
        this.btnAddSubtaskBtn.addEventListener('click', () => this.addModalSubtask());
        this.newSubtaskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addModalSubtask();
            }
        });

        // Modal Close Buttons
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.currentTarget.dataset.closeModal;
                const modal = document.getElementById(modalId);
                if (modal) modal.classList.add('hidden');
            });
        });

        // Close on clicking backdrop
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });

        // Add Category Modal
        document.getElementById('btnAddCategoryModal').addEventListener('click', () => {
            this.categoryModal.classList.remove('hidden');
        });

        this.categoryForm.addEventListener('submit', (e) => this.handleCategoryFormSubmit(e));

        // Backup & Help Modals
        document.getElementById('btnBackupModal').addEventListener('click', () => {
            this.backupModal.classList.remove('hidden');
        });

        document.getElementById('btnHelpModal').addEventListener('click', () => {
            this.helpModal.classList.remove('hidden');
        });

        // Refresh Stats button
        const refreshStatsBtn = document.getElementById('btnRefreshStats');
        if (refreshStatsBtn) {
            refreshStatsBtn.addEventListener('click', () => this.loadStats(true));
        }

        // Import Backup Trigger
        const triggerImportBtn = document.getElementById('btnTriggerImport');
        const importFileInput = document.getElementById('importFileInput');
        if (triggerImportBtn && importFileInput) {
            triggerImportBtn.addEventListener('click', () => importFileInput.click());
            importFileInput.addEventListener('change', (e) => this.handleFileImport(e));
        }

        // Reset Demo Data
        const resetDemoBtn = document.getElementById('btnResetDemo');
        if (resetDemoBtn) {
            resetDemoBtn.addEventListener('click', () => this.handleResetDemo());
        }

        // Kanban Drag and Drop listeners
        this.setupKanbanDragAndDrop();
    }

    // ===================== KEYBOARD SHORTCUTS =====================
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if active in an input/textarea and not Esc
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const isEditing = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.globalSearchInput.focus();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                this.sidebar.classList.toggle('collapsed');
                return;
            }

            if (isEditing) return;

            if (e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                this.openTaskModal();
            } else if (e.key === '1') {
                this.switchView('list');
            } else if (e.key === '2') {
                this.switchView('kanban');
            } else if (e.key === '3') {
                this.switchView('analytics');
            } else if (e.key === 'p' || e.key === 'P') {
                this.pomodoro.openModal();
            } else if (e.key === '/') {
                e.preventDefault();
                this.globalSearchInput.focus();
            }
        });
    }

    // ===================== VIEW SWITCHING =====================
    switchView(viewName) {
        if (!this.viewPanels[viewName]) return;
        this.currentView = viewName;

        this.viewButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        Object.keys(this.viewPanels).forEach(key => {
            this.viewPanels[key].classList.toggle('active', key === viewName);
        });

        if (viewName === 'kanban') {
            this.renderKanban();
        } else if (viewName === 'analytics') {
            this.loadStats(true);
        }
    }

    // ===================== DATA LOADING =====================
    async loadCategories() {
        try {
            const res = await window.API.getCategories();
            if (res.success) {
                this.categories = res.categories;
                this.renderCategories();
                this.populateCategoryDropdowns();
            }
        } catch (e) {
            console.error('Failed to load categories:', e);
        }
    }

    renderCategories() {
        this.categoryList.innerHTML = '';
        this.categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'category-item';
            if (this.activeFilter.category === cat.name) {
                item.classList.add('active');
            }
            item.innerHTML = `
                <span class="cat-dot" style="background-color: ${cat.color}"></span>
                <span class="cat-name">${cat.icon} ${cat.name}</span>
                <span class="badge">${cat.task_count || 0}</span>
            `;
            item.addEventListener('click', () => {
                document.querySelectorAll('.category-item').forEach(c => c.classList.remove('active'));
                this.sidebarNavItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                this.activeFilter.category = cat.name;
                this.activeFilter.due = 'all';
                this.activeFilter.status = '';
                this.viewTitle.textContent = `${cat.icon} ${cat.name}`;
                this.loadTasks();
            });
            this.categoryList.appendChild(item);
        });
    }

    populateCategoryDropdowns() {
        // Quick add dropdown
        this.quickTaskCategory.innerHTML = '';
        this.taskCategorySelect.innerHTML = '';

        this.categories.forEach(cat => {
            const opt1 = document.createElement('option');
            opt1.value = cat.name;
            opt1.textContent = `${cat.icon} ${cat.name}`;
            this.quickTaskCategory.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = cat.name;
            opt2.textContent = `${cat.icon} ${cat.name}`;
            this.taskCategorySelect.appendChild(opt2);
        });
    }

    async loadTasks() {
        try {
            const params = {
                sort_by: this.sortBy,
                order: this.sortOrder
            };

            if (this.activeFilter.status) params.status = this.activeFilter.status;
            if (this.activeFilter.category && this.activeFilter.category !== 'all') params.category = this.activeFilter.category;
            if (this.activeFilter.due && this.activeFilter.due !== 'all') params.due = this.activeFilter.due;
            if (this.activeFilter.priority && this.activeFilter.priority !== 'all') params.priority = this.activeFilter.priority;
            if (this.activeFilter.search) params.search = this.activeFilter.search;

            const res = await window.API.getTasks(params);
            if (res.success) {
                this.tasks = res.tasks;
                this.renderTaskList();
                if (this.currentView === 'kanban') {
                    this.renderKanban();
                }
                this.pomodoro.populateTasksDropdown(this.tasks);
                this.updateCounts();
            }
        } catch (e) {
            console.error('Failed to load tasks:', e);
            this.showToast('Failed to fetch tasks', 'error');
        }
    }

    async loadStats(renderCharts = false) {
        try {
            const res = await window.API.getStats();
            if (res.success) {
                this.stats = res.stats;
                this.updateSidebarWidget();
                if (renderCharts || this.currentView === 'analytics') {
                    this.renderAnalyticsCharts();
                }
            }
        } catch (e) {
            console.error('Failed to load stats:', e);
        }
    }

    updateCounts() {
        // Update sidebar badges from all loaded tasks or stats
        if (!this.stats) return;
        if (this.badges.all) this.badges.all.textContent = this.stats.total_tasks || 0;
        if (this.badges.today) this.badges.today.textContent = this.stats.due_today_tasks || 0;
        if (this.badges.overdue) this.badges.overdue.textContent = this.stats.overdue_tasks || 0;
        if (this.badges.completed) this.badges.completed.textContent = this.stats.completed_tasks || 0;
        if (this.badges.important) {
            const urgentCount = (this.stats.priority_breakdown?.urgent || 0) + (this.stats.priority_breakdown?.high || 0);
            this.badges.important.textContent = urgentCount;
        }

        // Subtitle count
        this.viewSubtitle.textContent = `Showing ${this.tasks.length} task${this.tasks.length === 1 ? '' : 's'}`;
    }

    updateSidebarWidget() {
        const rate = this.stats.completion_rate || 0;
        this.widgetCompletionRate.textContent = `${rate}%`;
        this.widgetProgressBar.style.width = `${rate}%`;
        this.widgetDoneToday.textContent = this.stats.completed_today || 0;
        this.widgetTotalPomos.textContent = `${this.stats.total_pomodoros || 0} 🍅`;
    }

    // ===================== LIST VIEW RENDERING =====================
    renderTaskList() {
        this.taskListContainer.innerHTML = '';

        if (!this.tasks || this.tasks.length === 0) {
            this.emptyState.classList.remove('hidden');
            return;
        }

        this.emptyState.classList.add('hidden');

        this.tasks.forEach(task => {
            const card = this.createTaskCardElement(task);
            this.taskListContainer.appendChild(card);
        });
    }

    createTaskCardElement(task) {
        const card = document.createElement('div');
        card.className = `task-item priority-${task.priority} ${task.completed ? 'completed-task' : ''}`;
        card.id = `task-card-${task.id}`;

        // Date calculations
        const dueInfo = this.formatDueDate(task.due_date);
        const subtasksTotal = task.subtasks ? task.subtasks.length : 0;
        const subtasksDone = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;

        card.innerHTML = `
            <div class="task-row-top">
                <div class="task-checkbox-wrap" title="${task.completed ? 'Mark Incomplete' : 'Mark Complete'}">
                    <div class="task-custom-check">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>

                <div class="task-main-info">
                    <span class="task-title">${this.escapeHTML(task.title)}</span>
                    ${task.description ? `<p class="task-description">${this.escapeHTML(task.description)}</p>` : ''}
                    
                    <div class="task-meta-bar">
                        <!-- Category tag -->
                        <span class="tag-pill">
                            <span>📁</span> ${this.escapeHTML(task.category)}
                        </span>

                        <!-- Priority tag -->
                        <span class="tag-pill tag-priority-${task.priority}">
                            ${this.getPriorityLabel(task.priority)}
                        </span>

                        <!-- Due Date tag -->
                        ${dueInfo ? `
                            <span class="tag-pill ${dueInfo.className}">
                                <span>📅</span> ${dueInfo.text}
                            </span>
                        ` : ''}

                        <!-- Recurring tag -->
                        ${task.recurring && task.recurring !== 'none' ? `
                            <span class="tag-pill" title="Recurring ${task.recurring}">
                                <span>🔄</span> ${task.recurring}
                            </span>
                        ` : ''}

                        <!-- Pomodoros -->
                        <span class="tag-pill" title="Completed Pomodoro Sessions">
                            <span>🍅</span> ${task.completed_pomodoros || 0}/${task.estimated_pomodoros || 1}
                        </span>

                        <!-- Subtasks count -->
                        ${subtasksTotal > 0 ? `
                            <span class="tag-pill">
                                <span>☑️</span> ${subtasksDone}/${subtasksTotal}
                            </span>
                        ` : ''}
                    </div>
                </div>

                <div class="task-actions">
                    <button class="task-action-btn btn-pomodoro" title="Focus on this task">
                        <span>🍅</span>
                    </button>
                    <button class="task-action-btn btn-edit" title="Edit Task">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </button>
                    <button class="task-action-btn btn-delete" title="Delete Task">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Subtasks inline section -->
            ${subtasksTotal > 0 ? `
                <div class="subtasks-collapse-wrap">
                    <button class="subtasks-toggle-btn">
                        <span>Checklist (${subtasksDone}/${subtasksTotal})</span>
                        <div class="subtasks-progress-mini">
                            <div class="subtasks-progress-mini-fill" style="width: ${subtasksTotal > 0 ? (subtasksDone / subtasksTotal * 100) : 0}%"></div>
                        </div>
                    </button>
                    <div class="subtasks-inline-list">
                        ${task.subtasks.map(st => `
                            <div class="subtask-inline-item ${st.completed ? 'completed' : ''}" data-subtask-id="${st.id}">
                                <input type="checkbox" class="subtask-checkbox" ${st.completed ? 'checked' : ''}>
                                <span>${this.escapeHTML(st.title)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        // Checkbox click
        const checkbox = card.querySelector('.task-checkbox-wrap');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTaskCompletion(task.id);
        });

        // Pomodoro launch
        const pomoBtn = card.querySelector('.btn-pomodoro');
        pomoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.pomodoro.setTask(task.id);
        });

        // Edit button
        const editBtn = card.querySelector('.btn-edit');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openTaskModal(task.id);
        });

        // Delete button
        const delBtn = card.querySelector('.btn-delete');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteTask(task.id);
        });

        // Subtask toggles
        card.querySelectorAll('.subtask-inline-item').forEach(item => {
            const stId = parseInt(item.dataset.subtaskId, 10);
            const chk = item.querySelector('.subtask-checkbox');
            chk.addEventListener('change', async (e) => {
                e.stopPropagation();
                try {
                    await window.API.toggleSubtask(stId);
                    this.loadTasks();
                } catch (err) {
                    this.showToast('Failed to toggle subtask', 'error');
                }
            });
        });

        return card;
    }

    formatDueDate(dueDateStr) {
        if (!dueDateStr) return null;
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const due = new Date(dueDateStr);
            due.setHours(0, 0, 0, 0);

            const diffTime = due.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                return {
                    text: `Overdue (${Math.abs(diffDays)}d ago)`,
                    className: 'tag-due-overdue'
                };
            } else if (diffDays === 0) {
                return {
                    text: 'Due Today',
                    className: 'tag-due-today'
                };
            } else if (diffDays === 1) {
                return {
                    text: 'Due Tomorrow',
                    className: ''
                };
            } else {
                return {
                    text: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    className: ''
                };
            }
        } catch (e) {
            return { text: dueDateStr, className: '' };
        }
    }

    getPriorityLabel(priority) {
        switch (priority) {
            case 'urgent': return '🔴 Urgent';
            case 'high': return '🟠 High';
            case 'medium': return '🟡 Medium';
            case 'low': return '🟢 Low';
            default: return priority;
        }
    }

    // ===================== KANBAN BOARD RENDERING =====================
    renderKanban() {
        Object.values(this.kanbanCols).forEach(col => col.innerHTML = '');

        const counts = { todo: 0, in_progress: 0, completed: 0 };

        this.tasks.forEach(task => {
            const status = task.status || (task.completed ? 'completed' : 'todo');
            if (counts[status] !== undefined) {
                counts[status]++;
            }

            const card = this.createKanbanCardElement(task);
            if (this.kanbanCols[status]) {
                this.kanbanCols[status].appendChild(card);
            }
        });

        document.getElementById('kanbanCountTodo').textContent = counts.todo;
        document.getElementById('kanbanCountInProgress').textContent = counts.in_progress;
        document.getElementById('kanbanCountCompleted').textContent = counts.completed;
    }

    createKanbanCardElement(task) {
        const card = document.createElement('div');
        card.className = `kanban-card priority-${task.priority}`;
        card.setAttribute('draggable', 'true');
        card.dataset.taskId = task.id;

        const dueInfo = this.formatDueDate(task.due_date);
        const subtasksTotal = task.subtasks ? task.subtasks.length : 0;
        const subtasksDone = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;

        card.innerHTML = `
            <div class="kanban-card-title">${this.escapeHTML(task.title)}</div>
            <div class="task-meta-bar">
                <span class="tag-pill">📁 ${this.escapeHTML(task.category)}</span>
                <span class="tag-pill tag-priority-${task.priority}">${this.getPriorityLabel(task.priority)}</span>
                ${dueInfo ? `<span class="tag-pill ${dueInfo.className}">📅 ${dueInfo.text}</span>` : ''}
            </div>
            <div class="kanban-card-footer">
                <span class="tag-pill">🍅 ${task.completed_pomodoros || 0}/${task.estimated_pomodoros || 1}</span>
                ${subtasksTotal > 0 ? `<span class="tag-pill">☑️ ${subtasksDone}/${subtasksTotal}</span>` : ''}
                <div class="task-actions">
                    <button class="task-action-btn btn-edit-kanban" title="Edit">✏️</button>
                </div>
            </div>
        `;

        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task.id);
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });

        const editBtn = card.querySelector('.btn-edit-kanban');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openTaskModal(task.id);
            });
        }

        return card;
    }

    setupKanbanDragAndDrop() {
        const columns = document.querySelectorAll('.kanban-column');
        columns.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.classList.add('drag-over');
            });

            col.addEventListener('dragleave', () => {
                col.classList.remove('drag-over');
            });

            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');

                const taskId = e.dataTransfer.getData('text/plain');
                const targetStatus = col.dataset.status;

                if (!taskId || !targetStatus) return;

                try {
                    await window.API.updateTaskStatus(parseInt(taskId, 10), targetStatus);
                    this.showToast(`Task moved to ${targetStatus.replace('_', ' ')}`, 'success');
                    await this.loadTasks();
                    await this.loadStats();
                } catch (err) {
                    this.showToast('Failed to update task status', 'error');
                }
            });
        });
    }

    // ===================== ANALYTICS CHARTS RENDERING =====================
    renderAnalyticsCharts() {
        if (!this.stats) return;

        // Stat Numbers
        document.getElementById('statsTotal').textContent = this.stats.total_tasks || 0;
        document.getElementById('statsCompleted').textContent = this.stats.completed_tasks || 0;
        document.getElementById('statsPending').textContent = this.stats.pending_tasks || 0;
        document.getElementById('statsOverdue').textContent = this.stats.overdue_tasks || 0;

        // Radial Circle
        const rate = this.stats.completion_rate || 0;
        const radialProg = document.getElementById('analyticsRadialProgress');
        const radialText = document.getElementById('analyticsRadialText');
        if (radialProg) radialProg.setAttribute('stroke-dasharray', `${rate}, 100`);
        if (radialText) radialText.textContent = `${rate}%`;

        document.getElementById('analyticsDoneToday').textContent = this.stats.completed_today || 0;
        document.getElementById('analyticsTotalPomos').textContent = this.stats.total_pomodoros || 0;

        const healthElem = document.getElementById('analyticsHealthStatus');
        if (rate >= 70) {
            healthElem.textContent = 'Excellent';
            healthElem.className = 'badge badge-success';
        } else if (rate >= 40) {
            healthElem.textContent = 'On Track';
            healthElem.className = 'badge badge-accent';
        } else {
            healthElem.textContent = 'Needs Attention';
            healthElem.className = 'badge badge-warning';
        }

        // Priority Breakdown Bars
        const priorityBars = document.getElementById('priorityBarsContainer');
        priorityBars.innerHTML = '';
        const priorityColors = {
            urgent: 'var(--danger)',
            high: 'var(--warning)',
            medium: '#3b82f6',
            low: 'var(--success)'
        };

        const totalTasks = this.stats.total_tasks || 1;
        ['urgent', 'high', 'medium', 'low'].forEach(p => {
            const count = this.stats.priority_breakdown?.[p] || 0;
            const pct = Math.round((count / totalTasks) * 100);
            const row = document.createElement('div');
            row.className = 'bar-row';
            row.innerHTML = `
                <div class="bar-label-wrap">
                    <span>${this.getPriorityLabel(p)}</span>
                    <span>${count} (${pct}%)</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${pct}%; background-color: ${priorityColors[p]}"></div>
                </div>
            `;
            priorityBars.appendChild(row);
        });

        // Category Breakdown Bars
        const catBars = document.getElementById('categoryBarsContainer');
        catBars.innerHTML = '';
        const catBreakdown = this.stats.category_breakdown || {};
        const catNames = Object.keys(catBreakdown);

        if (catNames.length === 0) {
            catBars.innerHTML = '<p class="text-muted">No category data available yet.</p>';
        } else {
            catNames.forEach(cName => {
                const count = catBreakdown[cName] || 0;
                const pct = Math.round((count / totalTasks) * 100);
                const matchedCat = this.categories.find(c => c.name === cName);
                const color = matchedCat ? matchedCat.color : '#8b5cf6';
                const icon = matchedCat ? matchedCat.icon : '📁';

                const row = document.createElement('div');
                row.className = 'bar-row';
                row.innerHTML = `
                    <div class="bar-label-wrap">
                        <span>${icon} ${this.escapeHTML(cName)}</span>
                        <span>${count} tasks (${pct}%)</span>
                    </div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${pct}%; background-color: ${color}"></div>
                    </div>
                `;
                catBars.appendChild(row);
            });
        }
    }

    // ===================== QUICK ADD TASK =====================
    async handleQuickAdd(e) {
        e.preventDefault();
        const title = this.quickTaskTitle.value.trim();
        if (!title) return;

        const payload = {
            title: title,
            category: this.quickTaskCategory.value || 'Work',
            priority: this.quickTaskPriority.value || 'medium',
            due_date: this.quickTaskDueDate.value || null,
            status: 'todo',
            estimated_pomodoros: 1
        };

        try {
            const res = await window.API.createTask(payload);
            if (res.success) {
                this.quickTaskTitle.value = '';
                this.quickTaskDueDate.value = '';
                this.showToast('Task created successfully!', 'success');
                await this.loadTasks();
                await this.loadStats();
                await this.loadCategories();
            }
        } catch (err) {
            this.showToast(err.message || 'Error creating task', 'error');
        }
    }

    // ===================== TASK MODAL (CREATE / EDIT) =====================
    async openTaskModal(taskId = null, defaultValues = {}) {
        this.editingTaskId = taskId;
        this.modalSubtasks = [];

        if (taskId) {
            this.taskModalTitle.textContent = 'Edit Task';
            try {
                const res = await window.API.getTask(taskId);
                if (res.success) {
                    const task = res.task;
                    this.taskFormId.value = task.id;
                    this.taskTitleInput.value = task.title;
                    this.taskDescInput.value = task.description || '';
                    this.taskCategorySelect.value = task.category;
                    this.taskPrioritySelect.value = task.priority;
                    this.taskDueDateInput.value = task.due_date || '';
                    this.taskStatusSelect.value = task.status;
                    this.taskRecurringSelect.value = task.recurring || 'none';
                    this.taskEstimatedPomos.value = task.estimated_pomodoros || 1;

                    this.modalSubtasks = (task.subtasks || []).map(s => ({
                        title: s.title,
                        completed: s.completed ? 1 : 0
                    }));
                }
            } catch (err) {
                this.showToast('Failed to load task details', 'error');
                return;
            }
        } else {
            this.taskModalTitle.textContent = 'Create Task';
            this.taskForm.reset();
            this.taskFormId.value = '';
            this.taskPrioritySelect.value = 'medium';
            this.taskStatusSelect.value = defaultValues.status || 'todo';
            this.taskRecurringSelect.value = 'none';
            this.taskEstimatedPomos.value = 1;

            if (this.activeFilter.category && this.activeFilter.category !== 'all') {
                this.taskCategorySelect.value = this.activeFilter.category;
            }
        }

        this.renderModalSubtasks();
        this.taskModal.classList.remove('hidden');
        this.taskTitleInput.focus();
    }

    renderModalSubtasks() {
        this.subtasksListContainer.innerHTML = '';
        this.modalSubtasks.forEach((st, idx) => {
            const item = document.createElement('div');
            item.className = `modal-subtask-item ${st.completed ? 'done' : ''}`;
            item.innerHTML = `
                <input type="checkbox" ${st.completed ? 'checked' : ''} data-idx="${idx}">
                <span style="flex: 1">${this.escapeHTML(st.title)}</span>
                <button type="button" class="btn-text-sm" data-remove-idx="${idx}" title="Delete step">&times;</button>
            `;

            item.querySelector('input').addEventListener('change', (e) => {
                this.modalSubtasks[idx].completed = e.target.checked ? 1 : 0;
                item.classList.toggle('done', e.target.checked);
            });

            item.querySelector('[data-remove-idx]').addEventListener('click', () => {
                this.modalSubtasks.splice(idx, 1);
                this.renderModalSubtasks();
            });

            this.subtasksListContainer.appendChild(item);
        });
    }

    addModalSubtask() {
        const title = this.newSubtaskInput.value.trim();
        if (!title) return;
        this.modalSubtasks.push({ title: title, completed: 0 });
        this.newSubtaskInput.value = '';
        this.renderModalSubtasks();
        this.newSubtaskInput.focus();
    }

    async handleTaskFormSubmit(e) {
        e.preventDefault();
        const title = this.taskTitleInput.value.trim();
        if (!title) return;

        const payload = {
            title: title,
            description: this.taskDescInput.value.trim(),
            category: this.taskCategorySelect.value,
            priority: this.taskPrioritySelect.value,
            due_date: this.taskDueDateInput.value || null,
            status: this.taskStatusSelect.value,
            recurring: this.taskRecurringSelect.value,
            estimated_pomodoros: parseInt(this.taskEstimatedPomos.value, 10) || 1,
            subtasks: this.modalSubtasks
        };

        try {
            if (this.editingTaskId) {
                await window.API.updateTask(this.editingTaskId, payload);
                this.showToast('Task updated successfully', 'success');
            } else {
                await window.API.createTask(payload);
                this.showToast('Task created successfully', 'success');
            }

            this.taskModal.classList.add('hidden');
            await this.loadTasks();
            await this.loadStats();
            await this.loadCategories();
        } catch (err) {
            this.showToast(err.message || 'Error saving task', 'error');
        }
    }

    // ===================== TASK ACTIONS =====================
    async toggleTaskCompletion(taskId) {
        try {
            const res = await window.API.toggleTask(taskId);
            if (res.success) {
                this.showToast(res.message, 'success');
                await this.loadTasks();
                await this.loadStats();
                await this.loadCategories();
            }
        } catch (err) {
            this.showToast('Failed to toggle task', 'error');
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            const res = await window.API.deleteTask(taskId);
            if (res.success) {
                this.showToast('Task deleted', 'warning');
                await this.loadTasks();
                await this.loadStats();
                await this.loadCategories();
            }
        } catch (err) {
            this.showToast('Failed to delete task', 'error');
        }
    }

    // ===================== CATEGORY CREATION =====================
    async handleCategoryFormSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('catNameInput').value.trim();
        const icon = document.getElementById('catIconInput').value.trim() || '📁';
        const color = document.getElementById('catColorInput').value || '#3b82f6';

        if (!name) return;

        try {
            const res = await window.API.createCategory({ name, icon, color });
            if (res.success) {
                this.categoryForm.reset();
                this.categoryModal.classList.add('hidden');
                this.showToast(`Category "${name}" created!`, 'success');
                await this.loadCategories();
            }
        } catch (err) {
            this.showToast(err.message || 'Error creating category', 'error');
        }
    }

    // ===================== DATA IMPORT & RESET =====================
    async handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const tasksArray = data.tasks || (Array.isArray(data) ? data : []);

            if (tasksArray.length === 0) {
                this.showToast('No valid tasks found in JSON file', 'error');
                return;
            }

            const res = await window.API.importTasks(tasksArray);
            if (res.success) {
                this.showToast(res.message, 'success');
                this.backupModal.classList.add('hidden');
                await this.loadCategories();
                await this.loadTasks();
                await this.loadStats();
            }
        } catch (err) {
            this.showToast('Invalid JSON file format', 'error');
        } finally {
            e.target.value = '';
        }
    }

    async handleResetDemo() {
        if (!confirm('Reset tasks back to original demo dataset? Any custom tasks will be overwritten.')) return;
        try {
            const res = await window.API.resetDemoData();
            if (res.success) {
                this.showToast(res.message, 'success');
                this.backupModal.classList.add('hidden');
                await this.loadCategories();
                await this.loadTasks();
                await this.loadStats();
            }
        } catch (err) {
            this.showToast('Failed to reset demo data', 'error');
        }
    }

    // ===================== TOAST SYSTEM =====================
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : (type === 'warning' ? '⚠️' : 'ℹ️'));
        toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHTML(message)}</span>`;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, 3200);
    }

    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TaskFlowApp();
});
