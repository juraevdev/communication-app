import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, Mail, Lock } from "lucide-react";
import { getCurrentUserInfo } from "@/utils/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    localStorage.clear();
    sessionStorage.clear();
    
    console.log("✅ All storage cleared before login");

    await apiClient.login(email, password);

    const accessToken = localStorage.getItem('access_token');

    if (!accessToken) {
      localStorage.removeItem("user_data")
      throw new Error("No access token received");
    }

    const userResponse = await getCurrentUserInfo(accessToken);
    
    console.log("✅ Fresh user data received:", userResponse.data);

    localStorage.setItem("user_data", JSON.stringify(userResponse.data));

    console.log("✅ User data saved to localStorage");

    navigate("/");

  } catch (error: any) {
    console.error("❌ Login error:", error.response?.data || error.message);
    alert("Login failed. Check your credentials.");
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gray-900 from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-white bg-gray-900">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-semibold text-white">
            SecureComm
          </CardTitle>
          <CardDescription className="text-white">
            Sign in to your secure communication platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-white">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-white" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 text-white"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-white">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-white" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 text-white"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              {"Don't have an account? "}
              <Link to="/register" className="text-white hover:text-blue-500 font-medium">
                Register here
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
