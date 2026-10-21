"""
database.py - SQLite Database manager for To-Do Task Management System.
Handles schema initialization, migrations, CRUD operations, and sample seed data.
"""

import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any, Generator

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks.db")


@contextmanager
def db_session() -> Generator[sqlite3.Connection, None, None]:
    """Yields an SQLite connection with Row factory and ensures it is cleanly closed."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Initializes the database schema and seeds initial data if empty."""
    with db_session() as conn:
        cursor = conn.cursor()

        # Tasks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                category TEXT DEFAULT 'Work',
                priority TEXT DEFAULT 'medium', -- urgent, high, medium, low
                status TEXT DEFAULT 'todo',       -- todo, in_progress, completed
                due_date TEXT,                    -- ISO format YYYY-MM-DD or YYYY-MM-DDTHH:MM
                completed INTEGER DEFAULT 0,      -- 0 or 1
                completed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                estimated_pomodoros INTEGER DEFAULT 1,
                completed_pomodoros INTEGER DEFAULT 0,
                recurring TEXT DEFAULT 'none'     -- none, daily, weekly, monthly
            )
        """)

        # Subtasks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS subtasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
            )
        """)

        # Categories table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT NOT NULL,
                icon TEXT NOT NULL
            )
        """)

        conn.commit()

        # Seed initial categories if none exist
        cursor.execute("SELECT COUNT(*) AS count FROM categories")
        if cursor.fetchone()["count"] == 0:
            default_categories = [
                ("Work", "#3b82f6", "💼"),
                ("Personal", "#10b981", "👤"),
                ("Coding", "#8b5cf6", "💻"),
                ("Health", "#ef4444", "🏃"),
                ("Learning", "#f59e0b", "📚"),
                ("Finance", "#14b8a6", "💰")
            ]
            cursor.executemany(
                "INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)",
                default_categories
            )
            conn.commit()

        # Seed sample tasks if tasks table is empty
        cursor.execute("SELECT COUNT(*) AS count FROM tasks")
        if cursor.fetchone()["count"] == 0:
            seed_sample_tasks(cursor)
            conn.commit()


def seed_sample_tasks(cursor: sqlite3.Cursor) -> None:
    """Populates the database with helpful, realistic demo tasks."""
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    tomorrow_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    next_week_str = (now + timedelta(days=5)).strftime("%Y-%m-%d")
    yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    sample_tasks = [
        (
            "Review pull request for authentication module",
            "Examine unit tests, check token expiration logic, and approve PR #42.",
            "Coding",
            "urgent",
            "in_progress",
            today_str,
            0,
            None,
            now.isoformat(),
            now.isoformat(),
            3,
            1,
            "none",
            [
                ("Verify JWT validation", 1),
                ("Run test suite", 1),
                ("Check security boundary edge cases", 0),
                ("Approve and merge PR", 0)
            ]
        ),
        (
            "Prepare weekly status report & roadmap",
            "Aggregate metrics from Jira, highlight achievements, and draft next week milestones.",
            "Work",
            "high",
            "todo",
            tomorrow_str,
            0,
            None,
            now.isoformat(),
            now.isoformat(),
            2,
            0,
            "weekly",
            [
                ("Gather Sprint velocity metrics", 0),
                ("Write executive summary", 0),
                ("Share with team leads", 0)
            ]
        ),
        (
            "30-minute cardio and core workout",
            "Daily workout routine: 15 min HIIT followed by 15 min core stretches.",
            "Health",
            "medium",
            "todo",
            today_str,
            0,
            None,
            now.isoformat(),
            now.isoformat(),
            1,
            0,
            "daily",
            [
                ("5 min warm-up", 0),
                ("20 min cardio workout", 0),
                ("5 min cool down stretch", 0)
            ]
        ),
        (
            "Finish reading Chapter 4: System Architecture",
            "Read Designing Data-Intensive Applications chapter on replication and partitioning.",
            "Learning",
            "low",
            "todo",
            next_week_str,
            0,
            None,
            now.isoformat(),
            now.isoformat(),
            2,
            0,
            "none",
            [
                ("Read sections 4.1 to 4.3", 0),
                ("Take notes in Obsidian", 0)
            ]
        ),
        (
            "Pay monthly electricity & internet bills",
            "Download invoice receipts and process via net banking portal.",
            "Finance",
            "high",
            "completed",
            yesterday_str,
            1,
            (now - timedelta(hours=12)).isoformat(),
            (now - timedelta(days=2)).isoformat(),
            (now - timedelta(hours=12)).isoformat(),
            1,
            1,
            "monthly",
            [
                ("Download electricity bill", 1),
                ("Transfer payment", 1),
                ("Archive invoice receipt", 1)
            ]
        )
    ]

    for item in sample_tasks:
        subtasks = item[13]
        task_data = item[:13]
        cursor.execute("""
            INSERT INTO tasks (
                title, description, category, priority, status,
                due_date, completed, completed_at, created_at,
                updated_at, estimated_pomodoros, completed_pomodoros, recurring
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, task_data)
        task_id = cursor.lastrowid
        for st_title, st_completed in subtasks:
            cursor.execute("""
                INSERT INTO subtasks (task_id, title, completed, created_at)
                VALUES (?, ?, ?, ?)
            """, (task_id, st_title, st_completed, now.isoformat()))


# ===================== TASK CRUD FUNCTIONS =====================

def get_all_tasks(
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    filter_due: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "due_date",
    order: str = "asc"
) -> List[Dict[str, Any]]:
    """Retrieves tasks matching query filters and sorting preferences."""
    today = date.today().strftime("%Y-%m-%d")

    query = "SELECT * FROM tasks WHERE 1=1"
    params: List[Any] = []

    if status:
        if status == "completed":
            query += " AND completed = 1"
        elif status == "pending":
            query += " AND completed = 0"
        else:
            query += " AND status = ?"
            params.append(status)

    if category and category.lower() != "all":
        query += " AND category = ?"
        params.append(category)

    if priority and priority.lower() != "all":
        query += " AND priority = ?"
        params.append(priority.lower())

    if search:
        query += " AND (title LIKE ? OR description LIKE ?)"
        wildcard = f"%{search.strip()}%"
        params.extend([wildcard, wildcard])

    if filter_due:
        if filter_due == "today":
            query += " AND date(due_date) = date(?)"
            params.append(today)
        elif filter_due == "upcoming":
            query += " AND date(due_date) > date(?)"
            params.append(today)
        elif filter_due == "overdue":
            query += " AND date(due_date) < date(?) AND completed = 0"
            params.append(today)
        elif filter_due == "important":
            query += " AND priority IN ('urgent', 'high')"

    # Sorting
    valid_sort_columns = {
        "due_date": "due_date",
        "created_at": "created_at",
        "priority": "CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END",
        "title": "title",
        "status": "status"
    }

    sort_col = valid_sort_columns.get(sort_by, "due_date")
    direction = "DESC" if order.lower() == "desc" else "ASC"

    # NULL due dates should appear at the end for due_date sorting
    if sort_by == "due_date":
        query += f" ORDER BY (due_date IS NULL OR due_date = ''), {sort_col} {direction}, id DESC"
    else:
        query += f" ORDER BY {sort_col} {direction}, id DESC"

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        tasks = []
        for row in rows:
            task = dict(row)
            task["subtasks"] = get_subtasks_for_task(task["id"], cursor)
            tasks.append(task)
        return tasks


def get_task_by_id(task_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves a single task along with its subtasks."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        if not row:
            return None
        task = dict(row)
        task["subtasks"] = get_subtasks_for_task(task_id, cursor)
        return task


def create_task(data: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a new task and associated subtasks."""
    now = datetime.now().isoformat()
    title = data.get("title", "").strip()
    if not title:
        raise ValueError("Task title is required.")

    description = data.get("description", "").strip()
    category = data.get("category", "Work")
    priority = data.get("priority", "medium").lower()
    status = data.get("status", "todo")
    due_date = data.get("due_date") or None
    estimated_pomodoros = int(data.get("estimated_pomodoros", 1) or 1)
    recurring = data.get("recurring", "none")

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tasks (
                title, description, category, priority, status,
                due_date, completed, completed_at, created_at,
                updated_at, estimated_pomodoros, completed_pomodoros, recurring
            ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, 0, ?)
        """, (
            title, description, category, priority, status,
            due_date, now, now, estimated_pomodoros, recurring
        ))
        task_id = cursor.lastrowid

        subtasks = data.get("subtasks", [])
        for st in subtasks:
            st_title = st.get("title", "").strip() if isinstance(st, dict) else str(st).strip()
            if st_title:
                cursor.execute("""
                    INSERT INTO subtasks (task_id, title, completed, created_at)
                    VALUES (?, ?, 0, ?)
                """, (task_id, st_title, now))

        conn.commit()

    return get_task_by_id(task_id)  # type: ignore


def update_task(task_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Updates an existing task's fields and manages subtasks."""
    existing = get_task_by_id(task_id)
    if not existing:
        return None

    now = datetime.now().isoformat()
    title = data.get("title", existing["title"]).strip()
    description = data.get("description", existing["description"])
    category = data.get("category", existing["category"])
    priority = data.get("priority", existing["priority"]).lower()
    status = data.get("status", existing["status"])
    due_date = data.get("due_date", existing["due_date"])
    recurring = data.get("recurring", existing.get("recurring", "none"))
    estimated_pomodoros = int(data.get("estimated_pomodoros", existing.get("estimated_pomodoros", 1)))
    completed_pomodoros = int(data.get("completed_pomodoros", existing.get("completed_pomodoros", 0)))

    completed = 1 if status == "completed" or data.get("completed") else 0
    completed_at = now if completed and not existing["completed"] else (None if not completed else existing["completed_at"])

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE tasks SET
                title = ?,
                description = ?,
                category = ?,
                priority = ?,
                status = ?,
                due_date = ?,
                completed = ?,
                completed_at = ?,
                updated_at = ?,
                estimated_pomodoros = ?,
                completed_pomodoros = ?,
                recurring = ?
            WHERE id = ?
        """, (
            title, description, category, priority, status,
            due_date, completed, completed_at, now,
            estimated_pomodoros, completed_pomodoros, recurring, task_id
        ))

        # Update subtasks if provided in payload
        if "subtasks" in data:
            cursor.execute("DELETE FROM subtasks WHERE task_id = ?", (task_id,))
            for st in data["subtasks"]:
                st_title = st.get("title", "").strip() if isinstance(st, dict) else str(st).strip()
                st_completed = 1 if (isinstance(st, dict) and st.get("completed")) else 0
                if st_title:
                    cursor.execute("""
                        INSERT INTO subtasks (task_id, title, completed, created_at)
                        VALUES (?, ?, ?, ?)
                    """, (task_id, st_title, st_completed, now))

        conn.commit()

    return get_task_by_id(task_id)


def toggle_task(task_id: int) -> Optional[Dict[str, Any]]:
    """Toggles task completed state and advances recurring tasks."""
    existing = get_task_by_id(task_id)
    if not existing:
        return None

    now = datetime.now()
    new_completed = 0 if existing["completed"] else 1
    new_status = "completed" if new_completed else "todo"
    new_completed_at = now.isoformat() if new_completed else None

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE tasks SET
                completed = ?,
                status = ?,
                completed_at = ?,
                updated_at = ?
            WHERE id = ?
        """, (new_completed, new_status, new_completed_at, now.isoformat(), task_id))

        # Check recurring logic: if completing a recurring task, schedule the next iteration!
        recurring = existing.get("recurring", "none")
        if new_completed == 1 and recurring and recurring != "none" and existing.get("due_date"):
            try:
                due_dt = datetime.fromisoformat(existing["due_date"])
                if recurring == "daily":
                    next_due = (due_dt + timedelta(days=1)).strftime("%Y-%m-%d")
                elif recurring == "weekly":
                    next_due = (due_dt + timedelta(days=7)).strftime("%Y-%m-%d")
                elif recurring == "monthly":
                    next_due = (due_dt + timedelta(days=30)).strftime("%Y-%m-%d")
                else:
                    next_due = existing["due_date"]

                # Create next recurring iteration
                cursor.execute("""
                    INSERT INTO tasks (
                        title, description, category, priority, status,
                        due_date, completed, completed_at, created_at,
                        updated_at, estimated_pomodoros, completed_pomodoros, recurring
                    ) VALUES (?, ?, ?, ?, 'todo', ?, 0, NULL, ?, ?, ?, 0, ?)
                """, (
                    existing["title"],
                    existing["description"],
                    existing["category"],
                    existing["priority"],
                    next_due,
                    now.isoformat(),
                    now.isoformat(),
                    existing.get("estimated_pomodoros", 1),
                    recurring
                ))
            except Exception:
                pass

        conn.commit()

    return get_task_by_id(task_id)


def update_task_status(task_id: int, status: str) -> Optional[Dict[str, Any]]:
    """Updates status for Kanban drag-and-drop ('todo', 'in_progress', 'completed')."""
    valid_statuses = {"todo", "in_progress", "completed"}
    if status not in valid_statuses:
        raise ValueError(f"Invalid status: {status}")

    now = datetime.now()
    completed = 1 if status == "completed" else 0
    completed_at = now.isoformat() if completed else None

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE tasks SET
                status = ?,
                completed = ?,
                completed_at = ?,
                updated_at = ?
            WHERE id = ?
        """, (status, completed, completed_at, now.isoformat(), task_id))
        conn.commit()

    return get_task_by_id(task_id)


def delete_task(task_id: int) -> bool:
    """Deletes a task and cascades to its subtasks."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        return cursor.rowcount > 0


# ===================== SUBTASK FUNCTIONS =====================

def get_subtasks_for_task(task_id: int, cursor: Optional[sqlite3.Cursor] = None) -> List[Dict[str, Any]]:
    """Returns all subtasks for a task."""
    sql = "SELECT * FROM subtasks WHERE task_id = ? ORDER BY id ASC"
    if cursor:
        cursor.execute(sql, (task_id,))
        return [dict(row) for row in cursor.fetchall()]
    with db_session() as conn:
        c = conn.cursor()
        c.execute(sql, (task_id,))
        return [dict(row) for row in c.fetchall()]


def add_subtask(task_id: int, title: str) -> Dict[str, Any]:
    """Adds a single subtask to a task."""
    title = title.strip()
    if not title:
        raise ValueError("Subtask title cannot be empty.")
    now = datetime.now().isoformat()
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO subtasks (task_id, title, completed, created_at)
            VALUES (?, ?, 0, ?)
        """, (task_id, title, now))
        conn.commit()
        subtask_id = cursor.lastrowid
        cursor.execute("SELECT * FROM subtasks WHERE id = ?", (subtask_id,))
        return dict(cursor.fetchone())


def toggle_subtask(subtask_id: int) -> Optional[Dict[str, Any]]:
    """Toggles completed state of a subtask."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM subtasks WHERE id = ?", (subtask_id,))
        row = cursor.fetchone()
        if not row:
            return None
        new_val = 0 if row["completed"] else 1
        cursor.execute("UPDATE subtasks SET completed = ? WHERE id = ?", (new_val, subtask_id))
        conn.commit()
        cursor.execute("SELECT * FROM subtasks WHERE id = ?", (subtask_id,))
        return dict(cursor.fetchone())


def delete_subtask(subtask_id: int) -> bool:
    """Deletes a subtask."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM subtasks WHERE id = ?", (subtask_id,))
        conn.commit()
        return cursor.rowcount > 0


# ===================== CATEGORIES & STATS =====================

def get_all_categories() -> List[Dict[str, Any]]:
    """Returns categories with task count per category."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.id, c.name, c.color, c.icon,
                   COUNT(t.id) AS task_count,
                   SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) AS completed_count
            FROM categories c
            LEFT JOIN tasks t ON c.name = t.category
            GROUP BY c.id, c.name, c.color, c.icon
            ORDER BY c.id ASC
        """)
        return [dict(r) for r in cursor.fetchall()]


def add_category(name: str, color: str = "#6366f1", icon: str = "📁") -> Dict[str, Any]:
    """Adds a new custom category."""
    name = name.strip()
    if not name:
        raise ValueError("Category name cannot be empty.")
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)", (name, color, icon))
        conn.commit()
        cat_id = cursor.lastrowid
        cursor.execute("SELECT * FROM categories WHERE id = ?", (cat_id,))
        return dict(cursor.fetchone())


def get_dashboard_stats() -> Dict[str, Any]:
    """Calculates overall task statistics and productivity metrics."""
    today = date.today().strftime("%Y-%m-%d")

    with db_session() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) AS total FROM tasks")
        total_tasks = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) AS completed FROM tasks WHERE completed = 1")
        completed_tasks = cursor.fetchone()["completed"]

        cursor.execute("SELECT COUNT(*) AS pending FROM tasks WHERE completed = 0")
        pending_tasks = cursor.fetchone()["pending"]

        cursor.execute("""
            SELECT COUNT(*) AS overdue FROM tasks
            WHERE completed = 0 AND due_date IS NOT NULL AND due_date != '' AND date(due_date) < date(?)
        """, (today,))
        overdue_tasks = cursor.fetchone()["overdue"]

        cursor.execute("""
            SELECT COUNT(*) AS due_today FROM tasks
            WHERE completed = 0 AND date(due_date) = date(?)
        """, (today,))
        due_today_tasks = cursor.fetchone()["due_today"]

        # Completed today
        cursor.execute("""
            SELECT COUNT(*) AS completed_today FROM tasks
            WHERE completed = 1 AND date(completed_at) = date(?)
        """, (today,))
        completed_today = cursor.fetchone()["completed_today"]

        # Total pomodoros
        cursor.execute("SELECT SUM(completed_pomodoros) AS pomos FROM tasks")
        row = cursor.fetchone()
        total_pomodoros = row["pomos"] or 0

        # Priority breakdown
        cursor.execute("""
            SELECT priority, COUNT(*) AS count
            FROM tasks
            GROUP BY priority
        """)
        priority_breakdown = {r["priority"]: r["count"] for r in cursor.fetchall()}

        # Category breakdown
        cursor.execute("""
            SELECT category, COUNT(*) AS count
            FROM tasks
            GROUP BY category
        """)
        category_breakdown = {r["category"]: r["count"] for r in cursor.fetchall()}

        completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0

        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "overdue_tasks": overdue_tasks,
            "due_today_tasks": due_today_tasks,
            "completed_today": completed_today,
            "total_pomodoros": total_pomodoros,
            "completion_rate": completion_rate,
            "priority_breakdown": priority_breakdown,
            "category_breakdown": category_breakdown
        }


def reset_to_sample_data() -> None:
    """Clears and re-seeds sample tasks for a fresh demo."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM subtasks")
        cursor.execute("DELETE FROM tasks")
        seed_sample_tasks(cursor)
        conn.commit()
