# 🚀 TaskFlow &bull; Modern To-Do & Task Management System

A high-performance, full-featured Task Management Application built with **Python**, **Flask**, **HTML5**, **CSS3**, and **Vanilla JavaScript**. Designed with modern UX principles inspired by industry-leading productivity apps (such as Linear, Things 3, and Notion).

![TaskFlow Status](https://img.shields.io/badge/Status-Complete-success)
![Python Version](https://img.shields.io/badge/Python-3.10%2B-blue)
![Flask Version](https://img.shields.io/badge/Flask-3.x-informational)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Key Features & Enhancements

### 1. 📋 Dual Productivity Views
- **Interactive List View**: Compact and clean task checklist with priority stripes, due dates, subtask progress, and hover actions.
- **Kanban Board**: Drag-and-drop workflow columns (**To Do**, **In Progress**, and **Completed**) with live state persistence.
- **Productivity Analytics Dashboard**: Visual radial progress meter, daily completion streak, tasks by priority, and tasks by category.

### 2. ⚡ Powerful Task Management
- **Task Attributes**: Title, multiline description/notes, categories, priority (`Urgent`, `High`, `Medium`, `Low`), due dates, status, and recurrence.
- **Interactive Subtasks / Checklists**: Add multiple steps to any task with real-time completion progress tracking (`3/5 steps completed`).
- **Recurring Schedules**: Daily, Weekly, and Monthly recurrence that automatically queues the next iteration upon task completion.
- **Categories with Custom Badges**: Color-coded project tags with emojis (Work, Personal, Coding, Health, Learning, Finance, plus custom categories).

### 3. 🍅 Built-in Pomodoro Focus Timer
- Integrated Pomodoro focus timer with modes for **Focus (25m)**, **Short Break (5m)**, and **Long Break (15m)**.
- Link timer directly to an active task; completed pomodoro sessions automatically increment on that task and update total metrics.
- Web Audio API synthesizer for pleasant chime notifications (no external audio files required).

### 4. 🎨 Design & Experience
- **Dark & Light Mode Toggle**: Seamless switching with local storage persistence.
- **Responsive Layout**: Collapsible sidebar, mobile drawer support, and high-DPI icons.
- **Instant Search & Multi-Filters**: Instant client/server search with real-time debouncing, filtering by Today, Upcoming, Overdue, and Priority.
- **Toast Notifications**: Interactive status notifications for all create, update, and delete actions.

### 5. ⌨️ Keyboard Shortcuts
- <kbd>N</kbd> — Create a new task
- <kbd>Ctrl</kbd> + <kbd>K</kbd> or <kbd>/</kbd> — Focus search bar
- <kbd>1</kbd> — Switch to List View
- <kbd>2</kbd> — Switch to Kanban Board View
- <kbd>3</kbd> — Switch to Analytics Dashboard
- <kbd>P</kbd> — Open Pomodoro Focus Timer
- <kbd>Ctrl</kbd> + <kbd>B</kbd> — Toggle Sidebar
- <kbd>Esc</kbd> — Close any open modal dialog

### 6. 💾 Data Portability & Safety
- **Export**: One-click download of your tasks as structured **JSON** or spreadsheet-compatible **CSV**.
- **Import**: Restore tasks from JSON backups with instant merge.
- **Sample Data Reset**: Re-seed sample data whenever you want to test or demo features.

---

## 🏗️ Project Architecture

```
To-Do-Task-Management-System/
├── app.py                   # Flask server, RESTful API endpoints, error handling
├── database.py              # SQLite database manager, schema migrations, CRUD logic
├── requirements.txt         # Minimal Python dependencies (Flask)
├── test_app.py              # Comprehensive automated unit & integration test suite
├── README.md                # System documentation & setup guide
├── static/
│   ├── css/
│   │   └── style.css        # Responsive stylesheet with CSS variables & Dark/Light theme
│   └── js/
│       ├── api.js           # REST API client wrapper
│       ├── pomodoro.js      # Built-in Pomodoro focus timer & Web Audio chime
│       └── app.js           # Main UI state controller, Kanban drag-and-drop, keyboard events
└── templates/
    └── index.html           # Accessible HTML5 Single Page Application dashboard
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+ installed on your system.

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Application
```bash
python app.py
```
*(On Windows systems, you can also run `py app.py`)*

### 3. Open in Your Browser
Open your favorite browser and visit:
```
http://127.0.0.1:5000
```
The database (`tasks.db`) will be automatically created with realistic seed tasks on the first run.

---

## 🧪 Running the Automated Test Suite

To run the unit and integration tests covering all REST API endpoints:
```bash
python test_app.py
```
*(Or `py test_app.py`)*

---

## 📡 RESTful API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | Get filtered/sorted tasks (`?status=&category=&priority=&due=&search=&sort_by=&order=`) |
| `POST` | `/api/tasks` | Create a new task (supports subtasks) |
| `GET` | `/api/tasks/<id>` | Fetch single task by ID |
| `PUT` | `/api/tasks/<id>` | Update full task details |
| `PATCH` | `/api/tasks/<id>/toggle` | Toggle task completion state |
| `PATCH` | `/api/tasks/<id>/status` | Update task workflow status (`todo`, `in_progress`, `completed`) |
| `PATCH` | `/api/tasks/<id>/pomodoro`| Increment completed Pomodoro count |
| `DELETE`| `/api/tasks/<id>` | Delete a task (cascades to subtasks) |
| `POST` | `/api/tasks/<id>/subtasks`| Add checklist subtask to task |
| `PATCH` | `/api/subtasks/<id>/toggle`| Toggle subtask completion |
| `DELETE`| `/api/subtasks/<id>` | Delete subtask |
| `GET` | `/api/stats` | Retrieve productivity metrics & completion breakdown |
| `GET` | `/api/categories` | List categories with task counts |
| `POST` | `/api/categories` | Create custom category |
| `GET` | `/api/export` | Download tasks as JSON (`?format=json`) or CSV (`?format=csv`) |
| `POST` | `/api/import` | Import tasks from JSON payload |
| `POST` | `/api/reset-demo` | Reset database to sample dataset |

---

## 📄 License
This project is open-source and available under the **MIT License**.
