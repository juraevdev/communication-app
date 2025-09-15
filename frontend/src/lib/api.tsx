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
};