import axios from "axios";

export const API_BASE_URL = "http://127.0.0.1:8000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

interface LoginData {
  email: string;
  password: string;
}

export const loginUser = (data: LoginData) =>
  apiClient.post("/api/v1/accounts/login/", data);


interface RegisterData {
  fullname: string;
  email: string;
  password: string;
  confirm_password: string;
}

export const registerUser = (data: RegisterData) =>
  apiClient.post("/api/v1/accounts/register/", data);



export const getCurrentUserInfo = async (token: string) => {
  return axios.get("http://localhost:8000/api/v1/accounts/me/", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};
