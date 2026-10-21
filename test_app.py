"""
test_app.py - Automated Integration and API Tests for TaskFlow
Tests all routes, CRUD operations, subtasks, categories, stats, and export/import.
"""

import unittest
import json
import os
import database
from app import app


class TaskFlowTestCase(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        app.config["TESTING"] = True
        self.client = app.test_client()

        # Re-initialize clean test database
        database.reset_to_sample_data()

    def test_index_route(self):
        """Test that root dashboard page loads with 200 OK."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"TaskFlow", response.data)

    def test_list_tasks(self):
        """Test GET /api/tasks returns seeded tasks."""
        response = self.client.get("/api/tasks")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data["success"])
        self.assertGreater(len(data["tasks"]), 0)

    def test_create_and_get_task(self):
        """Test creating a new task with subtasks and fetching it."""
        new_task = {
            "title": "Automated Test Task",
            "description": "Testing description notes",
            "category": "Coding",
            "priority": "high",
            "due_date": "2026-10-25",
            "subtasks": [
                {"title": "Subtask 1", "completed": 0},
                {"title": "Subtask 2", "completed": 1}
            ]
        }
        create_res = self.client.post("/api/tasks", json=new_task)
        self.assertEqual(create_res.status_code, 201)
        created_data = json.loads(create_res.data)
        self.assertTrue(created_data["success"])
        task_id = created_data["task"]["id"]

        # Get task
        get_res = self.client.get(f"/api/tasks/{task_id}")
        self.assertEqual(get_res.status_code, 200)
        task = json.loads(get_res.data)["task"]
        self.assertEqual(task["title"], "Automated Test Task")
        self.assertEqual(len(task["subtasks"]), 2)

    def test_toggle_task(self):
        """Test toggling completion state of a task."""
        # Create a task
        create_res = self.client.post("/api/tasks", json={"title": "Toggle Me"})
        task_id = json.loads(create_res.data)["task"]["id"]

        # Toggle to completed
        toggle_res = self.client.patch(f"/api/tasks/{task_id}/toggle")
        self.assertEqual(toggle_res.status_code, 200)
        data = json.loads(toggle_res.data)
        self.assertEqual(data["task"]["completed"], 1)
        self.assertEqual(data["task"]["status"], "completed")

        # Toggle back to incomplete
        toggle_res2 = self.client.patch(f"/api/tasks/{task_id}/toggle")
        data2 = json.loads(toggle_res2.data)
        self.assertEqual(data2["task"]["completed"], 0)
        self.assertEqual(data2["task"]["status"], "todo")

    def test_kanban_status_update(self):
        """Test updating task status between Kanban columns."""
        create_res = self.client.post("/api/tasks", json={"title": "Kanban Card"})
        task_id = json.loads(create_res.data)["task"]["id"]

        status_res = self.client.patch(f"/api/tasks/{task_id}/status", json={"status": "in_progress"})
        self.assertEqual(status_res.status_code, 200)
        data = json.loads(status_res.data)
        self.assertEqual(data["task"]["status"], "in_progress")

    def test_subtask_operations(self):
        """Test adding, toggling, and deleting a subtask."""
        create_res = self.client.post("/api/tasks", json={"title": "Parent Task"})
        task_id = json.loads(create_res.data)["task"]["id"]

        # Add subtask
        st_res = self.client.post(f"/api/tasks/{task_id}/subtasks", json={"title": "Step 1"})
        self.assertEqual(st_res.status_code, 201)
        subtask = json.loads(st_res.data)["subtask"]
        subtask_id = subtask["id"]

        # Toggle subtask
        toggle_res = self.client.patch(f"/api/subtasks/{subtask_id}/toggle")
        self.assertEqual(toggle_res.status_code, 200)
        self.assertEqual(json.loads(toggle_res.data)["subtask"]["completed"], 1)

        # Delete subtask
        del_res = self.client.delete(f"/api/subtasks/{subtask_id}")
        self.assertEqual(del_res.status_code, 200)

    def test_stats_and_categories(self):
        """Test stats and categories endpoints."""
        stats_res = self.client.get("/api/stats")
        self.assertEqual(stats_res.status_code, 200)
        stats = json.loads(stats_res.data)["stats"]
        self.assertIn("total_tasks", stats)
        self.assertIn("completion_rate", stats)

        cats_res = self.client.get("/api/categories")
        self.assertEqual(cats_res.status_code, 200)
        cats = json.loads(cats_res.data)["categories"]
        self.assertGreater(len(cats), 0)

    def test_export_and_import(self):
        """Test exporting and importing task data."""
        # Export JSON
        export_res = self.client.get("/api/export?format=json")
        self.assertEqual(export_res.status_code, 200)
        data = json.loads(export_res.data)
        self.assertIn("tasks", data)

        # Export CSV
        csv_res = self.client.get("/api/export?format=csv")
        self.assertEqual(csv_res.status_code, 200)
        self.assertIn(b"Title,Description", csv_res.data)

        # Import
        sample_import = {
            "tasks": [
                {"title": "Imported Task 1", "category": "Work", "priority": "low"},
                {"title": "Imported Task 2", "category": "Personal", "priority": "high"}
            ]
        }
        import_res = self.client.post("/api/import", json=sample_import)
        self.assertEqual(import_res.status_code, 200)
        self.assertEqual(json.loads(import_res.data)["imported_count"], 2)


if __name__ == "__main__":
    unittest.main()
