import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import Navbar from "../components/navigation/Navbar";
import Footer from "../components/navigation/Footer";
import api from "../services/api";
import { setUser } from "../store/slices/authSlice";

export default function MainLayout() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      api
        .get("/users/me")
        .then((res) => {
          if (isMounted && res.success && res.data?.user) {
            dispatch(setUser(res.data.user));
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [user, dispatch]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
