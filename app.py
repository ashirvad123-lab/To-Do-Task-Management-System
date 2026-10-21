"""
app.py - Main Flask Application for To-Do Task Management System.
Provides a modern RESTful API and serves the dashboard SPA interface.
"""

import csv
import io
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify, Response, send_file
import database

app = Flask(__name__)
app.config["SECRET_KEY"] = "to-do-task-manager-secret-key-2026"

# Initialize DB and seed demo data if needed
database.init_db()


# ===================== WEB ROUTES =====================

@app.route("/")
def index():
    """Renders the main dashboard page."""
    return render_template("index.html")


# ===================== TASK API =====================

@app.route("/api/tasks", methods=["GET"])
def list_tasks():
    """
    List tasks with optional filtering and sorting.
    Query parameters:
    - status: 'all', 'todo', 'in_progress', 'completed', 'pending'
    - category: category name
    - priority: 'urgent', 'high', 'medium', 'low'
    - due: 'today', 'upcoming', 'overdue', 'important'
    - search: search keyword
    - sort_by: 'due_date', 'priority', 'created_at', 'title', 'status'
    - order: 'asc', 'desc'
    """
    status = request.args.get("status")
    category = request.args.get("category")
    priority = request.args.get("priority")
    filter_due = request.args.get("due")
    search = request.args.get("search")
    sort_by = request.args.get("sort_by", "due_date")
    order = request.args.get("order", "asc")

    tasks = database.get_all_tasks(
        status=status,
        category=category,
        priority=priority,
        filter_due=filter_due,
        search=search,
        sort_by=sort_by,
        order=order
    )
    return jsonify({"success": True, "tasks": tasks, "count": len(tasks)})


@app.route("/api/tasks/<int:task_id>", methods=["GET"])
def get_task(task_id: int):
    """Retrieves a single task by ID."""
    task = database.get_task_by_id(task_id)
    if not task:
        return jsonify({"success": False, "error": "Task not found."}), 404
    return jsonify({"success": True, "task": task})


@app.route("/api/tasks", methods=["POST"])
def create_task():
    """Creates a new task."""
    data = request.get_json() or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"success": False, "error": "Task title is required."}), 400

    try:
        new_task = database.create_task(data)
        return jsonify({"success": True, "task": new_task, "message": "Task created successfully."}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id: int):
    """Updates an existing task."""
    data = request.get_json() or {}
    updated = database.update_task(task_id, data)
    if not updated:
        return jsonify({"success": False, "error": "Task not found."}), 404
    return jsonify({"success": True, "task": updated, "message": "Task updated successfully."})


@app.route("/api/tasks/<int:task_id>/toggle", methods=["PATCH"])
def toggle_task(task_id: int):
    """Toggles task completion state."""
    updated = database.toggle_task(task_id)
    if not updated:
        return jsonify({"success": False, "error": "Task not found."}), 404
    return jsonify({
        "success": True,
        "task": updated,
        "message": "Task marked " + ("completed" if updated["completed"] else "incomplete") + "."
    })


@app.route("/api/tasks/<int:task_id>/status", methods=["PATCH"])
def update_task_status(task_id: int):
    """Updates task status ('todo', 'in_progress', 'completed') for Kanban board."""
    data = request.get_json() or {}
    new_status = data.get("status")
    if not new_status:
        return jsonify({"success": False, "error": "Status is required."}), 400

    try:
        updated = database.update_task_status(task_id, new_status)
        if not updated:
            return jsonify({"success": False, "error": "Task not found."}), 404
        return jsonify({"success": True, "task": updated, "message": f"Status changed to {new_status}."})
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400


@app.route("/api/tasks/<int:task_id>/pomodoro", methods=["PATCH"])
def increment_pomodoro(task_id: int):
    """Increments the completed pomodoro sessions for a task."""
    task = database.get_task_by_id(task_id)
    if not task:
        return jsonify({"success": False, "error": "Task not found."}), 404

    completed_pomos = task.get("completed_pomodoros", 0) + 1
    updated = database.update_task(task_id, {**task, "completed_pomodoros": completed_pomos})
    return jsonify({"success": True, "task": updated, "message": "Pomodoro logged!"})


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id: int):
    """Deletes a task."""
    success = database.delete_task(task_id)
    if not success:
        return jsonify({"success": False, "error": "Task not found."}), 404
    return jsonify({"success": True, "message": "Task deleted successfully."})


# ===================== SUBTASK API =====================

@app.route("/api/tasks/<int:task_id>/subtasks", methods=["POST"])
def add_subtask(task_id: int):
    """Adds a subtask to an existing task."""
    data = request.get_json() or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"success": False, "error": "Subtask title is required."}), 400

    task = database.get_task_by_id(task_id)
    if not task:
        return jsonify({"success": False, "error": "Parent task not found."}), 404

    try:
        subtask = database.add_subtask(task_id, title)
        # Fetch updated task
        updated_task = database.get_task_by_id(task_id)
        return jsonify({"success": True, "subtask": subtask, "task": updated_task}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/subtasks/<int:subtask_id>/toggle", methods=["PATCH"])
def toggle_subtask(subtask_id: int):
    """Toggles a subtask completion."""
    subtask = database.toggle_subtask(subtask_id)
    if not subtask:
        return jsonify({"success": False, "error": "Subtask not found."}), 404
    parent_task = database.get_task_by_id(subtask["task_id"])
    return jsonify({"success": True, "subtask": subtask, "task": parent_task})


@app.route("/api/subtasks/<int:subtask_id>", methods=["DELETE"])
def delete_subtask(subtask_id: int):
    """Deletes a subtask."""
    success = database.delete_subtask(subtask_id)
    if not success:
        return jsonify({"success": False, "error": "Subtask not found."}), 404
    return jsonify({"success": True, "message": "Subtask deleted successfully."})


# ===================== STATS & CATEGORIES =====================

@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Returns analytics and dashboard productivity statistics."""
    stats = database.get_dashboard_stats()
    return jsonify({"success": True, "stats": stats})


@app.route("/api/categories", methods=["GET"])
def get_categories():
    """Returns categories list."""
    categories = database.get_all_categories()
    return jsonify({"success": True, "categories": categories})


@app.route("/api/categories", methods=["POST"])
def add_category():
    """Adds a new category."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    color = data.get("color", "#6366f1")
    icon = data.get("icon", "📁")
    if not name:
        return jsonify({"success": False, "error": "Category name is required."}), 400
    try:
        cat = database.add_category(name, color, icon)
        return jsonify({"success": True, "category": cat}), 201
    except Exception as e:
        return jsonify({"success": False, "error": "Category already exists or invalid."}), 400


# ===================== EXPORT & IMPORT =====================

@app.route("/api/export", methods=["GET"])
def export_tasks():
    """Exports tasks as CSV or JSON."""
    export_format = request.args.get("format", "json").lower()
    tasks = database.get_all_tasks(sort_by="created_at", order="desc")

    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID", "Title", "Description", "Category", "Priority",
            "Status", "Due Date", "Completed", "Completed At",
            "Created At", "Pomodoros", "Recurring", "Subtasks"
        ])
        for t in tasks:
            st_text = " | ".join([f"[{'x' if s['completed'] else ' '}] {s['title']}" for s in t.get("subtasks", [])])
            writer.writerow([
                t["id"], t["title"], t["description"], t["category"], t["priority"],
                t["status"], t["due_date"] or "", "Yes" if t["completed"] else "No",
                t["completed_at"] or "", t["created_at"],
                f"{t.get('completed_pomodoros', 0)}/{t.get('estimated_pomodoros', 1)}",
                t.get("recurring", "none"), st_text
            ])
        output.seek(0)
        filename = f"tasks_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename={filename}"}
        )

    # JSON export default
    filename = f"tasks_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    json_str = json.dumps({"exported_at": datetime.now().isoformat(), "tasks": tasks}, indent=2)
    return Response(
        json_str,
        mimetype="application/json",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )


@app.route("/api/import", methods=["POST"])
def import_tasks():
    """Imports tasks from uploaded JSON payload."""
    data = request.get_json()
    if not data or "tasks" not in data or not isinstance(data["tasks"], list):
        return jsonify({"success": False, "error": "Invalid JSON format. Expected object with 'tasks' list."}), 400

    imported_count = 0
    for item in data["tasks"]:
        if isinstance(item, dict) and item.get("title"):
            try:
                database.create_task(item)
                imported_count += 1
            except Exception:
                continue

    return jsonify({
        "success": True,
        "imported_count": imported_count,
        "message": f"Successfully imported {imported_count} tasks."
    })


@app.route("/api/reset-demo", methods=["POST"])
def reset_demo():
    """Resets database back to sample tasks."""
    database.reset_to_sample_data()
    return jsonify({"success": True, "message": "Demo data successfully reloaded."})


# ===================== ERROR HANDLERS =====================

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"success": False, "error": "Endpoint not found"}), 404
    return render_template("index.html"), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"success": False, "error": "Internal server error"}), 500


if __name__ == "__main__":
    print("=" * 60)
    print(" 🚀 To-Do Task Management System running at: http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host="127.0.0.1", port=5000, debug=True)
