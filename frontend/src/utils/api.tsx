import axios from "axios";

export const API_BASE_URL = "https://planshet2.stat.uz/api";

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

export const loginUser = async (data: LoginData) => {
  const response = await apiClient.post("/v1/token/", data); 
  const accessToken = response.data.access;
  const refreshToken = response.data.refresh;

  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);

  apiClient.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

  return response.data;
};


interface RegisterData {
  fullname: string;
  email: string;
  phone_number: string;
  username: string;
  password: string;
  confirm_password: string;
}

export const registerUser = (data: RegisterData) =>
  apiClient.post("/v1/accounts/register/", data);



export const getCurrentUserInfo = async (token: string) => {
  return axios.get("https://planshet2.stat.uz/api/v1/accounts/me/", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};
