import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { clearUser } from "../../store/slices/authSlice";
import { setCartItemCount } from "../../store/slices/cartSlice";
import api from "../../services/api";

/**
 * Custom hook for unified authentication logout across Customer and Admin interfaces.
 * 
 * Invokes backend endpoint POST /api/v1/auth/logout to destroy the server session
 * and clear the sessionId HTTP-only cookie.
 * Catches network or server errors to guarantee client-side cleanup occurs even if
 * the backend is unreachable, preventing stuck or inconsistent authenticated states.
 */
export function useLogout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async (redirectTo = "/login") => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("[Auth] Logout API encountered an error, continuing client cleanup:", err);
    } finally {
      dispatch(clearUser());
      dispatch(setCartItemCount(0));
      navigate(redirectTo);
    }
  };

  return { handleLogout };
}

export default useLogout;
