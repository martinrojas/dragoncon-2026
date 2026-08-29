import { useEffect, useState, type FormEvent } from "react";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import type { User } from "../homeTypes.ts";

export interface UseHomeAuthOptions {
  triggerToast: (message: string, type?: "ok" | "warn", actionLabel?: string, onAction?: () => void) => void;
  /** Called after a successful login/register/session-restore so sibling hooks (agenda, squad) can load their own data. */
  onAuthenticated?: (user: User) => void;
  /** Called after sign-out so sibling hooks can clear per-user state. */
  onLogout?: () => void;
}

export function useHomeAuth({ triggerToast, onAuthenticated, onLogout }: UseHomeAuthOptions) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userToken, setUserToken] = useState<string>("");
  const [supportsPasskeys, setSupportsPasskeys] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");

  // Restore session from localStorage on mount (SSR-safe: browser APIs only touched inside the effect).
  useEffect(() => {
    setSupportsPasskeys(browserSupportsWebAuthn());

    const savedUser = localStorage.getItem("dc_user");
    const savedToken = localStorage.getItem("dc_token");
    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser) as User;
        setCurrentUser(parsed);
        setUserToken(savedToken);
        onAuthenticated?.(parsed);
      } catch {
        // ignore invalid json
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAuthModal = (mode?: "login" | "register") => {
    if (mode) setAuthMode(mode);
    setShowAuthModal(true);
  };

  const persistSession = (user: User, token: string) => {
    setCurrentUser(user);
    setUserToken(token);
    localStorage.setItem("dc_user", JSON.stringify(user));
    localStorage.setItem("dc_token", token);
  };

  // Applies a patch to the logged-in user and re-syncs localStorage. Used by
  // useSquad's privacy toggle, which needs to mutate `currentUser.shareSchedule`.
  const updateCurrentUser = (updater: (prev: User) => User) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      localStorage.setItem("dc_user", JSON.stringify(next));
      return next;
    });
  };

  // 1-Click Passkey Login
  const handlePasskeyLogin = async () => {
    setAuthError("");
    try {
      const optRes = await fetch("/api/auth/passkey?action=generate-login-options", { method: "POST" });
      const optData = (await optRes.json()) as {
        success: boolean;
        options: PublicKeyCredentialRequestOptionsJSON;
        error?: string;
      };
      if (!optData.success) throw new Error(optData.error || "Failed to get login options");

      const assertionResponse = await startAuthentication({ optionsJSON: optData.options });

      const verifyRes = await fetch("/api/auth/passkey?action=verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assertionResponse, expectedChallenge: optData.options.challenge }),
      });

      const verifyData = (await verifyRes.json()) as { success: boolean; user: User; token: string; error?: string };

      if (verifyData.success) {
        persistSession(verifyData.user, verifyData.token);
        onAuthenticated?.(verifyData.user);
        setShowAuthModal(false);
        triggerToast(`Welcome back, ${verifyData.user.name}! ⚡`, "ok");
      } else {
        setAuthError(verifyData.error || "Passkey login failed");
      }
    } catch (e: unknown) {
      console.error(e);
      const isNotAllowed = e instanceof Error && e.name === "NotAllowedError";
      setAuthError(
        isNotAllowed
          ? "Passkey prompt cancelled or DevTools virtual authenticator not active."
          : e instanceof Error
          ? e.message
          : "Passkey login failed",
      );
    }
  };

  // 1-Click Quick Passkey Signup & Registration
  const handleQuickPasskeyRegister = async () => {
    if (!authUsername.trim()) {
      setAuthError("Username is required to create a passkey account");
      return;
    }
    setAuthError("");

    try {
      const optRes = await fetch("/api/auth/passkey?action=quick-register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername.trim(), name: authName.trim() || authUsername.trim() }),
      });
      const optData = (await optRes.json()) as {
        success: boolean;
        user: User;
        options: PublicKeyCredentialCreationOptionsJSON;
        error?: string;
      };
      if (!optData.success) throw new Error(optData.error || "Failed to start registration");

      const registrationResponse = await startRegistration({ optionsJSON: optData.options });

      const verifyRes = await fetch("/api/auth/passkey?action=verify-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: optData.user.id,
          registrationResponse,
          expectedChallenge: optData.options.challenge,
        }),
      });

      const verifyData = (await verifyRes.json()) as {
        success: boolean;
        user: User | null;
        token: string;
        error?: string;
      };

      if (verifyData.success && verifyData.user) {
        persistSession(verifyData.user, verifyData.token);
        onAuthenticated?.(verifyData.user);
        setShowAuthModal(false);
        triggerToast(`Squad account created! 🔑`, "ok");
      } else {
        setAuthError(verifyData.error || "Failed to save passkey");
      }
    } catch (e: unknown) {
      console.error(e);
      const isNotAllowed = e instanceof Error && e.name === "NotAllowedError";
      setAuthError(
        isNotAllowed
          ? "Passkey prompt cancelled or DevTools virtual authenticator not active."
          : e instanceof Error
          ? e.message
          : "Passkey registration failed",
      );
    }
  };

  // Register Passkey for current user
  const handleRegisterPasskey = async () => {
    if (!currentUser) return;
    try {
      const optRes = await fetch("/api/auth/passkey?action=generate-register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, username: currentUser.username }),
      });
      const optData = (await optRes.json()) as {
        success: boolean;
        options: PublicKeyCredentialCreationOptionsJSON;
        error?: string;
      };
      if (!optData.success) throw new Error(optData.error || "Failed to get registration options");

      const registrationResponse = await startRegistration({ optionsJSON: optData.options });

      const verifyRes = await fetch("/api/auth/passkey?action=verify-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          registrationResponse,
          expectedChallenge: optData.options.challenge,
        }),
      });

      const verifyData = (await verifyRes.json()) as { success: boolean; error?: string };
      if (verifyData.success) {
        triggerToast("🎉 Passkey registered! Next time log in with 1 click.", "ok");
      } else {
        triggerToast(verifyData.error || "Failed to register passkey", "warn");
      }
    } catch (e: unknown) {
      console.error(e);
      triggerToast(e instanceof Error ? e.message : "Passkey registration failed or cancelled", "warn");
    }
  };

  // Handle Auth Form Submission
  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: authMode, username: authUsername, password: authPassword, name: authName }),
      });

      const data = (await res.json()) as { success: boolean; user: User; token: string; error?: string };
      if (data.success) {
        persistSession(data.user, data.token);
        setShowAuthModal(false);
        setAuthUsername("");
        setAuthPassword("");
        setAuthName("");
        onAuthenticated?.(data.user);
        triggerToast(`Logged in as ${data.user.name}`, "ok");
      } else {
        setAuthError(data.error || "Authentication failed");
      }
    } catch {
      setAuthError("Network error during auth");
    }
  };

  // Logout
  const handleLogout = () => {
    setCurrentUser(null);
    setUserToken("");
    localStorage.removeItem("dc_user");
    localStorage.removeItem("dc_token");
    triggerToast("Signed out", "ok");
    onLogout?.();
  };

  return {
    currentUser,
    userToken,
    supportsPasskeys,
    showAuthModal,
    setShowAuthModal,
    authMode,
    setAuthMode,
    authUsername,
    setAuthUsername,
    authPassword,
    setAuthPassword,
    authName,
    setAuthName,
    authError,
    setAuthError,
    openAuthModal,
    handlePasskeyLogin,
    handleQuickPasskeyRegister,
    handleRegisterPasskey,
    handleAuthSubmit,
    handleLogout,
    updateCurrentUser,
  };
}
