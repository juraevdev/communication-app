import axios from 'axios';

const BASE_URL = 'https://planshet2.stat.uz/api';
const WS_BASE_URL = 'ws://planshet2.stat.uz/ws';

const api = axios.create({
  baseURL: `${BASE_URL}/v1`,
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
    const response = await api.post('/accounts/login', { email, password });
    const { access, refresh } = response.data;

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);

    return response.data;
  },

  async register(userData: any) {
    const response = await api.post('/accounts/register/', userData);
    return response.data;
  },


  async updateUserProfile(data: {
    fullname?: string;
    username: string;
    email: string;
    phone_number: string;
  }) {
    const response = await api.put('/accounts/user/edit/', data);
    return response.data
  },

  // async updateProfile(data: {
  //   phone_number: string;
  // }) {
  //   const response = await fetch('/api/v1/accounts/profile/', {
  //     method: 'PATCH',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
  //     },
  //     body: JSON.stringify(data),
  //   });

  //   if (!response.ok) {
  //     const errorData = await response.json();
  //     throw new Error(errorData.message || 'Profile update failed');
  //   }

  //   return response.json();
  // },

  async getUserProfile(contactUserId: any) {
    const response = await api.get(`accounts/user/${contactUserId}`)
    return response.data
  },

  async getProfile() {
    const response = await api.get('accounts/me/');
    return response.data;
  },

  async changePassword(passwordData: any) {
    try {
      const response = await api.post('accounts/change-password/', passwordData);
      return response.data;
    } catch (error) {
      console.error("Parolni o'zgartirishda xatolik:", error)
    }
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

  async searchUsers(searchTerm: any) {
    const response = await api.get(`/accounts/filter/?search=${searchTerm}`);
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

  // api.js fayliga qo'shiladi
async getVideoCallWebSocketUrl(roomId: any) {
  const token = localStorage.getItem('access_token');
  return `ws://planshet2.stat.uz/ws/ws/videocall/${roomId}/?token=${token}`;
},

  async removeContact(contactId: number) {
    const response = await api.delete(`/accounts/contact/delete/${contactId}/`);
    return response.data;
  },

  async updateContact(contactId: number, alias: string) {
    const response = await api.put(`accounts/contact/edit/${contactId}/`, {
      alias: alias
    });
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

  // Add these methods to your apiClient object in api.tsx

  async downloadGroupFile(fileUrl: string): Promise<Blob> {
    const response = await fetch(`${BASE_URL}${fileUrl}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    return response.blob();
  },

  async getGroupFileUrl(fileId: number): Promise<string> {
    const response = await api.get(`/group/files/${fileId}/`);
    return response.data.file_url;
  },

  // Alternative method using the existing API structure
  async downloadFile(fileUrl: string, _isGroupFile: boolean = false): Promise<Blob> {
    const fullUrl = fileUrl.startsWith('https')
      ? fileUrl
      : `${BASE_URL}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    return response.blob();
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


  async createGroup(data: { name: string; description?: string; created_by: string }) {
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
    const response = await fetch(`${BASE_URL}/api/v1/group/${groupId}/leave/`, {
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

  async getGroupUnreadCount(groupId: number): Promise<number> {
    const response = await api.get(`/group/unread-count/${groupId}/`);
    return response.data.unread_count;
  },

  async markGroupMessagesAsRead(groupId: number): Promise<any> {
    const response = await api.post(`/group/mark-all-read/${groupId}/`);
    return response.data;
  },

  async createChannel(data: {
    name: string;
    description?: string;
    owner: string;
    username: string; 
  }) {
    const response = await fetch(`${BASE_URL}/api/v1/channels/create/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        owner: data.owner,
        username: data.username,
      }),
    });
    return this.handleResponse(response);
  },

  async getChannels() {
    const response = await fetch(`${BASE_URL}/api/v1/channels/list/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },

  async getChannelsFilter(searchTerm: string) {
    const response = await api.get(`channels/filter/?search=${encodeURIComponent(searchTerm)}`);
    return response.data;
  },

  async getChannelDetail(channelId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/channels/${channelId}/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },

  async updateChannel(channelId: number, data: { name?: string; description?: string }) {
    const response = await fetch(`${BASE_URL}/api/v1/channels/edit/${channelId}/`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  },

  async deleteChannel(channelId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/channels/delete/${channelId}/`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },


  async followChannel(channelId: number, userId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/channels/follow/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        channel_id: channelId,
        user_id: userId
      }),
    });
    return this.handleResponse(response);
  },

  async unfollowChannel(channelId: number, userId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/channels/unfollow/`, {
      method: 'POST', 
      headers: this.getHeaders(),
      body: JSON.stringify({
        channel_id: channelId,
        user_id: userId
      }),
    });
    return this.handleResponse(response);
  },

  async getChannelMembers(channelId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/channels/members/${channelId}/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },

  async getChannelMessages(channelId: number) {
    const response = await fetch(`${BASE_URL}/api/v1/channels/messages/${channelId}/`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  },

  getChannelWebSocketUrl(channelId: string): string {
    const token = localStorage.getItem('access_token');
    return `${WS_BASE_URL}/ws/channel/${channelId}/?token=${token}`;
  },

  async downloadChannelFile(fileUrl: string): Promise<Blob> {
    return this.downloadFile(fileUrl);
  },
};