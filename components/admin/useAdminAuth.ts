import { useState, useEffect, type SyntheticEvent } from "react";
import { setupGlobalErrorCatchers } from "../../lib/errorReporting";
import { APP_VERSION } from "../../lib/version";
import type { User } from "./adminTypes";

export function useAdminAuth(onAdminAuthenticated?: (token: string) => void) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>("");

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("dc_user");
    const savedToken = localStorage.getItem("dc_token");
    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser) as User;
        setCurrentUser(parsed);
        setToken(savedToken);
        if (parsed.role === "admin" && onAdminAuthenticated) {
          onAdminAuthenticated(savedToken);
        }
      } catch {
        // ignore parse error
      }
    }

    const cleanupErrorCatchers = setupGlobalErrorCatchers(() => {
      const userStr = localStorage.getItem("dc_user");
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch {
          // ignore
        }
      }
      return null;
    }, APP_VERSION);

    return () => {
      cleanupErrorCatchers();
    };
  }, [onAdminAuthenticated]);

  const handleLoginSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError("Username and password are required.");
      return;
    }
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          username: loginUsername.trim(),
          password: loginPassword.trim(),
        }),
      });
      const data = (await res.json()) as {
        success: boolean;
        user?: User;
        token?: string;
        error?: string;
      };
      if (data.success && data.user && data.token) {
        if (data.user.role !== "admin") {
          setLoginError("Access denied: User account is not an administrator.");
        } else {
          setCurrentUser(data.user);
          setToken(data.token);
          localStorage.setItem("dc_user", JSON.stringify(data.user));
          localStorage.setItem("dc_token", data.token);
          setLoginUsername("");
          setLoginPassword("");
          if (onAdminAuthenticated) {
            onAdminAuthenticated(data.token);
          }
        }
      } else {
        setLoginError(data.error || "Login failed.");
      }
    } catch {
      setLoginError("An unexpected error occurred.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return {
    currentUser,
    token,
    loginUsername,
    loginPassword,
    loginError,
    isLoggingIn,
    setLoginUsername,
    setLoginPassword,
    handleLoginSubmit,
  };
}
