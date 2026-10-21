/**
 * api.js - REST API Client for TaskFlow
 * Provides centralized network request methods with consistent error handling.
 */

const API = {
    async request(url, options = {}) {
        try {
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(options.headers || {})
                },
                ...options
            };

            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${options.method || 'GET'} ${url}]:`, error);
            throw error;
        }
    },

    // Task Endpoints
    async getTasks(params = {}) {
        const query = new URLSearchParams();
        for (const [key, val] of Object.entries(params)) {
            if (val !== undefined && val !== null && val !== '') {
                query.append(key, val);
            }
        }
        const qs = query.toString() ? `?${query.toString()}` : '';
        return this.request(`/api/tasks${qs}`);
    },

    async getTask(id) {
        return this.request(`/api/tasks/${id}`);
    },

    async createTask(taskData) {
        return this.request('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    },

    async updateTask(id, taskData) {
        return this.request(`/api/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
    },

    async toggleTask(id) {
        return this.request(`/api/tasks/${id}/toggle`, {
            method: 'PATCH'
        });
    },

    async updateTaskStatus(id, status) {
        return this.request(`/api/tasks/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    },

    async logPomodoro(id) {
        return this.request(`/api/tasks/${id}/pomodoro`, {
            method: 'PATCH'
        });
    },

    async deleteTask(id) {
        return this.request(`/api/tasks/${id}`, {
            method: 'DELETE'
        });
    },

    // Subtasks
    async addSubtask(taskId, title) {
        return this.request(`/api/tasks/${taskId}/subtasks`, {
            method: 'POST',
            body: JSON.stringify({ title })
        });
    },

    async toggleSubtask(subtaskId) {
        return this.request(`/api/subtasks/${subtaskId}/toggle`, {
            method: 'PATCH'
        });
    },

    async deleteSubtask(subtaskId) {
        return this.request(`/api/subtasks/${subtaskId}`, {
            method: 'DELETE'
        });
    },

    // Stats & Categories
    async getStats() {
        return this.request('/api/stats');
    },

    async getCategories() {
        return this.request('/api/categories');
    },

    async createCategory(categoryData) {
        return this.request('/api/categories', {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });
    },

    // Import & Reset
    async importTasks(tasksArray) {
        return this.request('/api/import', {
            method: 'POST',
            body: JSON.stringify({ tasks: tasksArray })
        });
    },

    async resetDemoData() {
        return this.request('/api/reset-demo', {
            method: 'POST'
        });
    }
};

window.API = API;
