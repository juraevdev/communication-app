import { useEffect, useState } from "react";
import { Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeProvider } from "../ui/theme-provider";
import { Sidebar } from "./sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndUpdateUser = async () => {
      const user = localStorage.getItem("user");
      const token = localStorage.getItem("access_token");
      
      if (!user || !token) {
        navigate("/login");
        return;
      }

      try {
        const response = await fetch('https://planshet2.stat.uz/api/v1/accounts/user/', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const freshUserData = await response.json();
          localStorage.setItem('user', JSON.stringify(freshUserData));
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem("user_data");
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          navigate("/login");
        }
      } catch (error) {
        console.error('Failed to fetch fresh user data:', error);
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndUpdateUser();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Suspense fallback={null}>
          <ThemeProvider  defaultTheme="dark" >
            {children}
          </ThemeProvider>
        </Suspense>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; 
  }

  return (
    <div className="flex h-screen bg-black">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
