import axios from "axios";

const getBaseURL = () => {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:5001/api`;
  }
  return "http://localhost:5001/api";
};

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || getBaseURL(),
});

// Automatically attach token to every request
API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user && user.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

export default API;