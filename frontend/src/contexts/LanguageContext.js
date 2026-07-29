import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const dict = {
  en: {
    brand: "Rahi Bangla",
    tagline: "India's Story, Told Twice.",
    latest: "Latest",
    breaking: "Breaking",
    featured: "Featured",
    readMore: "Read more",
    login: "Log in",
    register: "Sign up",
    logout: "Log out",
    admin: "Admin",
    dashboard: "Dashboard",
    home: "Home",
    categories: {
      business: "Business",
      education: "Education",
      sports: "Sports",
      entertainment: "Entertainment",
      science: "Science",
      lifestyle: "Lifestyle",
      elections: "Elections",
    },
    subscribeCta: "Get the daily briefing",
    subscribeHint: "Independent news from India, delivered every morning.",
    email: "Email",
    subscribe: "Subscribe",
    subscribed: "You're on the list.",
    password: "Password",
    name: "Full name",
    haveAccount: "Already have an account?",
    noAccount: "New to Rahi Bangla?",
    loginTitle: "Sign in",
    registerTitle: "Create your account",
    comments: "Comments",
    postComment: "Post comment",
    writeComment: "Share your thoughts…",
    likes: "likes",
    like: "Like",
    liked: "Liked",
    bookmark: "Save",
    bookmarked: "Saved",
    by: "By",
    minRead: "min read",
    published: "Published",
    createArticle: "New story",
    editArticle: "Edit story",
    deleteArticle: "Delete",
    manageStories: "Manage stories",
    title: "Title",
    excerpt: "Excerpt",
    body: "Body",
    category: "Category",
    uploadImage: "Upload cover image",
    save: "Save",
    cancel: "Cancel",
    searchPlaceholder: "Search stories…",
    footerCopy: "An independent bilingual newsroom based in Kolkata & New Delhi.",
    allRights: "All rights reserved.",
    signOutOk: "Signed out.",
    invalidCred: "Invalid credentials.",
    noStories: "No stories yet.",
    loginRequired: "Please sign in to continue.",
  },
  bn: {
    brand: "রাহি বাংলা",
    tagline: "ভারতের গল্প, দুই কণ্ঠে।",
    latest: "সাম্প্রতিক",
    breaking: "সদ্য প্রাপ্ত",
    featured: "নির্বাচিত",
    readMore: "আরও পড়ুন",
    login: "লগইন",
    register: "নিবন্ধন",
    logout: "লগআউট",
    admin: "অ্যাডমিন",
    dashboard: "ড্যাশবোর্ড",
    home: "মূল পাতা",
    categories: {
      business: "ব্যবসা",
      education: "শিক্ষা",
      sports: "খেলা",
      entertainment: "বিনোদন",
      science: "বিজ্ঞান",
      lifestyle: "জীবনধারা",
      elections: "নির্বাচন",
    },
    subscribeCta: "প্রতিদিনের সংবাদ পান",
    subscribeHint: "ভারতের স্বাধীন সংবাদ, প্রতি সকালে আপনার ইনবক্সে।",
    email: "ইমেইল",
    subscribe: "সাবস্ক্রাইব",
    subscribed: "আপনি তালিকাভুক্ত হয়েছেন।",
    password: "পাসওয়ার্ড",
    name: "পুরো নাম",
    haveAccount: "ইতিমধ্যে অ্যাকাউন্ট আছে?",
    noAccount: "রাহি বাংলায় নতুন?",
    loginTitle: "সাইন ইন",
    registerTitle: "অ্যাকাউন্ট তৈরি করুন",
    comments: "মন্তব্য",
    postComment: "মন্তব্য পোস্ট করুন",
    writeComment: "আপনার মতামত জানান…",
    likes: "লাইক",
    like: "লাইক",
    liked: "লাইক হয়েছে",
    bookmark: "সংরক্ষণ",
    bookmarked: "সংরক্ষিত",
    by: "লেখক",
    minRead: "মিনিট পড়া",
    published: "প্রকাশিত",
    createArticle: "নতুন প্রতিবেদন",
    editArticle: "সম্পাদনা",
    deleteArticle: "মুছুন",
    manageStories: "প্রতিবেদন ব্যবস্থাপনা",
    title: "শিরোনাম",
    excerpt: "সারাংশ",
    body: "বিস্তারিত",
    category: "বিভাগ",
    uploadImage: "কভার ছবি আপলোড",
    save: "সংরক্ষণ",
    cancel: "বাতিল",
    searchPlaceholder: "প্রতিবেদন খুঁজুন…",
    footerCopy: "কলকাতা ও নয়াদিল্লি থেকে প্রকাশিত এক স্বাধীন দ্বিভাষিক সংবাদপত্র।",
    allRights: "সর্বস্বত্ব সংরক্ষিত।",
    signOutOk: "সাইন আউট হয়েছে।",
    invalidCred: "ভুল তথ্য।",
    noStories: "এখনও কোনো প্রতিবেদন নেই।",
    loginRequired: "চালিয়ে যেতে সাইন ইন করুন।",
  },
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem("rb-lang") || "en");

  useEffect(() => {
    localStorage.setItem("rb-lang", lang);
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  const toggle = useCallback(() => setLang((prev) => (prev === "en" ? "bn" : "en")), []);

  const t = useCallback(
    (key) => {
      const parts = key.split(".");
      let cur = dict[lang];
      for (const p of parts) {
        cur = cur?.[p];
        if (cur == null) return key;
      }
      return cur;
    },
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, toggle, t }),
    [lang, toggle, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be inside LanguageProvider");
  return ctx;
};

export const pick = (article, field, lang) => {
  if (!article) return "";
  const primary = article[`${field}_${lang}`];
  if (primary && primary.trim()) return primary;
  const fallbackLang = lang === "en" ? "bn" : "en";
  return article[`${field}_${fallbackLang}`] || "";
};
