import React from "react";
import "@/App.css";
import { Routes, Route } from "react-router-dom";
import SiteLayout from "@/components/layout/SiteLayout";
import HomePage from "@/pages/HomePage";
import CategoryPage from "@/pages/CategoryPage";
import ArticlePage from "@/pages/ArticlePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import UnsubscribePage from "@/pages/UnsubscribePage";
import BookmarksPage from "@/pages/BookmarksPage";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminEditor from "@/pages/AdminEditor";
import AdminComments from "@/pages/AdminComments";
import AdminCategories from "@/pages/AdminCategories";
import AdminBreaking from "@/pages/AdminBreaking";
import AdminSidebar from "@/pages/AdminSidebar";
import AdminLayout from "@/pages/AdminLayout";
import NotFound from "@/pages/NotFound";
import RequireAdmin from "@/components/auth/RequireAdmin";
import RequireAuth from "@/components/auth/RequireAuth";

function App() {
  return (
    <div className="App min-h-screen bg-background text-foreground">
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/category/:category" element={<CategoryPage />} />
          <Route path="/article/:slug" element={<ArticlePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="/bookmarks" element={<RequireAuth><BookmarksPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/new" element={<RequireAdmin><AdminEditor /></RequireAdmin>} />
          <Route path="/admin/edit/:id" element={<RequireAdmin><AdminEditor /></RequireAdmin>} />
          <Route path="/admin/comments" element={<RequireAdmin><AdminComments /></RequireAdmin>} />
          <Route path="/admin/categories" element={<RequireAdmin><AdminCategories /></RequireAdmin>} />
          <Route path="/admin/breaking" element={<RequireAdmin><AdminBreaking /></RequireAdmin>} />
          <Route path="/admin/sidebar" element={<RequireAdmin><AdminSidebar /></RequireAdmin>} />
          <Route path="/admin/layout" element={<RequireAdmin><AdminLayout /></RequireAdmin>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
