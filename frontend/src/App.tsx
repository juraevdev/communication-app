import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./components/DashboardPage";
import ChatPage from "./components/ChatPage";



export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage/>}/>
        <Route path="/chat" element={<ChatPage/>}/>
      </Routes>
    </BrowserRouter>
  )
}