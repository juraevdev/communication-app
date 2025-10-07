import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatPage from "./components/ChatPage";
import LoginPage from "./components/Login";
import RegisterPage from "./components/Register";



export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatPage/>}/>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/register" element={<RegisterPage/>}/>
      </Routes>
    </BrowserRouter>
  )
}