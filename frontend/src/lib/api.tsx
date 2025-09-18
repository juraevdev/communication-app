import axios from 'axios';

const BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${BASE_URL}/api/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export const apiClient = {
  baseUrl: `${BASE_URL}/api/v1`,

  async login(email: string, password: string) {
    const response = await api.post('/accounts/login/', { email, password });
    const { access, refresh } = response.data;

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);

    return response.data;
  },

  async register(userData: any) {
    const response = await api.post('/accounts/register/', userData);
    return response.data;
  },

  async getMe() {
    const response = await api.get('/accounts/me/');
    return response.data;
  },

  async getRecentConversations() {
    return null;
  },

  async startChat(contactUserId: number) {
    const response = await api.post('/chat/start/', {
      contact_user: contactUserId
    });
    return response.data;
  },

  async searchUsers(searchTerm: string) {
    const response = await api.get(`/accounts/users/search/?search=${searchTerm}`);
    return response.data;
  },

  async addContact(contactUserId: number, alias?: string) {
    const response = await api.post('/accounts/contact/', {
      contact_user: contactUserId,
      alias: alias
    });
    return response.data;
  },

  async getContacts() {
    const response = await api.get('/accounts/contact/filter/');
    return response.data;
  },

  async uploadFile(file: File, messageId?: number) {
    const formData = new FormData();
    formData.append('file', file);
    if (messageId) {
      formData.append('message_id', messageId.toString());
    }

    const response = await api.post('/chat/file-upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async downloadFile(fileId: number) {
    const response = await api.get(`/chat/files/${fileId}/download/`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async getUserFiles() {
    const response = await api.get('/chat/user-files/');
    return response.data;
  },

  getStatusWebSocketUrl(): string {
    const token = localStorage.getItem('access_token');
    return `${WS_BASE_URL}/ws/status/?token=${token}`;
  },

  getChatWebSocketUrl(roomId: string): string {
    const token = localStorage.getItem('access_token');
    return `${WS_BASE_URL}/ws/chat/room/${roomId}/?token=${token}`;
  },

  getNotificationsWebSocketUrl(): string {
    const token = localStorage.getItem('access_token');
    return `${WS_BASE_URL}/ws/notifications/?token=${token}`;
  },

  getFilesWebSocketUrl(): string {
    const token = localStorage.getItem('access_token');
    return `${WS_BASE_URL}/ws/files/?token=${token}`;
  },

  getHeaders(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  async createGroup(data: { name: string; description?: string; created_by: number }) {
    const response = await fetch(`${BASE_URL}/api/v1/group/create/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  },

  async getGroups() {
    const response = await fetch(`${BASE_URL}/api/v1/group/all/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },

  async getGroupDetail(groupId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/group/${groupId}/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },

  async updateGroup(groupId: number, data: { name?: string; description?: string }) {
    const response = await fetch(`${BASE_URL}/api/v1/group/edit/${groupId}/`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  },

  async deleteGroup(groupId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/group/delete/${groupId}/`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },

  async addGroupMember(data: { group: number; user: number; role: 'owner' | 'admin' | 'member' }) {
    const response = await fetch(`${BASE_URL}/api/v1/group/add-member/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  },

  async removeGroupMember(groupId: number, memberId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/group/remove-member/${groupId}/${memberId}/`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },

  async getGroupMembers(groupId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/group/members/${groupId}/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },

  async getGroupMessages(groupId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/group/group-messages/${groupId}/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },

  async markGroupMessageAsRead(groupId: number, messageId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/group/messages/${messageId}/read/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ group_id: groupId })
    });
    return this.handleResponse(response);
},

  getGroupWebSocketUrl(groupId: string): string {
    const token = localStorage.getItem('access_token');

    return `${WS_BASE_URL}/ws/groups/${groupId}/?token=${token}`;
  },

  async handleResponse(response: Response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.detail || 'API request failed');
    }
    return response.json();
  },

  async updateGroupMemberRole(groupId: number, userId: number, role: string): Promise<any> {
    const response = await fetch(`${BASE_URL}/api/v1/group/update-member-role/${groupId}/${userId}/`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ role })
    });
    return this.handleResponse(response);
  },

  async leaveGroup(groupId: number): Promise<any> {
    const response = await fetch(`/groups/${groupId}/leave/`, {
      method: 'POST',
      headers: this.getHeaders(),
    })
    return response
  },

  async searchUser(searchTerm: string = "") {
    const response = await fetch(`${BASE_URL}/api/v1/accounts/filter/?search=${encodeURIComponent(searchTerm)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },
};