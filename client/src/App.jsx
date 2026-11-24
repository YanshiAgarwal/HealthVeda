// App = the page layout (navbar + current page + footer) and the URL routes.
import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import Footer from "./components/layout/Footer.jsx";
import Navbar from "./components/layout/Navbar.jsx";
import Account from "./pages/Account.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DoshaQuiz from "./pages/DoshaQuiz.jsx";
import Home from "./pages/Home.jsx";
import NotFound from "./pages/NotFound.jsx";
import RemedyExplorer from "./pages/RemedyExplorer.jsx";
import ReportAnalyzer from "./pages/ReportAnalyzer.jsx";
import ReportView from "./pages/ReportView.jsx";
import VedaAssistant from "./pages/VedaAssistant.jsx";
import Wellness from "./pages/Wellness.jsx";

// Pages that need a login are wrapped in <ProtectedRoute>
const privatePage = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

export default function App() {
  const location = useLocation();

  // Start each new page at the top
  // (braces matter: an effect must return nothing or a cleanup function)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="flex-1"
        >
          <Routes location={location}>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/dosha" element={<DoshaQuiz />} />
            <Route path="/remedies" element={<RemedyExplorer />} />
            <Route path="/wellness" element={<Wellness />} />

            {/* Logged-in users */}
            <Route path="/dashboard" element={privatePage(<Dashboard />)} />
            <Route path="/chat" element={privatePage(<VedaAssistant />)} />
            <Route path="/report" element={privatePage(<ReportAnalyzer />)} />
            <Route path="/reports/:id" element={privatePage(<ReportView />)} />
            <Route path="/account" element={privatePage(<Account />)} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
      <Footer />
    </div>
  );
}
