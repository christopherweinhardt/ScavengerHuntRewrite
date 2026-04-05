import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { HuntDetailPage } from "@/pages/HuntDetailPage";
import { HuntsListPage } from "@/pages/HuntsListPage";
import { LoginPage } from "@/pages/LoginPage";

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "");

export function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<HuntsListPage />} />
          <Route path="hunts/:huntId" element={<HuntDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
