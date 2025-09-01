import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./components/DashboardPage";
import ChatPage from "./components/ChatPage";
import LoginPage from "./components/Login";
import RegisterPage from "./components/Register";
import ProfilePage from "./components/ProfilePage";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage/>}/>
        <Route path="/chat" element={<ChatPage/>}/>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/register" element={<RegisterPage/>}/>
        <Route path="/profile" element={<ProfilePage/>}/>
      </Routes>
    </BrowserRouter>
  )
}