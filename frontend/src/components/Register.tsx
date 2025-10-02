import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "@/utils/api";
import { Label } from "./ui/label";
import { Input } from "./ui/input";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone_number: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }


    setIsLoading(true);

    try {
      await registerUser({
        fullname: formData.fullName,
        email: formData.email,
        phone_number: formData.phone_number,
        username: formData.username,
        password: formData.password,
        confirm_password: formData.confirmPassword,
      });

      alert("Registration successful! Please sign in.");
      navigate("/login");
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      alert(error.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-900 from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md shadow-lg bg-gray-900 rounded-xl p-6 border border-white">
        <h1 className="text-2xl font-semibold text-white text-center mb-4">
          Create Account
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="block text-white text-sm font-medium">Full Name</Label>
            <Input
              type="text"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={(e) => handleInputChange("fullName", e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1 text-white"
              required
            />
          </div>

          <div>
            <Label className="block text-white text-sm font-medium">Phone Number</Label>
            <Input
              type="phone"
              placeholder="Enter your phone number"
              value={formData.phone_number}
              onChange={(e) => handleInputChange("phone_number", e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1 text-white"
              required
            />
          </div>
          <div>
            <Label className="block text-white text-sm font-medium">Username</Label>
            <Input
              type="username"
              placeholder="Enter your username"
              value={formData.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1 text-white"
              required
            />
          </div>
          <div>
            <Label className="block text-white text-sm font-medium">Email Address</Label>
            <Input
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1 text-white"
              required
            />
          </div>

          <div>
            <Label className="block text-white text-sm font-medium">Password</Label>
            <Input
              type="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1 text-white" 
              required
            />
          </div>

          <div>
            <Label className="block text-white text-sm font-medium">Confirm Password</Label>
            <Input
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1 text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 cursor-pointer"
          >
            {isLoading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
