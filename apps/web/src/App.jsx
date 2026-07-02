import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useSession } from "./hooks/useSession.js";
import LoginPage from "./pages/Login.jsx";
import OnboardingPage from "./pages/Onboarding.jsx";
import TodayPage from "./pages/Today.jsx";
import TasksPage from "./pages/Tasks.jsx";
import CheckInPage from "./pages/CheckIn.jsx";
import FocusPage from "./pages/Focus.jsx";
import WeekPage from "./pages/Week.jsx";
import WeekDayPage from "./pages/WeekDay.jsx";
import SettingsPage from "./pages/Settings.jsx";
import InsightsPage from "./pages/Insights.jsx";
import ReviewPage from "./pages/Review.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import AppShell from "./components/AppShell.jsx";
import { loadTheme, applyTheme } from "./services/theme.js";
import { initInstallPrompt } from "./services/installPrompt.js";

function Protected({ children }) {
  const { session, loading, profile } = useSession();
  if (loading) return <SplashScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile && !profile.onboarding_done) return <Navigate to="/onboarding" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  const { loading } = useSession();
  useEffect(() => { applyTheme(loadTheme()); initInstallPrompt(); }, []);
  if (loading) return <SplashScreen />;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/today"      element={<Protected><TodayPage /></Protected>} />
      <Route path="/tasks"      element={<Protected><TasksPage /></Protected>} />
      <Route path="/check-in"   element={<Protected><CheckInPage /></Protected>} />
      <Route path="/focus"      element={<Protected><FocusPage /></Protected>} />
      <Route path="/week"       element={<Protected><WeekPage /></Protected>} />
      <Route path="/week/:date" element={<Protected><WeekDayPage /></Protected>} />
      <Route path="/insights"   element={<Protected><InsightsPage /></Protected>} />
      <Route path="/review"     element={<Protected><ReviewPage /></Protected>} />
      <Route path="/settings"   element={<Protected><SettingsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
